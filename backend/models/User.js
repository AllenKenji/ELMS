/**
 * User Model - Data access layer for user operations.
 */
const pool = require('../db');

/** @returns {Promise<import('pg').QueryResult>} */
exports.ensureSignatureColumn = async () => {
  return pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS e_signature_url TEXT,
    ADD COLUMN IF NOT EXISTS e_signature_data BYTEA,
    ADD COLUMN IF NOT EXISTS e_signature_mime_type TEXT,
    ADD COLUMN IF NOT EXISTS e_profile_photo_url TEXT,
    ADD COLUMN IF NOT EXISTS e_profile_photo_data BYTEA,
    ADD COLUMN IF NOT EXISTS e_profile_photo_mime_type TEXT;
  `);
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.findAll = async () => {
  return pool.query(
    `SELECT u.id, u.name, u.email, u.role_id, u.e_signature_url, u.e_profile_photo_url,
            (u.e_signature_data IS NOT NULL) AS e_signature_has_data,
            (u.e_profile_photo_data IS NOT NULL) AS e_profile_photo_has_data,
            r.role_name, r.role_name AS role
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id`
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.findById = async (id) => {
  return pool.query('SELECT * FROM users WHERE id = $1', [id]);
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.findByEmail = async (email) => {
  return pool.query('SELECT * FROM users WHERE email = $1', [email]);
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.create = async (name, email, passwordHash, roleId) => {
  return pool.query(
    `INSERT INTO users (name, email, password_hash, role_id)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [name, email, passwordHash, roleId]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.updateRole = async (id, roleId) => {
  return pool.query(
    'UPDATE users SET role_id = $1 WHERE id = $2 RETURNING id, name, email, role_id, e_signature_url, e_profile_photo_url',
    [roleId, id]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.deleteById = async (client, id) => {
  return client.query('DELETE FROM users WHERE id = $1', [id]);
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.findWithRoleById = async (id) => {
  return pool.query(
    `SELECT u.id, u.name, u.email, u.e_signature_url, u.e_profile_photo_url, r.role_name
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE u.id = $1`,
    [id]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.updateSignatureAsset = async (id, signatureUrl, signatureData, signatureMimeType) => {
  return pool.query(
    `UPDATE users
     SET e_signature_url = $1,
         e_signature_data = $2,
         e_signature_mime_type = $3,
         updated_at = NOW()
     WHERE id = $4
     RETURNING id, name, email, role_id, e_signature_url, e_signature_mime_type`,
    [signatureUrl, signatureData, signatureMimeType, id]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.findSignatureById = async (id) => {
  return pool.query(
    'SELECT id, name, e_signature_url, e_signature_data, e_signature_mime_type FROM users WHERE id = $1',
    [id]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.findSignatureByName = async (name) => {
  return pool.query(
    `SELECT id, name, e_signature_url, e_signature_data, e_signature_mime_type,
            e_profile_photo_url, e_profile_photo_data, e_profile_photo_mime_type
     FROM users
     WHERE LOWER(REGEXP_REPLACE(TRIM(name), '\\s+', ' ', 'g')) = LOWER(REGEXP_REPLACE(TRIM($1), '\\s+', ' ', 'g'))
     LIMIT 1`,
    [name]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.findSignatureByRoleNames = async (roleNames) => {
  return pool.query(
    `SELECT u.id, u.name, u.e_signature_url, u.e_signature_data, u.e_signature_mime_type,
            u.e_profile_photo_url, u.e_profile_photo_data, u.e_profile_photo_mime_type, r.role_name
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE r.role_name = ANY($1::text[])
       AND (
         (u.e_signature_url IS NOT NULL AND TRIM(u.e_signature_url) <> '')
         OR u.e_signature_data IS NOT NULL
       )
     ORDER BY u.id ASC
     LIMIT 1`,
    [roleNames]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.updateProfilePhotoAsset = async (id, photoUrl, photoData, photoMimeType) => {
  return pool.query(
    `UPDATE users
     SET e_profile_photo_url = $1,
         e_profile_photo_data = $2,
         e_profile_photo_mime_type = $3,
         updated_at = NOW()
     WHERE id = $4
     RETURNING id, name, email, role_id, e_profile_photo_url, e_profile_photo_mime_type`,
    [photoUrl, photoData, photoMimeType, id]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.findProfilePhotoById = async (id) => {
  return pool.query(
    'SELECT id, name, e_profile_photo_url, e_profile_photo_data, e_profile_photo_mime_type FROM users WHERE id = $1',
    [id]
  );
};
