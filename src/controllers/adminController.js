const userModel = require('../models/userModel');

async function listUsers(req, res, next) {
  try {
    return res.json({ users: await userModel.listAll() });
  } catch (err) {
    return next(err);
  }
}

async function deleteUser(req, res, next) {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta de administrador' });
    }
    const user = await userModel.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    await userModel.remove(user.id);
    return res.status(204).end();
  } catch (err) {
    return next(err);
  }
}

module.exports = { listUsers, deleteUser };
