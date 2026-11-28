const express = require('express');
const { param } = require('express-validator');
const validate = require('../middlewares/validate');
const { authenticate, requireRole } = require('../middlewares/auth');
const admin = require('../controllers/adminController');

const router = express.Router();
router.use(authenticate, requireRole('admin'));

router.get('/users', admin.listUsers);
router.delete(
  '/users/:id',
  [param('id').isInt({ min: 1 }).withMessage('Id no válido').toInt()],
  validate,
  admin.deleteUser
);

module.exports = router;
