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
      { id: 4, role_name: 'Vice Mayor' },
      { id: 5, role_name: 'Resident' },
      { id: 6, role_name: 'Committee Secretary' },
    ];

    const users = [
      { name: 'Admin User', email: 'admin@elegislative.local', password: 'admin123', role_id: 1 },
      { name: 'Secretary User', email: 'sec@elegislative.local', password: 'sec123', role_id: 2 },
      { name: 'Councilor User', email: 'councilor@elegislative.local', password: 'councilor123', role_id: 3 },
      { name: 'Vice Mayor User', email: 'vicemayor@elegislative.local', password: 'vicemayor123', role_id: 4 },
      { name: 'Resident User', email: 'resident@elegislative.local', password: 'resident123', role_id: 5 },
      { name: 'Committee Secretary User', email: 'commsec@elegislative.local', password: 'commsec123', role_id: 6 },
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

    // Fetch the admin and councilor user IDs for sample drafts
    const adminRes = await pool.query(`SELECT id, name FROM users WHERE email = 'admin@elegislative.local'`);
    const councilorRes = await pool.query(`SELECT id, name FROM users WHERE email = 'councilor@elegislative.local'`);
    const secretaryRes = await pool.query(`SELECT id, name FROM users WHERE email = 'sec@elegislative.local'`);

    const adminUser = adminRes.rows[0];
    const councilorUser = councilorRes.rows[0];
    const secretaryUser = secretaryRes.rows[0];

    // Sample draft ordinances
    const sampleOrdinances = [
      {
        title: 'Barangay Cleanliness and Sanitation Ordinance',
        ordinance_number: 'ORD-2025-001',
        description: 'An ordinance establishing guidelines for maintaining cleanliness and proper sanitation in all public and private areas within the barangay.',
        content: `WHEREAS, the maintenance of cleanliness and proper sanitation is essential to public health and the well-being of all residents;\n\nWHEREAS, it is the duty of the local government to ensure a clean and healthy environment for its constituents;\n\nNOW, THEREFORE, be it ordained by the Sangguniang Barangay that:\n\nSection 1. All establishments and residences shall maintain cleanliness within their respective premises.\n\nSection 2. Garbage segregation into biodegradable, non-biodegradable, and hazardous waste shall be strictly observed.\n\nSection 3. Violation of this ordinance shall be subject to fines as prescribed herein.`,
        remarks: 'Pending review by the health committee',
        proposer_id: adminUser?.id,
        proposer_name: adminUser?.name,
      },
      {
        title: 'Traffic Safety Management Ordinance',
        ordinance_number: 'ORD-2025-002',
        description: 'An ordinance regulating traffic flow, parking, and road safety measures within the barangay to reduce accidents and ensure orderly movement of vehicles and pedestrians.',
        content: `WHEREAS, the increasing number of vehicles has created traffic congestion and safety hazards;\n\nWHEREAS, the protection of pedestrians and motorists is a primary responsibility of the local government;\n\nNOW, THEREFORE, be it ordained by the Sangguniang Barangay that:\n\nSection 1. Designated parking zones shall be established along main roads within the barangay.\n\nSection 2. Overspeeding within the barangay is strictly prohibited. Maximum speed limit is 30 km/h.\n\nSection 3. All motorists must observe traffic signs and signals installed by the barangay.\n\nSection 4. Violators shall be subject to appropriate penalties as stated in this ordinance.`,
        remarks: null,
        proposer_id: councilorUser?.id,
        proposer_name: councilorUser?.name,
      },
    ];

    // Sample draft resolutions
    const sampleResolutions = [
      {
        title: 'Resolution Commending Outstanding Community Service',
        resolution_number: 'RES-2025-001',
        description: 'A resolution commending and recognizing the outstanding contributions of barangay volunteers during the recent disaster relief operations.',
        content: `WHEREAS, the recent flooding incident severely affected several families within the barangay;\n\nWHEREAS, a group of dedicated volunteers selflessly rendered aid and assistance to affected residents;\n\nNOW, THEREFORE, be it resolved by the Sangguniang Barangay that:\n\nSection 1. The Sangguniang Barangay hereby commends and recognizes the outstanding service rendered by the barangay volunteers during the relief operations.\n\nSection 2. A certificate of recognition shall be awarded to each volunteer in a public ceremony.\n\nSection 3. This resolution shall take effect immediately upon approval.`,
        remarks: 'To be presented at the next barangay assembly',
        proposer_id: secretaryUser?.id,
        proposer_name: secretaryUser?.name,
      },
      {
        title: 'Resolution Endorsing the Barangay Economic Development Program',
        resolution_number: 'RES-2025-002',
        description: 'A resolution endorsing and supporting the implementation of the Barangay Economic Development Program aimed at livelihood assistance and small business support for residents.',
        content: `WHEREAS, many residents of the barangay are in need of sustainable livelihood opportunities;\n\nWHEREAS, the Barangay Economic Development Program has been designed to address unemployment and support small-scale entrepreneurs;\n\nNOW, THEREFORE, be it resolved by the Sangguniang Barangay that:\n\nSection 1. The Sangguniang Barangay hereby endorses and supports the implementation of the Barangay Economic Development Program.\n\nSection 2. The barangay shall allocate funds from the annual budget for livelihood training and microfinance assistance.\n\nSection 3. A monitoring committee shall be formed to oversee the progress of the program.`,
        remarks: null,
        proposer_id: councilorUser?.id,
        proposer_name: councilorUser?.name,
      },
    ];

    // Insert sample draft ordinances (skip if title already exists as Draft)
    for (const ord of sampleOrdinances) {
      await pool.query(
        `INSERT INTO ordinances (title, ordinance_number, description, content, remarks, proposer_id, proposer_name, status, created_at)
         SELECT $1, $2, $3, $4, $5, $6, $7, 'Draft', NOW()
         WHERE NOT EXISTS (
           SELECT 1 FROM ordinances WHERE title = $8 AND status = 'Draft'
         )`,
        [ord.title, ord.ordinance_number, ord.description, ord.content, ord.remarks, ord.proposer_id, ord.proposer_name, ord.title]
      );
    }

    // Insert sample draft resolutions (skip if title already exists as Draft)
    for (const res of sampleResolutions) {
      await pool.query(
        `INSERT INTO resolutions (title, resolution_number, description, content, remarks, proposer_id, proposer_name, status, created_at)
         SELECT $1, $2, $3, $4, $5, $6, $7, 'Draft', NOW()
         WHERE NOT EXISTS (
           SELECT 1 FROM resolutions WHERE title = $8 AND status = 'Draft'
         )`,
        [res.title, res.resolution_number, res.description, res.content, res.remarks, res.proposer_id, res.proposer_name, res.title]
      );
    }

    console.log('✅ Seeded sample draft ordinances and resolutions successfully');
  } catch (err) {
    console.error('❌ Seeding error:', err);
  } finally {
    pool.end();
  }
}

seed();
