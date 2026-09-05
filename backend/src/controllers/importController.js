const prisma = require('../config/db');
const ImageKit = require('imagekit');
const Papa = require('papaparse');
const bcrypt = require('bcrypt');
const axios = require('axios');
const crypto = require('crypto');
const { sendNotification } = require('../utils/notificationEngine');

const imagekit = new ImageKit({
    publicKey : process.env.IMAGEKIT_PUBLIC_KEY,
    privateKey : process.env.IMAGEKIT_PRIVATE_KEY,
    urlEndpoint : process.env.IMAGEKIT_URL_ENDPOINT
});

// Helper: Generate Employee ID
const generateEmployeeId = async (displayName) => {
  const year = new Date().getFullYear();
  const parts = (displayName || 'New User').trim().split(/\s+/);
  const f2 = (parts[0] || 'XX').substring(0, 2).toUpperCase();
  const l2 = (parts.length > 1 ? parts[parts.length - 1] : 'XX').substring(0, 2).toUpperCase();
  const prefix = `CI${f2}${l2}${year}`;

  const lastUser = await prisma.user.findFirst({
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

const uploadEmployeesCsv = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file uploaded' });
    }

    // 1. Upload CSV to ImageKit to satisfy strict "All files in ImageKit" requirement
    const uploadRes = await imagekit.upload({
      file: req.file.buffer.toString('base64'),
      fileName: `employees_import_${req.user.tenantId}_${Date.now()}.csv`,
      folder: '/imports',
      useUniqueFileName: true
    });

    const sourceFileUrl = uploadRes.url;

    // 2. Create the ImportJob record in DB
    const importJob = await prisma.importJob.create({
      data: {
        tenantId: req.user.tenantId,
        sourceFile: sourceFileUrl,
        status: 'importing'
      }
    });

    res.status(202).json({ 
      message: 'CSV uploaded to ImageKit and import job started asynchronously.', 
      jobId: importJob.id,
      sourceUrl: sourceFileUrl
    });

    // 3. Process Asynchronously using WebSocket for real-time update
    processCsvImport(importJob.id, req.user.tenantId, sourceFileUrl, req.app.get('io')).catch(console.error);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const processCsvImport = async (jobId, tenantId, fileUrl, io) => {
  try {
    // Fetch the CSV directly from ImageKit
    const response = await axios.get(fileUrl);
    const csvData = response.data;
    
    // Parse using PapaParse
    const parsed = Papa.parse(csvData, {
      header: true,
      skipEmptyLines: true,
      transformHeader: h => h.trim().toLowerCase()
    });

    if (parsed.errors.length > 0) {
      const updatedJob = await prisma.importJob.update({
        where: { id: jobId },
        data: { status: 'failed', errorLog: parsed.errors }
      });
      if (io) io.emit(`import-update-${tenantId}`, updatedJob);
      return;
    }
    const rows = parsed.data;
    const errors = [];
    let successCount = 0;

    // Fetch tenant roles for assignment
    const tenantRoles = await prisma.basePrisma.roleDefinition.findMany({ where: { tenantId } });
    const fallbackRole = tenantRoles.find(r => r.isSystemDefault && r.name === 'Employee');
    
    const tenantOffices = await prisma.basePrisma.office.findMany({ where: { tenantId } });
    const tenantEntities = await prisma.basePrisma.legalEntity.findMany({ where: { tenantId } });

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const email = row.email?.trim();
        const displayName = row.name?.trim() || row.displayname?.trim();
        
        if (!email || !displayName) {
          throw new Error('Row missing email or name');
        }

        const customRole = row.role?.trim();
        let targetRoleDef = customRole ? tenantRoles.find(r => r.name.toLowerCase() === customRole.toLowerCase()) : fallbackRole;
        if (!targetRoleDef) targetRoleDef = fallbackRole;

        // Prevent assigning Level 0 (Owner) or Level 1 (Admin) via CSV for safety
        if (targetRoleDef && targetRoleDef.level <= 1) {
           throw new Error(`Cannot assign Level ${targetRoleDef.level} role via CSV import for safety reasons.`);
        }

        const existing = await prisma.user.findFirst({ where: { email } });
        if (existing) {
          throw new Error(`Email ${email} already exists`);
        }

        const employeeId = await generateEmployeeId(displayName);
        const generatedPassword = Math.random().toString(36).slice(-8) + 'Aa1@';
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(generatedPassword, salt);
        
        const inviteToken = crypto.randomBytes(32).toString('hex');
        const inviteTokenExpiry = new Date(Date.now() + 72 * 60 * 60 * 1000);

        let doj = new Date();
        if (row.dateofjoining && row.dateofjoining.trim() !== '') {
          const rawDate = row.dateofjoining.trim();
          doj = new Date(rawDate);
          
          if (isNaN(doj.getTime())) {
            // Fallback for Excel auto-formatting (DD/MM/YYYY or DD-MM-YYYY)
            const parts = rawDate.split(/[-/]/);
            if (parts.length === 3 && parts[2].length === 4) {
              // Reconstruct as YYYY-MM-DD
              doj = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            }
          }
          
          if (isNaN(doj.getTime())) {
            throw new Error(`Invalid DateOfJoining format ("${rawDate}"). Please use YYYY-MM-DD.`);
          }
        }

        const newUser = await prisma.user.create({
          data: {
            tenantId,
            employeeId,
            email,
            password: hashedPassword,
            roleDefinitionId: targetRoleDef?.id || null,
            customRole: targetRoleDef?.name || 'Employee',
            mustChangePassword: true,
            inviteToken,
            inviteTokenExpiry,
            displayName,
            gender: row.gender?.trim() || null,
            department: row.department?.trim() || null,
            jobPosition: row.jobposition?.trim() || row.position?.trim() || null,
            phone: row.phone?.trim() || null,
            location: row.location?.trim() || null,
            officeId: (row.office?.trim() && tenantOffices.find(o => o.name.toLowerCase() === row.office.trim().toLowerCase())?.id) || null,
            entityId: (row.entity?.trim() && tenantEntities.find(e => e.name.toLowerCase() === row.entity.trim().toLowerCase())?.id) || null,
            dateOfJoining: doj,
            workingDaysPerWeek: 6,
            breakTimeHrs: 1.0
          }
        });

        // Send welcome onboarding email
        sendNotification({
          userId: newUser.id,
          tenantId: newUser.tenantId,
          type: 'WELCOME_ONBOARDING_INVITE',
          data: {
            email,
            inviteToken,
            roleName: targetRoleDef?.name || 'Employee'
          }
        }).catch(err => console.error(`[CSV Import] Failed to send invite to ${email}`, err));

        successCount++;
      } catch (err) {
        let errMsg = err.message;
        if (err.code === 'P2002') {
          errMsg = `Duplicate entry. This record already exists.`;
        } else if (errMsg.includes('prisma.')) {
          const lines = errMsg.split('\n').map(l => l.trim()).filter(l => l);
          errMsg = lines[lines.length - 1] || 'Database error occurred.';
        }
        errors.push({ row: i + 1, data: row, error: errMsg });
      }
    }

    // Update job status
    const updatedJob = await prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: errors.length > 0 && successCount === 0 ? 'failed' : 'completed',
        errorLog: { errors, successCount, totalRows: rows.length }
      }
    });

    if (io) io.emit(`import-update-${tenantId}`, updatedJob);

  } catch (error) {
    const updatedJob = await prisma.importJob.update({
      where: { id: jobId },
      data: { status: 'failed', errorLog: { message: error.message } }
    });
    if (io) io.emit(`import-update-${tenantId}`, updatedJob);
  }
};

const getImportJobs = async (req, res) => {
  try {
    const jobs = await prisma.importJob.findMany({
      where: { tenantId: req.user.tenantId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  uploadEmployeesCsv,
  getImportJobs
};
