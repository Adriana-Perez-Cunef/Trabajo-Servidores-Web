function notFound(req, res) {
  res.status(404).json({ error: 'Recurso no encontrado' });
}

// Manejador global: no filtra detalles internos al cliente
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON mal formado' });
  }
  if (err.code === '23503') {
    return res.status(409).json({ error: 'La referencia indicada ya no existe' });
  }
  console.error(err);
  return res.status(500).json({ error: 'Error interno del servidor' });
}

module.exports = { notFound, errorHandler };
