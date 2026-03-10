// seed.js
const pool = require('./db');
const bcrypt = require('bcrypt');

async function seed() {
  try {
    // Define roles and users in one place
    const roles = [
      { id: 1, role_name: 'Admin' },
      { id: 2, role_name: 'Secretary' },
      { id: 3, role_name: 'Councilor' },
      { id: 4, role_name: 'Captain' },
      { id: 5, role_name: 'Resident' },
      { id: 6, role_name: 'DILG Official' },
    ];

    const users = [
      { name: 'Admin User', email: 'admin@elegislative.local', password: 'admin123', role_id: 1 },
      { name: 'Secretary User', email: 'sec@elegislative.local', password: 'sec123', role_id: 2 },
      { name: 'Councilor User', email: 'councilor@elegislative.local', password: 'councilor123', role_id: 3 },
      { name: 'Captain User', email: 'captain@elegislative.local', password: 'captain123', role_id: 4 },
      { name: 'Resident User', email: 'resident@elegislative.local', password: 'resident123', role_id: 5 },
      { name: 'DILG User', email: 'dilg@elegislative.local', password: 'dilg123', role_id: 6 },
    ];

    // Seed roles
    for (const role of roles) {
      await pool.query(
        `INSERT INTO roles (id, role_name)
         VALUES ($1, $2)
         ON CONFLICT (id) DO NOTHING`,
        [role.id, role.role_name]
      );
    }

    // Seed users
    for (const user of users) {
      const hash = await bcrypt.hash(user.password, 10);
      await pool.query(
        `INSERT INTO users (name, email, password_hash, role_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO NOTHING`,
        [user.name, user.email, hash, user.role_id]
      );
    }

    console.log('✅ Seeded roles and users successfully');
  } catch (err) {
    console.error('❌ Seeding error:', err);
  } finally {
    pool.end();
  }
}

seed();
