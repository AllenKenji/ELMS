// middleware/roles.js

const roleNameToId = {
  Admin: 1,
  Secretary: 2,
  Councilor: 3,
  'Vice Mayor': 4,
  Resident: 5,
};

const roleIdToName = Object.fromEntries(
  Object.entries(roleNameToId).map(([name, id]) => [id, name])
);

/**
 * Middleware to authorize specific roles.
 * Accepts either role names ("Secretary") or numeric IDs (1).
 */
function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ error: 'No role information found in token' });
    }

    const userRole = req.user.role;

    const normalizeRoleToName = (role) => {
      if (typeof role === 'number') {
        return roleIdToName[role] || String(role);
      }
      if (typeof role === 'string') {
        const asNumber = Number(role);
        if (!Number.isNaN(asNumber) && roleIdToName[asNumber]) {
          return roleIdToName[asNumber];
        }
        return role;
      }
      return String(role);
    };

    const userRoleName = normalizeRoleToName(userRole);
    const allowedRoleNames = allowedRoles.map((role) => {
      if (typeof role === 'number') {
        return roleIdToName[role] || String(role);
      }
      if (typeof role === 'string') {
        if (roleNameToId[role]) return role;
        const asNumber = Number(role);
        if (!Number.isNaN(asNumber) && roleIdToName[asNumber]) {
          return roleIdToName[asNumber];
        }
        return role;
      }
      return String(role);
    });

    if (!allowedRoleNames.includes(userRoleName)) {
      console.warn(`Access denied: user role ${userRoleName} not in [${allowedRoleNames}]`);
      return res.status(403).json({ error: 'Access denied: insufficient role' });
    }

    next();
  };
}

module.exports = authorizeRoles;
