const userModel = require('../models/userModel');
const followModel = require('../models/followModel');
const eventModel = require('../models/eventModel');

async function getMe(req, res, next) {
  try {
    const user = await userModel.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    return res.json({ user });
  } catch (err) {
    return next(err);
  }
}

async function updateMe(req, res, next) {
  try {
    const { username, fullName, bio } = req.body;
    const user = await userModel.updateProfile(req.user.id, {
      username,
      fullName,
      bio,
    });
    return res.json({ user });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ese nombre de usuario ya está en uso' });
    }
    return next(err);
  }
}

async function updateSettings(req, res, next) {
  try {
    const { isPrivate, allowRequests, shareActivity } = req.body;
    const user = await userModel.updateSettings(req.user.id, {
      isPrivate,
      allowRequests,
      shareActivity,
    });
    return res.json({ user });
  } catch (err) {
    return next(err);
  }
}

async function search(req, res, next) {
  try {
    const users = await userModel.search(req.query.q, req.user.id);
    return res.json({ users });
  } catch (err) {
    return next(err);
  }
}

// Perfil de un usuario. Si la cuenta es privada y no la sigo, solo se ve lo básico.
async function getProfile(req, res, next) {
  try {
    const targetId = req.params.id;
    const target = await userModel.findById(targetId);
    if (!target) return res.status(404).json({ error: 'Usuario no encontrado' });

    const isSelf = target.id === req.user.id;
    const isAdmin = req.user.role === 'admin';
    const status = isSelf ? null : await followModel.getStatus(req.user.id, target.id);
    const canSee = isSelf || isAdmin || !target.isPrivate || status === 'accepted';
    const showActivity = canSee && (isSelf || isAdmin || target.shareActivity);
    const { followers, following } = await followModel.counts(target.id);

    let upcoming = [];
    let past = [];
    if (showActivity) {
      [upcoming, past] = await Promise.all([
        eventModel.listEvents(req.user.id, { attendeeId: target.id, order: 'date', limit: 20 }),
        eventModel.listEvents(req.user.id, {
          attendeeId: target.id,
          past: true,
          order: 'recent',
          limit: 20,
        }),
      ]);
    }

    return res.json({
      user: {
        id: target.id,
        username: target.username,
        fullName: target.fullName,
        bio: canSee ? target.bio : '',
        isPrivate: target.isPrivate,
        acceptsRequests: target.allowRequests,
      },
      relation: isSelf ? 'self' : status || 'none',
      canSee,
      showActivity,
      followers,
      following,
      upcoming,
      past,
    });
  } catch (err) {
    return next(err);
  }
}

async function follow(req, res, next) {
  try {
    const targetId = req.params.id;
    if (targetId === req.user.id) {
      return res.status(400).json({ error: 'No puedes seguirte a ti mismo' });
    }
    const target = await userModel.findById(targetId);
    if (!target) return res.status(404).json({ error: 'Usuario no encontrado' });

    const current = await followModel.getStatus(req.user.id, targetId);
    if (current) return res.json({ status: current });

    if (!target.allowRequests) {
      return res.status(403).json({ error: 'Este usuario no acepta solicitudes de seguimiento' });
    }
    // En cuentas privadas la solicitud queda pendiente hasta que el usuario la acepte
    const status = target.isPrivate ? 'pending' : 'accepted';
    await followModel.create(req.user.id, targetId, status);
    return res.status(201).json({ status });
  } catch (err) {
    return next(err);
  }
}

async function unfollow(req, res, next) {
  try {
    await followModel.remove(req.user.id, req.params.id);
    return res.status(204).end();
  } catch (err) {
    return next(err);
  }
}

async function listRequests(req, res, next) {
  try {
    return res.json({ requests: await followModel.pendingRequests(req.user.id) });
  } catch (err) {
    return next(err);
  }
}

async function acceptRequest(req, res, next) {
  try {
    const ok = await followModel.accept(req.params.id, req.user.id);
    if (!ok) return res.status(404).json({ error: 'Solicitud no encontrada' });
    return res.json({ status: 'accepted' });
  } catch (err) {
    return next(err);
  }
}

async function rejectRequest(req, res, next) {
  try {
    const ok = await followModel.reject(req.params.id, req.user.id);
    if (!ok) return res.status(404).json({ error: 'Solicitud no encontrada' });
    return res.status(204).end();
  } catch (err) {
    return next(err);
  }
}

async function friends(req, res, next) {
  try {
    const [list, pending] = await Promise.all([
      followModel.friends(req.user.id),
      followModel.pendingRequests(req.user.id),
    ]);
    return res.json({ friends: list, pendingRequests: pending.length });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getMe,
  updateMe,
  updateSettings,
  search,
  getProfile,
  follow,
  unfollow,
  listRequests,
  acceptRequest,
  rejectRequest,
  friends,
};
