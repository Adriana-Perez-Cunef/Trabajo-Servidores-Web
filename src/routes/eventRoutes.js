const express = require('express');
const { body, param, query } = require('express-validator');
const validate = require('../middlewares/validate');
const { authenticate } = require('../middlewares/auth');
const events = require('../controllers/eventController');

const router = express.Router();
router.use(authenticate);

const idParam = param('id').isInt({ min: 1 }).withMessage('Id no válido').toInt();

const listRules = [
  query('q').optional().trim().isLength({ max: 60 }).withMessage('Búsqueda demasiado larga'),
  query('from').optional().isISO8601().withMessage('Fecha de inicio no válida'),
  query('to').optional().isISO8601().withMessage('Fecha de fin no válida'),
  query('price').optional().isInt({ min: 1, max: 3 }).withMessage('Precio no válido'),
  query('city').optional().trim().isLength({ max: 60 }).withMessage('Ciudad no válida'),
  query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('Límite no válido'),
  query('order').optional().isIn(['date', 'popular', 'friends', 'recent']).withMessage('Orden no válido'),
  query('past').optional().isIn(['0', '1']).withMessage('Valor no válido'),
];

const createRules = [
  body('title').trim().isLength({ min: 3, max: 80 }).withMessage('El nombre debe tener 3-80 caracteres'),
  body('venue').trim().isLength({ min: 2, max: 80 }).withMessage('La sala debe tener 2-80 caracteres'),
  body('address').optional().trim().isLength({ max: 120 }).withMessage('Dirección de máximo 120 caracteres'),
  body('city').trim().isLength({ min: 2, max: 60 }).withMessage('La ciudad debe tener 2-60 caracteres'),
  body('startsAt').isISO8601().withMessage('Fecha y hora no válidas'),
  body('priceTier').optional({ values: 'falsy' }).isInt({ min: 1, max: 3 }).withMessage('Precio no válido').toInt(),
  body('genre').optional().trim().isLength({ max: 40 }).withMessage('Género de máximo 40 caracteres'),
  body('description').optional().trim().isLength({ max: 600 }).withMessage('Descripción de máximo 600 caracteres'),
];

router.get('/', listRules, validate, events.list);
router.get('/home', events.home);
router.post('/', createRules, validate, events.create);

router.get('/:id', [idParam], validate, events.getOne);
router.delete('/:id', [idParam], validate, events.remove);
router.post('/:id/attend', [idParam], validate, events.attend);
router.delete('/:id/attend', [idParam], validate, events.unattend);

module.exports = router;
