# Sistema de Backups — Labu

## Descripción

El sistema genera backups comprimidos de la base de datos PostgreSQL (`rtype1`) usando `pg_dump` + `gzip`. Los archivos se guardan en la carpeta `backups/` con el formato `backup-YYYY-MM-DD-HH.sql.gz`. Se mantienen automáticamente los últimos **7 backups**, eliminando los más viejos.

---

## Scripts disponibles

### Hacer backup manual

```bash
# Desde la carpeta backend/
npm run backup

# O directamente:
node scripts/backup.js
```

### Listar backups disponibles

```bash
node scripts/restore.js --list
```

### Restaurar desde un backup

```bash
# Desde la carpeta backend/
npm run restore backup-2026-04-09-02.sql.gz

# O directamente:
node scripts/restore.js backup-2026-04-09-02.sql.gz
```

> **Advertencia:** la restauración sobreescribe la base de datos actual. Asegúrate de tener un backup reciente antes de restaurar.

---

## Variables de entorno necesarias

Agregar al archivo `.env` del backend:

```env
# Directorio donde se guardan los backups (absoluto o relativo al proyecto)
DB_BACKUP_PATH=/var/backups/rtype1

# Contraseña de PostgreSQL usada por pg_dump/psql (si no está en .pgpass)
PGPASSWORD_BACKUP=tu_password_postgres

# (Opcional) Ruta completa al ejecutable pg_dump si no está en PATH
PG_DUMP_PATH=/usr/bin/pg_dump

# (Opcional) Ruta completa al ejecutable psql si no está en PATH
PSQL_PATH=/usr/bin/psql
```

---

## Configurar backup automático en producción (Linux/macOS)

### Con cron

Editar el crontab del servidor:

```bash
crontab -e
```

Agregar la línea para ejecutar el backup todos los días a las 2 AM:

```cron
0 2 * * * cd /ruta/al/proyecto/backend && /usr/bin/node scripts/backup.js >> /var/log/rtype1-backup.log 2>&1
```

Ejemplos de otras frecuencias:

```cron
# Cada 6 horas
0 */6 * * * cd /ruta/al/proyecto/backend && node scripts/backup.js >> /var/log/rtype1-backup.log 2>&1

# Cada hora
0 * * * * cd /ruta/al/proyecto/backend && node scripts/backup.js >> /var/log/rtype1-backup.log 2>&1
```

### Con PM2 (si ya usas PM2 para el servidor)

```bash
# Agregar tarea cron a PM2
pm2 start /ruta/al/proyecto/backend/scripts/backup.js --name rtype1-backup --cron "0 2 * * *" --no-autorestart
pm2 save
```

---

## Estructura de archivos

```
backups/                        ← directorio configurable con DB_BACKUP_PATH
├── backup-2026-04-09-02.sql.gz
├── backup-2026-04-08-02.sql.gz
├── backup-2026-04-07-02.sql.gz
└── ...  (máximo 7 archivos)

backend/scripts/
├── backup.js    ← genera el backup
└── restore.js   ← restaura desde un archivo
```

---

## Notas para Windows (desarrollo local)

En Windows el ejecutable está en `C:\Program Files\PostgreSQL\18\bin\`. Configurar en `.env`:

```env
PG_DUMP_PATH=C:\Program Files\PostgreSQL\18\bin\pg_dump.exe
PSQL_PATH=C:\Program Files\PostgreSQL\18\bin\psql.exe
```

O agregar `C:\Program Files\PostgreSQL\18\bin\` al PATH del sistema para no necesitar configurarlo.
