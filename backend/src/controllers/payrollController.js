const prisma = require('../config/db');
const { countBusinessDays } = require('../config/scheduleConfig');
const { dispatchWebhook } = require('../utils/webhookDispatcher');
const { sendNotification } = require('../utils/notificationEngine');
const { calculateAdvanceRiskScore } = require('../utils/riskScoringEngine');

function redactAdvanceSecurityFields(advance, isAdminOrManager) {
  if (Array.isArray(advance)) {
    return advance.map(a => redactAdvanceSecurityFields(a, isAdminOrManager));
  }
  if (!advance) return advance;

  const copy = { ...advance };
  if (!isAdminOrManager) {
    delete copy.riskScore;
    delete copy.riskLabel;
  }
  return copy;
}

// Request a salary advance
const requestAdvance = async (req, res) => {
  try {
    const { amount, reason, monthDeduction } = req.body;
    const userId = req.user.id;
    const tenantId = req.user.tenantId;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Advance amount must be greater than 0.' });
    }
    if (!monthDeduction) {
      return res.status(400).json({ error: 'Deduction month is required.' });
    }
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Reason for advance is required.' });
    }

    // Validation: Deduction month cannot be in the past
    const [reqYear, reqMonth] = monthDeduction.split('-').map(Number);
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-indexed
    if (reqYear < currentYear || (reqYear === currentYear && reqMonth < currentMonth)) {
      return res.status(400).json({ error: 'Deduction month cannot be in the past.' });
    }

    // Calculate risk metrics (snapshot at creation time)
    const riskMetrics = await calculateAdvanceRiskScore(userId, numAmount, tenantId);

    const advance = await prisma.salaryAdvance.create({
      data: {
        userId,
        tenantId,
        amount: numAmount,
        reason: reason.trim(),
        monthDeduction,
        status: 'Pending',
        riskScore: riskMetrics.score,
        riskLabel: riskMetrics.label
      }
    });

    const io = req.app.get('io');
    if (io) io.to(`tenant:${req.user.tenantId}`).emit('inbox:updated', { message: 'New salary advance requested' });

    // Immutable Audit Trail
    await prisma.auditLog.create({
      data: {
        tenantId,
        actorId: userId,
        action: 'SALARY_ADVANCE_REQUESTED',
        targetId: userId,
        details: `Requested salary advance of ₹${numAmount} for deduction month ${monthDeduction}. Reason: ${reason}`
      }
    });

    // Send email notification to user confirming request submission
    try {
      sendNotification({
        userId,
        tenantId,
        type: 'SALARY_ADVANCE_REQUESTED',
        title: 'Salary Advance Requested',
        message: `Your request for a salary advance of ₹${numAmount} has been submitted for approval.`,
        data: {
          fullName: req.user.displayName || req.user.email,
          requestId: advance.id,
          amount: numAmount,
          monthDeduction,
          reason: reason.trim()
        }
      });
    } catch (e) {
      console.warn('Failed to send advance request notification email:', e.message);
    }

    const isAdminOrManager = req.user.roleDefinition && req.user.roleDefinition.level <= 2;
    res.json(redactAdvanceSecurityFields(advance, isAdminOrManager));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Admin approves/rejects advance
const updateAdvanceStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, comments } = req.body;

    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be Approved or Rejected.' });
    }

    const existing = await prisma.salaryAdvance.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Salary advance request not found.' });
    }

    if (existing.tenantId !== req.user.tenantId) {
      return res.status(403).json({ error: 'Forbidden: Access denied to request outside your tenant.' });
    }

    const isApprove = status === 'Approved';
    if (existing.status !== 'Pending') {
      return res.status(400).json({ error: `Cannot update a request that is already ${existing.status}.` });
    }
    const updateData = {
      status,
      ...(isApprove 
        ? { approvedBy: req.user.id, approvedAt: new Date() } 
        : { rejectedBy: req.user.id, rejectedAt: new Date() })
    };

    const advance = await prisma.salaryAdvance.update({
      where: { id },
      data: updateData,
      include: { user: { select: { id: true, displayName: true, email: true } } }
    });
    
    await prisma.auditLog.create({
      data: {
        tenantId: req.user.tenantId,
        actorId: req.user.id,
        action: `SALARY_ADVANCE_${status.toUpperCase()}`,
        targetId: advance.userId,
        details: `Salary advance of ₹${advance.amount} for month ${advance.monthDeduction} was ${status.toLowerCase()} by ${req.user.displayName || req.user.email}.${comments ? ` Notes: ${comments}` : ''}`
      }
    });

    // Notify employee with exact template payload
    try {
      const actorName = req.user.displayName || req.user.email || 'Priya Singh';
      const actorRole = req.user.jobPosition || req.user.customRole || 'HR Manager';
      const hrFormattedName = `${actorName} (${actorRole})`;
      const formattedDate = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

      sendNotification({
        userId: advance.userId,
        tenantId: req.user.tenantId,
        type: `SALARY_ADVANCE_${status.toUpperCase()}`,
        title: `Salary Advance ${status}`,
        message: `Your salary advance request of ₹${advance.amount} has been ${status.toLowerCase()}.`,
        data: {
          fullName: advance.user?.displayName || 'Employee',
          requestId: advance.user?.employeeId || advance.id,
          amount: advance.amount,
          monthDeduction: advance.monthDeduction,
          status,
          comments,
          rejectionReason: comments || "Your requested amount exceeds the organization's salary advance eligibility limit.",
          approvedBy: hrFormattedName,
          approvedDate: formattedDate,
          rejectedBy: hrFormattedName,
          rejectedDate: formattedDate
        }
      });
    } catch (e) {
      console.warn('Failed to send status update notification:', e.message);
    }

    const isAdminOrManager = req.user.roleDefinition && req.user.roleDefinition.level <= 2;
    res.json(redactAdvanceSecurityFields(advance, isAdminOrManager));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Employee gets their own advances (strictly redacted)
