const prisma = require('../config/db');
const crypto = require('crypto');

const generateHash = (userId, surveyId) => {
  const salt = process.env.PULSE_SALT || 'crew_pulse_secret_salt_123';
  return crypto.createHash('sha256').update(`${userId}:${surveyId}:${salt}`).digest('hex');
};

const inboxCache = new Map();
const INBOX_CACHE_TTL = 15000; // 15s TTL

const getInbox = async (req, res) => {
  try {
    const userId = req.user.id;
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      return res.json([]);
    }

    const now = Date.now();
    const cached = inboxCache.get(userId);
    if (cached && (now - cached.timestamp < INBOX_CACHE_TTL)) {
      return res.json(cached.data);
    }

    const isFounder = req.user.roleDefinition?.level === 0;
    const isAdmin = req.user.roleDefinition?.level <= 1 || req.user.customRole === 'SuperAdmin' || req.user.role === 'SuperAdmin';

    let inboxItems = [];

    // Filter out items older than 48 hours
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

    // 1. Prepare queries
    // Founder gets no tenantId filter, everyone else is scoped to their tenant
    const baseWhere = isFounder ? {} : { tenantId };

    const leavesWhereBase = isAdmin ? { ...baseWhere } : { ...baseWhere, managerId: userId };
    const leavesWhere = { ...leavesWhereBase, OR: [{ status: 'Pending' }, { updatedAt: { gte: fortyEightHoursAgo } }] };
    
    const expensesWhereBase = isAdmin ? { ...baseWhere } : { ...baseWhere, approverId: userId };
    const expensesWhere = { ...expensesWhereBase, OR: [{ status: 'PENDING' }, { updatedAt: { gte: fortyEightHoursAgo } }] };

    const [leaves, advances, expenses, tasks, applications, pulseSurveys, intelligenceSignals, irisTasks, appNotifications] = await Promise.all([
      prisma.leave.findMany({
        where: leavesWhere,
        include: { user: { select: { displayName: true, email: true } }, tenant: { select: { name: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 50
      }).catch(() => []),
      isAdmin ? prisma.salaryAdvance.findMany({
        where: { ...baseWhere, OR: [{ status: 'Pending' }, { updatedAt: { gte: fortyEightHoursAgo } }] },
        include: { user: { select: { displayName: true } }, tenant: { select: { name: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 50
      }).catch(() => []) : Promise.resolve([]),
      prisma.expenseClaim.findMany({
        where: expensesWhere,
        include: { user: { select: { displayName: true } }, tenant: { select: { name: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 50
      }).catch(() => []),
      prisma.onboardingTask.findMany({
        where: { ...baseWhere, userId: userId, OR: [{ isCompleted: false }, { completedAt: { gte: fortyEightHoursAgo } }] },
        include: { tenant: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50
      }).catch(() => []),
      isAdmin ? prisma.application.findMany({
        where: { ...baseWhere, OR: [{ stage: { notIn: ['Hired', 'Rejected'] } }, { updatedAt: { gte: fortyEightHoursAgo } }] },
        include: {
          candidate: { select: { firstName: true, lastName: true } },
          jobRequisition: { select: { title: true, department: true } },
          tenant: { select: { name: true } }
        },
        orderBy: { updatedAt: 'desc' },
        take: 50
      }).catch(() => []) : Promise.resolve([]),
      prisma.pulseSurvey.findMany({
        where: { ...baseWhere, isActive: true },
        include: { tenant: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50
      }).catch(() => []),
      isAdmin ? prisma.intelligenceSignal.findMany({
        where: { ...baseWhere, severity: { in: ['HIGH', 'CRITICAL'] }, lifecycleState: 'NEW' },
        include: { user: { select: { displayName: true } }, tenant: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50
      }).catch(() => []) : Promise.resolve([]),
      isAdmin ? prisma.irisTask.findMany({
        where: { ...baseWhere, status: 'AWAITING_APPROVAL' },
        include: { recommendation: true, tenant: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50
      }).catch(() => []) : Promise.resolve([]),
      prisma.appNotification.findMany({
        where: {
          ...baseWhere,
          userId,
          createdAt: { gte: fortyEightHoursAgo },
          type: { notIn: ['OTP_VERIFICATION', 'PASSWORD_RESET', 'PASSWORD_CHANGED', 'NEW_ACCOUNT_CREDENTIALS'] },
          NOT: [
            { title: { contains: 'verification code', mode: 'insensitive' } },
            { title: { contains: 'OTP', mode: 'insensitive' } }
          ]
        },
        include: { tenant: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50
      }).catch(() => [])
    ]);

    // 2. Process Results
    const appendTenant = (item) => isFounder && item.tenant?.name ? ` | Tenant: ${item.tenant.name}` : '';

    leaves.forEach(l => {
      inboxItems.push({
        id: `leave_${l.id}`,
        type: 'Leave',
        title: `Leave Request: ${l.durationType || 'FullDay'}`,
        description: `${l.user?.displayName || 'A user'} requested leave from ${new Date(l.startDate).toISOString().split('T')[0]} to ${new Date(l.endDate).toISOString().split('T')[0]}${appendTenant(l)}`,
        createdAt: l.createdAt,
        status: l.status,
        actionUrl: '/dashboard/leave-approvals',
        originalId: l.id
      });
    });

    irisTasks.forEach(task => {
      if (task.recommendation) {
        inboxItems.push({
          id: `iris_${task.id}`,
          type: 'IrisRecommendation',
          title: `Iris Action Proposed: ${task.recommendation.type}`,
          description: `${task.recommendation.recommendedAction}${appendTenant(task)}`,
          createdAt: task.createdAt,
          status: task.status,
          actionUrl: `/dashboard/iris-action/${task.id}`,
          originalId: task.id
        });
      }
    });

    intelligenceSignals.forEach(signal => {
      inboxItems.push({
        id: `signal_${signal.id}`,
        type: 'IntelligenceSignal',
        title: `Intelligence Alert: ${signal.type}`,
        description: `${signal.description || 'A high or critical severity signal requires review.'}${appendTenant(signal)}`,
        createdAt: signal.createdAt,
        status: signal.lifecycleState || 'NEW',
        actionUrl: '/dashboard/intelligence',
        originalId: signal.id
      });
    });

    advances.forEach(a => {
      inboxItems.push({
        id: `advance_${a.id}`,
        type: 'SalaryAdvance',
        title: `Salary Advance: ${a.amount}`,
        description: `${a.user?.displayName || 'A user'} requested an advance. Reason: ${a.reason}${appendTenant(a)}`,
        createdAt: a.createdAt,
        status: a.status,
        actionUrl: '/dashboard/salary-advance',
        originalId: a.id
      });
    });

    expenses.forEach(e => {
      inboxItems.push({
        id: `expense_${e.id}`,
        type: 'ExpenseClaim',
        title: `Expense Claim: ${e.amount} ${e.currency || 'USD'}`,
        description: `${e.user?.displayName || 'A user'} submitted an expense. Category: ${e.category}${appendTenant(e)}`,
        createdAt: e.createdAt,
        status: e.status,
        actionUrl: '/dashboard/expenses',
        originalId: e.id
      });
    });

    tasks.forEach(t => {
      inboxItems.push({
        id: `task_${t.id}`,
        type: 'OnboardingTask',
        title: `Onboarding Task: ${t.title}`,
        description: `${t.description || 'Please complete this onboarding task.'}${appendTenant(t)}`,
        createdAt: t.createdAt,
        status: t.isCompleted ? 'Completed' : 'Pending',
        actionUrl: '/dashboard/my-profile',
        originalId: t.id
      });
    });

    applications.forEach(app => {
      inboxItems.push({
        id: `app_${app.id}`,
        type: 'Recruitment',
        title: `New Job Application: ${app.jobRequisition?.title}`,
        description: `${app.candidate?.firstName} ${app.candidate?.lastName} applied for ${app.jobRequisition?.title} (${app.jobRequisition?.department}).${appendTenant(app)}`,
        createdAt: app.createdAt,
        status: app.stage || 'Applied',
        actionUrl: '/dashboard/recruitment',
        originalId: app.id
      });
    });

    if (pulseSurveys.length > 0) {
      const pulseItems = await Promise.all(pulseSurveys.map(async (s) => {
        const hash = generateHash(userId, s.id);
        const hasResponded = await prisma.pulseResponse.findUnique({
          where: { surveyId_respondentHash: { surveyId: s.id, respondentHash: hash } }
        });
        if (!hasResponded) {
          return {
            id: `pulse_${s.id}`,
            type: 'PulseSurvey',
            title: `Pulse Check: ${s.title}`,
            description: `A new anonymous pulse survey requires your feedback.${appendTenant(s)}`,
            createdAt: s.createdAt,
            status: 'Pending',
            actionUrl: '/dashboard/pulse',
            originalId: s.id
          };
        }
        return null;
      }));
      pulseItems.filter(Boolean).forEach(item => inboxItems.push(item));
    }

    appNotifications.forEach(n => {
      // Security Failsafe Guard: Never render OTP or verification code items in dashboard inbox
      const text = `${n.title || ''} ${n.message || ''}`.toLowerCase();
      if (text.includes('otp') || text.includes('verification code') || text.includes('password reset')) return;

      let actionUrl = '#';
      if (n.data && n.data.link && n.data.link !== '#') {
        actionUrl = n.data.link;
      } else if (text.includes('announcement') || (n.type && n.type.toLowerCase().includes('announcement'))) {
        actionUrl = '/dashboard/engagement';
      }

      inboxItems.push({
        id: `notification_${n.id}`,
        type: 'Notification',
        title: n.title || 'New Notification',
        description: `${n.message || 'You have a new notification.'}${appendTenant(n)}`,
        createdAt: n.createdAt,
        status: n.isRead ? 'Read' : 'Unread',
        actionUrl,
        originalId: n.id
      });
    });

    // Sort descending by created date
    inboxItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    inboxCache.set(userId, { timestamp: Date.now(), data: inboxItems });
    res.json(inboxItems);
  } catch (error) {
    console.error('getInbox error:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getInbox
};
