const db = require('../config/db');

const COLS =
  'id, username, email, role, full_name, bio, is_private, allow_requests, share_activity, created_at';

function toUser(r) {
  if (!r) return null;
  return {
    id: r.id,
    username: r.username,
    email: r.email,
    role: r.role,
    fullName: r.full_name,
    bio: r.bio,
    isPrivate: r.is_private,
    allowRequests: r.allow_requests,
    shareActivity: r.share_activity,
    createdAt: r.created_at,
  };
}

function escapeLike(text) {
  return text.replace(/[\\%_]/g, '\\$&');
}

async function create({ username, email, passwordHash, role = 'user', fullName }) {
  const { rows } = await db.query(
    `INSERT INTO users (username, email, password_hash, role, full_name)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${COLS}`,
    [username, email, passwordHash, role, fullName || username]
  );
  return toUser(rows[0]);
}

// Devuelve la fila completa (incluye password_hash): solo para el login
async function findRawByEmail(email) {
  const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await db.query(`SELECT ${COLS} FROM users WHERE id = $1`, [id]);
  return toUser(rows[0]);
}

// Solo se cambian los campos recibidos; el resto conserva su valor actual
async function updateProfile(id, changes) {
  const current = await findById(id);
  if (!current) return null;
  const { rows } = await db.query(
    `UPDATE users SET username = $2, full_name = $3, bio = $4 WHERE id = $1 RETURNING ${COLS}`,
    [
      id,
      changes.username !== undefined ? changes.username : current.username,
      changes.fullName !== undefined ? changes.fullName : current.fullName,
      changes.bio !== undefined ? changes.bio : current.bio,
    ]
  );
  return toUser(rows[0]);
}

async function updateSettings(id, changes) {
  const current = await findById(id);
  if (!current) return null;
  const pick = (value, old) => (value !== undefined ? value : old);
  const { rows } = await db.query(
    `UPDATE users SET is_private = $2, allow_requests = $3, share_activity = $4 WHERE id = $1 RETURNING ${COLS}`,
    [
      id,
      pick(changes.isPrivate, current.isPrivate),
      pick(changes.allowRequests, current.allowRequests),
      pick(changes.shareActivity, current.shareActivity),
    ]
  );
  return toUser(rows[0]);
}

// Búsqueda de personas, con el estado de seguimiento del usuario que busca
async function search(q, viewerId, limit = 20) {
  const { rows } = await db.query(
    `SELECT u.id, u.username, u.full_name, u.is_private, f.status
       FROM users u
       LEFT JOIN follows f ON f.follower_id = $1 AND f.followee_id = u.id
      WHERE u.id <> $1
        AND (LOWER(u.username) LIKE $2 OR LOWER(u.full_name) LIKE $2)
      ORDER BY u.username
      LIMIT $3`,
    [viewerId, `%${escapeLike(q.toLowerCase())}%`, limit]
  );
  return rows.map((r) => ({
    id: r.id,
    username: r.username,
    fullName: r.full_name,
    isPrivate: r.is_private,
    relation: r.status || 'none',
  }));
}

async function listAll() {
  const { rows } = await db.query(`SELECT ${COLS} FROM users ORDER BY id`);
  return rows.map(toUser);
}

async function remove(id) {
  await db.query('DELETE FROM users WHERE id = $1', [id]);
}

module.exports = {
  create,
  findRawByEmail,
  findById,
  updateProfile,
  updateSettings,
  search,
  listAll,
  remove,
  toUser,
};
