const prisma = require('../config/db');
const bcrypt = require('bcrypt');
const { sendNotification } = require('../utils/notificationEngine');

const generateEmployeeId = async (displayName, tenantId) => {
  const year = new Date().getFullYear();
  const parts = (displayName || 'New User').trim().split(/\s+/);
  const f2 = (parts[0] || 'XX').substring(0, 2).toUpperCase();
  const l2 = (parts.length > 1 ? parts[parts.length - 1] : 'XX').substring(0, 2).toUpperCase();
  const prefix = `CI${f2}${l2}${year}`;

  const lastUser = await prisma.basePrisma.user.findFirst({
    where: { employeeId: { startsWith: prefix }, tenantId },
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

const createTenant = async (req, res) => {
  try {
    const { name, domain, adminEmail, adminName, adminPassword } = req.body;
    
    if (!name || !adminEmail || !adminName || !adminPassword) {
      return res.status(400).json({ error: 'Missing required fields for tenant provisioning' });
    }
    
    const existingTenant = await prisma.basePrisma.tenant.findUnique({
      where: { domain }
    });

    if (existingTenant && domain) {
      return res.status(400).json({ error: 'Domain already in use' });
    }

    const tenant = await prisma.basePrisma.tenant.create({
      data: {
        name,
        domain: domain || null
      }
    });
    
    const employeeId = await generateEmployeeId(adminName, tenant.id);
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(adminPassword, salt);
    
    const adminUser = await prisma.basePrisma.user.create({
      data: {
        tenantId: tenant.id,
        employeeId,
        email: adminEmail,
        password: hashedPassword,
        customRole: 'Admin',
        mustChangePassword: true,
        displayName: adminName,
        companyName: name,
        dateOfJoining: new Date()
      }
    });

    await prisma.basePrisma.adminEmail.create({
      data: {
        tenantId: tenant.id,
        email: adminEmail
      }
    });

    const { seed: seedCommunicationReview } = require('../services/communicationPersonaSeeder');
    await seedCommunicationReview(prisma.basePrisma, tenant.id);

    sendNotification({
      userId: adminUser.id,
      tenantId: tenant.id,
      type: 'COMPANY_CREATED',
      data: {}
    });

    sendNotification({
      userId: adminUser.id,
      tenantId: tenant.id,
      type: 'NEW_ACCOUNT_CREDENTIALS',
      data: { password: adminPassword }
    });

    res.status(201).json({ message: 'Tenant provisioned successfully', tenant, adminUser: adminUser.email });
  } catch (error) {
    console.error('Provision Tenant error:', error);
    res.status(500).json({ error: error.message });
  }
};

const getAllTenants = async (req, res) => {
  try {
    const tenants = await prisma.basePrisma.tenant.findMany({
      include: {
        _count: {
          select: { users: true, attendances: true }
        },
        users: {
          where: { },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { displayName: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(tenants);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};



const requestAccess = async (req, res) => {
  try {
    const { id: tenantId } = req.params;
    const ceo = await prisma.basePrisma.user.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'asc' }
    });

    if (!ceo) {
      return res.status(404).json({ error: 'No admin or CEO found for this organization.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    await prisma.basePrisma.user.update({
      where: { id: ceo.id },
      data: {
        otpCode: otp,
        otpExpiry: new Date(Date.now() + 15 * 60 * 1000)
      }
    });

    sendNotification({
      userId: ceo.id,
      tenantId: ceo.tenantId,
      channel: 'EMAIL',
      type: 'OTP_VERIFICATION',
      data: { otp }
    });

    res.json({ message: 'OTP sent to the organization administrator.', email: ceo.email });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const verifyAccess = async (req, res) => {
  try {
    const { id: tenantId } = req.params;
    const { otp } = req.body;
    
    const ceo = await prisma.basePrisma.user.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'asc' }
    });

    if (!ceo || !ceo.otpCode || ceo.otpCode !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    if (new Date() > new Date(ceo.otpExpiry)) {
      return res.status(400).json({ error: 'OTP has expired' });
    }

    // Clear the OTP
    await prisma.basePrisma.user.update({
      where: { id: ceo.id },
      data: { otpCode: null, otpExpiry: null }
    });

    res.json({ message: 'Access granted.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getTenantDetails = async (req, res) => {
  try {
    const { id: tenantId } = req.params;
    const tenant = await prisma.basePrisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        users: {
          where: { },
          select: { id: true, displayName: true, email: true, customRole: true }
        }
      }
    });
    
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    res.json(tenant);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateTenant = async (req, res) => {
  try {
    const { id: tenantId } = req.params;
    const { 
      name, domain, planTier,
      pan, gstin, cin, industry, size, founded,
      address, city, state, pincode, country,
      onboardingReminderDays
    } = req.body;
    
    const updated = await prisma.basePrisma.tenant.update({
      where: { id: tenantId },
      data: { 
        name, 
        domain: domain || null, 
        planTier,
        pan, gstin, cin, industry, size, founded,
        address, city, state, pincode, country,
        onboardingReminderDays: onboardingReminderDays !== undefined ? parseInt(onboardingReminderDays) : undefined
      }
    });
    
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createTenant,
  getAllTenants,
  requestAccess,
  verifyAccess,
  getTenantDetails,
  updateTenant
};
