const db = require('../config/db');

// $1 siempre es el id del usuario que consulta (para "voy", "amigos que van", etc.)
const SELECT_EVENT = `
  SELECT e.id, e.title, e.venue, e.address, e.city, e.starts_at, e.price_tier,
         e.genre, e.description, e.creator_id, cu.username AS creator_username,
         (SELECT COUNT(*) FROM event_attendees a WHERE a.event_id = e.id) AS attendees,
         (SELECT COUNT(*) FROM event_attendees a WHERE a.event_id = e.id AND a.user_id = $1) AS going,
         (SELECT COUNT(*)
            FROM event_attendees a
            JOIN follows f ON f.followee_id = a.user_id AND f.follower_id = $1 AND f.status = 'accepted'
            JOIN users au ON au.id = a.user_id AND au.share_activity
           WHERE a.event_id = e.id) AS friends_going
    FROM events e
    JOIN users cu ON cu.id = e.creator_id`;

const ORDERS = {
  date: 't.starts_at ASC',
  popular: 't.attendees DESC, t.starts_at ASC',
  friends: 't.friends_going DESC, t.starts_at ASC',
  recent: 't.starts_at DESC',
};

function escapeLike(text) {
  return text.replace(/[\\%_]/g, '\\$&');
}

function toEvent(r) {
  return {
    id: r.id,
    title: r.title,
    venue: r.venue,
    address: r.address,
    city: r.city,
    startsAt: r.starts_at,
    priceTier: r.price_tier,
    genre: r.genre,
    description: r.description,
    creatorId: r.creator_id,
    creatorUsername: r.creator_username,
    attendees: Number(r.attendees),
    going: Number(r.going) > 0,
    friendsGoing: Number(r.friends_going),
  };
}

// Listado con filtros. Todos los valores van como parámetros (sin concatenar texto del usuario).
async function listEvents(viewerId, o = {}) {
  const params = [viewerId];
  const add = (value) => {
    params.push(value);
    return `$${params.length}`;
  };
  const where = [];

  if (o.id) where.push(`e.id = ${add(o.id)}`);
  if (o.q) {
    const p = add(`%${escapeLike(o.q.toLowerCase())}%`);
    where.push(
      `(LOWER(e.title) LIKE ${p} OR LOWER(e.venue) LIKE ${p} OR LOWER(e.genre) LIKE ${p} OR LOWER(e.address) LIKE ${p})`
    );
  }
  if (o.from) where.push(`e.starts_at >= ${add(o.from)}`);
  if (o.to) where.push(`e.starts_at < ${add(o.to)}`);
  // Un evento sigue "en curso" hasta 6 horas después de su inicio
  const cutoff = new Date(Date.now() - 6 * 3600 * 1000);
  if (o.past) where.push(`e.starts_at < ${add(cutoff)}`);
  else if (!o.from && !o.id) where.push(`e.starts_at >= ${add(cutoff)}`);
  if (o.price) where.push(`e.price_tier = ${add(o.price)}`);
  if (o.city) where.push(`LOWER(e.city) = LOWER(${add(o.city)})`);
  if (o.attendeeId) {
    where.push(
      `(SELECT COUNT(*) FROM event_attendees x WHERE x.event_id = e.id AND x.user_id = ${add(o.attendeeId)}) > 0`
    );
  }

  const outer = o.onlyFriends ? 'WHERE t.friends_going > 0' : '';
  const order = ORDERS[o.order] || ORDERS.date;
  const limit = Math.min(Number(o.limit) || 50, 200);
  const sql = `SELECT * FROM (${SELECT_EVENT}${where.length ? ` WHERE ${where.join(' AND ')}` : ''}) t
               ${outer} ORDER BY ${order} LIMIT ${limit}`;

  const { rows } = await db.query(sql, params);
  return rows.map(toEvent);
}

async function findById(viewerId, id) {
  const [event] = await listEvents(viewerId, { id });
  return event || null;
}

async function create(data) {
  const { rows } = await db.query(
    `INSERT INTO events
       (title, venue, address, city, starts_at, price_tier, genre, description, creator_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      data.title,
      data.venue,
      data.address,
      data.city,
      data.startsAt,
      data.priceTier,
      data.genre,
      data.description,
      data.creatorId,
    ]
  );
  return rows[0].id;
}

async function remove(id) {
  await db.query('DELETE FROM events WHERE id = $1', [id]);
}

// Si ya estaba apuntado, la clave primaria (event_id, user_id) lo impide: se ignora el error 23505
async function attend(eventId, userId) {
  try {
    await db.query('INSERT INTO event_attendees (event_id, user_id) VALUES ($1, $2)', [eventId, userId]);
  } catch (err) {
    if (err.code !== '23505') throw err;
  }
}

async function unattend(eventId, userId) {
  await db.query('DELETE FROM event_attendees WHERE event_id = $1 AND user_id = $2', [
    eventId,
    userId,
  ]);
}

// Amigos (a los que sigo) que van al evento y comparten su actividad
async function friendsGoing(eventId, viewerId) {
  const { rows } = await db.query(
    `SELECT u.id, u.username, u.full_name
       FROM event_attendees a
       JOIN follows f ON f.followee_id = a.user_id AND f.follower_id = $2 AND f.status = 'accepted'
       JOIN users u ON u.id = a.user_id AND u.share_activity
      WHERE a.event_id = $1
      ORDER BY u.username
      LIMIT 8`,
    [eventId, viewerId]
  );
  return rows.map((r) => ({
    id: r.id,
    username: r.username,
    fullName: r.full_name,
  }));
}

module.exports = { listEvents, findById, create, remove, attend, unattend, friendsGoing };
