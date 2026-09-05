export const hasPermission = (user, permKey) => {
  if (!user || !user.roleDefinition) return false;
  // Owner (Level 0) always has full access
  if (user.roleDefinition.level === 0) return true;

  const perms = user.roleDefinition.permissions;

  // KEY FIX: distinguish null (never configured) from object (explicitly configured).
  // If permissions is an object (even empty {}), the owner has deliberately set it.
  // Missing keys in the object mean that permission is REVOKED (false).
  if (perms !== null && perms !== undefined && typeof perms === 'object') {
    return perms[permKey] === true;
  }

  // perms is null → role was never configured in the console → fall back to
  // the safe level-based defaults so new tenants work out of the box.
  const l = user.roleDefinition.level;
  switch (permKey) {
    case 'view_all_employees': return l <= 2;
    case 'edit_all_employees': return l <= 1;
    case 'approve_leaves':     return l <= 2;
    case 'generate_payroll':   return l <= 1;
    case 'manage_expenses':    return l <= 1;
    case 'view_reports':       return l <= 1;
    case 'manage_shifts':      return l <= 1;
    case 'approve_advances':   return l <= 2;
    case 'manage_performance': return l <= 2;
    case 'manage_recruitment': return l <= 1;
    case 'manage_benefits':    return l <= 2;
    case 'manage_organization':return l <= 1;
    case 'manage_helpdesk':    return l <= 1;
    case 'communication_stress_test':           return l <= 2;
    case 'view_all_communication_stress_tests': return l <= 1;
    case 'manage_communication_personas':       return l <= 1;
    case 'view_communication_trends':           return l <= 1;
    default: return false;
  }
};

