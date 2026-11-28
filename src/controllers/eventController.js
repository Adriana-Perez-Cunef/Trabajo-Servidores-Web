const eventModel = require('../models/eventModel');

async function list(req, res, next) {
  try {
    const { q, from, to, price, city, limit, order, past } = req.query;
    const events = await eventModel.listEvents(req.user.id, {
      q,
      from,
      to,
      price: price ? Number(price) : undefined,
      city,
      limit,
      order,
      past: past === '1',
    });
    return res.json({ events });
  } catch (err) {
    return next(err);
  }
}

// Pantalla de inicio: evento del día, recomendados y planes de amigos
async function home(req, res, next) {
  try {
    const uid = req.user.id;
    const now = Date.now();
    const [todayList, recommended, friends] = await Promise.all([
      eventModel.listEvents(uid, {
        from: new Date(now - 6 * 3600 * 1000).toISOString(),
        to: new Date(now + 24 * 3600 * 1000).toISOString(),
        order: 'popular',
        limit: 1,
      }),
      eventModel.listEvents(uid, { order: 'popular', limit: 10 }),
      eventModel.listEvents(uid, { order: 'friends', onlyFriends: true, limit: 10 }),
    ]);
    return res.json({ today: todayList[0] || null, recommended, friends });
  } catch (err) {
    return next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const event = await eventModel.findById(req.user.id, req.params.id);
    if (!event) return res.status(404).json({ error: 'Evento no encontrado' });
    const friendsGoingUsers = await eventModel.friendsGoing(event.id, req.user.id);
    return res.json({ event, friendsGoingUsers });
  } catch (err) {
    return next(err);
  }
}

async function create(req, res, next) {
  try {
    const b = req.body;
    const id = await eventModel.create({
      title: b.title,
      venue: b.venue,
      address: b.address || '',
      city: b.city,
      startsAt: b.startsAt,
      priceTier: b.priceTier || 2,
      genre: b.genre || '',
      description: b.description || '',
      creatorId: req.user.id,
    });
    const event = await eventModel.findById(req.user.id, id);
    return res.status(201).json({ event });
  } catch (err) {
    return next(err);
  }
}

// Solo el creador del evento o un admin pueden borrarlo
async function remove(req, res, next) {
  try {
    const event = await eventModel.findById(req.user.id, req.params.id);
    if (!event) return res.status(404).json({ error: 'Evento no encontrado' });
    if (event.creatorId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Solo el creador puede borrar el evento' });
    }
    await eventModel.remove(event.id);
    return res.status(204).end();
  } catch (err) {
    return next(err);
  }
}

async function attend(req, res, next) {
  try {
    const event = await eventModel.findById(req.user.id, req.params.id);
    if (!event) return res.status(404).json({ error: 'Evento no encontrado' });
    await eventModel.attend(event.id, req.user.id);
    return res.status(201).json({ going: true });
  } catch (err) {
    return next(err);
  }
}

async function unattend(req, res, next) {
  try {
    await eventModel.unattend(req.params.id, req.user.id);
    return res.status(204).end();
  } catch (err) {
    return next(err);
  }
}

module.exports = { list, home, getOne, create, remove, attend, unattend };
