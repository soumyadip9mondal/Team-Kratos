const prisma = require('../config/db');
const { withRetry } = prisma;
const auth = require('../middleware/auth');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { dispatchWebhook } = require('../utils/webhookDispatcher');
const { sendNotification, sendEmail } = require('../utils/notificationEngine');
const templates = require('../utils/emailTemplates');

// ── Helpers ───────────────────────────────────────────────

const generateAuthToken = (user) => {
  return jwt.sign(
    { _id: user.id, role: user.roleDefinition?.name, customRole: user.customRole, tenantId: user.tenantId },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit OTP
};

/**
 * Generate employeeId in format: CI[First2][Last2][YYYY][0001]
 * Example: John Doe joining in 2026 → CIJODO20260001
 */
const generateEmployeeId = async (displayName) => {
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
};

// ── Sign Up (Admin / Employee Invitation) ──────────────────────

const signup = async (req, res) => {
  try {
    const { displayName, email, phone, password, confirmPassword, companyName, department } = req.body;

    // Validate confirm password
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    // Check duplicate email
    const existing = await prisma.basePrisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const employeeId = await generateEmployeeId(displayName);

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    let assignedRole = 'Employee';
    let assignedTenantId = null;
    let assignedRoleDefinitionId = null;
    
    if (email.toLowerCase() === 'barshanmajumdar249@gmail.com') {
      assignedRole = 'SuperAdmin';
    } else {
      const isAdminEmail = await prisma.basePrisma.adminEmail.findFirst({ where: { email } });
      const isInvitedEmployee = await prisma.basePrisma.invitedEmployee.findFirst({ where: { email } });

      if (isAdminEmail) {
        assignedRole = 'Admin';
        assignedTenantId = isAdminEmail.tenantId;
        // Find the tenant's Level 1 (HR Admin) RoleDefinition to assign
        if (assignedTenantId) {
          const adminRoleDef = await prisma.basePrisma.roleDefinition.findFirst({
            where: { tenantId: assignedTenantId, level: 1 }
          });
          assignedRoleDefinitionId = adminRoleDef?.id || null;
        }
      } else if (isInvitedEmployee) {
        assignedRole = 'Employee';
        assignedTenantId = isInvitedEmployee.tenantId;
        // Use the pre-assigned roleDefinitionId if the admin set one, else fallback to least-privileged
        if (isInvitedEmployee.roleDefinitionId) {
          assignedRoleDefinitionId = isInvitedEmployee.roleDefinitionId;
        } else if (assignedTenantId) {
          const employeeRoleDef = await prisma.basePrisma.roleDefinition.findFirst({
            where: { tenantId: assignedTenantId },
            orderBy: { level: 'desc' }
          });
          assignedRoleDefinitionId = employeeRoleDef?.id || null;
        }
      } else {
        // Block all unauthorized signups
        return res.status(403).json({ 
          error: 'User not found. Please register your company first, or ask your HR/Admin to invite or add you.' 
        });
      }
    }

    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    const user = await prisma.basePrisma.user.create({
      data: {
        employeeId,
        email,
        phone: phone || null,
        password: hashedPassword,
        tenantId: assignedTenantId,
        roleDefinitionId: assignedRoleDefinitionId,   // ← Assign the correct RoleDefinition
        mustChangePassword: false,
        emailVerified: false,
        otpCode: otp,
        otpExpiry,
        displayName: displayName || null,
        // Apply pre-assigned department/location from invite record if set, else use signup-provided
        department: isInvitedEmployee?.department || department || null,
        location: isInvitedEmployee?.branch || null,
        companyName: companyName || null,
        dateOfJoining: new Date()
      },
      include: { roleDefinition: true }  // ← Always include so frontend gets full role data
    });

    // Optionally delete from invited list so it isn't reused (though User table unique constraint prevents reuse anyway)
    // We are keeping it so the admin can see a history of all invitations they've sent.
    
    if (assignedTenantId) {
      // Fire webhook
      dispatchWebhook(assignedTenantId, 'user.created', {
        userId: user.id,
        employeeId: user.employeeId,
        email: user.email
      });

      // Fire notification
      sendNotification({
        userId: user.id,
        tenantId: assignedTenantId,
        channel: 'EMAIL',
        type: 'WELCOME'
      });
      
      // Fire OTP notification
      sendNotification({
        userId: user.id,
        tenantId: assignedTenantId,
        channel: 'EMAIL',
        type: 'OTP_VERIFICATION',
        data: { otp }
      });
    }
    
    const token = generateAuthToken(user);
    const { password: _, ...safeUser } = user;

    res.status(201).json({ user: safeUser, token });
  } catch (error) {
    console.error('Signup error:', error);
    if (error.name?.includes('Prisma') || error.message?.includes('prisma')) {
      return res.status(500).json({ error: 'A database error occurred. Please try again later.' });
    }
    res.status(400).json({ error: error.message || 'An unexpected error occurred during signup.' });
  }
};

// ── Login (accepts email OR employeeId) ──────────────────

const login = async (req, res) => {
  try {
    const { identifier, password, source } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Login ID/Email and password are required' });
    }

    // Try finding by email first, then by employeeId
    // withRetry handles Neon cold-start: compute takes ~3-5s to wake up
    let user = await withRetry(() => prisma.basePrisma.user.findUnique({ 
      where: { email: identifier },
      include: { roleDefinition: true }
    }));
    if (!user) {
      user = await withRetry(() => prisma.basePrisma.user.findFirst({ 
        where: { employeeId: identifier },
        include: { roleDefinition: true }
      }));
    }

    if (!user) {
      return res.status(400).json({ error: 'User not found. Please register your company first, or ask your HR/Admin to invite or add you.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid login credentials' });
    }

    // Block Console access for non-admins BEFORE sending OTP
    const roleLevel = user.roleDefinition?.level ?? 99;
    // UX shortcut: provide an early friendly error when the client identifies as a console login.
    // SECURITY NOTE: This is NOT the real access gate — the `requireConsoleAccess` middleware
    // on every console route is the authoritative check. Never rely on client-provided `source`.
    if (source === 'console' && roleLevel > 1) {
      return res.status(403).json({ error: 'This dashboard is for company administrators. Please use the App.' });
    }

    let requireOtp = false;

    if (!user.mustChangePassword) {
      // Send OTP for 2FA only if password has been changed
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      await prisma.basePrisma.user.update({
        where: { id: user.id },
        data: { 
          otpCode: otp,
          otpExpiry: new Date(Date.now() + 15 * 60 * 1000) 
        }
      });

      sendNotification({
        userId: user.id,
        tenantId: user.tenantId,
        channel: 'EMAIL',
        type: 'OTP_VERIFICATION',
        data: { otp }
      });
      requireOtp = true;
    }

    const token = generateAuthToken(user);
    const { password: _, ...safeUser } = user;

    res.cookie('jwt', token, {
      domain: process.env.COOKIE_DOMAIN || undefined,
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({ user: safeUser, token, requireOtp });
  } catch (error) {
    console.error('Login error:', error);
    if (error.name?.includes('Prisma') || error.message?.includes('prisma')) {
      return res.status(500).json({ error: 'A database error occurred. Please try again later.', details: error.message, stack: error.stack });
    }
    res.status(400).json({ error: error.message || 'An unexpected error occurred during login.' });
  }
};

// ── Change Password ──────────────────────────────────────

const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const user = req.user;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Old password and new password are required' });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await prisma.basePrisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        mustChangePassword: false,
        otpCode: otp,
        otpExpiry: new Date(Date.now() + 15 * 60 * 1000) 
      }
    });

    sendNotification({
      userId: user.id,
      tenantId: user.tenantId,
      channel: 'EMAIL',
      type: 'OTP_VERIFICATION',
      data: { otp }
    });

    // Notify the user that their password was changed
    sendNotification({
      userId: user.id,
      tenantId: user.tenantId,
      channel: 'EMAIL',
      type: 'PASSWORD_CHANGED',
      data: {}
    });

    res.json({ message: 'Password changed successfully', requireOtp: true });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(400).json({ error: error.message });
  }
};

