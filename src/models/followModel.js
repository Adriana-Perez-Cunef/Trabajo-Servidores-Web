const db = require('../config/db');

async function getStatus(followerId, followeeId) {
  const { rows } = await db.query(
    'SELECT status FROM follows WHERE follower_id = $1 AND followee_id = $2',
    [followerId, followeeId]
  );
  return rows[0] ? rows[0].status : null;
}

async function create(followerId, followeeId, status) {
  try {
    await db.query('INSERT INTO follows (follower_id, followee_id, status) VALUES ($1, $2, $3)', [
      followerId,
      followeeId,
      status,
    ]);
  } catch (err) {
    if (err.code !== '23505') throw err; // ya existía la relación
  }
}

// Dejar de seguir o cancelar una solicitud pendiente
async function remove(followerId, followeeId) {
  await db.query('DELETE FROM follows WHERE follower_id = $1 AND followee_id = $2', [
    followerId,
    followeeId,
  ]);
}

// El usuario `followeeId` acepta la solicitud de `followerId`
async function accept(followerId, followeeId) {
  const { rowCount } = await db.query(
    `UPDATE follows SET status = 'accepted'
      WHERE follower_id = $1 AND followee_id = $2 AND status = 'pending'`,
    [followerId, followeeId]
  );
  return rowCount > 0;
}

async function reject(followerId, followeeId) {
  const { rowCount } = await db.query(
    `DELETE FROM follows
      WHERE follower_id = $1 AND followee_id = $2 AND status = 'pending'`,
    [followerId, followeeId]
  );
  return rowCount > 0;
}

async function pendingRequests(userId) {
  const { rows } = await db.query(
    `SELECT u.id, u.username, u.full_name
       FROM follows f
       JOIN users u ON u.id = f.follower_id
      WHERE f.followee_id = $1 AND f.status = 'pending'
      ORDER BY f.created_at DESC`,
    [userId]
  );
  return rows.map((r) => ({
    id: r.id,
    username: r.username,
    fullName: r.full_name,
  }));
}

async function counts(userId) {
  const { rows } = await db.query(
    `SELECT
       (SELECT COUNT(*) FROM follows WHERE followee_id = $1 AND status = 'accepted') AS followers,
       (SELECT COUNT(*) FROM follows WHERE follower_id = $1 AND status = 'accepted') AS following`,
    [userId]
  );
  return { followers: Number(rows[0].followers), following: Number(rows[0].following) };
}

// Usuarios a los que sigo, con el próximo evento al que asisten (si comparten su actividad)
async function friends(userId) {
  const { rows } = await db.query(
    `SELECT u.id, u.username, u.full_name,
            CASE WHEN u.share_activity THEN
              (SELECT e.title
                 FROM event_attendees a
                 JOIN events e ON e.id = a.event_id
                WHERE a.user_id = u.id AND e.starts_at >= $2
                ORDER BY e.starts_at
                LIMIT 1)
            END AS next_event
       FROM follows f
       JOIN users u ON u.id = f.followee_id
      WHERE f.follower_id = $1 AND f.status = 'accepted'
      ORDER BY u.username`,
    [userId, new Date(Date.now() - 6 * 3600 * 1000)]
  );
  return rows.map((r) => ({
    id: r.id,
    username: r.username,
    fullName: r.full_name,
    nextEvent: r.next_event,
  }));
}

module.exports = { getStatus, create, remove, accept, reject, pendingRequests, counts, friends };
