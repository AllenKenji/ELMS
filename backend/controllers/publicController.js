const pool = require('../db');

async function safeQuery(text, params = []) {
  try {
    const result = await pool.query(text, params);
    return result.rows;
  } catch (err) {
    console.error('Public query failed:', err.message);
    return [];
  }
}

function getBranding(lguName) {
  const publicBaseUrl = String(process.env.PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '');
  const logoUrl = process.env.PUBLIC_LGU_LOGO_URL || (publicBaseUrl ? `${publicBaseUrl}/public-assets/lgu-logo.png` : '/public-assets/lgu-logo.png');
  const sealUrl = process.env.PUBLIC_LGU_SEAL_URL || (publicBaseUrl ? `${publicBaseUrl}/public-assets/lgu-seal.png` : '/public-assets/lgu-seal.png');

  return {
    logoUrl,
    sealUrl,
    officeName: process.env.PUBLIC_OFFICE_NAME || `${lguName} Legislative Office`,
    address: process.env.PUBLIC_OFFICE_ADDRESS || 'Municipal Hall, Main Civic Center',
    phone: process.env.PUBLIC_OFFICE_PHONE || '(000) 000-0000',
    email: process.env.PUBLIC_OFFICE_EMAIL || 'legislative.office@lgu.gov.ph',
    officeHours: process.env.PUBLIC_OFFICE_HOURS || 'Monday to Friday, 8:00 AM to 5:00 PM',
  };
}

async function getLguName() {
  const settingsRows = await safeQuery(
    `SELECT barangay_name
     FROM system_settings
     LIMIT 1`
  );

  return settingsRows[0]?.barangay_name || 'Local Government Unit';
}

exports.getOverview = async (_req, res) => {
  try {
    const lguName = await getLguName();
    const branding = getBranding(lguName);

    const councilors = await safeQuery(
      `SELECT u.id,
              u.name,
              r.role_name AS role,
              u.e_profile_photo_url AS photo_url
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE r.role_name IN ('Vice Mayor', 'Councilor', 'Secretary')
       ORDER BY
         CASE r.role_name
           WHEN 'Vice Mayor' THEN 1
           WHEN 'Councilor' THEN 2
           WHEN 'Secretary' THEN 3
           ELSE 4
         END,
         u.name ASC`
    );

    const legislativeDocuments = await safeQuery(
      `SELECT d.id,
              d.document_type,
              d.reference_no,
              d.title,
              d.description,
              d.status,
              d.reading_stage,
              d.updated_at
       FROM (
         SELECT o.id,
                'Ordinance'::text AS document_type,
                o.ordinance_number AS reference_no,
                o.title,
                o.description,
                o.status,
                o.reading_stage,
                COALESCE(o.updated_at, o.created_at) AS updated_at
         FROM ordinances o

         UNION ALL

         SELECT r.id,
                'Resolution'::text AS document_type,
                r.resolution_number AS reference_no,
                r.title,
            r.description,
                r.status,
                r.reading_stage,
                COALESCE(r.updated_at, r.created_at) AS updated_at
         FROM resolutions r
       ) d
       ORDER BY d.updated_at DESC NULLS LAST
       LIMIT 12`
    );

    const committees = await safeQuery(
      `SELECT c.id,
              c.name,
              c.description,
              c.status,
              u.name AS chair_name,
              COUNT(cm.id)::int AS member_count
       FROM committees c
       LEFT JOIN users u ON u.id = c.chair_id
       LEFT JOIN committee_members cm ON cm.committee_id = c.id
       GROUP BY c.id, u.name
       ORDER BY c.created_at DESC
       LIMIT 8`
    );

    const scheduledSessions = await safeQuery(
      `SELECT s.id,
              s.title,
              s.date,
              s.session_time,
              s.location,
              s.agenda
       FROM sessions s
       WHERE s.date >= CURRENT_DATE
       ORDER BY s.date ASC, s.session_time ASC NULLS LAST
       LIMIT 8`
    );

    const scheduledMeetings = await safeQuery(
      `SELECT cm.id,
              cm.title,
              cm.meeting_date,
              cm.meeting_time,
              cm.meeting_location,
              cm.meeting_mode,
              cm.meeting_link,
              c.name AS committee_name
       FROM committee_meetings cm
       LEFT JOIN committees c ON c.id = cm.committee_id
       WHERE cm.meeting_date >= CURRENT_DATE
         AND COALESCE(cm.ended, false) = false
       ORDER BY cm.meeting_date ASC, cm.meeting_time ASC NULLS LAST
       LIMIT 8`
    );

    res.json({
      lguName,
      branding,
      about: `${lguName} eLegislative portal provides transparent access to council composition, legislative documents, committee structure, and public schedules.`,
      councilors,
      legislativeDocuments,
      committees,
      scheduledSessions,
      scheduledMeetings,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Public overview error:', err);
    res.status(500).json({ error: 'Failed to load public overview' });
  }
};

exports.getCouncilorDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await safeQuery(
      `SELECT u.id,
              u.name,
              u.email,
              u.e_profile_photo_url AS photo_url,
              r.role_name AS role
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1
         AND r.role_name IN ('Vice Mayor', 'Councilor', 'Secretary')
       LIMIT 1`,
      [id]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Councilor not found' });
    }

    const committeeMemberships = await safeQuery(
      `SELECT c.id,
              c.name,
              c.status,
              cm.role AS committee_role
       FROM committee_members cm
       JOIN committees c ON c.id = cm.committee_id
       WHERE cm.user_id = $1
       ORDER BY c.name ASC`,
      [id]
    );

    return res.json({
      ...rows[0],
      bio: `${rows[0].name} serves in the ${rows[0].role || 'legislative'} office of ${await getLguName()}.`,
      committeeMemberships,
    });
  } catch (err) {
    console.error('Public councilor detail error:', err);
    return res.status(500).json({ error: 'Failed to load councilor details' });
  }
};