// ── Get current authenticated user ───────────────────────

const getMe = async (req, res) => {
  const { password: _, attritionRiskScore, attritionRiskLabel, riskUpdatedAt, ...safeUser } = req.user;
  res.json(safeUser);
};

// ── Register New Company (From Marketing Site) ───────────

const sendRegistrationOtp = async (req, res) => {
  try {
    const { email, companyName, ceoName } = req.body;
    if (!email || !companyName || !ceoName) {
      return res.status(400).json({ error: 'Email, Company Name, and CEO Name are required' });
    }

    const existingUser = await prisma.basePrisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.basePrisma.pendingRegistration.upsert({
      where: { email },
      update: { otpCode: otp, otpExpiry, payload: req.body },
      create: { email, otpCode: otp, otpExpiry, payload: req.body }
    });

    const { subject, message } = templates.getOtpVerificationTemplate({
      companyName,
      firstName: ceoName.split(' ')[0],
      otp,
      frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173'
    });

    sendEmail(email, subject, message).catch(console.error);

    res.json({ message: 'OTP sent successfully', otpCode: otp });
  } catch (error) {
    console.error('Send Registration OTP error:', error);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
};

const registerCompany = async (req, res) => {
  try {
    let payloadData;
    let email = req.body.email;

    if (req.body.companyName && req.body.email && req.body.password && req.body.ceoName) {
      // Direct registration mode (no OTP verification step)
      payloadData = req.body;
    } else {
      // OTP-based registration mode (fallback lookup from pendingRegistration)
      const { otpCode } = req.body;
      if (!email || !otpCode) {
        return res.status(400).json({ error: 'Email and OTP or full company details are required' });
      }

      const pendingReg = await prisma.basePrisma.pendingRegistration.findUnique({ where: { email } });
      if (!pendingReg) {
        return res.status(400).json({ error: 'No pending registration found for this email' });
      }

      if (pendingReg.otpCode !== otpCode) {
        return res.status(400).json({ error: 'Invalid OTP' });
      }

      if (new Date() > new Date(pendingReg.otpExpiry)) {
        return res.status(400).json({ error: 'OTP has expired' });
      }

      payloadData = pendingReg.payload;
    }

    const { 
      companyName, legalName, industry, size, website, founded, 
      pan, gstin, cin, address, city, state, pincode, country, 
      departments, customRoles, 
      ceoName, designation, phone, password 
    } = payloadData;

    const normalizedEmail = (email || '').toLowerCase().trim();

    if (!companyName || !normalizedEmail || !password || !ceoName) {
      return res.status(400).json({ error: 'Company name, CEO name, email, and password are required' });
    }

    // Check duplicate email
    const existingUser = await prisma.basePrisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      return res.status(400).json({ error: 'This email address is already registered. Please sign in or use a different email.' });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    const employeeId = await generateEmployeeId(ceoName);

    const domainVal = (website && website.trim()) ? website.trim().toLowerCase() : null;
    const panVal = (pan && pan.trim()) ? pan.trim().toUpperCase() : null;
    const gstinVal = (gstin && gstin.trim()) ? gstin.trim().toUpperCase() : null;
    const cinVal = (cin && cin.trim()) ? cin.trim().toUpperCase() : null;

    // Run in a transaction
    const result = await prisma.basePrisma.$transaction(async (tx) => {
      // 1. Create Tenant with all statutory info
      const tenant = await tx.tenant.create({
        data: {
          name: String(companyName).trim(),
          domain: domainVal,
          planTier: 'Free',
          pan: panVal,
          gstin: gstinVal,
          cin: cinVal,
          industry: industry ? String(industry).trim() : null,
          size: size ? String(size).trim() : null,
          founded: founded ? String(founded).trim() : null,
          address: address ? String(address).trim() : null,
          city: city ? String(city).trim() : null,
          state: state ? String(state).trim() : null,
          pincode: pincode ? String(pincode).trim() : null,
          country: country ? String(country).trim() : null,
          departments: departments || [],
          customRoles: customRoles || []
        }
      });

      // 2. Seed Role Definitions
      let rolesToCreate = customRoles && customRoles.length > 0 ? customRoles : [
        { name: 'Owner', level: 0, isOwnerRole: true, isSystemDefault: true, canAccessConsole: true },
        { name: 'HR Admin', level: 1, isOwnerRole: false, isSystemDefault: true, canAccessConsole: true },
        { name: 'Manager', level: 2, isOwnerRole: false, isSystemDefault: true, canAccessConsole: false },
        { name: 'Employee', level: 3, isOwnerRole: false, isSystemDefault: true, canAccessConsole: false }
      ];

      const createdRoles = [];
      for (const r of rolesToCreate) {
        const levelNum = typeof r.level === 'number' ? r.level : (parseInt(r.level, 10) || 0);
        const roleDef = await tx.roleDefinition.create({
          data: {
            tenantId: tenant.id,
            name: String(r.name),
            level: levelNum,
            isOwnerRole: levelNum === 0,
            isSystemDefault: r.isSystemDefault || false,
            canAccessConsole: levelNum <= 1
          }
        });
        createdRoles.push(roleDef);
      }

      const ownerRole = createdRoles.find(r => r.level === 0) || createdRoles[0];

      // 3. Create CEO (Level 0)
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          employeeId,
          email: email.toLowerCase().trim(),
          password: hashedPassword,
          roleDefinitionId: ownerRole.id,
          customRole: ownerRole.name,
          mustChangePassword: false,
          emailVerified: true,
          otpCode: null,
          otpExpiry: null,
          displayName: ceoName,
          jobPosition: designation || 'CEO / Founder',
          phone: phone || null,
          companyName: companyName,
          dateOfJoining: new Date()
        },
        include: { roleDefinition: true }
      });

      // 4. Create Default Configurations
      await tx.payrollConfig.create({
        data: {
          tenantId: tenant.id,
          companyName: companyName,
          pfEmployeePercent: 12.0,
          pfEmployerPercent: 12.0,
          professionalTax: 200.0,
          standardAllowance: 4167.0
        }
      });

      const { seed: seedCommunicationReview } = require('../services/communicationPersonaSeeder');
      await seedCommunicationReview(tx, tenant.id);

      await tx.leavePolicy.create({
        data: {
          tenantId: tenant.id,
          name: 'Annual Leave',
          annualQuota: 20,
          isPaid: true
        }
      });

      return user;
    }, {
      maxWait: 10000,
      timeout: 20000
    });

    // Fire Company Created Notification
    sendNotification({
      userId: result.id,
      tenantId: result.tenantId,
      channel: 'EMAIL',
      type: 'COMPANY_CREATED',
      data: { companyName: result.companyName, ceoName: result.displayName }
    }).catch(() => {});

    await prisma.basePrisma.pendingRegistration.deleteMany({ where: { email } });

    const token = generateAuthToken(result);
    const { password: _, ...safeUser } = result;

    res.cookie('jwt', token, {
      domain: process.env.NODE_ENV === 'production' ? '.crewhr.io' : 'localhost',
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.status(201).json({ user: safeUser, token });
  } catch (error) {
    console.error('Register company error:', error);
    let userMsg = error.message || 'An unexpected error occurred during company registration.';
    if (error.code === 'P2002') {
      const target = error.meta?.target;
      if (Array.isArray(target) && target.includes('email')) {
        userMsg = 'This email address is already registered. Please sign in or use a different email.';
      } else if (Array.isArray(target) && target.includes('domain')) {
        userMsg = 'This company domain is already registered.';
      } else {
        userMsg = 'A workspace or account with these details already exists.';
      }
    }
    res.status(400).json({ error: userMsg });
  }
};

