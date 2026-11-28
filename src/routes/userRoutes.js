const express = require('express');
const { body, param, query } = require('express-validator');
const validate = require('../middlewares/validate');
const { authenticate } = require('../middlewares/auth');
const users = require('../controllers/userController');

const router = express.Router();
router.use(authenticate);

const idParam = param('id').isInt({ min: 1 }).withMessage('Id no válido').toInt();

// --- Mi cuenta (rutas /me antes que /:id) ---
router.get('/me', users.getMe);

router.patch(
  '/me',
  [
    body('username')
      .optional()
      .trim()
      .matches(/^[A-Za-z0-9_]{3,30}$/)
      .withMessage('El usuario debe tener 3-30 caracteres (letras, números o _)'),
    body('fullName').optional().trim().isLength({ max: 60 }).withMessage('Nombre de máximo 60 caracteres'),
    body('bio').optional().trim().isLength({ max: 160 }).withMessage('Biografía de máximo 160 caracteres'),
  ],
  validate,
  users.updateMe
);

router.patch(
  '/me/settings',
  [
    body('isPrivate').optional().isBoolean().withMessage('Valor no válido').toBoolean(),
    body('allowRequests').optional().isBoolean().withMessage('Valor no válido').toBoolean(),
    body('shareActivity').optional().isBoolean().withMessage('Valor no válido').toBoolean(),
  ],
  validate,
  users.updateSettings
);

router.get('/me/friends', users.friends);
router.get('/me/requests', users.listRequests);
router.post('/me/requests/:id/accept', [idParam], validate, users.acceptRequest);
router.delete('/me/requests/:id', [idParam], validate, users.rejectRequest);

// --- Otros usuarios ---
router.get(
  '/search',
  [query('q').trim().isLength({ min: 2, max: 40 }).withMessage('Escribe al menos 2 caracteres')],
  validate,
  users.search
);

router.get('/:id', [idParam], validate, users.getProfile);
router.post('/:id/follow', [idParam], validate, users.follow);
router.delete('/:id/follow', [idParam], validate, users.unfollow);

module.exports = router;
