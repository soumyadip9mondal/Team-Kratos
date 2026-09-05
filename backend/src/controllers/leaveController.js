const prisma = require('../config/db');
const ImageKit = require('imagekit');
const { sendNotification } = require('../utils/notificationEngine');
const { reserveLeave, reverseLeave, getAvailableBalance } = require('../utils/leaveLedger');
const { isManagerOf, getSubordinateIds } = require('../utils/managerHierarchy');
const { applyLeaveSchema, createPolicySchema } = require('../../../packages/shared/validations/leave');
const { enrollAllUsersInPolicy } = require('../jobs/leaveEnrollmentJob');
const { isDefaultOffDay, countBusinessDays } = require('../config/scheduleConfig');

const imagekit = new ImageKit({
    publicKey : process.env.IMAGEKIT_PUBLIC_KEY,
    privateKey : process.env.IMAGEKIT_PRIVATE_KEY,
    urlEndpoint : process.env.IMAGEKIT_URL_ENDPOINT
});

// ──────────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────────

/**
 * Count business days between two dates (Mon-Sat as tenant default working days, Sun as off day).
 * Per decision record: working-day patterns are org-level, not per-employee.
 */
// countBusinessDays imported from ../config/scheduleConfig


/**
 * Calculate the number of leave days requested based on durationType.
 */
function calculateLeaveDays(durationType, startDate, endDate, hoursRequested) {
  switch (durationType) {
    case 'HalfDay':
      return 0.5;
    case 'Hourly':
      return (hoursRequested || 0) / 8;
    case 'FullDay':
    default:
      return countBusinessDays(startDate, endDate);
  }
}

/**
 * Get the latest version of each non-archived policy for a tenant,
 * grouped by policyGroupId (only the most recent effectiveFrom).
 */
async function getActivePoliciesForTenant(tenantId) {
  const policies = await prisma.leavePolicy.findMany({
    where: { tenantId, isArchived: false, policyGroupId: { not: null } },
    orderBy: { effectiveFrom: 'desc' }
  });

  const uniqueMap = new Map();
  for (const p of policies) {
    if (!uniqueMap.has(p.policyGroupId)) {
      uniqueMap.set(p.policyGroupId, p);
    }
  }
  return Array.from(uniqueMap.values());
}

// ──────────────────────────────────────────────────────────────────
// POLICY CRUD (Admin only — Level ≤ 1)
// ──────────────────────────────────────────────────────────────────

const getPolicies = async (req, res) => {
  try {
    const policies = await getActivePoliciesForTenant(req.user.tenantId);
    res.json(policies);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createPolicy = async (req, res) => {
  try {
    const data = createPolicySchema.parse(req.body);
    
    const policy = await prisma.leavePolicy.create({
      data: {
        tenantId: req.user.tenantId,
        name: data.name,
        annualQuota: data.annualQuota,
        carryForward: data.carryForward,
        maxCarryForward: data.maxCarryForward || null,
        isPaid: data.isPaid,
        allowNegativeBalance: data.allowNegativeBalance,
        requiresAttachment: data.requiresAttachment,
        leaveYearStartMonth: data.leaveYearStartMonth,
        leaveYearStartDay: data.leaveYearStartDay,
      }
    });

    // Async enrollment — does NOT block the HTTP response.
    // Uses setImmediate; becomes a BullMQ job when Redis is wired up.
    setImmediate(() => {
      enrollAllUsersInPolicy(req.user.tenantId, policy);
    });

    // Emit real-time event
    const io = req.app.get('io');
    if (io) {
      io.to(`tenant:${req.user.tenantId}`).emit('leave:policy_created', { policy });
    }

    res.status(201).json({ policy, enrollmentStatus: 'queued' });
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: error.message });
  }
};

