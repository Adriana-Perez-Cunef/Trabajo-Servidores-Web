const express = require('express');
const { body } = require('express-validator');
const validate = require('../middlewares/validate');
const auth = require('../controllers/authController');

const router = express.Router();

router.post(
  '/register',
  [
    body('username')
      .trim()
      .matches(/^[A-Za-z0-9_]{3,30}$/)
      .withMessage('El usuario debe tener 3-30 caracteres (letras, números o _)'),
    body('email').trim().isEmail().withMessage('Correo no válido').normalizeEmail(),
    body('password')
      .isLength({ min: 8, max: 72 })
      .withMessage('La contraseña debe tener 8-72 caracteres'),
    body('confirmPassword')
      .custom((value, { req }) => value === req.body.password)
      .withMessage('Las contraseñas no coinciden'),
  ],
  validate,
  auth.register
);

router.post(
  '/login',
  [
    body('email').trim().isEmail().withMessage('Correo no válido').normalizeEmail(),
    body('password').isString().notEmpty().withMessage('Contraseña requerida'),
  ],
  validate,
  auth.login
);

module.exports = router;
