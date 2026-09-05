const prisma = require('../config/db');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { sendNotification } = require('../utils/notificationEngine');

class ExecutionError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

// Real Sequence-based ID Generator logic matching userController
async function generateEmployeeId(displayName) {
  const year = new Date().getFullYear();
  const parts = (displayName || 'New User').trim().split(/\s+/);
  const f2 = (parts[0] || 'XX').substring(0, 2).toUpperCase();
  const l2 = (parts.length > 1 ? parts[parts.length - 1] : 'XX').substring(0, 2).toUpperCase();
  const prefix = `CI${f2}${l2}${year}`;

  const lastUser = await prisma.basePrisma.user.findFirst({
    where: { employeeId: { startsWith: prefix } },
    orderBy: { employeeId: 'desc' },
    select: { employeeId: true }
  });

  let seq = 1;
  if (lastUser && lastUser.employeeId) {
    const lastSeq = parseInt(lastUser.employeeId.slice(-4), 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }

  return `${prefix}${seq.toString().padStart(4, '0')}`;
}

async function executeAddEmployee(tenantId, adminRoleLevel, adminRoleName, adminDepartment, payload) {
  const { 
    email, displayName, department, phone, customRole,
    jobPosition, gender, location, workingDaysPerWeek, breakTimeHrs, entityId, officeId 
  } = payload;

  if (!email || !displayName) {
    throw new ExecutionError('Email and Name are required', 400);
  }

  if (!customRole) {
    throw new ExecutionError('A role must be assigned to the new employee', 400);
  }

  let resolvedOfficeId = officeId;

  if (!resolvedOfficeId && payload.officeName) {
    const office = await prisma.basePrisma.office.findFirst({
      where: {
        tenantId,
        name: { contains: payload.officeName, mode: 'insensitive' }
      }
    });
    if (office) {
      resolvedOfficeId = office.id;
    }
  }

  if (!resolvedOfficeId) {
    throw new ExecutionError('A valid Office / Branch must be assigned to the new employee. Please specify an exact branch name.', 400);
  }

  // 1. Enforce strict departmental boundaries if admin is limited to a department
  if (adminRoleLevel >= 1 && adminDepartment) {
    if (department && department !== adminDepartment) {
      throw new ExecutionError(`Access Denied: You can only onboard employees into the ${adminDepartment} department.`, 403);
    }
  }

  // 2. Fetch the tenant's role hierarchy defined by the chairman
  const tenantRoles = await prisma.basePrisma.roleDefinition.findMany({
    where: { tenantId },
    orderBy: { level: 'asc' }
  });

  if (!tenantRoles || tenantRoles.length === 0) {
    throw new ExecutionError('No role hierarchy configured for this company. Please ask the owner to set up roles.', 400);
  }

  // 3. Identify target role in company hierarchy
  const targetRoleDef = tenantRoles.find(
    r => r.name.toLowerCase() === customRole.toLowerCase()
  );
  if (!targetRoleDef) {
    throw new ExecutionError(`"${customRole}" is not a valid role in your company's role hierarchy. Valid roles: ${tenantRoles.map(r => r.name).join(', ')}`, 400);
  }

  const targetLevel = targetRoleDef.level;

  // 4. Enforce strict hierarchical RBAC universally
  // NO ONE can assign a role at or above their own level.
  if (adminRoleLevel !== 0 && targetLevel <= adminRoleLevel) {
    throw new ExecutionError(`Access Denied: As a "${adminRoleName}" (Level ${adminRoleLevel}), you can only assign roles strictly below your level. "${customRole}" is at Level ${targetLevel}.`, 403);
  }

  const existing = await prisma.basePrisma.user.findUnique({ where: { email } });
  if (existing) {
    // If user exists and is pending onboarding completion, enforce document requirements
    const { getEmployeeDocumentStatus } = require('./irisDocumentAdapter');
    const docStatus = await getEmployeeDocumentStatus(tenantId, existing.id);
    if (!docStatus.isFullySatisfied) {
      if (docStatus.missingCount > 0) {
        throw new ExecutionError(
          `DOCUMENTATION_INCOMPLETE: Cannot finalize onboarding for ${existing.displayName}. ${docStatus.missingCount} required onboarding document(s) missing.`,
          400
        );
      }
      if (docStatus.reviewRequiredCount > 0) {
        throw new ExecutionError(
          `DOCUMENT_REVIEW_REQUIRED: Cannot finalize onboarding for ${existing.displayName}. ${docStatus.reviewRequiredCount} onboarding document(s) require HR verification.`,
          400
        );
      }
    }
    throw new ExecutionError('An account with this email already exists', 400);
  }

  const employeeId = await generateEmployeeId(displayName);

  // Auto-generate a secure temporary password
  const generatedPassword = Math.random().toString(36).slice(-8) + 'Aa1@';
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(generatedPassword, salt);
  
  const inviteToken = crypto.randomBytes(32).toString('hex');
  const inviteTokenExpiry = new Date(Date.now() + 72 * 60 * 60 * 1000);

  // Execute creation and audit trail
  const [user] = await prisma.basePrisma.$transaction([
    prisma.basePrisma.user.create({
      data: {
        tenantId,
        employeeId,
        email,
        password: hashedPassword,
        roleDefinitionId: targetRoleDef.id,
        customRole: customRole,    
        mustChangePassword: true,
        status: 'Active',
        inviteToken,
        inviteTokenExpiry,
        faceRegistered: false,
        displayName,
        department: department || null,
        phone: phone || null,
        jobPosition: jobPosition || null,
        gender: gender || null,
        location: location || null,
        entityId: entityId || null,
        officeId: resolvedOfficeId || null,
        workingDaysPerWeek: workingDaysPerWeek ? parseInt(workingDaysPerWeek) : 6,
        breakTimeHrs: breakTimeHrs ? parseFloat(breakTimeHrs) : 1.0,
        dateOfJoining: new Date()
      }
    })
  ]);

  // Execute audit log securely through the extended client to guarantee cryptographic hashing
  await prisma.auditLog.create({
    data: {
      tenantId,
      actorId: payload._adminId || 'SYSTEM',
      action: 'IRIS_EXECUTE_ADD_EMPLOYEE',
      targetId: email,
      details: { displayName, department, customRole }
    }
  });

  const { password: _, ...safeUser } = user;

  // IMPORTANT: Send the onboarding email so the employee can set their password
  sendNotification({
    userId: user.id,
    tenantId: user.tenantId,
    type: 'WELCOME_ONBOARDING_INVITE',
    data: {
      email,
      inviteToken,
      roleName: customRole
    }
  }).catch(err => console.error('Failed to send onboarding invite notification in background', err));
  
  return safeUser;
}

module.exports = {
  executeAddEmployee,
  ExecutionError
};
