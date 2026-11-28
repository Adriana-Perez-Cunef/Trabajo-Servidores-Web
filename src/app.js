const path = require('path');
const express = require('express');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const eventRoutes = require('./routes/eventRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { notFound, errorHandler } = require('./middlewares/errorHandler');

const app = express();
app.disable('x-powered-by');

// Documentación de la API (Swagger UI). Se monta antes de helmet porque necesita scripts en línea.
try {
  const openapi = YAML.load(path.join(__dirname, '..', 'docs', 'openapi.yaml'));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapi));
} catch (err) {
  console.error('No se pudo cargar docs/openapi.yaml:', err.message);
}

// Cabeceras de seguridad con helmet (con la configuración por defecto de clase).
// Única excepción: se desactivan HSTS y 'upgrade-insecure-requests' porque la app se sirve por http en
// local (Safari dejaba de cargar los scripts). En producción, con HTTPS, se dejarían activados.
app.use(
  helmet({
    hsts: false,
    contentSecurityPolicy: { useDefaults: true, directives: { 'upgrade-insecure-requests': null } },
  })
);
app.use(express.json({ limit: '10kb' }));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/admin', adminRoutes);

// Frontend estático
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api', notFound);
app.use(errorHandler);

module.exports = app;