const getMyAdvances = async (req, res) => {
  try {
    const advances = await prisma.salaryAdvance.findMany({
      where: { userId: req.user.id, tenantId: req.user.tenantId },
      orderBy: { createdAt: 'desc' }
    });

    const isAdminOrManager = req.user.roleDefinition && req.user.roleDefinition.level <= 2;
    res.json(redactAdvanceSecurityFields(advances, isAdminOrManager));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Admin gets all advances for tenant
const getAllAdvances = async (req, res) => {
  try {
    const isFounder = req.user.roleDefinition?.level === 0;
    const filter = isFounder ? {} : { tenantId: req.user.tenantId };
    
    const advances = await prisma.salaryAdvance.findMany({
      where: filter,
      include: { 
        tenant: { select: { name: true } },
        user: { 
          select: { 
            id: true, 
            displayName: true, 
            employeeId: true, 
            avatar: true, 
            baseSalary: true, 
            dateOfJoining: true 
          } 
        } 
      },
      orderBy: { createdAt: 'desc' }
    });

    const isAdminOrManager = req.user.roleDefinition && req.user.roleDefinition.level <= 2;
    res.json(redactAdvanceSecurityFields(advances, isAdminOrManager));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

      // Config endpoints and generateMonthlyPayroll updates
      const generateMonthlyPayroll = async (req, res) => {
        try {
          const { month } = req.params; // format: '2026-07'
          const { userId } = req.body || {};
          const [yearStr, monthStr] = month.split('-');
          const year = parseInt(yearStr);
          const monthIndex = parseInt(monthStr) - 1; // 0-based
      
          const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
          
          // Get config
          let config = await prisma.payrollConfig.findFirst({ where: { tenantId: req.user.tenantId } });
          if (!config) {
            return res.status(400).json({ error: 'Payroll configuration is missing. Please configure it in Org Settings first.' });
          }
          
          const userQuery = { status: 'Active', tenantId: req.user.tenantId };
          if (userId) userQuery.id = userId;

          const users = await prisma.user.findMany({
            where: userQuery,
            include: {
              shiftPolicy: true,
              advances: {
                where: { monthDeduction: month, status: 'Approved' }
              },
              attendances: {
                where: {
                  date: {
                    gte: new Date(year, monthIndex, 1),
                    lt: new Date(year, monthIndex + 1, 1)
                  }
                }
              },
              leaves: {
                where: {
                  status: 'Approved',
                  startDate: { lt: new Date(year, monthIndex + 1, 1) },
                  endDate: { gte: new Date(year, monthIndex, 1) }
                },
                include: { leavePolicy: true }
              },
              employeeBenefits: {
                where: {
                  OR: [
                    { status: 'ACTIVE' },
                    { status: 'CANCELLED', effectiveEndDate: { gte: new Date(year, monthIndex, 1) } }
                  ]
                },
                include: { plan: true }
              },
              payrolls: {
                where: { month }
              }
            }
          });
      
          if (users.length === 0) {
            return res.json({ message: 'No eligible employees found for payroll generation.', succeeded: [], failed: [] });
          }
          
          const succeeded = [];
          const failed = [];
          const { calculatePayroll } = require('../utils/payrollCalculator');
          const { computeShiftCompliance } = require('../utils/shiftComplianceEngine');
          
          const complianceRules = await prisma.complianceRule.findMany({ where: { tenantId: req.user.tenantId } });
      
          for (const user of users) {
            try {
              if (user.baseSalary === null || user.baseSalary === undefined) {
                failed.push({ id: user.id, name: user.displayName, reason: 'Base salary is not set' });
                continue;
              }
              
              const existingPayroll = user.payrolls[0];
              if (existingPayroll && existingPayroll.locked) {
                failed.push({ id: user.id, name: user.displayName, reason: 'Payslip is locked' });
                continue;
              }
      
              let absentDays = 0;
              for (const att of user.attendances) {
                if (att.status === 'Absent') absentDays++;
                else if (att.status === 'HalfDay') absentDays += 0.5;
              }
              
              let unpaidLeaveDays = 0;
              for (const leave of user.leaves) {
                if (leave.leavePolicy && leave.leavePolicy.isPaid === true) continue;

                const monthStart = new Date(year, monthIndex, 1);
                const monthEnd = new Date(year, monthIndex + 1, 0); 
                
                const start = new Date(leave.startDate) < monthStart ? monthStart : new Date(leave.startDate);
                const end = new Date(leave.endDate) > monthEnd ? monthEnd : new Date(leave.endDate);
                
                if (start <= end) {
                  let leaveDuration = 0;
                  if (leave.durationType === 'HalfDay') {
                    leaveDuration = 0.5;
                  } else if (leave.durationType === 'Hourly') {
                    leaveDuration = (leave.hoursRequested || 0) / 8;
                  } else {
                    leaveDuration = countBusinessDays(start, end);
                  }
                  unpaidLeaveDays += leaveDuration;
                }
              }
              
              const payableDays = Math.max(0, daysInMonth - absentDays - unpaidLeaveDays);
              const monthWage = Number(user.baseSalary); // Convert Prisma Decimal to JS Number
              
              let advanceDeduction = 0;
              user.advances.forEach(adv => advanceDeduction += Number(adv.amount));

              // Date-math prorated Benefits Deductions
              const monthStart = new Date(year, monthIndex, 1);
              const monthEnd = new Date(year, monthIndex + 1, 0); // Last day of month
              
              let benefitsDeduction = 0;
              let benefitsEmployerContribution = 0;
              const benefitsBreakdown = [];

              (user.employeeBenefits || []).forEach(eb => {
                const rates = eb.plan?.tierRates?.[eb.coverageTier] || { employeeDeduction: 0, employerContribution: 0 };
                const rawEmp = eb.customDeduction !== null ? Number(eb.customDeduction) : Number(rates.employeeDeduction || 0);
                const rawEr = Number(rates.employerContribution || 0);

                const enrolledDate = new Date(eb.enrolledAt);
                const coverageStart = enrolledDate > monthStart ? enrolledDate : monthStart;

                let coverageEnd = monthEnd;
                if (eb.status === 'CANCELLED' && eb.effectiveEndDate) {
                  const cancelDate = new Date(eb.effectiveEndDate);
                  if (cancelDate < monthEnd) coverageEnd = cancelDate;
                }

                if (coverageStart <= coverageEnd) {
                  const diffMs = Math.abs(coverageEnd - coverageStart);
                  const coveredDays = Math.min(daysInMonth, Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1));
                  const prorationRatio = coveredDays / daysInMonth;

                  const empAmt = Number((rawEmp * prorationRatio).toFixed(2));
                  const erAmt = Number((rawEr * prorationRatio).toFixed(2));

                  benefitsDeduction += empAmt;
                  benefitsEmployerContribution += erAmt;

                  benefitsBreakdown.push({
                    planId: eb.plan.id,
                    planName: eb.plan.name,
                    category: eb.plan.category,
                    coverageTier: eb.coverageTier,
                    coverageStart: coverageStart.toISOString().split('T')[0],
                    coverageEnd: coverageEnd.toISOString().split('T')[0],
                    coveredDays,
                    daysInMonth,
                    employeeDeduction: empAmt,
                    employerContribution: erAmt
                  });
                }
              });

              let dynamicConfig = { ...config };
              
              // Apply compliance rules (mocking state check by simply applying them if they exist)
              complianceRules.forEach(rule => {
                if (rule.ruleType === 'PF' && rule.rateTable) {
                  dynamicConfig.pfEmployeePercent = rule.rateTable.employeeShare || dynamicConfig.pfEmployeePercent;
                  dynamicConfig.pfEmployerPercent = rule.rateTable.employerShare || dynamicConfig.pfEmployerPercent;
                }
                if (rule.ruleType === 'PT' && rule.rateTable) {
                  dynamicConfig.professionalTax = rule.rateTable.amount || dynamicConfig.professionalTax;
                }
              });

              const calc = calculatePayroll(monthWage, payableDays, daysInMonth, dynamicConfig);
              
              let complianceResult = { overtimeHours: 0, overtimeBonus: 0, lateDeductions: 0, deductions: [], bonuses: [] };
              if (user.shiftPolicy && typeof computeShiftCompliance === 'function') {
                complianceResult = computeShiftCompliance(
                  user.attendances,
                  user.shiftPolicy,
                  user.baseSalary,
                  user.leaves
                );
              }
              
              const netAfterAdvancesAndBenefits = Math.max(
                0,
                Number((calc.netSalary - advanceDeduction - benefitsDeduction + (complianceResult.overtimeBonus || 0) - (complianceResult.lateDeductions || 0)).toFixed(2))
              );

              const payroll = await prisma.payroll.upsert({
                where: {
                  tenantId_userId_month: {
                    tenantId: req.user.tenantId,
                    userId: user.id,
                    month
                  }
                },
                update: {
                  entityId: user.entityId || null,
                  monthWage,
                  payableDays,
                  basicSalary: calc.basicSalary,
                  hra: calc.hra,
                  standardAllowance: calc.standardAllowance,
                  performanceBonus: calc.performanceBonus,
                  lta: calc.lta,
                  pfEmployee: calc.pfEmployee,
                  pfEmployer: calc.pfEmployer,
                  professionalTax: calc.professionalTax,
                  fixedAllowance: calc.fixedAllowance,
                  grossSalary: calc.grossSalary,
                  advanceDeduction: advanceDeduction,
                  benefitsDeduction: benefitsDeduction,
                  benefitsBreakdown: benefitsBreakdown,
                  overtimeHours: complianceResult.overtimeHours,
                  overtimeBonus: complianceResult.overtimeBonus,
                  lateDeductions: complianceResult.lateDeductions,
                  deductionBreakdown: complianceResult.deductions,
                  bonusBreakdown: complianceResult.bonuses,
                  netSalary: netAfterAdvancesAndBenefits
                },
                create: {
                  tenantId: req.user.tenantId,
                  entityId: user.entityId || null,
                  userId: user.id,
                  month,
                  monthWage,
                  payableDays,
                  basicSalary: calc.basicSalary,
                  hra: calc.hra,
                  standardAllowance: calc.standardAllowance,
                  performanceBonus: calc.performanceBonus,
                  lta: calc.lta,
                  pfEmployee: calc.pfEmployee,
                  pfEmployer: calc.pfEmployer,
                  professionalTax: calc.professionalTax,
                  fixedAllowance: calc.fixedAllowance,
                  grossSalary: calc.grossSalary,
                  advanceDeduction: advanceDeduction,
                  benefitsDeduction: benefitsDeduction,
                  benefitsBreakdown: benefitsBreakdown,
                  overtimeHours: complianceResult.overtimeHours,
                  overtimeBonus: complianceResult.overtimeBonus,
                  lateDeductions: complianceResult.lateDeductions,
                  deductionBreakdown: complianceResult.deductions,
                  bonusBreakdown: complianceResult.bonuses,
                  netSalary: netAfterAdvancesAndBenefits
                }
              });

              // Mark deducted advances as DEDUCTED
              if (user.advances && user.advances.length > 0) {
                for (const adv of user.advances) {
                  await prisma.salaryAdvance.update({
                    where: { id: adv.id },
                    data: {
                      status: 'Deducted',
                      deducted: true,
                      deductedAt: new Date()
                    }
                  });

                  await prisma.auditLog.create({
                    data: {
                      tenantId: req.user.tenantId,
                      actorId: req.user.id,
                      action: 'SALARY_ADVANCE_DEDUCTED',
                      targetId: user.id,
                      details: `Approved advance of ₹${adv.amount} was deducted from ${month} payroll.`
                    }
                  });

                  try {
                    sendNotification({
                      userId: user.id,
                      tenantId: req.user.tenantId,
                      type: 'SALARY_ADVANCE_DEDUCTED',
                      data: { amount: adv.amount, month }
                    });
                  } catch (e) {
                    console.warn('Failed to send advance deduction notification:', e.message);
                  }
                }
              }

              succeeded.push({ id: user.id, name: user.displayName, netSalary: netAfterAdvancesAndBenefits });
            } catch (err) {
              failed.push({ id: user.id, name: user.displayName, reason: err.message });
            }
          }
      
          // Audit Log
          await prisma.auditLog.create({
            data: {
              actorId: req.user.id,
              action: 'PAYROLL_GENERATED',
              details: `Generated payroll for ${month}. Success: ${succeeded.length}, Failed: ${failed.length}`
            }
          });
          
          if (succeeded.length > 0) {
            dispatchWebhook(req.user.tenantId, 'payroll.generated', {
              month,
              successCount: succeeded.length,
              failedCount: failed.length
            });

            // Dispatch Notifications to all employees who got payroll
            succeeded.forEach(pay => {
              sendNotification({
                userId: pay.id,
                tenantId: req.user.tenantId,
                channel: 'ALL',
                type: 'PAYROLL_GENERATED',
                data: { month, netSalary: pay.netSalary }
              });
            });
          }
      
          res.json({ message: 'Payroll generation complete', succeeded, failed });
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      };
      
      const getMyPayrolls = async (req, res) => {
        try {
          const payrolls = await prisma.payroll.findMany({
            where: { userId: req.user.id },
            orderBy: { month: 'desc' }
          });
          res.json(payrolls);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      };
      
      const getAllPayrolls = async (req, res) => {
        try {
          const isFounder = req.user.roleDefinition?.level === 0;
          const { month } = req.query;
          const filter = month ? { month } : {};
          if (!isFounder) {
            filter.tenantId = req.user.tenantId;
          }

          const payrolls = await prisma.payroll.findMany({
            where: filter,
            include: { user: { select: { displayName: true, employeeId: true } }, tenant: { select: { name: true } } },
            orderBy: { month: 'desc' }
          });
          res.json(payrolls);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      };
      
      const getPayrollsByUser = async (req, res) => {
        try {
          const isFounder = req.user.roleDefinition?.level === 0;
          const { userId } = req.params;
          
          const filter = { userId };
          if (!isFounder) {
            filter.tenantId = req.user.tenantId;
          }

          const payrolls = await prisma.payroll.findMany({
            where: filter,
            include: { user: { select: { displayName: true, employeeId: true } }, tenant: { select: { name: true } } },
            orderBy: { month: 'desc' }
          });
          res.json(payrolls);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      };

      // Config methods
      const getConfig = async (req, res) => {
        try {
          let config = await prisma.payrollConfig.findFirst({ where: { tenantId: req.user.tenantId } });
          if (!config) {
             config = await prisma.payrollConfig.create({
               data: { tenantId: req.user.tenantId, companyName: 'Default Company' }
             });
          }
          res.json(config);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      };
      
      const updateConfig = async (req, res) => {
        try {
          const { companyName, ...rest } = req.body;
          
          // Validation: Basic + HRA + Bonus + LTA + Std Allowance relative to wage shouldn't exceed wage
          // i.e., basic% + (basic% * hra%) + (basic% * bonus%) + (basic% * lta%)
          // Since it's all relative to Basic (except std allowance), we compute:
          const totalPercentageOfWage = rest.basicPercentOfWage * (1 + (rest.hraPercentOfBasic/100) + (rest.bonusPercentOfBasic/100) + (rest.ltaPercentOfBasic/100));
          
          if (totalPercentageOfWage >= 100) {
            return res.status(400).json({ error: 'Config invalid: The sum of Basic, HRA, Bonus, and LTA exceeds 100% of the Month Wage. This would result in negative Fixed Allowance.' });
          }
          
          let config = await prisma.payrollConfig.findFirst({ where: { tenantId: req.user.tenantId } });
          if (config) {
            config = await prisma.payrollConfig.update({
              where: { id: config.id },
              data: { ...rest }
            });
          } else {
            config = await prisma.payrollConfig.create({
              data: { tenantId: req.user.tenantId, companyName: companyName || 'Company', ...rest }
            });
          }
          
          await prisma.auditLog.create({
            data: {
              actorId: req.user.id,
              action: 'CONFIG_UPDATED',
              details: `Payroll configuration updated.`
            }
          });
      
          res.json(config);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      };
      
      const lockPayroll = async (req, res) => {
        try {
          const { id } = req.params;
          const payroll = await prisma.payroll.update({
            where: { id },
            data: { locked: true }
          });
          res.json(payroll);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      };
      
      const getPayslipPdf = async (req, res) => {
        try {
          const { id } = req.params;
          const payroll = await prisma.payroll.findUnique({
            where: { id },
            include: { user: true, tenant: true }
          });
      
          if (!payroll) return res.status(404).json({ error: 'Payroll not found' });
          if (!['Admin', 'SuperAdmin', 'CEO'].includes(req.user.role) && req.user.id !== payroll.userId) {
            return res.status(403).json({ error: 'Unauthorized' });
          }
      
          const PDFDocument = require('pdfkit');
          const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
          
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename=payslip-${payroll.month}.pdf`);
          
          doc.pipe(res);
          
          const companyName = payroll.tenant?.name || 'Company';
          const user = payroll.user;

          let formattedMonthPdf = payroll.month;
          if (payroll.month && payroll.month.includes('-')) {
            const [yr, mo] = payroll.month.split('-');
            formattedMonthPdf = new Date(parseInt(yr), parseInt(mo) - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
          }

          // 1. Header
          doc.fillColor('#4F46E5').fontSize(24).text(companyName, 50, 45, { align: 'left' });
          doc.fillColor('#6B7280').fontSize(10).text(`Payslip for ${formattedMonthPdf}`, 50, 75, { align: 'left' });
          doc.fillColor('#111827').fontSize(20).text('PAYSLIP', 50, 45, { align: 'right' });
          doc.moveTo(50, 95).lineTo(545, 95).strokeColor('#E5E7EB').lineWidth(1).stroke();

          // 2. Employee Details Box
          doc.roundedRect(50, 115, 495, 75, 8).fill('#F9FAFB').stroke('#E5E7EB');
          doc.fillColor('#374151').fontSize(10);
          doc.text('Employee Name:', 70, 130).fillColor('#111827').text(user.displayName || 'N/A', 170, 130);
          doc.fillColor('#374151').text('Employee ID:', 70, 150).fillColor('#111827').text(user.employeeId || 'N/A', 170, 150);
          doc.fillColor('#374151').text('Designation:', 70, 170).fillColor('#111827').text('Employee', 170, 170);
          doc.fillColor('#374151').text('Pay Period:', 320, 130).fillColor('#111827').text(formattedMonthPdf, 400, 130);
          doc.fillColor('#374151').text('Payable Days:', 320, 150).fillColor('#111827').text(payroll.payableDays.toString(), 400, 150);

          // 3. Salary Details Table
          const tableTop = 215;
          doc.roundedRect(50, tableTop, 495, 30, 4).fill('#4F46E5');
          doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica-Bold');
          doc.text('Earnings', 70, tableTop + 10);
          doc.text('Amount', 220, tableTop + 10, { width: 70, align: 'right' });
          doc.text('Deductions', 320, tableTop + 10);
          doc.text('Amount', 450, tableTop + 10, { width: 70, align: 'right' });

          doc.font('Helvetica');
          let y = tableTop + 45;

          const drawRow = (earnLabel, earnAmt, dedLabel, dedAmt, isLast = false) => {
            doc.fillColor('#374151').fontSize(10);
            if (earnLabel) doc.text(earnLabel, 70, y);
            if (earnAmt !== null) doc.text(`Rs ${earnAmt.toFixed(2)}`, 220, y, { width: 70, align: 'right' });
            if (dedLabel) doc.text(dedLabel, 320, y);
            if (dedAmt !== null) doc.text(`Rs ${dedAmt.toFixed(2)}`, 450, y, { width: 70, align: 'right' });
            y += 25;
            if (!isLast) doc.moveTo(50, y - 10).lineTo(545, y - 10).strokeColor('#F3F4F6').lineWidth(1).stroke();
          };

          const earnings = [
            { label: 'Basic Salary', amount: payroll.basicSalary },
            { label: 'House Rent Allowance (HRA)', amount: payroll.hra },
            { label: 'Standard Allowance', amount: payroll.standardAllowance },
            { label: 'Performance Bonus', amount: payroll.performanceBonus },
            { label: 'Leave Travel Allowance (LTA)', amount: payroll.lta },
            { label: 'Fixed Allowance', amount: payroll.fixedAllowance }
          ];

          const deductions = [
            { label: 'PF Employee', amount: payroll.pfEmployee },
            { label: 'Professional Tax', amount: payroll.professionalTax }
          ];
          if (payroll.advanceDeduction > 0) {
            deductions.push({ label: 'Salary Advance Recovery', amount: payroll.advanceDeduction });
          }

          if (payroll.overtimeBonus > 0) {
            earnings.push({ label: `Overtime Bonus (${payroll.overtimeHours.toFixed(1)}h)`, amount: payroll.overtimeBonus });
          }
          if (payroll.lateDeductions > 0) {
            deductions.push({ label: 'Attendance Timing Deductions', amount: payroll.lateDeductions });
          }

          const rowsCount = Math.max(earnings.length, deductions.length);
          if (rowsCount === 0) {
              drawRow('No Earnings', 0, 'No Deductions', 0);
          } else {
              for (let i = 0; i < rowsCount; i++) {
                drawRow(earnings[i]?.label, earnings[i]?.amount ?? null, deductions[i]?.label, deductions[i]?.amount ?? null);
              }
          }

          doc.moveTo(50, y - 5).lineTo(545, y - 5).strokeColor('#E5E7EB').lineWidth(1).stroke();
          doc.font('Helvetica-Bold').fillColor('#111827');
          doc.text('Gross Earnings', 70, y + 5);
          doc.text(`Rs ${payroll.grossSalary.toFixed(2)}`, 220, y + 5, { width: 70, align: 'right' });

          const totalDeductions = (payroll.pfEmployee || 0) + (payroll.professionalTax || 0) + (payroll.advanceDeduction || 0) + (payroll.lateDeductions || 0);
          doc.text('Total Deductions', 320, y + 5);
          doc.text(`Rs ${totalDeductions.toFixed(2)}`, 450, y + 5, { width: 70, align: 'right' });

          // 4. Net Salary Block
          y += 40;
          doc.roundedRect(50, y, 495, 50, 8).fill('#F0FDF4').stroke('#BBF7D0');
          doc.fillColor('#166534').fontSize(14).font('Helvetica-Bold');
          doc.text('NET SALARY', 70, y + 18);
          doc.fontSize(18);
          doc.text(`Rs ${payroll.netSalary.toFixed(2)}`, 320, y + 15, { width: 200, align: 'right' });

          // 5. Add footer to all pages (Made with Crew)
          const pages = doc.bufferedPageRange();
          for (let i = 0; i < pages.count; i++) {
            doc.switchToPage(i);
            if (i > 0) {
              doc.fillColor('#4F46E5').font('Helvetica').fontSize(14).text(companyName, 50, 45, { align: 'left' });
              doc.moveTo(50, 65).lineTo(545, 65).strokeColor('#E5E7EB').lineWidth(1).stroke();
            }
            doc.font('Helvetica').fontSize(10);
            const bottomY = doc.page.height - 80;
            doc.moveTo(50, bottomY - 15).lineTo(545, bottomY - 15).strokeColor('#E5E7EB').lineWidth(1).stroke();
            const fullText = 'Made with Crew - All rights reserved.';
            const startX = (595.28 - doc.widthOfString(fullText)) / 2;
            doc.fillColor('#9CA3AF').text('Made with ', startX, bottomY, { continued: true })
               .fillColor('#4F46E5').text('Crew', { link: 'https://crewhrms.com', continued: true, underline: true })
               .fillColor('#9CA3AF').text(' - All rights reserved.', { link: null, underline: false, continued: false });
          }

          doc.end();
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      };
      
      const getAuditLogs = async (req, res) => {
        try {
          const logs = await prisma.auditLog.findMany({
            orderBy: { createdAt: 'desc' }
          });
          res.json(logs);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      };
      
      const getForecastBaseline = async (req, res) => {
        try {
          const tenantId = req.user.tenantId;

          // Fetch payroll config
          let config = await prisma.payrollConfig.findFirst({ where: { tenantId } });
          if (!config) {
            config = {
              basicPercentOfWage: 50.0,
              hraPercentOfBasic: 40.0,
              pfEmployerPercent: 12.0
            };
          }

          // Aggregate by department
          const aggregates = await prisma.user.groupBy({
            by: ['department'],
            where: { tenantId, status: 'Active' },
            _sum: { baseSalary: true },
            _count: { _all: true }
          });

          let totalHeadcount = 0;
          let totalBaseSalary = 0;
          const departments = aggregates.map(agg => {
            const headcount = agg._count._all || 0;
            const deptBaseSalary = agg._sum.baseSalary || 0;
            totalHeadcount += headcount;
            totalBaseSalary += deptBaseSalary;
            return {
              name: agg.department || 'Unassigned',
              headcount,
              totalBaseSalary: deptBaseSalary
            };
          });

          res.json({
            totalHeadcount,
            totalBaseSalary,
            departments,
            payrollConfig: {
              basicPercent: config.basicPercentOfWage,
              hraPercent: config.hraPercentOfBasic,
              employerPfPercent: config.pfEmployerPercent
            }
          });
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      };
      
module.exports = {
  requestAdvance,
  updateAdvanceStatus,
  getAllAdvances,
  getMyAdvances,
  generateMonthlyPayroll,
  getMyPayrolls,
  getAllPayrolls,
  getPayrollsByUser,
  getConfig,
  updateConfig,
  lockPayroll,
  getPayslipPdf,
  getAuditLogs,
  getForecastBaseline
};
