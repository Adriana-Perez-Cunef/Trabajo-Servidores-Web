const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { jwtSecret, jwtExpiresIn } = require('../config/env');
const userModel = require('../models/userModel');

// Hash falso para igualar tiempos de respuesta cuando el email no existe
const DUMMY_HASH = bcrypt.hashSync('dummy-password', 10);

function signToken(user) {
  return jwt.sign({ id: user.id, username: user.username, role: user.role }, jwtSecret, {
    expiresIn: jwtExpiresIn,
  });
}

async function register(req, res, next) {
  try {
    const { username, email, password } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await userModel.create({ username, email, passwordHash });
    return res.status(201).json({ user, token: signToken(user) });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'El usuario o el email ya están registrados' });
    }
    return next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const row = await userModel.findRawByEmail(email);
    const ok = await bcrypt.compare(password, row ? row.password_hash : DUMMY_HASH);
    if (!row || !ok) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }
    const user = userModel.toUser(row);
    return res.json({ user, token: signToken(user) });
  } catch (err) {
    return next(err);
  }
}

module.exports = { register, login };