// Removed old forgotPassword and resetPassword in favor of the new ones at the bottom.

// ── OTP Verification ───────────────────────────────────────

const verifyOTP = async (req, res) => {
  try {
    const { otp } = req.body;
    const user = await prisma.basePrisma.user.findUnique({ where: { id: req.user.id } });

    if (!user.otpCode || user.otpCode !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    if (new Date() > new Date(user.otpExpiry)) {
      return res.status(400).json({ error: 'OTP has expired' });
    }

    // Capture whether this is the very first verification BEFORE updating
    const isFirstVerification = !user.emailVerified;

    const updatedUser = await prisma.basePrisma.user.update({
      where: { id: req.user.id },
      data: {
        emailVerified: true,
        otpCode: null,
        otpExpiry: null
      },
      include: { roleDefinition: true }
    });

    if (auth.clearAuthUserCache) {
      auth.clearAuthUserCache(req.user.id);
    }

    // Send welcome email ONLY once — on their very first successful verification
    if (isFirstVerification) {
      sendNotification({
        userId: req.user.id,
        tenantId: req.user.tenantId,
        channel: 'EMAIL',
        type: 'WELCOME_VERIFIED',
        data: {}
      });
    }

    const { password: _, ...safeUser } = updatedUser;
    res.json({ message: 'Email verified successfully', user: safeUser });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const resendOTP = async (req, res) => {
  try {
    const user = await prisma.basePrisma.user.findUnique({ where: { id: req.user.id } });

    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    await prisma.basePrisma.user.update({
      where: { id: req.user.id },
      data: { otpCode: otp, otpExpiry }
    });

    sendNotification({
      userId: user.id,
      tenantId: user.tenantId,
      channel: 'EMAIL',
      type: 'OTP_VERIFICATION',
      data: { otp }
    });

    res.json({ message: 'A new OTP has been sent to your email.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Password Reset Flow ───────────────────────────────────

const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const user = await prisma.basePrisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: 'User not found. Please register your company first, or ask your HR/Admin to invite or add you.' });
    }

    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    await prisma.basePrisma.user.update({
      where: { id: user.id },
      data: { resetPasswordOtp: otp, resetPasswordOtpExpiry: otpExpiry }
    });

    sendNotification({
      userId: user.id,
      tenantId: user.tenantId,
      channel: 'EMAIL',
      type: 'OTP_VERIFICATION', // Reusing OTP template
      data: { otp, context: 'password_reset' }
    });

    res.json({ message: 'A password reset OTP has been sent to your email.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const verifyResetOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required' });

    const user = await prisma.basePrisma.user.findUnique({ where: { email } });
    if (!user || !user.resetPasswordOtp || user.resetPasswordOtp !== otp) {
      return res.status(400).json({ error: 'Invalid or missing OTP' });
    }

    if (new Date() > new Date(user.resetPasswordOtpExpiry)) {
      return res.status(400).json({ error: 'OTP has expired' });
    }

    res.json({ message: 'OTP verified. You may now reset your password.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: 'Email, OTP, and new password are required' });
    }

    const user = await prisma.basePrisma.user.findUnique({ where: { email } });
    if (!user || !user.resetPasswordOtp || user.resetPasswordOtp !== otp) {
      return res.status(400).json({ error: 'Invalid or missing OTP' });
    }

    if (new Date() > new Date(user.resetPasswordOtpExpiry)) {
      return res.status(400).json({ error: 'OTP has expired' });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await prisma.basePrisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordOtp: null,
        resetPasswordOtpExpiry: null,
        mustChangePassword: false
      }
    });

    sendNotification({
      userId: user.id,
      tenantId: user.tenantId,
      channel: 'EMAIL',
      type: 'PASSWORD_CHANGED',
      data: { message: 'Your password was successfully reset.' }
    });

    res.json({ message: 'Password has been successfully reset. You can now log in.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ── Waitlist Request (Beta / Early Access) ─────────────────

const joinWaitlist = async (req, res) => {
  try {
    const { email, type } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required to join the waitlist.' });
    
    let title, messageText;
    if (type === 'beta') {
      title = 'Crew AI - Beta Access Request Received';
      messageText = 'Your beta access request has been successfully received. We will notify you via email if you are selected for the beta program.';
    } else {
      title = 'Crew AI - Early Access Request Received';
      messageText = 'Your early access request has been successfully received. We will notify you via email if you meet the eligibility criteria.';
    }

    const { subject, message } = templates.getCustomNotificationTemplate({
      companyName: 'Crew HRMS',
      firstName: 'there',
      title: title,
      messageText: messageText,
      link: '/',
      frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173'
    });

    // Fire and forget: don't make the user wait for Google's slow email servers
    sendEmail(email, subject, message).catch(err => console.error('[WAITLIST EMAIL ERROR]', err.message));
    
    res.json({ message: 'Request received' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  joinWaitlist,
  signup,
  login,
  changePassword,
  getMe,
  sendRegistrationOtp,
  registerCompany,
  verifyOTP,
  resendOTP,
  requestPasswordReset,
  verifyResetOtp,
  resetPassword
};
