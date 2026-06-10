# ============================================================
# run-migrations.ps1
# Ejecuta los SQL de blueprints en orden, eliminando BOM UTF-8
# ============================================================

param(
    [string]$DBHost   = "localhost",
    [string]$Port     = "5432",
    [string]$Database = "rtype1",
    [string]$User     = "postgres",
    [string]$Password = ""          # o usa variable de entorno PGPASSWORD
)

# --- Configuracion -----------------------------------------------------------
$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$BlueprintDir = Join-Path $ScriptDir "data\blueprints"

# Orden correcto de ejecucion (etapa1 es el schema base, aqui empezamos en 2)
$SqlFiles = @(
    "etapa2_seguridad.sql",
    "etapa3_precios.sql",
    "etapa4_perfiles.sql",
    "etapa5_tienda.sql",
    "etapa6_geolocalizacion.sql",
    "etapa7_confianza.sql",
    "etapa8_pagos.sql",
    "etapa9_comunicacion.sql",
    "etapa10_equipate.sql",
    "etapa11_features.sql"
)

# --- Helpers -----------------------------------------------------------------
function Write-Step([string]$msg) {
    Write-Host "`n>>> $msg" -ForegroundColor Cyan
}
function Write-OK([string]$msg) {
    Write-Host "    [OK] $msg" -ForegroundColor Green
}
function Write-Fail([string]$msg) {
    Write-Host "    [FAIL] $msg" -ForegroundColor Red
}

# Elimina BOM UTF-8 (EF BB BF) y devuelve el contenido como string limpio
function Remove-BOM([string]$filePath) {
    $bytes = [System.IO.File]::ReadAllBytes($filePath)
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        $bytes = $bytes[3..($bytes.Length - 1)]
    }
    return [System.Text.Encoding]::UTF8.GetString($bytes)
}

# Escribe contenido sin BOM en un archivo temporal y devuelve su ruta
function Write-TempSQL([string]$content) {
    $tmp = [System.IO.Path]::GetTempFileName() + ".sql"
    [System.IO.File]::WriteAllText($tmp, $content, (New-Object System.Text.UTF8Encoding $false))
    return $tmp
}

# --- Verificar psql disponible -----------------------------------------------
Write-Step "Verificando que psql este disponible..."
$psqlExe = $null
$psqlCmd = Get-Command psql -ErrorAction SilentlyContinue
if ($psqlCmd) {
    $psqlExe = $psqlCmd.Source
    Write-OK "psql encontrado en PATH: $psqlExe"
} else {
    $fallbackPaths = @(
        "C:\Program Files\PostgreSQL\18\bin\psql.exe",
        "C:\Program Files\PostgreSQL\17\bin\psql.exe",
        "C:\Program Files\PostgreSQL\16\bin\psql.exe",
        "C:\Program Files\PostgreSQL\15\bin\psql.exe"
    )
    foreach ($path in $fallbackPaths) {
        if (Test-Path $path) {
            $psqlExe = $path
            Write-OK "psql no esta en PATH, usando: $psqlExe"
            break
        }
    }
    if (-not $psqlExe) {
        Write-Fail "psql no encontrado en PATH ni en rutas tipicas de PostgreSQL (v15/16/17/18)."
        exit 1
    }
}

# --- Variables de entorno para autenticacion ---------------------------------
if ($Password -ne "") {
    $env:PGPASSWORD = $Password
}

# Base de argumentos para psql
$PsqlArgs = @(
    "--host=${DBHost}",
    "--port=$Port",
    "--username=$User",
    "--dbname=$Database",
    "--set=ON_ERROR_STOP=1"   # detiene la ejecucion ante el primer error SQL
)

# --- Verificar conexion ------------------------------------------------------
Write-Step "Probando conexion a ${User}@${DBHost}:${Port}/${Database} ..."
$testResult = & $psqlExe @PsqlArgs --command="SELECT 1" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Fail "No se pudo conectar a la base de datos:"
    Write-Host $testResult -ForegroundColor Yellow
    exit 1
}
Write-OK "Conexion exitosa."

# --- Ejecutar migraciones ----------------------------------------------------
$errores   = @()
$exitosos  = @()

foreach ($file in $SqlFiles) {
    $filePath = Join-Path $BlueprintDir $file
    Write-Step "Ejecutando: $file"

    if (-not (Test-Path $filePath)) {
        Write-Fail "Archivo no encontrado: $filePath"
        $errores += $file
        continue
    }

    # Remover BOM y escribir archivo temporal limpio
    try {
        $cleanContent = Remove-BOM $filePath
        $tmpFile      = Write-TempSQL $cleanContent
    } catch {
        Write-Fail "Error al procesar BOM: $_"
        $errores += $file
        continue
    }

    # Ejecutar con psql - stderr a archivo separado para filtrar NOTICEs de errores reales
    $tmpStderr   = [System.IO.Path]::GetTempFileName()
    $stdout      = & $psqlExe @PsqlArgs --file="$tmpFile" 2>$tmpStderr
    $exitCode    = $LASTEXITCODE
    $stderrLines = if (Test-Path $tmpStderr) { Get-Content $tmpStderr } else { @() }
    Remove-Item $tmpStderr -ErrorAction SilentlyContinue

    # Limpiar temporal SQL
    Remove-Item $tmpFile -ErrorAction SilentlyContinue

    # NOTICEs y WARNINGs son informativos; solo ERROR/FATAL/PANIC son errores reales de SQL
    $notices    = @($stderrLines | Where-Object { $_ -match '^\s*(NOTICE|WARNING):' })
    $realErrors = @($stderrLines | Where-Object { $_ -match '^\s*(ERROR|FATAL|PANIC):'  })
    $hasFailed  = ($exitCode -ne 0) -or ($realErrors.Count -gt 0)

    if (-not $hasFailed) {
        Write-OK "$file ejecutado correctamente."
        if ($stdout)  { Write-Host ($stdout | Out-String).Trim() -ForegroundColor DarkGray }
        if ($notices) { Write-Host ($notices -join "`n")          -ForegroundColor DarkGray }
        $exitosos += $file
    } else {
        Write-Fail "Error en $file (exit code $exitCode):"
        if ($realErrors) { Write-Host ($realErrors -join "`n")      -ForegroundColor Yellow }
        if ($stdout)     { Write-Host ($stdout | Out-String).Trim() -ForegroundColor Yellow }
        $errores += $file

        # Preguntar si continuar o abortar
        $resp = Read-Host "  Continuar con las siguientes etapas? (s/N)"
        if ($resp -notmatch '^[sS]') {
            Write-Host "`nMigracion interrumpida por el usuario." -ForegroundColor Red
            break
        }
    }
}

# --- Resumen -----------------------------------------------------------------
Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host " RESUMEN" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " Exitosos  : $($exitosos.Count)" -ForegroundColor Green
if ($exitosos.Count -gt 0) {
    $exitosos | ForEach-Object { Write-Host "   - $_" -ForegroundColor Green }
}
if ($errores.Count -gt 0) {
    Write-Host " Con errores: $($errores.Count)" -ForegroundColor Red
    $errores | ForEach-Object { Write-Host "   - $_" -ForegroundColor Red }
    exit 1
}
Write-Host "`nTodas las migraciones completadas correctamente." -ForegroundColor Green
exit 0