exports.getCommitteeDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await safeQuery(
      `SELECT c.id,
              c.name,
              c.description,
              c.status,
              u.name AS chair_name
       FROM committees c
       LEFT JOIN users u ON u.id = c.chair_id
       WHERE c.id = $1
       LIMIT 1`,
      [id]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Committee not found' });
    }

    const members = await safeQuery(
      `SELECT cm.id,
              cm.role,
              u.id AS user_id,
              u.name,
              u.email
       FROM committee_members cm
       JOIN users u ON u.id = cm.user_id
       WHERE cm.committee_id = $1
       ORDER BY
         CASE cm.role
           WHEN 'Chair' THEN 1
           WHEN 'Vice Chair' THEN 2
           WHEN 'Committee Secretary' THEN 3
           ELSE 4
         END,
         u.name ASC`,
      [id]
    );

    const upcomingMeetings = await safeQuery(
      `SELECT id,
              title,
              meeting_date,
              meeting_time,
              meeting_location,
              meeting_mode,
              meeting_link
       FROM committee_meetings
       WHERE committee_id = $1
         AND meeting_date >= CURRENT_DATE
         AND COALESCE(ended, false) = false
       ORDER BY meeting_date ASC, meeting_time ASC NULLS LAST
       LIMIT 6`,
      [id]
    );

    return res.json({
      ...rows[0],
      members,
      upcomingMeetings,
    });
  } catch (err) {
    console.error('Public committee detail error:', err);
    return res.status(500).json({ error: 'Failed to load committee details' });
  }
};

exports.getDocumentDetails = async (req, res) => {
  try {
    const { id, type } = req.params;
    const normalizedType = String(type || '').trim().toLowerCase();

    let text = null;
    if (normalizedType === 'ordinance') {
      text = `SELECT o.id,
                     'Ordinance'::text AS document_type,
                     o.ordinance_number AS reference_no,
                     o.title,
                     o.description,
                     o.content,
                     o.remarks,
                     o.status,
                     o.reading_stage,
                     o.proposer_name,
                     COALESCE(o.updated_at, o.created_at) AS updated_at
              FROM ordinances o
              WHERE o.id = $1
              LIMIT 1`;
    }

    if (normalizedType === 'resolution') {
      text = `SELECT r.id,
                     'Resolution'::text AS document_type,
                     r.resolution_number AS reference_no,
                     r.title,
                     r.description,
                     r.content,
                     r.remarks,
                     r.status,
                     r.reading_stage,
                     r.proposer_name,
                     COALESCE(r.updated_at, r.created_at) AS updated_at
              FROM resolutions r
              WHERE r.id = $1
              LIMIT 1`;
    }

    if (!text) {
      return res.status(400).json({ error: 'Unsupported document type' });
    }

    const rows = await safeQuery(text, [id]);
    if (!rows[0]) {
      return res.status(404).json({ error: 'Document not found' });
    }

    return res.json(rows[0]);
  } catch (err) {
    console.error('Public document detail error:', err);
    return res.status(500).json({ error: 'Failed to load document details' });
  }
};
