// Datos de demostración: se crean solo si la tabla de eventos está vacía y SEED_DEMO_DATA no es "false".
const bcrypt = require('bcrypt');
const db = require('./config/db');
const userModel = require('./models/userModel');
const { adminPassword } = require('./config/env');

async function ensureUser({ username, email, password, role, fullName, bio }) {
  const existing = await db.query('SELECT id FROM users WHERE username = $1', [username]);
  if (existing.rows[0]) return existing.rows[0].id;
  const user = await userModel.create({
    username,
    email,
    passwordHash: await bcrypt.hash(password, 10),
    role,
    fullName,
  });
  await db.query('UPDATE users SET bio = $2 WHERE id = $1', [user.id, bio]);
  return user.id;
}

// Las horas son relativas a "ahora", así que siempre hay eventos próximos para la demo
const DEMO_EVENTS = [
  ['DJx en Copérnico', 'Sala Copérnico', 'Calle Gran Vía 12', 'Madrid', 5, 2, 'Techno', 'Noche de techno con DJx y sesión especial hasta el amanecer.'],
  ['ECLIPSE', 'Eclipse Club', 'Calle Alcalá 90', 'Madrid', 8, 2, 'Techno', 'Luces láser y los mejores DJs de techno de la ciudad.'],
  ['RUBICON', 'Rubicon', 'Calle Mallorca 5', 'Madrid', 29, 2, 'House', 'House y deep house toda la noche en la pista principal.'],
  ['RIVIERA', 'Riviera', 'Calle Goya 4', 'Madrid', 51, 3, 'Reggaeton', 'Fiesta latina con reservados y barra libre de bienvenida.'],
  ['ATTA', 'Atta Club', 'Calle Serrano 25', 'Madrid', 75, 2, 'Electrónica', 'Electrónica y visuales inmersivos en dos salas.'],
  ['OH MY CLUB', 'Oh My Club', 'Calle Fuencarral 70', 'Madrid', 99, 1, 'Pop', 'Hits de los 2000 y los éxitos del momento. Entrada económica.'],
  ['VANDALS Night', 'Sala Vandals', 'Calle Atocha 40', 'Madrid', 123, 1, 'Rock', 'Rock alternativo, indie y conciertos en directo.'],
  ['NOCHE RETRO', 'Sala Copérnico', 'Calle Gran Vía 12', 'Madrid', -50, 1, 'Pop', 'Una noche de clásicos que ya pasó (evento anterior de demostración).'],
];

async function seedDemoData() {
  const { rows } = await db.query('SELECT COUNT(*) AS n FROM events');
  if (Number(rows[0].n) > 0) return;

  const adminId = await ensureUser({
    username: 'hive_admin',
    email: 'admin@hive.local',
    password: adminPassword,
    role: 'admin',
    fullName: 'HIVE Madrid',
    bio: 'Cuenta oficial de administración',
  });
  const demoPassword = 'Demo1234!';
  const claudia = await ensureUser({
    username: 'claudia_perez', email: 'claudia@hive.local', password: demoPassword,
    role: 'user', fullName: 'Claudia Pérez', bio: 'Techno, house y buena compañía',
  });
  const alvaro = await ensureUser({
    username: 'alvaro_soriano', email: 'alvaro@hive.local', password: demoPassword,
    role: 'user', fullName: 'Álvaro Soriano', bio: 'DJ aficionado. Siempre en primera fila',
  });
  const sofia = await ensureUser({
    username: 'sofia_martin', email: 'sofia@hive.local', password: demoPassword,
    role: 'user', fullName: 'Sofía Martín', bio: 'Reggaeton y fiesta',
  });

  const attendance = [
    [claudia, alvaro], [claudia, sofia, alvaro], [alvaro], [sofia, claudia],
    [claudia], [sofia], [alvaro, sofia], [claudia, alvaro],
  ];

  for (let i = 0; i < DEMO_EVENTS.length; i += 1) {
    const [title, venue, address, city, hours, price, genre, description] = DEMO_EVENTS[i];
    // Fecha relativa a "ahora": hora en punto actual + N horas
    const startsAt = new Date();
    startsAt.setMinutes(0, 0, 0);
    startsAt.setHours(startsAt.getHours() + hours);
    const created = await db.query(
      `INSERT INTO events (title, venue, address, city, starts_at, price_tier, genre, description, creator_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [title, venue, address, city, startsAt, price, genre, description, adminId]
    );
    for (const userId of attendance[i]) {
      await db.query(
        'INSERT INTO event_attendees (event_id, user_id) VALUES ($1, $2)',
        [created.rows[0].id, userId]
      );
    }
  }
  console.log('Datos de demostración creados (usuarios hive_admin, claudia_perez, alvaro_soriano, sofia_martin).');
}

module.exports = { seedDemoData };
