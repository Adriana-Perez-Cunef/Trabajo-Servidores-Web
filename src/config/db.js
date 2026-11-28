const { Client } = require('pg');
const { databaseUrl } = require('./env');

// Conexión a PostgreSQL con pg (Client). Se conecta una vez al arrancar el servidor (ver server.js).
const db = new Client({ connectionString: databaseUrl });

db.on('error', (err) => {
  console.error('Error en la conexión con PostgreSQL:', err.message);
  process.exit(1); // Docker reinicia el contenedor (restart: unless-stopped)
});

module.exports = db;
