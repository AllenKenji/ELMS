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

exports.getOverview = async (_req, res) => {
  try {
    const settingsRows = await safeQuery(
      `SELECT barangay_name
       FROM system_settings
       LIMIT 1`
    );

    const lguName = settingsRows[0]?.barangay_name || 'Local Government Unit';

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
              d.status,
              d.reading_stage,
              d.updated_at
       FROM (
         SELECT o.id,
                'Ordinance'::text AS document_type,
                o.ordinance_number AS reference_no,
                o.title,
                o.status,
                o.reading_stage,
                COALESCE(o.updated_at, o.created_at) AS updated_at
         FROM ordinances o

         UNION ALL

         SELECT r.id,
                'Resolution'::text AS document_type,
                r.resolution_number AS reference_no,
                r.title,
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
