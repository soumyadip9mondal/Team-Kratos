const prisma = require('../config/db');
const { searchHRDocuments, buildRetrievedContext } = require('./vectorSearch');
const { executeRosterPlan } = require('./shiftExecutionService');
const { generateRosterPlan } = require('./rosterSimulationService');
const geminiClient = require('./geminiClient');
const { attachAttendancePercentages } = require('./attendanceEngine');

class ToolError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ToolError';
  }
}

async function resolveEmployee(identifier, tenantId) {
  let user = await prisma.basePrisma.user.findFirst({
    where: { id: identifier, tenantId },
  });
  if (!user) {
    user = await prisma.basePrisma.user.findFirst({
      where: { tenantId, displayName: { contains: identifier, mode: 'insensitive' } },
    });
  }
  if (!user) throw new ToolError(`No employee matching "${identifier}" found in this organisation.`);
  return user;
}

const TOOL_HANDLERS = {
  async getEmployeeDocumentStatus({ employeeNameOrId }, ctx) {
    const user = await resolveEmployee(employeeNameOrId, ctx.tenantId);
    const { getEmployeeDocumentStatus } = require('./irisDocumentAdapter');
    const statusInfo = await getEmployeeDocumentStatus(ctx.tenantId, user.id);
    const resultObj = {
      employeeName: user.displayName,
      employeeId: user.employeeId,
      ...statusInfo
    };
    const cardTag = statusInfo.documents && statusInfo.documents[0]
      ? `\n\n[IRIS_DOCUMENT_CARD:${JSON.stringify(statusInfo.documents[0])}]`
      : '';
    return JSON.stringify(resultObj, null, 2) + cardTag;
  },

  async checkOnboardingRequirements({ employeeNameOrId }, ctx) {
    const user = await resolveEmployee(employeeNameOrId, ctx.tenantId);
    const { getEmployeeDocumentStatus } = require('./irisDocumentAdapter');
    const statusInfo = await getEmployeeDocumentStatus(ctx.tenantId, user.id);
    const firstDoc = statusInfo.documents && statusInfo.documents[0] ? statusInfo.documents[0] : null;
    const cardTag = firstDoc ? `\n\n[IRIS_DOCUMENT_CARD:${JSON.stringify(firstDoc)}]` : '';
    return JSON.stringify({
      employeeName: user.displayName,
      onboardingStatus: statusInfo.isFullySatisfied ? 'COMPLETE' : 'INCOMPLETE',
      requirementsSatisfied: statusInfo.isFullySatisfied,
      missingCount: statusInfo.missingCount,
      reviewRequiredCount: statusInfo.reviewRequiredCount,
      documents: statusInfo.documents
    }, null, 2) + cardTag;
  },

  async analyzeEmployeeDocument({ documentId }, ctx) {
    const { analyzeDocumentEvidence } = require('./irisDocumentAdapter');
    const analysis = await analyzeDocumentEvidence(ctx.tenantId, documentId);
    const cardTag = `\n\n[IRIS_DOCUMENT_CARD:${JSON.stringify(analysis)}]`;
    return JSON.stringify(analysis, null, 2) + cardTag;
  },

  async draftActionForApproval({ actionType, actionParameters, justification }, ctx) {
    // 0. Pre-emptive Validation
    if (ctx.roleLevel !== 0) {
      if (actionType === 'APPROVE_LEAVE' || actionType === 'REJECT_LEAVE') {
        const leave = await prisma.basePrisma.leave.findUnique({ where: { id: actionParameters.leaveId }, select: { tenantId: true } });
        if (leave && leave.tenantId !== ctx.tenantId) {
          return `Error: You do not have permission to approve or reject leaves for employees outside your organization (tenant mismatch).`;
        }
      }
      if (actionType === 'ROSTER_ADJUSTMENT') {
        const sim = await prisma.basePrisma.rosterSimulation.findUnique({ where: { id: actionParameters.planId }, select: { tenantId: true } });
        if (sim && sim.tenantId !== ctx.tenantId) {
          return `Error: You do not have permission to execute shift assignments or roster plans outside your organization (tenant mismatch).`;
        }
      }
    }

    if (actionType === 'ADD_EMPLOYEE' && actionParameters && actionParameters.email) {
      const existing = await prisma.basePrisma.user.findUnique({ 
        where: { email: actionParameters.email } 
      });
      if (existing) {
        return `Error: An account with the email ${actionParameters.email} already exists in the system. Tell the user this email is already in use and ask for a different one.`;
      }
    }

    // 1. Create a mock Outbox event to act as the source
    const sourceEventId = `chat_action_${Date.now()}_${Math.floor(Math.random()*1000)}`;
    
    // 2. Create the Iris Task
    const task = await prisma.basePrisma.irisTask.create({
      data: {
        tenantId: ctx.tenantId,
        sourceEventId: sourceEventId,
        status: 'AWAITING_APPROVAL'
      }
    });

    // 3. Create the Iris Recommendation attached to the task
    await prisma.basePrisma.irisRecommendation.create({
      data: {
        taskId: task.id,
        type: actionType,
        evidence: { chatContext: 'Triggered manually by user from Iris Chat interface.' },
        recommendedAction: justification,
        actionType: actionType,
        actionParameters: actionParameters,
        dataFingerprint: `chat_fingerprint_${Date.now()}`,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }
    });

    return `Action successfully drafted! I have created an Inbox Action Card for '${actionType}'.\n\n[IRIS_ACTION_CARD:${task.id}]`;
  },

  async searchHRPolicies({ query }, ctx) {
    const chunks = await searchHRDocuments(query, ctx.tenantId, 5, ctx.roleLevel);
    if (chunks.length === 0) return "No relevant policies found.";
    return buildRetrievedContext(chunks);
  },

  async getEmployeeProfile({ employeeNameOrId }, ctx) {
    const user = await resolveEmployee(employeeNameOrId, ctx.tenantId);
    // Don't leak full user object, just safe fields. NEVER leak internal UUID (id) or personal emails.
    return {
      employeeId: user.employeeId,
      name: user.displayName,
      department: user.department,
      jobPosition: user.jobPosition,
      status: user.status,
      joiningDate: user.dateOfJoining ? user.dateOfJoining.toISOString().split('T')[0] : null,
    };
  },

  async searchEmployees({ department, designation, status }, ctx) {
    const where = { tenantId: ctx.tenantId };
    if (department) where.department = department;
    if (designation) where.jobPosition = designation;
    if (status) {
      const s = status.toLowerCase().replace(/[^a-z]/g, '');
      if (s === 'active') where.status = 'Active';
      else if (s === 'inactive') where.status = 'Inactive';
      else if (s.includes('leave')) where.status = 'OnLeave';
    }
    
    const users = await prisma.basePrisma.user.findMany({
      where,
      select: { id: true, employeeId: true, displayName: true, department: true, jobPosition: true, status: true, dateOfJoining: true },
      take: 50 // cap
    });

    const usersWithStats = await attachAttendancePercentages(users, ctx.tenantId);

    return { 
      count: usersWithStats.length, 
      users: usersWithStats.map(u => ({ 
        employeeId: u.employeeId, 
        name: u.displayName, 
        department: u.department, 
        jobPosition: u.jobPosition, 
        status: u.status, 
        dateOfJoining: u.dateOfJoining ? u.dateOfJoining.toISOString().split('T')[0] : null,
        dashboardOverallAttendancePercentage: u.attendancePercentage,
        hasInconsistency: u.hasAttendanceInconsistency
      })) 
    };
  },

  async getAttendanceSummary({ startDate, endDate, department, employeeNameOrId }, ctx) {
    const where = { tenantId: ctx.tenantId, date: { gte: new Date(startDate), lte: new Date(endDate) } };
    
    if (employeeNameOrId) {
      const user = await resolveEmployee(employeeNameOrId, ctx.tenantId);
      where.userId = user.id;
    }

    if (department && !employeeNameOrId) {
      where.user = { department };
    }

    // Fetch all matching records without `take: 100` so counts are accurate.
    const records = await prisma.basePrisma.attendance.findMany({
      where,
      select: { date: true, status: true, userId: true, user: { select: { displayName: true, employeeId: true } } }
    });

    // To ensure employees with 0 attendance events are still represented (e.g. 100% lifetime),
    // fetch all active users matching the same scope filters.
    const usersWhere = { tenantId: ctx.tenantId, status: 'Active' };
    if (where.userId) usersWhere.id = where.userId;
    if (where.user?.department) usersWhere.department = where.user.department;

    const activeUsers = await prisma.basePrisma.user.findMany({
      where: usersWhere,
      select: { id: true, displayName: true, employeeId: true }
    });

    const combinedUserMap = new Map(activeUsers.map(u => [u.id, { name: u.displayName, employeeId: u.employeeId }]));
    
    records.forEach(r => {
      if (!combinedUserMap.has(r.userId)) {
        combinedUserMap.set(r.userId, { name: r.user?.displayName || 'Unknown', employeeId: r.user?.employeeId || null });
      }
    });

    const combinedUserIds = Array.from(combinedUserMap.keys());

    // Fetch dashboard lifetime attendance percentages for the involved employees (capped to avoid overhead)
    let employeeDashboardStats = [];
    if (combinedUserIds.length > 0 && combinedUserIds.length <= 100) {
      const usersToAttach = combinedUserIds.map(id => ({ id }));
      const usersWithStats = await attachAttendancePercentages(usersToAttach, ctx.tenantId);
      employeeDashboardStats = usersWithStats.map(u => {
        const userInfo = combinedUserMap.get(u.id);
        return {
          employeeId: userInfo?.employeeId || null,
          name: userInfo?.name || 'Unknown',
          dashboardOverallAttendancePercentage: u.attendancePercentage,
          hasInconsistency: u.hasAttendanceInconsistency
        };
      });
    }

    const summary = {
      totalAttendanceEvents: records.length,
      uniqueEmployeesInvolved: combinedUserIds.length,
      employeeDashboardStats,
      byDate: {}
    };

    records.forEach(r => {
      // Safely convert date to YYYY-MM-DD string
      const dateStr = (r.date instanceof Date) ? r.date.toISOString().split('T')[0] : String(r.date).split('T')[0];
      
      if (!summary.byDate[dateStr]) {
        summary.byDate[dateStr] = {
          employeeStatus: []
        };
      }
      
      summary.byDate[dateStr][r.status] = (summary.byDate[dateStr][r.status] || 0) + 1;
      
      if (r.user) {
        summary.byDate[dateStr].employeeStatus.push({ name: r.user.displayName, status: r.status });
      }
    });

    return summary;
  },

  async getAbsenteesToday({}, ctx) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const absentRecords = await prisma.basePrisma.attendance.findMany({
      where: {
        tenantId: ctx.tenantId,
        date: { gte: today },
        status: 'Absent'
      },
      include: { user: { select: { displayName: true, department: true } } }
    });

    return {
      status: 'Absent',
      date: today.toISOString().split('T')[0],
      absentEmployees: absentRecords.map(r => ({ name: r.user.displayName, department: r.user.department }))
    };
  },

  async getShiftAssignments({ dateISO }, ctx) {
    const targetDate = dateISO ? new Date(dateISO) : new Date();
    targetDate.setUTCHours(0,0,0,0);
    
    const endDateLimit = new Date(targetDate);
    endDateLimit.setDate(endDateLimit.getDate() + 30);

    const slots = await prisma.basePrisma.shiftSlot.findMany({
      where: {
        tenantId: ctx.tenantId,
        date: { gte: targetDate, lte: endDateLimit }
      },
      orderBy: { date: 'asc' },
      include: { assignments: { include: { employee: { select: { displayName: true, department: true } } } } }
    });

    const employeeSchedules = {};
    for (const slot of slots) {
      for (const assignment of slot.assignments) {
        const empName = assignment.employee?.displayName || 'Unknown';
        const slotDate = slot.date.toISOString().split('T')[0];
        
        if (!employeeSchedules[empName]) {
          employeeSchedules[empName] = {
            department: assignment.employee?.department || 'Unknown',
            shiftType: slot.shiftType,
            startTime: slot.startTime,
            endTime: slot.endTime,
            startDate: slotDate,
            endDate: slotDate
          };
        } else {
          if (employeeSchedules[empName].shiftType === slot.shiftType) {
            // Extend the end date for the same shift block
            employeeSchedules[empName].endDate = slotDate;
          }
        }
      }
    }

    const assignments = Object.entries(employeeSchedules).map(([employeeName, details]) => ({
      employeeName,
      ...details
    }));

    if (assignments.length === 0) {
      return { message: `No shift assignments found from ${targetDate.toISOString().split('T')[0]} onwards.` };
    }

    return { 
      message: `Shift roster loaded successfully. Each employee's block applies from their startDate to their endDate continuously.`,
      assignments 
    };
  },

  async assignEmployeeToShift({ employeeNameOrId, shiftType, dateISO }, ctx) {
    try {
      // 1. Resolve the employee
      const employee = await resolveEmployee(employeeNameOrId, ctx.tenantId);
      if (!employee) {
        return { error: `Could not find employee "${employeeNameOrId}" in the system. Please check the name and try again.` };
      }

      // 2. Parse target date
      const targetDate = new Date(dateISO);
      targetDate.setUTCHours(0, 0, 0, 0);

      // 3. Look up existing slot for this shift type and date (case-insensitive)
      const normalizedShiftType = shiftType.toLowerCase().trim();
      let slot = await prisma.basePrisma.shiftSlot.findFirst({
        where: { tenantId: ctx.tenantId, shiftType: { equals: normalizedShiftType, mode: 'insensitive' }, date: targetDate }
      });

      // 4. If no slot exists, check for any slot of this type nearby to copy timing from
      if (!slot) {
        const lookback = new Date(targetDate);
        lookback.setDate(lookback.getDate() - 14);
        const referenceSlot = await prisma.basePrisma.shiftSlot.findFirst({
          where: { tenantId: ctx.tenantId, shiftType: { equals: normalizedShiftType, mode: 'insensitive' }, date: { gte: lookback } },
          orderBy: { date: 'desc' }
        });

        if (!referenceSlot) {
          // Show available shift types to help the user
          const availableSlots = await prisma.basePrisma.shiftSlot.findMany({
            where: { tenantId: ctx.tenantId },
            distinct: ['shiftType'],
            select: { shiftType: true },
            take: 5
          });
          const available = availableSlots.map(s => `"${s.shiftType}"`).join(', ');
          return { error: `No shift type matching "${shiftType}" found. Available shift types in your system: ${available}.` };
        }

        // Create the slot
        slot = await prisma.basePrisma.shiftSlot.create({
          data: {
            tenantId: ctx.tenantId,
            date: targetDate,
            shiftType: referenceSlot.shiftType,
            startTime: referenceSlot.startTime,
            endTime: referenceSlot.endTime
          }
        });
      }

      // 5. Check for double booking
      const existingAssignment = await prisma.basePrisma.shiftAssignment.findFirst({
        where: { slotId: slot.id },
        include: { employee: { select: { displayName: true } } }
      });

      if (existingAssignment && existingAssignment.employeeId !== employee.id) {
        return { 
          error: `This slot is already assigned to ${existingAssignment.employee?.displayName || 'another employee'}. Cannot double-book.` 
        };
      }

      // 6. Upsert the assignment
      await prisma.basePrisma.shiftAssignment.upsert({
        where: { slotId_employeeId: { slotId: slot.id, employeeId: employee.id } },
        update: { mode: 'MANUAL', assignedBy: ctx.userId },
        create: {
          tenantId: ctx.tenantId,
          slotId: slot.id,
          employeeId: employee.id,
          mode: 'MANUAL',
          assignedBy: ctx.userId
        }
      });

      return {
        success: true,
        message: `✅ ${employee.displayName} has been assigned to the ${slot.shiftType} (${slot.startTime} – ${slot.endTime}) on ${targetDate.toISOString().split('T')[0]}.`
      };
    } catch (err) {
      return { error: `Assignment failed: ${err.message}` };
    }
  },

  async getLeaveRequests({ status, startDate, endDate }, ctx) {
    const where = { tenantId: ctx.tenantId };
    if (status) {
      where.status = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
    }
    if (startDate && endDate) {
      where.startDate = { gte: new Date(startDate) };
      where.endDate = { lte: new Date(endDate) };
    }
    
    const leaves = await prisma.basePrisma.leave.findMany({
      where,
      select: { id: true, status: true, startDate: true, endDate: true, reason: true, attachment: true, leavePolicy: { select: { name: true } }, user: { select: { displayName: true } } },
      take: 50
    });
    
    return { count: leaves.length, leaves };
  },

  async analyzeLeaveAttachment({ leaveId }, ctx) {
    const leave = await prisma.basePrisma.leave.findUnique({
      where: { id: leaveId, tenantId: ctx.tenantId },
      select: { attachment: true, reason: true }
    });

    if (!leave) return { error: 'Leave request not found.' };
    if (!leave.attachment) return { error: 'No document is attached to this leave request.' };

    try {
      const response = await fetch(leave.attachment);
      if (!response.ok) throw new Error(`Failed to download attachment: ${response.statusText}`);
      
      const buffer = await response.arrayBuffer();
      const mimeType = response.headers.get('content-type') || 'image/jpeg';
      
      const ai = geminiClient.getAI();
      const result = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  data: Buffer.from(buffer).toString("base64"),
                  mimeType
                }
              },
              { text: `Analyze this document which is attached to a leave request. The employee's stated reason is: "${leave.reason}". Please transcribe the key details (like dates, doctor names, or diagnosis) and state whether it appears to support the leave request.` }
            ]
          }
        ]
      });

      return { analysis: result.text };
    } catch (err) {
      console.error('[analyzeLeaveAttachment] Error:', err);
      return { error: `Failed to analyze document: ${err.message}` };
    }
  },

  async generateRosterPlan({ weekISO, department }, ctx) {
    try {
      const { generateRosterPlan: simulateRoster } = require('./rosterSimulationService');
      const { currentFingerprint, proposedFingerprint, plan, metrics } = await simulateRoster(ctx.tenantId, weekISO, 7, department);
      
      const simulation = await prisma.basePrisma.rosterSimulation.create({
        data: {
          tenantId: ctx.tenantId,
          currentFingerprint,
          proposedFingerprint,
          plan,
          metrics,
          createdBy: ctx.userId || ctx.tenantId,
          status: 'PENDING_APPROVAL',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      });

      return {
        planId: simulation.id,
        metrics: metrics,
        planSummary: `Generated ${plan.length} slot assignments. Coverage Score: ${metrics.proposed.coverage}%. Fairness Score: ${metrics.proposed.details.workloadFairness}. Use planId "${simulation.id}" to execute this roster.`
      };
    } catch (err) {
      return { error: `Simulation failed: ${err.message}` };
    }
  },

  async getEmployeesOnLeaveToday({}, ctx) {
    const today = new Date();
    const leaves = await prisma.basePrisma.leave.findMany({
      where: {
        tenantId: ctx.tenantId,
        status: 'Approved',
        startDate: { lte: today },
        endDate: { gte: today }
      },
      include: { user: { select: { displayName: true, department: true } }, leavePolicy: { select: { name: true } } }
    });
    
    return leaves.map(l => ({ name: l.user.displayName, department: l.user.department, type: l.leavePolicy?.name }));
  },

  async getDepartmentMetrics({ department, month }, ctx) {
    const startDate = new Date(month + "-01");
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0); // Last day of month

    const users = await prisma.basePrisma.user.findMany({
      where: { tenantId: ctx.tenantId, department },
      select: { id: true }
    });

    if (users.length === 0) return { error: "No users found in this department." };

    const userIds = users.map(u => u.id);

    const attendance = await prisma.basePrisma.attendance.findMany({
      where: {
        tenantId: ctx.tenantId,
        userId: { in: userIds },
        date: { gte: startDate, lte: endDate }
      },
      select: { status: true }
    });

    const statusCounts = {};
    attendance.forEach(a => {
      statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;
    });

    return {
      department,
      month,
      employeeCount: userIds.length,
      attendanceMetrics: statusCounts,
      totalRecords: attendance.length
    };
  },

  async getLeavePolicies({}, ctx) {
    const policies = await prisma.basePrisma.leavePolicy.findMany({
      where: { tenantId: ctx.tenantId, isArchived: false },
      select: {
        name:                true,
        annualQuota:         true,
        carryForward:        true,
        maxCarryForward:     true,
        isPaid:              true,
        allowNegativeBalance: true,
        requiresAttachment:  true,
        effectiveFrom:       true,
        leaveYearStartMonth: true,
        leaveYearStartDay:   true,
      },
      orderBy: { name: 'asc' }
    });

    if (policies.length === 0) return 'No leave policies have been configured for this company yet.';

    return {
      count: policies.length,
      policies: policies.map(p => ({
        name:               p.name,
        annualQuota:        `${p.annualQuota} days`,
        isPaid:             p.isPaid ? 'Paid' : 'Unpaid',
        carryForward:       p.carryForward ? `Enabled (max ${p.maxCarryForward ?? 'unlimited'} days)` : 'Disabled',
        negativeBalance:    p.allowNegativeBalance ? 'Allowed' : 'Not Allowed',
        requiresAttachment: p.requiresAttachment ? 'Yes' : 'No',
        effectiveFrom:      p.effectiveFrom?.toISOString().split('T')[0],
      }))
    };
  },

  async getDepartmentCostMetrics({ departmentName, period, baselinePeriod }, ctx) {
    if (ctx.roleLevel > 1) {
      throw new ToolError('Permission denied. Only admins can view financial metrics.');
    }
    
    // In a real implementation, you might map departmentName to ID, but for this demo:
    const workforceCostService = require('./workforceCostService');
    const summary = await workforceCostService.getDepartmentCostSummary(ctx.tenantId, departmentName, period, baselinePeriod, ctx);
    
    if (summary.insights.length === 0) {
      return `No cost data found for ${departmentName} in period ${period}. Please ensure the metric producers have run.`;
    }

    return summary;
  },

  async getPayrollSummary({ month }, ctx) {
    if (ctx.roleLevel > 1) {
      throw new ToolError('You do not have permission to view payroll data.');
    }
    
    const payrolls = await prisma.basePrisma.payroll.findMany({
      where: { tenantId: ctx.tenantId, month },
      select: { locked: true, netSalary: true }
    });

    const summary = {
      totalEmployeesPaid: payrolls.filter(p => p.locked).length,
      totalPending: payrolls.filter(p => !p.locked).length,
      totalNetPayOut: payrolls.filter(p => p.locked).reduce((sum, p) => sum + Number(p.netSalary || 0), 0)
    };

    return summary;
  },

  async getAttritionRiskList({}, ctx) {
    if (ctx.roleLevel > 1) {
      throw new ToolError('You do not have permission to view attrition risk data.');
    }
    
    const riskyEmployees = await prisma.basePrisma.user.findMany({
      where: { 
        tenantId: ctx.tenantId, 
        status: 'Active',
        attritionRiskLabel: { in: ['High', 'Critical'] }
      },
      select: {
        employeeId: true,
        displayName: true,
        department: true,
        attritionRiskScore: true,
        attritionRiskLabel: true,
        riskUpdatedAt: true
      },
      orderBy: { attritionRiskScore: 'desc' }
    });

    if (riskyEmployees.length === 0) {
      return "No active employees are currently flagged for high or critical attrition risk.";
    }

    return {
      count: riskyEmployees.length,
      employees: riskyEmployees.map(emp => ({
        employeeId: emp.employeeId,
        name: emp.displayName,
        department: emp.department,
        riskScore: emp.attritionRiskScore,
        riskLabel: emp.attritionRiskLabel,
        lastUpdated: emp.riskUpdatedAt?.toISOString().split('T')[0]
      }))
    };
  },

  async getFraudAlertSummary({ startDate, endDate, severity, status, alertType, departmentId, userId }, ctx) {
    if (ctx.roleLevel > 1) {
      throw new ToolError('You do not have permission to view fraud alerts.');
    }
    
    const where = { tenantId: ctx.tenantId };
    
    if (startDate && endDate) {
      where.attendanceDate = { gte: new Date(startDate), lte: new Date(endDate) };
    } else if (startDate) {
      where.attendanceDate = { gte: new Date(startDate) };
    }
    
    if (severity) where.severity = severity.toUpperCase();
    if (alertType) where.alertType = alertType;
    if (userId) where.userId = userId;
    
    if (status) {
      where.resolved = status.toUpperCase() === 'RESOLVED';
    }
    
    if (departmentId) {
      // department on User is typically a string, assuming departmentId matches it or we filter by user relation
      where.user = { department: departmentId };
    }
    
    const alerts = await prisma.basePrisma.proxyAlert.findMany({
      where,
      select: {
        id: true,
        severity: true,
        alertType: true,
        resolved: true,
        attendanceDate: true,
        user: { select: { displayName: true, department: true } }
      }
    });

    const summary = {
      totalAlerts: alerts.length,
      severityCounts: {},
      typeCounts: {},
      resolvedCount: 0,
      openCount: 0,
      departmentCounts: {}
    };

    alerts.forEach(a => {
      summary.severityCounts[a.severity] = (summary.severityCounts[a.severity] || 0) + 1;
      summary.typeCounts[a.alertType] = (summary.typeCounts[a.alertType] || 0) + 1;
      
      if (a.resolved) summary.resolvedCount++;
      else summary.openCount++;
      
      if (a.user && a.user.department) {
        summary.departmentCounts[a.user.department] = (summary.departmentCounts[a.user.department] || 0) + 1;
      }
    });

    return summary;
  },

  async getPendingApprovals({}, ctx) {
    const pendingLeaves = await prisma.basePrisma.leave.count({
      where: { tenantId: ctx.tenantId, status: 'Pending' }
    });
    
    const pendingExpenses = await prisma.basePrisma.expenseClaim.count({
      where: { tenantId: ctx.tenantId, status: 'PENDING' }
    });

    const pendingAdvances = await prisma.basePrisma.salaryAdvance.count({
      where: { tenantId: ctx.tenantId, status: 'Pending' }
    });

    return { pendingLeaves, pendingExpenses, pendingAdvances };
  },

  async getTopCandidatesForJob({ jobTitle }, ctx) {
    if (ctx.roleLevel > 2) {
      throw new ToolError('You do not have permission to view recruitment data.');
    }

    const job = await prisma.basePrisma.jobRequisition.findFirst({
      where: { 
        tenantId: ctx.tenantId, 
        title: { contains: jobTitle, mode: 'insensitive' } 
      }
    });

    if (!job) {
      throw new ToolError(`Could not find a job requisition matching "${jobTitle}".`);
    }

    const rankings = await prisma.basePrisma.candidateRanking.findMany({
      where: {
        tenantId: ctx.tenantId,
        jobId: job.id,
        application: { stage: 'Applied' }
      },
      orderBy: { rank: 'asc' },
      take: 5,
      include: {
        application: {
          include: { candidate: true }
        }
      }
    });

    if (rankings.length === 0) {
      return `No candidates have been ranked yet for the role: ${job.title}. Please wait for the ATS and ranking engine to process them.`;
    }

    const topCandidates = rankings.map(r => ({
      rank: r.rank,
      name: `${r.application.candidate.firstName} ${r.application.candidate.lastName}`,
      rankingScore: r.rankingScore,
      eligibilityStatus: r.eligibilityStatus,
      scoreBreakdown: r.scoreBreakdown,
      evidenceCoverage: r.evidenceCoverage
    }));

    return {
      jobTitle: job.title,
      topCandidates
    };
  },

  async getInterviewingCandidatesForJob({ jobTitle }, ctx) {
    if (ctx.roleLevel > 2) throw new ToolError('Permission denied.');
    const job = await prisma.basePrisma.jobRequisition.findFirst({
      where: { tenantId: ctx.tenantId, title: { contains: jobTitle, mode: 'insensitive' } }
    });
    if (!job) throw new ToolError(`Could not find job matching "${jobTitle}".`);
    const rankings = await prisma.basePrisma.candidateRanking.findMany({
      where: { tenantId: ctx.tenantId, jobId: job.id, application: { stage: 'Interview' } },
      orderBy: { rank: 'asc' }, take: 10,
      include: { application: { include: { candidate: true } } }
    });
    if (rankings.length === 0) return `No candidates are in the Interview stage for the role: ${job.title}.`;
    return {
      jobTitle: job.title,
      interviewingCandidates: rankings.map(r => ({
        name: `${r.application.candidate.firstName} ${r.application.candidate.lastName}`,
        rankingScore: r.rankingScore
      }))
    };
  },

  async getOfferedCandidatesForJob({ jobTitle }, ctx) {
    if (ctx.roleLevel > 2) throw new ToolError('Permission denied.');
    const job = await prisma.basePrisma.jobRequisition.findFirst({
      where: { tenantId: ctx.tenantId, title: { contains: jobTitle, mode: 'insensitive' } }
    });
    if (!job) throw new ToolError(`Could not find job matching "${jobTitle}".`);
    const rankings = await prisma.basePrisma.candidateRanking.findMany({
      where: { tenantId: ctx.tenantId, jobId: job.id, application: { stage: 'Offer' } },
      orderBy: { rank: 'asc' }, take: 10,
      include: { application: { include: { candidate: true } } }
    });
    if (rankings.length === 0) return `No candidates have been offered the role: ${job.title} yet.`;
    return {
      jobTitle: job.title,
      offeredCandidates: rankings.map(r => ({
        name: `${r.application.candidate.firstName} ${r.application.candidate.lastName}`
      }))
    };
  },

  async getHiredCandidatesForJob({ jobTitle }, ctx) {
    if (ctx.roleLevel > 2) throw new ToolError('Permission denied.');
    const job = await prisma.basePrisma.jobRequisition.findFirst({
      where: { tenantId: ctx.tenantId, title: { contains: jobTitle, mode: 'insensitive' } }
    });
    if (!job) throw new ToolError(`Could not find job matching "${jobTitle}".`);
    const rankings = await prisma.basePrisma.candidateRanking.findMany({
      where: { tenantId: ctx.tenantId, jobId: job.id, application: { stage: 'Hired' } },
      orderBy: { rank: 'asc' }, take: 10,
      include: { application: { include: { candidate: true } } }
    });
    if (rankings.length === 0) return `No candidates have been hired for the role: ${job.title} yet.`;
    return {
      jobTitle: job.title,
      hiredCandidates: rankings.map(r => ({
        name: `${r.application.candidate.firstName} ${r.application.candidate.lastName}`
      }))
    };
  },

  async getCandidateRanking({ candidateName, jobTitle }, ctx) {
    if (ctx.roleLevel > 2) {
      throw new ToolError('You do not have permission to view recruitment data.');
    }

    const candidateWhere = {
      tenantId: ctx.tenantId,
      OR: [
        { firstName: { contains: candidateName.split(' ')[0], mode: 'insensitive' } },
        { lastName: { contains: candidateName.split(' ').pop(), mode: 'insensitive' } }
      ]
    };

    const candidates = await prisma.basePrisma.candidate.findMany({
      where: candidateWhere
    });

    if (candidates.length === 0) {
      throw new ToolError(`Could not find candidate matching "${candidateName}".`);
    }

    const candidateIds = candidates.map(c => c.id);

    const appWhere = {
      tenantId: ctx.tenantId,
      applicationId: { in: candidateIds }
    };

    if (jobTitle) {
      appWhere.jobRequisition = {
        title: { contains: jobTitle, mode: 'insensitive' }
      };
    }

    // Wait, candidateRanking uses applicationId, so we need to map candidateId -> applicationId
    const apps = await prisma.basePrisma.application.findMany({
      where: { tenantId: ctx.tenantId, candidateId: { in: candidateIds } },
      select: { id: true, jobRequisition: true }
    });
    
    let targetAppId = null;
    let targetJob = null;
    
    if (jobTitle) {
      const match = apps.find(a => a.jobRequisition.title.toLowerCase().includes(jobTitle.toLowerCase()));
      if (match) {
        targetAppId = match.id;
        targetJob = match.jobRequisition;
      }
    } else if (apps.length > 0) {
      targetAppId = apps[0].id;
      targetJob = apps[0].jobRequisition;
    }

    if (!targetAppId) {
       throw new ToolError(`Could not find an application for ${candidateName}${jobTitle ? ` for the role ${jobTitle}` : ''}.`);
    }

    const ranking = await prisma.basePrisma.candidateRanking.findFirst({
      where: { tenantId: ctx.tenantId, applicationId: targetAppId },
      include: { application: { include: { candidate: true } } }
    });

    if (!ranking) {
      return `The ranking for ${candidateName} is not available yet. ATS processing might be pending.`;
    }

    return {
      candidateName: `${ranking.application.candidate.firstName} ${ranking.application.candidate.lastName}`,
      jobTitle: targetJob.title,
      rank: ranking.rank,
      rankingScore: ranking.rankingScore,
      evidenceCoverage: ranking.evidenceCoverage,
      eligibilityStatus: ranking.eligibilityStatus,
      scoreBreakdown: ranking.scoreBreakdown,
      rankingEvidence: ranking.rankingEvidence,
      disqualifyingFactors: ranking.disqualifyingFactors
    };
  },

  async compareCandidates({ candidateName1, candidateName2, jobTitle }, ctx) {
     const cand1 = await this.getCandidateRanking({ candidateName: candidateName1, jobTitle }, ctx);
     const cand2 = await this.getCandidateRanking({ candidateName: candidateName2, jobTitle }, ctx);
     
     return {
       jobTitle: cand1.jobTitle || cand2.jobTitle || jobTitle,
       comparison: [cand1, cand2]
     };
  },

  async getCandidateATSScore({ candidateName, jobTitle }, ctx) {
    if (ctx.roleLevel > 2) {
      throw new ToolError('You do not have permission to view recruitment data.');
    }

    const candidateWhere = {
      tenantId: ctx.tenantId,
      OR: [
        { firstName: { contains: candidateName.split(' ')[0], mode: 'insensitive' } },
        { lastName: { contains: candidateName.split(' ').pop(), mode: 'insensitive' } }
      ]
    };

    const candidates = await prisma.basePrisma.candidate.findMany({
      where: candidateWhere
    });

    if (candidates.length === 0) {
      throw new ToolError(`Could not find candidate matching "${candidateName}".`);
    }

    const candidateIds = candidates.map(c => c.id);

    const appWhere = {
      tenantId: ctx.tenantId,
      candidateId: { in: candidateIds }
    };

    if (jobTitle) {
      appWhere.jobRequisition = {
        title: { contains: jobTitle, mode: 'insensitive' }
      };
    }

    const application = await prisma.basePrisma.application.findFirst({
      where: appWhere,
      include: {
        jobRequisition: true,
        candidate: true,
        ATSResult: {
          orderBy: { generatedAt: 'desc' },
          take: 1
        }
      }
    });

    if (!application) {
      throw new ToolError(`Could not find an application for ${candidateName}${jobTitle ? ` for the role ${jobTitle}` : ''}.`);
    }

    if (application.atsStatus !== 'COMPLETED' || application.ATSResult.length === 0) {
      return `The ATS match score for ${application.candidate.firstName} ${application.candidate.lastName} is currently: ${application.atsStatus}. It has not completed processing.`;
    }

    const result = application.ATSResult[0];

    return {
      candidateName: `${application.candidate.firstName} ${application.candidate.lastName}`,
      jobTitle: application.jobRequisition.title,
      score: result.score,
      breakdown: result.breakdown,
      matchEvidence: result.matchEvidence,
      missingSkills: result.missingSkills,
      explanation: result.explanation || 'No explanation generated yet.'
    };
  },

  async runWorkforceScenario({ action, departmentId, count, overtimeReductionAssumption, inputMetricVersion }, ctx) {
    if (!action || !inputMetricVersion) {
      throw new ToolError("Missing required scenario parameters: 'action' and 'inputMetricVersion' are mandatory.");
    }
    
    const parameters = { departmentId, count };
    const assumptions = {};
    if (overtimeReductionAssumption) assumptions.OVERTIME_REDUCTION = overtimeReductionAssumption;

    // Use the backend engine to calculate deterministically
    const { calculateScenarioProjection } = require('./scenarioProjectionEngine');
    const projection = await calculateScenarioProjection(
      ctx.tenantId, 
      ctx.userId, 
      action, 
      parameters, 
      assumptions, 
      inputMetricVersion
    );

    return {
      scenarioId: projection.scenarioId,
      result: projection.result,
      auditTimestamp: projection.createdAt,
      systemMessage: "DO NOT invent numbers. Explain the provided result matrix, strictly separating FACT, PROJECTION, and ASSUMPTION."
    };
  },

  async getOpenJobs(_, ctx) {
    const jobs = await prisma.basePrisma.jobRequisition.findMany({
      where: { tenantId: ctx.tenantId, status: 'Open' },
      select: { 
        title: true, 
        department: true, 
        location: true, 
        employmentType: true,
        _count: { select: { applications: true } }
      }
    });
    // Format response to make the applicant count easily readable for the AI
    const formattedJobs = jobs.map(j => ({
      title: j.title,
      department: j.department,
      location: j.location,
      employmentType: j.employmentType,
      applicantCount: j._count.applications
    }));
    return { count: formattedJobs.length, jobs: formattedJobs };
  },

  async getOpenTickets(_, ctx) {
    const tickets = await prisma.basePrisma.ticket.findMany({
      where: { tenantId: ctx.tenantId, status: { in: ['Open', 'InProgress'] } },
      select: { category: true, priority: true, status: true, createdBy: { select: { displayName: true } } }
    });
    return { count: tickets.length, tickets };
  },

  async getPendingExpenses(_, ctx) {
    const expenses = await prisma.basePrisma.expenseClaim.findMany({
      where: { tenantId: ctx.tenantId, status: 'PENDING' },
      select: { amount: true, category: true, description: true, user: { select: { displayName: true } } }
    });
    return { count: expenses.length, expenses };
  },

  async getEmployeeAssets({ employeeNameOrId }, ctx) {
    const user = await resolveEmployee(employeeNameOrId, ctx.tenantId);
    const assignments = await prisma.basePrisma.assetAssignment.findMany({
      where: { userId: user.id, status: 'ACTIVE' },
      include: { asset: { select: { type: true, model: true, serialNumber: true } } }
    });
    return {
      employee: user.displayName,
      assets: assignments.map(a => `${a.asset.type}: ${a.asset.model}`)
    };
  },

  async getEmployeeGoals({ employeeNameOrId }, ctx) {
    const user = await resolveEmployee(employeeNameOrId, ctx.tenantId);
    const goals = await prisma.basePrisma.goal.findMany({
      where: { userId: user.id },
      select: { title: true, progress: true, status: true, dueDate: true }
    });
    return { employee: user.displayName, goals };
  }
};

const SENSITIVE_TOOLS = new Set(['getPayrollSummary', 'getAttritionRiskList', 'getFraudAlertSummary', 'runWorkforceScenario', 'getPendingExpenses']);

async function executeTool(call, ctx) {
  try {
    const handler = TOOL_HANDLERS[call.name];
    if (!handler) throw new ToolError(`Unknown tool: ${call.name}`);
    
    if (SENSITIVE_TOOLS.has(call.name)) {
       // Log sensitive tool usage
       await prisma.auditLog.create({
         data: {
           tenantId: ctx.tenantId,
           actorId: ctx.userId,
           action: 'AI_SENSITIVE_TOOL_ACCESSED',
           targetId: ctx.sessionId || 'none',
           details: { tool: call.name, args: call.args, entity: 'ChatSession' }
         }
       });
    }

    const result = await handler(call.args || {}, ctx);
    return { name: call.name, response: { result } };
  } catch (err) {
    return { name: call.name, response: { error: `Tool failed: ${err.message}` } };
  }
}

module.exports = { executeTool, TOOL_HANDLERS, SENSITIVE_TOOLS };
