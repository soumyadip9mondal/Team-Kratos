const prisma = require('../config/db');
const templates = require('./emailTemplates');
const axios = require('axios');

/**
 * 0.7 Omnichannel Notification Engine
 * Handles dispatching professional email notifications via Resend API.
 */

// ── Strip HTML to plain text ────────────────────────────────────
const htmlToPlainText = (html) => {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

// ── Send raw email (Google Apps Script API) ────────────────────────────────
const sendEmail = async (to, subject, body, attachmentBase64 = null, attachmentName = null) => {
  const { GOOGLE_SCRIPT_URL } = process.env;

  if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL === 'your_google_script_url_here') {
    console.log(`[SIMULATED EMAIL DISPATCHED] To: ${to} | Subject: ${subject}`);
    return true;
  }

  try {
    const payload = {
      to: to,
      subject: subject,
      html: body,
      name: 'Crew HRMS'
    };

    // Google Apps Script doesn't natively handle base64 attachments as easily without advanced code,
    // so we skip them for this free API bridge or handle them differently if absolutely needed.

    const response = await axios.post(GOOGLE_SCRIPT_URL, JSON.stringify(payload), {
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    });

    const data = response.data;
    if (data.status !== 'success') {
      throw new Error(data.message || 'Google Script API failed');
    }

    console.log(`[GOOGLE API DISPATCHED] To: ${to} | Status: Success`);
    return true;
  } catch (error) {
    console.error(`[GOOGLE API ERROR] Failed to send to ${to}:`, error.message);
    return false;
  }
};

