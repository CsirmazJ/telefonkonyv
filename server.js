'use strict';

const express  = require('express');
const Database = require('better-sqlite3');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const path     = require('path');
const fs       = require('fs');

const app        = express();
const PORT       = parseInt(process.env.PORT || '3000');
const JWT_SECRET = process.env.JWT_SECRET || 'telefonkonyv-secret-change-me';
const DB_PATH    = process.env.DB_PATH    || path.join(__dirname, 'data', 'telefonkonyv.db');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Adatbázis inicializálás ───────────────────────────────────────────────────
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS units (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS employees (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    name      TEXT    NOT NULL,
    position  TEXT    NOT NULL DEFAULT '',
    phone     TEXT    NOT NULL DEFAULT '',
    email_1   TEXT    NOT NULL DEFAULT '',
    email_2   TEXT    NOT NULL DEFAULT '',
    email_3   TEXT    NOT NULL DEFAULT '',
    unit_id   INTEGER REFERENCES units(id) ON DELETE SET NULL,
    active    INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS users (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    username     TEXT UNIQUE NOT NULL,
    password     TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role         TEXT NOT NULL DEFAULT 'editor'
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    ts         TEXT    NOT NULL,
    user_id    INTEGER,
    username   TEXT,
    action     TEXT    NOT NULL,
    entity     TEXT    NOT NULL,
    entity_id  INTEGER,
    detail     TEXT
  );
`);

// sort_order oszlop hozzáadása meglévő adatbázishoz (migráció)
try {
  db.exec('ALTER TABLE units ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0');
} catch {}

// Alap adatok feltöltése (csak üres adatbázisnál)
const seed = db.transaction(() => {
  if (!db.prepare('SELECT 1 FROM units LIMIT 1').get()) {
    const ins = db.prepare('INSERT INTO units (name, sort_order) VALUES (?,?)');
    ['IT', 'HR', 'Értékesítés', 'Pénzügy', 'Logisztika'].forEach((n, i) => ins.run(n, i + 1));
  }
  if (!db.prepare('SELECT 1 FROM users LIMIT 1').get()) {
    db.prepare('INSERT INTO users (username,password,display_name,role) VALUES (?,?,?,?)')
      .run('admin', bcrypt.hashSync('admin123', 10), 'Főadmin', 'superadmin');
  }
  if (!db.prepare('SELECT 1 FROM settings LIMIT 1').get()) {
    const ins = db.prepare('INSERT OR IGNORE INTO settings (key,value) VALUES (?,?)');
    ins.run('title',     'Telefonkönyv');
    ins.run('employees', 'Munkatársak');
    ins.run('units',     'Egységek');
  }
});
seed();

// ── Audit log helper ──────────────────────────────────────────────────────────
const log = (user, action, entity, entityId, detail) => {
  try {
    db.prepare('INSERT INTO audit_log (ts,user_id,username,action,entity,entity_id,detail) VALUES (?,?,?,?,?,?,?)')
      .run(new Date().toISOString(), user?.id||null, user?.username||null, action, entity, entityId||null, detail||null);
  } catch (e) {
    console.error('Audit log hiba:', e);
  }
};

// ── Hitelesítés middleware ────────────────────────────────────────────────────
const auth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer '))
    return res.status(401).json({ error: 'Bejelentkezés szükséges' });
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Érvénytelen token – kérlek jelentkezz be újra' });
  }
};

const superadminOnly = (req, res, next) => {
  if (req.user?.role !== 'superadmin')
    return res.status(403).json({ error: 'Csak főadmin végezheti ezt a műveletet' });
  next();
};

// Segédfüggvény: employee sor normalizálása (active 0/1 → boolean)
const normalizeEmp = (e) => e ? { ...e, active: e.active === 1 } : null;

// ── Hitelesítési végpontok ────────────────────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password)
    return res.status(400).json({ error: 'Felhasználónév és jelszó szükséges' });

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Helytelen felhasználónév vagy jelszó!' });

  const payload = { id: user.id, username: user.username, role: user.role, displayName: user.display_name };
  const token   = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
  log(payload, 'LOGIN', 'users', user.id, null);
  res.json({ token, user: payload });
});

app.post('/api/auth/logout', auth, (req, res) => {
  log(req.user, 'LOGOUT', 'users', req.user.id, null);
  res.json({ ok: true });
});

// ── Egységek (units) ──────────────────────────────────────────────────────────
app.get('/api/units', (_req, res) => {
  res.json(db.prepare('SELECT * FROM units ORDER BY sort_order ASC, id ASC').all());
});

app.post('/api/units', auth, (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Név megadása kötelező' });
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order),0) as m FROM units').get().m;
  const r = db.prepare('INSERT INTO units (name, sort_order) VALUES (?,?)').run(name.trim(), maxOrder + 1);
  const unit = db.prepare('SELECT * FROM units WHERE id = ?').get(r.lastInsertRowid);
  log(req.user, 'CREATE', 'units', unit.id, name.trim());
  res.status(201).json(unit);
});

app.put('/api/units/:id', auth, (req, res) => {
  const { name } = req.body;
  db.prepare('UPDATE units SET name = ? WHERE id = ?').run(name, req.params.id);
  const unit = db.prepare('SELECT * FROM units WHERE id = ?').get(req.params.id);
  if (!unit) return res.status(404).json({ error: 'Nem található' });
  log(req.user, 'UPDATE', 'units', unit.id, name);
  res.json(unit);
});

app.delete('/api/units/:id', auth, (req, res) => {
  const unit = db.prepare('SELECT * FROM units WHERE id = ?').get(req.params.id);
  db.prepare('DELETE FROM units WHERE id = ?').run(req.params.id);
  log(req.user, 'DELETE', 'units', parseInt(req.params.id), unit?.name||null);
  res.json({ ok: true });
});

app.post('/api/units/reorder', auth, (req, res) => {
  const { id, direction } = req.body;
  const units = db.prepare('SELECT * FROM units ORDER BY sort_order ASC, id ASC').all();
  const idx = units.findIndex(u => u.id === id);
  if (idx < 0) return res.status(404).json({ error: 'Nem található' });
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= units.length) return res.json({ ok: true });
  const a = units[idx], b = units[swapIdx];
  const update = db.prepare('UPDATE units SET sort_order = ? WHERE id = ?');
  db.transaction(() => {
    update.run(b.sort_order, a.id);
    update.run(a.sort_order, b.id);
  })();
  log(req.user, 'REORDER', 'units', id, direction);
  res.json(db.prepare('SELECT * FROM units ORDER BY sort_order ASC, id ASC').all());
});

// ── Munkatársak (employees) ───────────────────────────────────────────────────
app.get('/api/employees', (req, res) => {
  const parts  = ['SELECT * FROM employees WHERE 1=1'];
  const params = [];

  if (req.query.unit_id === 'unassigned') {
    parts.push('AND unit_id IS NULL');
  } else if (req.query.unit_id) {
    parts.push('AND unit_id = ?');
    params.push(req.query.unit_id);
  }

  if (req.query.search) {
    const s = `%${req.query.search}%`;
    parts.push('AND (name LIKE ? OR position LIKE ? OR phone LIKE ? OR email_1 LIKE ? OR email_2 LIKE ? OR email_3 LIKE ?)');
    params.push(s, s, s, s, s, s);
  }

  parts.push('ORDER BY name');
  res.json(db.prepare(parts.join(' ')).all(...params).map(normalizeEmp));
});

app.post('/api/employees', auth, (req, res) => {
  const { name, position, phone, email_1, email_2, email_3, unit_id, active } = req.body;
  const r = db.prepare(
    'INSERT INTO employees (name,position,phone,email_1,email_2,email_3,unit_id,active) VALUES (?,?,?,?,?,?,?,?)'
  ).run(name, position||'', phone||'', email_1||'', email_2||'', email_3||'', unit_id||null, active?1:0);
  const emp = normalizeEmp(db.prepare('SELECT * FROM employees WHERE id = ?').get(r.lastInsertRowid));
  log(req.user, 'CREATE', 'employees', emp.id, name);
  res.status(201).json(emp);
});

app.put('/api/employees/:id', auth, (req, res) => {
  const { name, position, phone, email_1, email_2, email_3, unit_id, active } = req.body;
  db.prepare(
    'UPDATE employees SET name=?,position=?,phone=?,email_1=?,email_2=?,email_3=?,unit_id=?,active=? WHERE id=?'
  ).run(name, position||'', phone||'', email_1||'', email_2||'', email_3||'', unit_id||null, active?1:0, req.params.id);
  const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
  if (!emp) return res.status(404).json({ error: 'Nem található' });
  log(req.user, 'UPDATE', 'employees', emp.id, name);
  res.json(normalizeEmp(emp));
});

app.delete('/api/employees/:id', auth, (req, res) => {
  const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
  db.prepare('DELETE FROM employees WHERE id = ?').run(req.params.id);
  log(req.user, 'DELETE', 'employees', parseInt(req.params.id), emp?.name||null);
  res.json({ ok: true });
});

// ── Felhasználók (users) ──────────────────────────────────────────────────────
app.get('/api/users', auth, (req, res) => {
  res.json(
    db.prepare('SELECT id, username, display_name as displayName, role FROM users ORDER BY id').all()
  );
});

app.post('/api/users', auth, superadminOnly, (req, res) => {
  const { username, password, displayName, role } = req.body;
  if (!username?.trim() || !password?.trim())
    return res.status(400).json({ error: 'Felhasználónév és jelszó kötelező' });
  try {
    const r = db.prepare('INSERT INTO users (username,password,display_name,role) VALUES (?,?,?,?)')
      .run(username.trim(), bcrypt.hashSync(password, 10), displayName, role || 'editor');
    log(req.user, 'CREATE', 'users', r.lastInsertRowid, username.trim());
    res.status(201).json({ id: r.lastInsertRowid, username: username.trim(), displayName, role: role || 'editor' });
  } catch {
    res.status(409).json({ error: 'Ez a felhasználónév már foglalt' });
  }
});

app.put('/api/users/:id', auth, superadminOnly, (req, res) => {
  const { username, password, displayName, role } = req.body;
  if (password?.trim()) {
    db.prepare('UPDATE users SET username=?,password=?,display_name=?,role=? WHERE id=?')
      .run(username, bcrypt.hashSync(password, 10), displayName, role, req.params.id);
  } else {
    db.prepare('UPDATE users SET username=?,display_name=?,role=? WHERE id=?')
      .run(username, displayName, role, req.params.id);
  }
  log(req.user, 'UPDATE', 'users', parseInt(req.params.id), username);
  res.json({ id: parseInt(req.params.id), username, displayName, role });
});

app.delete('/api/users/:id', auth, superadminOnly, (req, res) => {
  const target      = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  const superCount  = db.prepare("SELECT COUNT(*) as c FROM users WHERE role='superadmin'").get().c;
  if (target?.role === 'superadmin' && superCount <= 1)
    return res.status(400).json({ error: 'Az utolsó főadmin nem törölhető!' });
  db.prepare('DELETE FROM users WHERE id=?').run(req.params.id);
  log(req.user, 'DELETE', 'users', parseInt(req.params.id), target?.username||null);
  res.json({ ok: true });
});

// ── Beállítások (settings) ────────────────────────────────────────────────────
app.get('/api/settings', (_req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const obj  = {};
  rows.forEach(r => obj[r.key] = r.value);
  res.json(obj);
});

app.put('/api/settings', auth, (req, res) => {
  const upsert = db.prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)');
  const txn    = db.transaction(data => Object.entries(data).forEach(([k, v]) => upsert.run(k, v)));
  txn(req.body);
  log(req.user, 'UPDATE', 'settings', null, JSON.stringify(req.body));
  res.json({ ok: true });
});

// ── Audit log ─────────────────────────────────────────────────────────────────
app.get('/api/audit', auth, superadminOnly, (req, res) => {
  const rows = db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 200').all();
  res.json(rows);
});

// ── SPA fallback (React Router kompatibilis) ──────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Szerver indítás ───────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Telefonkönyv szerver fut: http://localhost:${PORT}`);
  console.log(`📁 Adatbázis: ${DB_PATH}`);
});
