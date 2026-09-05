const cron = require('node-cron');
const prisma = require('../config/db');
const { withRetry } = prisma;
const { gatherUserMetrics } = require('../utils/attritionMetrics');
const { computeAttritionRisk } = require('../utils/attritionRiskEngine');
const { computeColocationGraph } = require('../utils/colocationEngine');

async function runColocationGraphJob(basePrisma) {
  const tenants = await basePrisma.tenant.findMany({ select: { id: true } });
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

  for (const tenant of tenants) {
    try {
      const attendanceRecords = await basePrisma.attendance.findMany({
        where: { tenantId: tenant.id, status: { in: ['Present', 'HalfDay'] }, checkOut: { not: null }, date: { gte: thirtyDaysAgo } },
        select: { userId: true, officeId: true, date: true, checkIn: true, checkOut: true },
      });
      const users = await basePrisma.user.findMany({
        where: { tenantId: tenant.id },
        select: { id: true, displayName: true, department: true },
      });

      const graph = computeColocationGraph(attendanceRecords, users);

      await basePrisma.colocationGraphCache.upsert({
        where: { tenantId: tenant.id },
        update: { nodes: graph.nodes, links: graph.links, computedAt: new Date() },
        create: { tenantId: tenant.id, nodes: graph.nodes, links: graph.links },
      });

      console.log(`[COLOCATION] Tenant ${tenant.id}: ${graph.nodes.length} nodes, ${graph.links.length} links.`);
    } catch (err) {
      console.error(`[COLOCATION] Failed for tenant ${tenant.id}:`, err.message);
    }
  }
}

async function runAttritionRiskJob(basePrisma) {
  const tenants = await basePrisma.tenant.findMany({ select: { id: true } });

  for (const tenant of tenants) {
    try {
      const activeUsers = await basePrisma.user.findMany({
        where: { tenantId: tenant.id, status: 'Active' },
        select: { id: true, dateOfJoining: true },
      });

      const updates = [];
      for (const user of activeUsers) {
        const metrics = await gatherUserMetrics(basePrisma, tenant.id, user.id, user.dateOfJoining);
        const { score, label } = computeAttritionRisk(metrics);
        updates.push({ id: user.id, score, label });
      }

      // Batch these in a single transaction rather than one await per user in series.
      await basePrisma.$transaction(
        updates.map(u => basePrisma.user.update({
          where: { id: u.id },
          data: { attritionRiskScore: u.score, attritionRiskLabel: u.label, riskUpdatedAt: new Date() },
        }))
      );

      console.log(`[ATTRITION RISK] Tenant ${tenant.id}: updated ${updates.length} users.`);
    } catch (err) {
      console.error(`[ATTRITION RISK] Failed for tenant ${tenant.id}:`, err.message);
    }
  }
}

