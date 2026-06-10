const fs   = require("fs");
const os   = require("os");
const path = require("path");
const request = require("supertest");
const app     = require("./app");
const { limpiarTablas, registrarYLogin } = require("./helpers");
const childProcess = require("child_process");
const { EventEmitter } = require("events");
const { PassThrough }  = require("stream");

// ─── cleanOldBackups ──────────────────────────────────────────────────────────

describe("cleanOldBackups", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `backup-clean-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    process.env.BACKUP_DIR = tmpDir;
  });

  afterEach(() => {
    delete process.env.BACKUP_DIR;
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("mantiene los N más recientes y elimina los sobrantes", async () => {
    const nombres = [
      "backup-2024-01-01-0300.sql.gz",
      "backup-2024-01-02-0300.sql.gz",
      "backup-2024-01-03-0300.sql.gz",
      "backup-2024-01-04-0300.sql.gz",
      "backup-2024-01-05-0300.sql.gz",
    ];
    for (let i = 0; i < nombres.length; i++) {
      const fp = path.join(tmpDir, nombres[i]);
      fs.writeFileSync(fp, `contenido ${i}`);
      const d = new Date(2024, 0, i + 1);
      fs.utimesSync(fp, d, d);
    }

    const { cleanOldBackups } = require("../services/backup.service");
    const { eliminados } = await cleanOldBackups(3);

    expect(eliminados).toBe(2);
    expect(fs.readdirSync(tmpDir).length).toBe(3);
    expect(fs.existsSync(path.join(tmpDir, "backup-2024-01-05-0300.sql.gz"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, "backup-2024-01-04-0300.sql.gz"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, "backup-2024-01-03-0300.sql.gz"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, "backup-2024-01-01-0300.sql.gz"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, "backup-2024-01-02-0300.sql.gz"))).toBe(false);
  });

  test("no falla con directorio vacío", async () => {
    const { cleanOldBackups } = require("../services/backup.service");
    const { eliminados } = await cleanOldBackups(7);
    expect(eliminados).toBe(0);
  });

  test("no elimina nada si hay menos archivos que keepLast", async () => {
    fs.writeFileSync(path.join(tmpDir, "backup-2024-01-01-0300.sql.gz"), "data");
    const { cleanOldBackups } = require("../services/backup.service");
    const { eliminados } = await cleanOldBackups(7);
    expect(eliminados).toBe(0);
    expect(fs.readdirSync(tmpDir).length).toBe(1);
  });
});

// ─── runBackup (mock spawn) ───────────────────────────────────────────────────

describe("runBackup genera archivo comprimido", () => {
  let tmpDir;
  let spawnSpy;

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `backup-run-${Date.now()}`);
    process.env.BACKUP_DIR = tmpDir;
  });

  afterEach(() => {
    spawnSpy && spawnSpy.mockRestore();
    delete process.env.BACKUP_DIR;
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("crea archivo .sql.gz en BACKUP_DIR cuando pg_dump sale con código 0", async () => {
    let capturedProc;

    spawnSpy = jest.spyOn(childProcess, "spawn").mockImplementationOnce(() => {
      const proc   = new EventEmitter();
      const stdout = new PassThrough();
      const stderr = new PassThrough();
      proc.stdout = stdout;
      proc.stderr = stderr;
      capturedProc = proc;

      setImmediate(() => {
        stdout.push("-- PostgreSQL dump mock\n");
        stdout.push(null); // end stream
      });

      return proc;
    });

    const { runBackup } = require("../services/backup.service");
    const runPromise = runBackup();

    // Esperar a que el pipeline de streams termine, luego emitir close
    await new Promise((r) => setTimeout(r, 200));
    capturedProc.emit("close", 0);

    const result = await runPromise;

    expect(result.filename).toMatch(/^backup-\d{4}-\d{2}-\d{2}-\d{4}\.sql\.gz$/);
    expect(fs.existsSync(result.filePath)).toBe(true);
    expect(result.size).toBeGreaterThan(0);
  });

  test("rechaza la promesa cuando pg_dump sale con código distinto de 0", async () => {
    let capturedProc;

    spawnSpy = jest.spyOn(childProcess, "spawn").mockImplementationOnce(() => {
      const proc   = new EventEmitter();
      const stdout = new PassThrough();
      const stderr = new PassThrough();
      proc.stdout = stdout;
      proc.stderr = stderr;
      capturedProc = proc;

      setImmediate(() => { stdout.push(null); });

      return proc;
    });

    const { runBackup } = require("../services/backup.service");
    const runPromise = runBackup();

    await new Promise((r) => setTimeout(r, 100));
    capturedProc.emit("close", 1);

    await expect(runPromise).rejects.toThrow("pg_dump terminó con código 1");
  });
});

// ─── GET /api/admin/backups ───────────────────────────────────────────────────

describe("GET /api/admin/backups", () => {
  let pool;
  let tokenAdmin;
  let tokenComun;

  beforeAll(async () => {
    pool = require("../config/db");
    await limpiarTablas();

    tokenComun = await registrarYLogin({ email: "comun.backup@test.com", tipo_perfil: "dueno" });
    tokenAdmin = await registrarYLogin({ email: "admin.backup@test.com", tipo_perfil: "dueno" });

    const { rows: [adminUser] } = await pool.query(
      "SELECT id FROM usuarios WHERE email = $1",
      ["admin.backup@test.com"]
    );
    await pool.query("UPDATE usuarios SET es_admin = TRUE WHERE id = $1", [adminUser.id]);
  });

  afterAll(async () => {
    await pool.end();
  });

  test("sin token → 401", async () => {
    const res = await request(app).get("/api/admin/backups");
    expect(res.status).toBe(401);
  });

  test("usuario común → 403", async () => {
    const res = await request(app)
      .get("/api/admin/backups")
      .set("Authorization", `Bearer ${tokenComun}`);
    expect(res.status).toBe(403);
  });

  test("admin → 200 con lista de backups", async () => {
    const backupSvc = require("../services/backup.service");
    const spy = jest.spyOn(backupSvc, "getBackupStatus").mockResolvedValueOnce({
      backups: [
        { nombre: "backup-2024-01-01-0300.sql.gz", tamanio: 2048, fecha: new Date("2024-01-01T03:00:00Z") },
      ],
      total: 1,
    });

    const res = await request(app)
      .get("/api/admin/backups")
      .set("Authorization", `Bearer ${tokenAdmin}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.backups)).toBe(true);
    expect(res.body.total).toBe(1);
    expect(res.body.backups[0].nombre).toBe("backup-2024-01-01-0300.sql.gz");

    spy.mockRestore();
  });
});