const updatePolicy = async (req, res) => {
  try {
    const { id } = req.params;
    const data = createPolicySchema.parse(req.body);

    // Find original policy to get policyGroupId
    const original = await prisma.leavePolicy.findUnique({ where: { id } });
    if (!original) return res.status(404).json({ error: 'Policy not found' });

    // Archive the old version
    await prisma.leavePolicy.update({
      where: { id },
      data: { isArchived: true }
    });

    // Create new version with same policyGroupId (append-only versioning)
    const newPolicy = await prisma.leavePolicy.create({
      data: {
        tenantId: req.user.tenantId,
        name: data.name,
        policyGroupId: original.policyGroupId,
        annualQuota: data.annualQuota,
        carryForward: data.carryForward,
        maxCarryForward: data.maxCarryForward || null,
        isPaid: data.isPaid,
        allowNegativeBalance: data.allowNegativeBalance,
        requiresAttachment: data.requiresAttachment,
        leaveYearStartMonth: data.leaveYearStartMonth,
        leaveYearStartDay: data.leaveYearStartDay,
      }
    });

    res.json(newPolicy);
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: error.message });
  }
};

const archivePolicy = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.leavePolicy.update({
      where: { id },
      data: { isArchived: true }
    });
    res.json({ message: 'Policy archived' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ──────────────────────────────────────────────────────────────────
// LEAVE APPLICATION (All authenticated employees)
// ──────────────────────────────────────────────────────────────────

const applyLeave = async (req, res) => {
  try {
    const userId = req.user.id;
    const tenantId = req.user.tenantId;

    // Parse form data — policyGroupId, dates, reason come as text fields alongside multer file
    const body = {
      policyGroupId: req.body.policyGroupId,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      reason: req.body.reason,
      durationType: req.body.durationType || 'FullDay',
      hoursRequested: req.body.hoursRequested ? Number(req.body.hoursRequested) : undefined
    };

    const validated = applyLeaveSchema.parse(body);

    // Look up the active policy by policyGroupId
    const policy = await prisma.leavePolicy.findFirst({
      where: {
        tenantId,
        policyGroupId: validated.policyGroupId,
        isArchived: false
      },
      orderBy: { effectiveFrom: 'desc' }
    });

    if (!policy) {
      return res.status(400).json({ error: 'Leave policy not found or has been archived' });
    }

    const start = new Date(validated.startDate);
    const end = new Date(validated.endDate);

    if (isDefaultOffDay(start) || isDefaultOffDay(end)) {
      return res.status(400).json({ error: 'Leaves cannot start or end on a weekly off day (Sunday)' });
    }

    // Calculate leave days
    const leaveDays = calculateLeaveDays(validated.durationType, start, end, validated.hoursRequested);
    if (leaveDays <= 0) {
      return res.status(400).json({ error: 'Leave duration must be greater than 0' });
    }

    // Check attachment requirement (per-policy, not blanket)
    if (policy.requiresAttachment && !req.file) {
      return res.status(400).json({ error: `A supporting document is required for ${policy.name} requests` });
    }

    // Upload attachment if provided
    let attachment = null;
    if (req.file) {
      const uploadRes = await imagekit.upload({
        file: req.file.buffer.toString('base64'),
        fileName: `leave_${userId}_${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`,
        folder: '/leaves',
        useUniqueFileName: true
      });
      attachment = uploadRes.url;
    }

    // Reserve balance in the ledger (PENDING_HOLD is the permanent debit)
    // This is done inside a transaction with advisory lock for concurrency safety
    let leave;
    try {
      leave = await prisma.$transaction(async (tx) => {
        const holdEntry = await reserveLeave(tx, {
          tenantId,
          userId,
          policyGroupId: policy.policyGroupId,
          amount: leaveDays,
          leaveRequestId: null, // We'll update this after creating the Leave record
          allowNegativeBalance: policy.allowNegativeBalance
        });

        // Create the Leave record
        const newLeave = await tx.leave.create({
          data: {
            userId,
            tenantId,
            leavePolicyId: policy.id,
            durationType: validated.durationType,
            hoursRequested: validated.hoursRequested || null,
            startDate: start,
            endDate: end,
            reason: validated.reason,
            attachment,
            managerId: req.user.managerId || null
          }
        });

        // Link the hold entry to this specific leave request
        await tx.leaveLedgerEntry.update({
          where: { id: holdEntry.id },
          data: { leaveRequestId: newLeave.id }
        });

        return newLeave;
      }, { maxWait: 10000, timeout: 30000 });
    } catch (txError) {
      // If this is a balance error, return it as a 400 with helpful info
      if (txError.message && txError.message.includes('Insufficient leave balance')) {
        return res.status(400).json({ error: txError.message });
      }
      throw txError;
    }

    // Fire notification to the employee as confirmation
    sendNotification({
      userId: req.user.id,
      tenantId,
      type: 'LEAVE_APPLIED_CONFIRMATION',
      title: 'Leave Request Submitted',
      message: `Your leave request starting on ${start.toISOString().split('T')[0]} has been successfully submitted and is pending approval.`,
      data: {
        date: start.toISOString().split('T')[0]
      }
    });

    // Emit Socket.io event to admin room for real-time approval queue update
    const io = req.app.get('io');
    if (io) {
      io.to(`tenant:${tenantId}:admin`).emit('leave:new_request', {
        leaveId: leave.id,
        employeeName: req.user.displayName,
        policyName: policy.name,
        startDate: start,
        endDate: end
      });
    }
    if (io) io.to(`tenant:${req.user.tenantId}`).emit('inbox:updated', { message: 'New leave requested' });

    res.json(leave);
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: error.message });
  }
};

