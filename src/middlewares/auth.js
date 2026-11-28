const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/env');

// Autenticación: exige un token JWT válido en la cabecera Authorization: Bearer <token>
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Token de autenticación requerido' });
  }
  try {
    const payload = jwt.verify(token, jwtSecret);
    req.user = { id: payload.id, username: payload.username, role: payload.role };
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o caducado' });
  }
}

// Autorización por rol
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: 'No tienes permisos para esta acción' });
    }
    return next();
  };
}

module.exports = { authenticate, requireRole };
