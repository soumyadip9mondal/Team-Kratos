/**
 * Permission-Key Middleware
 *
 * Works alongside the existing numeric `authorize(N)` middleware in role.js.
 * While `authorize` checks `roleDefinition.level`, this middleware checks
 * named permission keys stored in `roleDefinition.permissions` (JSON column).
 *
 * Logic mirrors frontend/src/lib/permissions.js exactly:
 *   - Owner (level 0) → always allowed
 *   - SuperAdmin (tenantId null) → always allowed
 *   - permissions is a non-null object → key must be explicitly `true`
 *   - permissions is null (never configured) → level-based fallback from PERMISSION_DEFAULTS
 */

const { PERMISSION_DEFAULTS } = require('../config/communicationReviewPolicy');

const requirePermission = (permissionKey) => {
  return (req, res, next) => {
    const roleDef = req.user?.roleDefinition;
    if (!roleDef) {
      return res.status(401).json({ error: 'Unauthorized: No role attached to session.' });
    }

    // SuperAdmin bypass — same check as role.js:11
    if (roleDef.name === 'SuperAdmin' && req.user.tenantId === null) {
      return next();
    }

    // Owner always has access — same as permissions.js:4
    if (roleDef.level === 0) return next();

    const perms = roleDef.permissions;

    // Explicit permissions object — same as permissions.js:11-12
    if (perms !== null && perms !== undefined && typeof perms === 'object') {
      if (perms[permissionKey] === true) return next();
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges.' });
    }

    // Null permissions — level-based fallback
    const rule = PERMISSION_DEFAULTS[permissionKey];
    if (rule && roleDef.level <= rule.maxLevel) return next();

    return res.status(403).json({ error: 'Forbidden: Insufficient privileges.' });
  };
};

module.exports = requirePermission;
