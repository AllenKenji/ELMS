const pool = require('../db');

function normalizeMeasureType(measureType) {
  const type = String(measureType || '').toLowerCase();
  if (type === 'ordinance' || type === 'resolution') return type;

  const err = new Error('Invalid measure type. Expected ordinance or resolution.');
  err.status = 400;
  throw err;
}

function getMeasureConfig(measureType) {
  const type = normalizeMeasureType(measureType);
  if (type === 'ordinance') {
    return {
      table: 'ordinances',
      numberField: 'ordinance_number',
      type,
    };
  }

  return {
    table: 'resolutions',
    numberField: 'resolution_number',
    type,
  };
}

exports.getTemplates = async ({ measureType, userId, favoritesOnly = false, historyOnly = false, limit = 50 }) => {
  const cfg = getMeasureConfig(measureType);
  const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 200));

  const params = [cfg.type, Number(userId), safeLimit];
  const where = ["m.status <> 'Draft'"];

  if (favoritesOnly) {
    where.push('COALESCE(p.is_favorite, FALSE) = TRUE');
  }

  if (historyOnly) {
    where.push('p.last_used_at IS NOT NULL');
  }

  const query = `
    SELECT
      m.id,
      m.title,
      m.${cfg.numberField} AS measure_number,
      m.status,
      m.created_at,
      m.updated_at,
      COALESCE(p.is_favorite, FALSE) AS is_favorite,
      p.last_used_at,
      COALESCE(p.used_count, 0) AS used_count
    FROM ${cfg.table} m
    LEFT JOIN measure_template_preferences p
      ON p.measure_type = $1
      AND p.measure_id = m.id
      AND p.user_id = $2
    WHERE ${where.join(' AND ')}
    ORDER BY COALESCE(p.is_favorite, FALSE) DESC,
             COALESCE(p.last_used_at, m.updated_at, m.created_at) DESC,
             m.created_at DESC
    LIMIT $3
  `;

  const result = await pool.query(query, params);
  return result.rows;
};

exports.toggleFavorite = async ({ measureType, measureId, userId, isFavorite }) => {
  const cfg = getMeasureConfig(measureType);
  const id = Number(measureId);

  const exists = await pool.query(`SELECT id FROM ${cfg.table} WHERE id = $1`, [id]);
  if (!exists.rows.length) {
    const err = new Error(`${cfg.type} not found`);
    err.status = 404;
    throw err;
  }

  const result = await pool.query(
    `INSERT INTO measure_template_preferences (user_id, measure_type, measure_id, is_favorite, used_count, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 0, NOW(), NOW())
     ON CONFLICT (user_id, measure_type, measure_id)
     DO UPDATE SET is_favorite = EXCLUDED.is_favorite, updated_at = NOW()
     RETURNING *`,
    [Number(userId), cfg.type, id, Boolean(isFavorite)]
  );

  return result.rows[0];
};

exports.markUsed = async ({ measureType, measureId, userId }) => {
  const cfg = getMeasureConfig(measureType);
  const id = Number(measureId);

  const exists = await pool.query(`SELECT id FROM ${cfg.table} WHERE id = $1`, [id]);
  if (!exists.rows.length) {
    const err = new Error(`${cfg.type} not found`);
    err.status = 404;
    throw err;
  }

  const result = await pool.query(
    `INSERT INTO measure_template_preferences (user_id, measure_type, measure_id, is_favorite, last_used_at, used_count, created_at, updated_at)
     VALUES ($1, $2, $3, FALSE, NOW(), 1, NOW(), NOW())
     ON CONFLICT (user_id, measure_type, measure_id)
     DO UPDATE SET last_used_at = NOW(), used_count = measure_template_preferences.used_count + 1, updated_at = NOW()
     RETURNING *`,
    [Number(userId), cfg.type, id]
  );

  return result.rows[0];
};