// ──────────────────────────────────────────────────────────────────
// LEAVE QUERIES
// ──────────────────────────────────────────────────────────────────

const getMyLeaves = async (req, res) => {
  try {
    const leaves = await prisma.leave.findMany({
      where: { userId: req.user.id },
      include: {
        leavePolicy: {
          select: { name: true, isPaid: true, policyGroupId: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    res.json(leaves);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getAllLeaves = async (req, res) => {
  try {
    const isManager = req.user.roleDefinition && req.user.roleDefinition.level === 2;
    const isAdmin = req.user.roleDefinition && req.user.roleDefinition.level <= 1;
    
    const isFounder = req.user.roleDefinition && req.user.roleDefinition.level === 0;
    
    let whereClause = isFounder ? {} : { tenantId: req.user.tenantId };
    
    if (isManager && !isAdmin) {
      // Hierarchy-aware scoping: manager sees direct + skip-level reports
      // Uses the same recursive pattern as Performance Management
      const teamIds = await getSubordinateIds(req.user.id, req.user.tenantId);
      if (teamIds.length === 0) {
        return res.json([]); // Manager has no subordinates
      }
      whereClause = {
        tenantId: req.user.tenantId,
        userId: { in: teamIds }
      };
    }

    const leaves = await prisma.leave.findMany({
      where: whereClause,
      include: {
        user: {
          select: { displayName: true, department: true, employeeId: true }
        },
        leavePolicy: {
          select: { name: true, isPaid: true, policyGroupId: true }
        },
        tenant: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(leaves);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getLeavesByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const leaves = await prisma.leave.findMany({
      where: { userId },
      include: {
        leavePolicy: {
          select: { name: true, isPaid: true, policyGroupId: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(leaves);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ──────────────────────────────────────────────────────────────────
// LEAVE APPROVAL / REJECTION
// ──────────────────────────────────────────────────────────────────

const updateLeaveStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminRemarks } = req.body;

    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be Approved or Rejected' });
    }

    const leave = await prisma.leave.findUnique({
      where: { id },
      include: { user: true, leavePolicy: true }
    });
    if (!leave) return res.status(404).json({ error: 'Leave request not found' });

    if (leave.tenantId !== req.user.tenantId) {
      return res.status(403).json({ error: 'Forbidden: Access denied to request outside your tenant' });
    }

    if (leave.status !== 'Pending') {
      return res.status(400).json({ error: `Cannot update a leave request that is already ${leave.status}.` });
    }

    const isAdmin = req.user.roleDefinition && req.user.roleDefinition.level <= 1;

    // Self-approval block for regular employees (Admins or self-rejections/cancellations allowed)
    if (leave.userId === req.user.id && status === 'Approved' && !isAdmin) {
      return res.status(403).json({
        error: 'You cannot approve your own leave request. It has been routed to your reporting manager.'
      });
    }

    // Manager (level 2) can only approve for their subordinates
    if (!isAdmin && leave.userId !== req.user.id) {
      const isMgr = await isManagerOf(req.user.id, leave.userId);
      if (!isMgr) {
        return res.status(403).json({ error: 'You can only approve leaves for your team members' });
      }
    }

    if (status === 'Approved') {
      // APPROVAL: Pure status transition. The PENDING_HOLD is already the permanent debit.
      // No ledger write on approval — this is the settled design decision.
      const updated = await prisma.leave.update({
        where: { id },
        data: { status: 'Approved', adminRemarks, approvedById: req.user.id, approvedAt: new Date() }
      });

      sendNotification({
        userId: leave.userId,
        tenantId: req.user.tenantId,
        type: 'LEAVE_APPROVED',
        data: { date: updated.startDate.toISOString().split('T')[0] }
      });

      // Event-Driven Dirty Marking for Intelligence Engine
      await prisma.intelligenceProfile.upsert({
        where: { userId: leave.userId },
        update: { isDirty: true },
        create: { tenantId: req.user.tenantId, userId: leave.userId, isDirty: true }
      }).catch(err => console.error('[Intelligence] Failed to mark profile dirty:', err));

      // Proactive Intelligence Trigger: Emit ROSTER_SHORTAGE for approved leave dates
      const { publishEvent } = require('../services/outboxService');
      const targetUser = await prisma.user.findUnique({ where: { id: leave.userId }, select: { department: true } });
      
      await publishEvent(prisma, {
        tenantId: req.user.tenantId,
        eventType: 'ROSTER_SHORTAGE',
        sourceEntity: 'Leave',
        sourceEntityId: updated.id,
        payload: {
          department: targetUser?.department || 'General',
          date: updated.startDate.toISOString().split('T')[0],
          reason: 'Employee approved for leave'
        },
        idempotencyKey: `roster_shortage_leave_${updated.id}_${Date.now()}`
      }).catch(err => console.error('Failed to trigger proactive intelligence:', err));

      res.json(updated);
    } else {
      // REJECTION: Write a single REVERSAL entry to credit back the held amount
      const updated = await prisma.$transaction(async (tx) => {
        // Find the PENDING_HOLD ledger entry for this leave request's policy
        const holdEntry = await tx.leaveLedgerEntry.findFirst({
          where: {
            tenantId: req.user.tenantId,
            userId: leave.userId,
            leaveRequestId: leave.id,
            reason: 'PENDING_HOLD'
          }
        });

        // Reverse the hold if it exists
        if (holdEntry) {
          await reverseLeave(tx, req.user.tenantId, holdEntry.id);
        }

        return await tx.leave.update({
          where: { id },
          data: { status: 'Rejected', adminRemarks, approvedById: req.user.id, approvedAt: new Date() }
        });
      }, { maxWait: 10000, timeout: 30000 });

      sendNotification({
        userId: leave.userId,
        tenantId: req.user.tenantId,
        type: 'LEAVE_REJECTED',
        title: 'Leave Request Rejected',
        message: `Your leave request starting on ${updated.startDate.toISOString().split('T')[0]} has been rejected.`,
        data: { date: updated.startDate.toISOString().split('T')[0], adminRemarks }
      });

      res.json(updated);
    }

    // Emit real-time event
    const io = req.app.get('io');
    if (io) {
      io.to(`tenant:${req.user.tenantId}:user:${leave.userId}`).emit('leave:status_updated', {
        leaveId: id, status
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ──────────────────────────────────────────────────────────────────
// BALANCE ENDPOINTS
// ──────────────────────────────────────────────────────────────────

/**
 * GET /api/leave/balances — returns balance breakdown per policy for the current user
 */
const getMyBalances = async (req, res) => {
  try {
    const balances = await computeBalancesForUser(req.user.tenantId, req.user.id);
    res.json(balances);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/leave/balances/:userId — returns balance for a specific user
 * Accessible by admins (level ≤ 1) and managers who are in the user's manager chain
 */
const getBalancesByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const isAdmin = req.user.roleDefinition && req.user.roleDefinition.level <= 1;

    if (!isAdmin) {
      // Manager: verify they are in the user's manager chain
      const isMgr = await isManagerOf(req.user.id, userId);
      if (!isMgr) {
        return res.status(403).json({ error: 'You can only view balances for your team members' });
      }
    }

    const balances = await computeBalancesForUser(req.user.tenantId, userId);
    res.json(balances);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Internal helper: compute balance breakdown for a user across all active policies.
 */
async function computeBalancesForUser(tenantId, userId) {
  const policies = await getActivePoliciesForTenant(tenantId);
  const balances = [];

  for (const policy of policies) {
    // Get all ledger entries for this user + policy group
    let entries = await prisma.leaveLedgerEntry.findMany({
      where: {
        tenantId,
        userId,
        policyGroupId: policy.policyGroupId
      }
    });

    // SELF-HEALING LAZY ENROLLMENT: If user has 0 ledger entries for this active policy,
    // enroll them on the fly so they get their prorated quota and can apply for leave immediately.
    if (entries.length === 0) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { dateOfJoining: true } });
      const { enrollUserInLeaves } = require('../utils/leaveLedger');
      await enrollUserInLeaves(tenantId, userId, user?.dateOfJoining || new Date());
      
      // Re-fetch entries after lazy enrollment
      entries = await prisma.leaveLedgerEntry.findMany({
        where: {
          tenantId,
          userId,
          policyGroupId: policy.policyGroupId
        }
      });
    }

    let granted = 0;  // Sum of credits (ANNUAL_GRANT, CARRY_FORWARD, ACCRUAL, REVERSAL)
    let used = 0;      // Sum of non-reversed PENDING_HOLD debits where leave is Approved
    let pending = 0;   // Sum of non-reversed PENDING_HOLD debits where leave is still Pending
    let totalBalance = 0;

    // Collect reversed entry IDs so we don't double-count
    const reversedIds = new Set();
    for (const e of entries) {
      if (e.reason === 'REVERSAL' && e.reversedEntryId) {
        reversedIds.add(e.reversedEntryId);
      }
    }

    for (const e of entries) {
      const amount = parseFloat(e.amount);
      totalBalance += amount;
      
      if (amount > 0) {
        granted += amount;
      } else if (e.reason === 'PENDING_HOLD' && !reversedIds.has(e.id)) {
        // This hold was not reversed — it's either pending or approved
        // We'll figure out pending vs used below
        used += Math.abs(amount);
      }
      // YEAR_END_LAPSE, REVERSAL, etc. are already accounted for in totalBalance
    }

    // To split used vs pending: check Leave records for this policy that are still Pending
    const pendingLeaves = await prisma.leave.findMany({
      where: {
        tenantId,
        userId,
        leavePolicyId: policy.id,
        status: 'Pending'
      }
    });

    // Approximate: pending hold amount = count of pending leaves * their duration
    // For accuracy, sum the actual durations
    let pendingDays = 0;
    for (const l of pendingLeaves) {
      pendingDays += calculateLeaveDays(l.durationType, l.startDate, l.endDate, l.hoursRequested);
    }

    // Adjust: used = total holds - pending holds
    const actualUsed = Math.max(0, used - pendingDays);
    
    balances.push({
      policyGroupId: policy.policyGroupId,
      policyName: policy.name,
      annualQuota: parseFloat(policy.annualQuota),
      allocated: granted, // Total granted base quota (useful for denominator when prorated)
      used: actualUsed,
      pending: pendingDays,
      available: totalBalance,
      isPaid: policy.isPaid,
      requiresAttachment: policy.requiresAttachment
    });
  }

  return balances;
}

module.exports = {
  getPolicies,
  createPolicy,
  updatePolicy,
  archivePolicy,
  applyLeave,
  getMyLeaves,
  getAllLeaves,
  getLeavesByUser,
  updateLeaveStatus,
  getMyBalances,
  getBalancesByUser
};