// ── Main Notification Dispatcher ───────────────────────────────
const sendNotification = async (params) => {
  try {
    const {
      userId: rawUserId,
      recipientId,
      tenantId,
      type,
      data = {},
      title,
      message: customMessage,
      link
    } = params || {};

    let attachmentBase64 = params?.attachmentBase64 || null;
    let attachmentName = params?.attachmentName || null;

    const userId = rawUserId || recipientId;
    if (!userId) {
      console.error('[NOTIFICATION ERROR] Missing userId/recipientId in sendNotification params');
      return;
    }

    const user = await prisma.basePrisma.user.findUnique({
      where: { id: userId },
      select: { email: true, personalEmail: true, phone: true, displayName: true, employeeId: true, roleDefinition: { select: { level: true } } }
    });

    console.log(`[NOTIFICATION] type=${type} | userId=${userId} | email=${user?.email || 'NOT FOUND'}`);

    if (!user) return;
    if (!user.email) {
      console.error(`[NOTIFICATION ERROR] User ${userId} has no email address in DB!`);
      return;
    }

    // Fetch company name if tenantId is provided
    let companyName = 'Crew HRMS';
    if (tenantId) {
      try {
        const tenant = await prisma.basePrisma.tenant.findUnique({
          where: { id: tenantId },
          select: { name: true }
        });
        if (tenant?.name) companyName = tenant.name;
      } catch (_) { /* Non-critical, fallback to default */ }
    }

    const firstName = (user.displayName || 'there').split(' ')[0];
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    let subject = null;
    let message = null;
    // let attachmentBase64 = null;
    // let attachmentName = null;

    // Use the extracted templates
    const templateArgs = {
      ...data, // Spread data first to avoid overriding base parameters securely loaded from DB
      companyName,
      firstName,
      frontendUrl,
      email: user.email,
      employeeId: user.employeeId,
      title: title || data.title,
      message: customMessage || data.message,
      link: link || data.link
    };

    switch (type) {
      case 'NEW_ACCOUNT_CREDENTIALS':
        ({ subject, message } = templates.getNewAccountCredentialsTemplate(templateArgs));
        break;

      case 'WELCOME_ONBOARDING_INVITE':
        ({ subject, message } = templates.getWelcomeOnboardingInviteTemplate(templateArgs));
        break;

      case 'OTP_VERIFICATION':
        ({ subject, message } = templates.getOtpVerificationTemplate(templateArgs));
        break;

      case 'PASSWORD_RESET':
        ({ subject, message } = templates.getPasswordResetTemplate(templateArgs));
        break;

      case 'PASSWORD_CHANGED':
        ({ subject, message } = templates.getPasswordChangedTemplate(templateArgs));
        break;

      case 'WELCOME_VERIFIED':
        ({ subject, message } = templates.getWelcomeVerifiedTemplate(templateArgs));
        break;

      case 'PAYROLL_GENERATED':
        ({ subject, message } = templates.getPayrollGeneratedTemplate(templateArgs));
        
        try {
          const payroll = await prisma.basePrisma.payroll.findUnique({
            where: { tenantId_userId_month: { tenantId, userId, month: data.month } }
          });

          if (payroll) {
              const PDFDocument = require('pdfkit');
              const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
              const buffers = [];

              await new Promise((resolve, reject) => {
                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => {
                  attachmentBase64 = Buffer.concat(buffers).toString('base64');
                  attachmentName = `Payslip-${data.month}.pdf`;
                  resolve();
                });
                doc.on('error', reject);

                let formattedMonthPdf = payroll.month;
                if (payroll.month && payroll.month.includes('-')) {
                  const [yr, mo] = payroll.month.split('-');
                  formattedMonthPdf = new Date(parseInt(yr), parseInt(mo) - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
                }

                // 1. Header
                doc.fillColor('#4F46E5')
                   .fontSize(24)
                   .text(companyName, 50, 45, { align: 'left' });
                   
                doc.fillColor('#6B7280')
                   .fontSize(10)
                   .text(`Payslip for ${formattedMonthPdf}`, 50, 75, { align: 'left' });

                doc.fillColor('#111827')
                   .fontSize(20)
                   .text('PAYSLIP', 50, 45, { align: 'right' });

                // Divider
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
                
                // Table Header
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
                  if (!isLast) {
                    doc.moveTo(50, y - 10).lineTo(545, y - 10).strokeColor('#F3F4F6').lineWidth(1).stroke();
                  }
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

                const rowsCount = Math.max(earnings.length, deductions.length);
                if (rowsCount === 0) {
                    drawRow('No Earnings', 0, 'No Deductions', 0);
                } else {
                    for (let i = 0; i < rowsCount; i++) {
                      const earn = earnings[i] || {};
                      const ded = deductions[i] || {};
                      drawRow(earn.label, earn.amount ?? null, ded.label, ded.amount ?? null);
                    }
                }

                // Table Footer (Gross & Total Deductions)
                doc.moveTo(50, y - 5).lineTo(545, y - 5).strokeColor('#E5E7EB').lineWidth(1).stroke();
                
                doc.font('Helvetica-Bold').fillColor('#111827');
                doc.text('Gross Earnings', 70, y + 5);
                doc.text(`Rs ${payroll.grossSalary.toFixed(2)}`, 220, y + 5, { width: 70, align: 'right' });

                  const totalDeductions = (payroll.pfEmployee || 0) + (payroll.professionalTax || 0) + (payroll.advanceDeduction || 0);
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
                  
                  // If it's page 2 or beyond, ensure company name header is there
                  if (i > 0) {
                    doc.fillColor('#4F46E5').font('Helvetica').fontSize(14).text(companyName, 50, 45, { align: 'left' });
                    doc.moveTo(50, 65).lineTo(545, 65).strokeColor('#E5E7EB').lineWidth(1).stroke();
                  }

                  // Footer
                  doc.font('Helvetica').fontSize(10);
                  const bottomY = doc.page.height - 80;
                  
                  doc.moveTo(50, bottomY - 15).lineTo(545, bottomY - 15).strokeColor('#E5E7EB').lineWidth(1).stroke();
                  
                  const fullText = 'Made with Crew - All rights reserved.';
                  const textWidth = doc.widthOfString(fullText);
                  const startX = (595.28 - textWidth) / 2;
                  
                  doc.fillColor('#9CA3AF').text('Made with ', startX, bottomY, { continued: true })
                     .fillColor('#4F46E5').text('Crew', { link: 'https://hrms-crew.vercel.app', continued: true, underline: true })
                     .fillColor('#9CA3AF').text(' - All rights reserved.', { underline: false, continued: false });
                }

                doc.end();
              });
          }
        } catch (pdfErr) {
          console.error('Error generating PDF attachment:', pdfErr);
        }
        break;

      case 'LEAVE_APPROVED':
        ({ subject, message } = templates.getLeaveApprovedTemplate(templateArgs));
        break;

      case 'UNAPPROVED_ABSENCE':
        ({ subject, message } = templates.getUnapprovedAbsenceTemplate(templateArgs));
        break;

      case 'LATE_CLOCK_IN':
        ({ subject, message } = templates.getLateClockInTemplate(templateArgs));
        break;

      case 'COMPANY_CREATED':
        ({ subject, message } = templates.getCompanyCreatedTemplate(templateArgs));
        break;

      case 'COMPANY_ANNOUNCEMENT':
        ({ subject, message } = templates.getCompanyAnnouncementTemplate(templateArgs));
        break;

      case 'BIRTHDAY_WISH':
        ({ subject, message } = templates.getBirthdayWishTemplate(templateArgs));
        break;

      case 'SHIFT_ASSIGNED':
        ({ subject, message } = templates.getShiftAssignedTemplate(templateArgs));
        break;

      case 'EXPENSE_APPROVED':
      case 'EXPENSE_REJECTED':
      case 'EXPENSE_SETTLED':
        ({ subject, message } = templates.getExpenseStatusTemplate(templateArgs));
        break;

      case 'LEAVE_REJECTED':
        ({ subject, message } = templates.getLeaveRejectedTemplate(templateArgs));
        break;

      case 'LEAVE_APPLIED_CONFIRMATION':
        ({ subject, message } = templates.getLeaveAppliedConfirmationTemplate(templateArgs));
        break;

      case 'MEETING_REMINDER':
        ({ subject, message } = templates.getMeetingReminderTemplate(templateArgs));
        break;

      case 'WORK_ANNIVERSARY':
        ({ subject, message } = templates.getWorkAnniversaryTemplate(templateArgs));
        break;
        
      case 'PROXY_ALERT_HIGH':
        ({ subject, message } = templates.getProxyAlertTemplate(templateArgs));
        break;

      case 'SALARY_ADVANCE_REQUESTED':
        ({ subject, message } = templates.getSalaryAdvanceRequestedTemplate(templateArgs));
        break;

      case 'SALARY_ADVANCE_APPROVED':
      case 'SALARY_ADVANCE_REJECTED':
        ({ subject, message } = templates.getSalaryAdvanceStatusTemplate(templateArgs));
        break;

      case 'PROFILE_UPDATED':
        ({ subject, message } = templates.getProfileUpdatedTemplate(templateArgs));
        break;

      case '1ON1_SCHEDULED':
        ({ subject, message } = templates.getOneOnOneScheduledTemplate(templateArgs));
        break;

      case 'DOCUMENT_GENERATED': {
        const titleText = data.title || title || '📄 New Official Document Issued';
        const msgText = data.message || customMessage || 'A new document has been generated for your record.';
        ({ subject, message } = templates.getCustomNotificationTemplate({
          ...templateArgs,
          title: titleText,
          messageText: msgText,
          link: data.link || link || '/dashboard/documents'
        }));
        break;
      }

      case 'BENEFIT_ENROLLED': {
        const titleText = data.title || title || '🎉 Benefit Plan Enrolled';
        const msgText = data.message || customMessage || 'You have successfully enrolled in a benefit plan.';
        ({ subject, message } = templates.getCustomNotificationTemplate({
          ...templateArgs,
          title: titleText,
          messageText: msgText,
          link: data.link || link || '/dashboard/benefits'
        }));
        break;
      }

      case 'AUDIT_TAMPER_DETECTED': {
        const titleText = '🚨 Security Alert: Audit Log Tamper Detected';
        const msgText = `Audit record #${data.recordId || ''} (${data.action || 'Unknown Action'}) failed integrity verification.`;
        ({ subject, message } = templates.getCustomNotificationTemplate({
          ...templateArgs,
          title: titleText,
          messageText: msgText,
          link: '/dashboard/security'
        }));
        break;
      }

      default: {
        const customTitle = data?.title || title;
        const customMsg = data?.message || data?.messageContent || customMessage;
        if (customTitle && customMsg) {
          ({ subject, message } = templates.getCustomNotificationTemplate({
            ...templateArgs,
            title: customTitle,
            messageText: customMsg,
            link: data?.link || link
          }));
        } else {
          // Suppress generic "You have a new update" email notifications completely
          console.log(`[NOTIFICATION SKIPPED] Suppressing generic uninformative email for type=${type} to user ${userId}`);
          break;
        }
      }
    }

    // Dispatch Email asynchronously in background (non-blocking) so HTTP API calls return instantly
    if (user.email && subject && message) {
      sendEmail(user.email, subject, message, attachmentBase64, attachmentName)
        .then(isSent => {
          if (isSent && tenantId) {
            prisma.basePrisma.auditLog.create({
              data: {
                actorId: userId,
                action: 'NOTIFICATION_SENT',
                tenantId,
                details: `Sent ${type} via EMAIL. Subject: ${subject}`
              }
            }).catch(auditError => {
              console.warn(`[NOTIFICATION AUDIT WARNING] Could not write audit log for ${type}:`, auditError.message);
            });
          }
        })
        .catch(err => console.error(`[NOTIFICATION ERROR] Email dispatch failed for ${type}:`, err.message));

      if (user.personalEmail && user.personalEmail.trim().length > 0 && user.personalEmail.toLowerCase() !== user.email.toLowerCase()) {
        sendEmail(user.personalEmail, subject, message, attachmentBase64, attachmentName)
          .then(() => console.log(`[NOTIFICATION] Dual-sent ${type} notification to personal email: ${user.personalEmail}`))
          .catch(err => console.error(`[NOTIFICATION WARNING] Could not send copy to personal email (${user.personalEmail}):`, err.message));
      }
    } else {
      console.log(`[NOTIFICATION SKIPPED] Suppressed email dispatch for type=${type} (no email subject/body)`);
    }

    // Create AppNotification for the target user's personal dashboard inbox (Exclude security credentials)
    const isSensitiveSecurityType = ['OTP_VERIFICATION', 'PASSWORD_RESET', 'PASSWORD_CHANGED', 'NEW_ACCOUNT_CREDENTIALS'].includes(type);
    if (tenantId && userId && !isSensitiveSecurityType) {
      try {
        await prisma.basePrisma.appNotification.create({
          data: {
            tenantId,
            userId,
            type,
            title: title || subject || type,
            message: customMessage || (message ? htmlToPlainText(message).substring(0, 150) + '...' : 'You have a new notification.'),
            data: { ...data, link }
          }
        });
        
        // Use websocket to emit to this specific user's inbox
        if (global.io) {
          global.io.to(`tenant:${tenantId}:user:${userId}`).emit('inbox:updated', { message: title || subject || type });
        }
      } catch (err) {
        console.error('[NOTIFICATION AppNotification ERROR]', err);
      }
    }

  } catch (error) {
    console.error('Notification Engine Error:', error);
  }
};

module.exports = { sendNotification, sendEmail };
