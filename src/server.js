const { port, seedDemoData: seedEnabled } = require('./config/env');
const app = require('./app');
const db = require('./config/db');
const { seedDemoData } = require('./bootstrap');

async function start() {
  await db.connect();
  if (seedEnabled) {
    try {
      await seedDemoData();
    } catch (err) {
      console.error('No se pudieron crear los datos de demostración:', err.message);
    }
  }
  app.listen(port, () => {
    console.log(`HIVE escuchando en http://localhost:${port}`);
  });
}

start();