const initCronJobs = () => {
  // 1. Statutory Compliance Engine (Runs every night at 2:00 AM)
  cron.schedule('0 2 * * *', async () => {
    console.log('[CRON] Running Statutory Compliance Engine...');
    try {
      const activeRules = await prisma.basePrisma.complianceRule.findMany({
        where: { effectiveFrom: { lte: new Date() } }
      });

      // We group offices by state to apply the relevant rule
      const offices = await prisma.basePrisma.office.findMany({
        select: { id: true, state: true, tenantId: true }
      });

      for (const office of offices) {
        if (!office.state) continue;

        // Find rules matching the office's state
        const stateRules = activeRules.filter(r => r.state.toLowerCase() === office.state.toLowerCase() && r.tenantId === office.tenantId);
        
        if (stateRules.length === 0) continue;

        // Apply rules to active, unlocked payrolls of users in this office
        const usersInOffice = await prisma.basePrisma.user.findMany({
          where: { officeId: office.id, tenantId: office.tenantId },
          select: { id: true }
        });
        
        if (usersInOffice.length === 0) continue;
        
        const userIds = usersInOffice.map(u => u.id);

        const unlockedPayrolls = await prisma.basePrisma.payroll.findMany({
          where: {
            tenantId: office.tenantId,
            userId: { in: userIds },
            locked: false
          }
        });

        for (const payroll of unlockedPayrolls) {
          let updatedData = { ...payroll };
          let modified = false;

          for (const rule of stateRules) {
            const rateTable = typeof rule.rateTable === 'string' ? JSON.parse(rule.rateTable) : rule.rateTable;
            if (rule.ruleType === 'PT' && rateTable.amount) {
              // Professional Tax
              if (payroll.grossSalary >= (rateTable.minSalary || 0)) {
                updatedData.professionalTax = rateTable.amount;
                modified = true;
              }
            } else if (rule.ruleType === 'PF' && rateTable.percentage) {
              updatedData.pfEmployee = payroll.basicSalary * (rateTable.percentage / 100);
              updatedData.pfEmployer = payroll.basicSalary * (rateTable.percentage / 100);
              modified = true;
            }
          }

          if (modified) {
            // Recalculate net salary
            const totalDeductions = updatedData.pfEmployee + updatedData.professionalTax + updatedData.advanceDeduction + updatedData.lateDeductions;
            const netSalary = updatedData.grossSalary - totalDeductions;
            
            await prisma.basePrisma.payroll.update({
              where: { id: payroll.id },
              data: {
                professionalTax: updatedData.professionalTax,
                pfEmployee: updatedData.pfEmployee,
                pfEmployer: updatedData.pfEmployer,
                netSalary: netSalary
              }
            });
          }
        }
      }
      console.log('[CRON] Statutory Compliance Engine finished.');
    } catch (error) {
      console.error('[CRON] Error in Statutory Compliance Engine:', error);
    }
  });

  // 2. Active Employee Counter for Metered Billing (Runs at 3:00 AM on the 1st of every month)
  cron.schedule('0 3 1 * *', async () => {
    console.log('[CRON] Running Metered Billing Usage Counter...');
    try {
      const tenants = await prisma.basePrisma.tenant.findMany({ select: { id: true } });
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

      for (const tenant of tenants) {
        const activeCount = await prisma.basePrisma.user.count({
          where: { tenantId: tenant.id, status: 'Active' }
        });

        await prisma.basePrisma.usageRecord.upsert({
          where: { tenantId_month: { tenantId: tenant.id, month: currentMonth } },
          update: { activeEmployees: activeCount },
          create: { tenantId: tenant.id, month: currentMonth, activeEmployees: activeCount }
        });
      }
      console.log('[CRON] Metered Billing Usage Counter finished.');
    } catch (error) {
      console.error('[CRON] Error in Metered Billing Counter:', error);
    }
  });

  // 2.5 Communication Stress Test Retention Redaction (Runs daily at 3:00 AM)
  cron.schedule('0 3 * * *', async () => {
    console.log('[CRON] Running Communication Stress Test Retention Redaction...');
    const { redactExpiredTests } = require('../jobs/redactExpiredCommunicationStressTests');
    await redactExpiredTests(prisma.basePrisma);
  });
  
  // 3. Leave Year Renewal (Runs daily at 1:00 AM)
  // Handles annual grant, carry-forward, and year-end lapse
  const { runLeaveRenewal } = require('../jobs/leaveRenewalJob');
  cron.schedule('0 1 * * *', () => {
    console.log('[CRON] Running Leave Year Renewal...');
    runLeaveRenewal().catch(err => console.error('[CRON] Leave Renewal error:', err));
  });

  // 3.5 Shift Reconciliation Engine (Runs every 2 hours)
  // For every active employee whose shift has ended in the last 3-hour window:
  //   - If still clocked in  → auto clock out at official shift end
  //   - If never clocked in  → mark Absent (unless on approved leave)
  // Handles morning, afternoon, night, and overnight shifts correctly.
  const { runShiftReconciliation } = require('../jobs/shiftReconciliationJob');
  cron.schedule('0 */2 * * *', () => {
    runShiftReconciliation().catch(err => console.error('[CRON] Shift Reconciliation error:', err));
  });

  // 4. Onboarding Reminders (Runs daily at 9:00 AM)
  // Nudges employees stuck on wizard steps and notifies HR/managers
  const { sendOnboardingReminders } = require('../jobs/onboardingReminders');
  cron.schedule('0 9 * * *', () => {
    console.log('[CRON] Running Onboarding Reminders...');
    sendOnboardingReminders().catch(err => console.error('[CRON] Onboarding Reminders error:', err));
  });

  // 5. Daily Birthday Engine (Runs daily at 8:00 AM)
  const { runAllTenantsBirthdayCheck } = require('../jobs/birthdayJob');
  cron.schedule('0 8 * * *', () => {
    runAllTenantsBirthdayCheck().catch(err => console.error('[CRON] Birthday Check error:', err));
  });

  // 6. Auto-delete old 1:1 meetings (Runs every hour at minute 0)
  cron.schedule('0 * * * *', async () => {
    console.log('[CRON] Running 1:1 Meetings cleanup...');
    try {
      const now = new Date();
      const result = await prisma.basePrisma.oneOnOne.deleteMany({
        where: {
          date: { lt: now }
        }
      });
      console.log(`[CRON] Cleaned up ${result.count} past 1:1 meetings.`);
    } catch (error) {
      console.error('[CRON] Error in 1:1 Meetings cleanup:', error);
    }
  });

  // 7. Attrition Risk Scoring (Runs every night at 4:00 AM)
  cron.schedule('0 4 * * *', async () => {
    console.log('[CRON] Running Attrition Risk Engine...');
    if (typeof runAttritionRiskJob === 'function') {
      await runAttritionRiskJob(prisma.basePrisma);
    }
    console.log('[CRON] Attrition Risk Engine finished.');
  });
  
  // 8. Colocation Network Graph Precomputation (Runs every night at 4:30 AM)
  cron.schedule('30 4 * * *', async () => {
    console.log('[CRON] Running Colocation Graph Engine...');
    if (typeof runColocationGraphJob === 'function') {
      await runColocationGraphJob(prisma.basePrisma);
    }
    console.log('[CRON] Colocation Graph Engine finished.');
  });
  
  // 9. Nightly Mark-Absent Engine (Runs every night at 23:30 IST)
  // Marks every active employee with no attendance record today as Absent,
  // provided they are not on an approved leave.
  const { runMarkAbsent } = require('../jobs/markAbsentJob');
  cron.schedule('30 18 * * *', () => {
    // 23:30 IST = 18:00 UTC (IST is UTC+5:30)
    console.log('[CRON] Running Mark-Absent Engine...');
    runMarkAbsent().catch(err => console.error('[CRON] Mark-Absent error:', err));
  }, { timezone: 'Asia/Kolkata' });

  // 10. Monthly Workforce Metric Producer (Runs at 00:00 on the 1st of every month)
  // Captures the official end-of-month snapshot for the Workforce Scenario Simulator
  cron.schedule('0 0 1 * *', async () => {
    console.log('[CRON] Running Monthly Workforce Metric Producer...');
    try {
      const { produceDepartmentAttendanceMetric } = require('../services/metricProducers/attendanceMetricProducer');
      const tenants = await prisma.basePrisma.tenant.findMany({ select: { id: true } });
      
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const period = lastMonth.toISOString().slice(0, 7); // YYYY-MM
      
      for (const tenant of tenants) {
        // Fetch all distinct departments for the tenant
        const users = await prisma.basePrisma.user.findMany({
          where: { tenantId: tenant.id },
          select: { department: true }
        });
        const departments = [...new Set(users.map(u => u.department).filter(Boolean))];
        
        for (const dept of departments) {
          await produceDepartmentAttendanceMetric(tenant.id, dept, period).catch(e =>
            console.error(`Failed to produce metric for ${dept}:`, e.message)
          );
        }
      }
      console.log('[CRON] Monthly Workforce Metric Producer finished successfully.');
    } catch (error) {
      console.error('[CRON] Error in Workforce Metric Producer:', error);
    }
  });

  // 10. Workforce Intelligence Pattern Engine (Runs every night at 2:00 AM)
  const { analyzeEmployeePattern } = require('../services/patternAnalysisEngine');
  cron.schedule('0 2 * * *', async () => {
    console.log('[CRON] Running Workforce Intelligence Pattern Engine...');
    try {
      const dirtyProfiles = await prisma.basePrisma.intelligenceProfile.findMany({
        where: { isDirty: true },
        select: { userId: true, tenantId: true }
      });
      
      for (const profile of dirtyProfiles) {
        await analyzeEmployeePattern(profile.userId, profile.tenantId);
      }
      
      console.log(`[CRON] Analyzed patterns for ${dirtyProfiles.length} dirty profiles.`);
    } catch (err) {
      console.error('[CRON] Workforce Intelligence Pattern Engine error:', err);
    }
  });

  // Cleanup Failsafe: Deferred non-blocking background cleanup on server boot
  // Delayed 10s so the DB warm-up ping has time to complete first
  setTimeout(async () => {
    try {
      const updatedAbsent = await withRetry(() => prisma.basePrisma.attendance.updateMany({
        where: { status: 'Absent', checkOut: null },
        data: { checkOut: new Date() }
      }));
      if (updatedAbsent.count > 0) {
        console.log(`[CLEANUP] Fixed ${updatedAbsent.count} system-generated Absent records with checkOut: null.`);
      }

      const deletedSensitive = await withRetry(() => prisma.basePrisma.appNotification.deleteMany({
        where: { type: { in: ['OTP_VERIFICATION', 'PASSWORD_RESET', 'PASSWORD_CHANGED', 'NEW_ACCOUNT_CREDENTIALS'] } }
      }));
      if (deletedSensitive.count > 0) {
        console.log(`[CLEANUP] Deleted ${deletedSensitive.count} sensitive security notifications from in-app inbox.`);
      }
    } catch (e) {
      console.error('[CLEANUP] Deferred background cleanup error:', e.message);
    }
  }, 10000);

  console.log('[CRON] Background jobs initialized (10 scheduled).');
};

module.exports = { initCronJobs, runAttritionRiskJob, runColocationGraphJob };
