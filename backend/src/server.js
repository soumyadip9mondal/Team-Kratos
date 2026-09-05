const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
app.set('trust proxy', 1); // Required for rate-limiting behind Render's reverse proxy
const server = http.createServer(app);
const corsOptions = {
  origin: (origin, callback) => {
    // If no origin (e.g. server-to-server) or explicitly wildcard
    if (!origin || !process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGINS === '*') {
      return callback(null, true);
    }
    
    // Check if the requested origin is inside the ALLOWED_ORIGINS string
    // We use .includes on the raw string so it doesn't matter if they used spaces, commas, or quotes
    if (process.env.ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }

    // Instead of throwing a 500 Error, we gracefully return false
    // which tells the cors package to just block it normally without crashing
    callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  credentials: true
};

const io = new Server(server, {
  cors: corsOptions
});

// Make io accessible to controllers and background workers
app.set('io', io);
global.io = io;

// Middleware
app.use(helmet());
app.use(cors(corsOptions));
app.use(require('cookie-parser')());
app.use(express.json({ limit: '5mb' })); // Reduced from 50mb to prevent DoS
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Global Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000, // Limit each IP to 2000 requests per windowMs
  message: { error: 'Too many requests from this IP, please try again after 15 minutes.' }
});
app.use('/api/', limiter);

// Rate Limiting for Auth
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 1000, // Limit each IP to 1000 requests per hour
  message: { error: 'Too many authentication attempts from this IP, please try again after an hour.' }
});
app.use('/api/auth/', authLimiter);


const jwt = require('jsonwebtoken');
const prisma = require('./config/db');
const { withRetry } = prisma;

// Socket.io Connection Middleware (JWT Verification)
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }
    if (!process.env.JWT_SECRET) {
      return next(new Error('Authentication error: Server configuration issue'));
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Load the user and roleDefinition using basePrisma (outside tenantContext)
    const userId = decoded._id || decoded.id;
    const user = await withRetry(() => prisma.basePrisma.user.findUnique({
      where: { id: userId },
      include: { roleDefinition: true }
    }));
    
    if (!user) {
      return next(new Error('Authentication error: User not found'));
    }
    socket.user = user;
    next();
  } catch (err) {
    return next(new Error('Authentication error: Invalid token'));
  }
});

// Socket.io for Real-Time Attendance & Live Org Pulse
io.on('connection', (socket) => {
  console.log('New authenticated client connected', socket.id, socket.user?.displayName);

  const user = socket.user;
  const tenantId = user.tenantId;
  const roleDef = user.roleDefinition;

  // Automatically join standard rooms based on verified token
  if (tenantId) {
    socket.join(`tenant:${tenantId}`);
    
    if (roleDef && roleDef.level <= 1) {
      socket.join(`tenant:${tenantId}:admin`);
    }

    // Gated Pulse Dashboard Room: Only SuperAdmin or Admins/CEOs (level <= 1)
    const isSuperAdmin = roleDef && (roleDef.name === 'SuperAdmin' || roleDef.level === -1);
    const isAdminOrCEO = roleDef && roleDef.level <= 1;
    if (isSuperAdmin || isAdminOrCEO) {
      socket.join(`tenant:${tenantId}:admin:pulse`);
    }
  }
  if (user.id && tenantId) {
    socket.join(`tenant:${tenantId}:user:${user.id}`);
  }

  // Keep legacy join signature for compatibility (does nothing now that rooms are secure)
  socket.on('join', () => {});

  socket.on('chatbot:query', async (data) => {
    const { handleSocketQuery } = require('./controllers/chatbotController');
    await handleSocketQuery(socket, io, data);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected', socket.id);
  });
});

// 1-minute live ticker for cost accretion
setInterval(() => {
  try {
    const pulseEngine = require('./utils/pulseEngine');
    pulseEngine.tickAllTenants();
    
    const activeIds = pulseEngine.getActiveTenantIds();
    for (const tId of activeIds) {
      io.to(`tenant:${tId}:admin:pulse`).emit('pulse:update', pulseEngine.getTenantState(tId));
    }
  } catch (err) {
    console.error('Error in Pulse 1-minute ticker:', err);
  }
}, 60_000);

// Start Background Workers
const { initCronJobs } = require('./workers/cronJobs');
initCronJobs();

const eventDispatcher = require('./workers/eventDispatcher');
eventDispatcher.start();

// Routes Placeholder
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/leave', require('./routes/leave'));
app.use('/api/proxy-alerts', require('./routes/proxyAlerts'));
app.use('/api/pulse', require('./routes/pulse'));
const payrollRoutes = require('./routes/payroll');
const tenantSettingsRoutes = require('./routes/tenantSettingsRoutes');
const importRoutes = require('./routes/importRoutes');
const developerSettingsRoutes = require('./routes/developerSettingsRoutes');
const statutoryFilingRoutes = require('./routes/statutoryFilingRoutes');
const ticketRoutes = require('./routes/tickets');
const announcementRoutes = require('./routes/announcements');
const billingRoutes = require('./routes/billingRoutes');

const { tenantStorage, setTenantContext } = require('./middleware/auth');
app.use('/api/payroll', payrollRoutes);
app.use('/api/superadmin', require('./routes/superadminRoutes'));
app.use('/api/tenant-settings', tenantSettingsRoutes);
app.use('/api/ats', require('./routes/atsRoutes'));
app.use('/api/inbox', require('./routes/inboxRoutes'));
app.use('/api/developer-settings', developerSettingsRoutes);
app.use('/api/statutory-filings', statutoryFilingRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/import', importRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/assets', require('./routes/assetRoutes'));
app.use('/api/projects', require('./routes/projectRoutes'));
app.use('/api/one-on-ones', require('./routes/oneOnOneRoutes'));
app.use('/api/pulse', require('./routes/pulseRoutes'));
app.use('/api/console', require('./routes/console'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/colocation', require('./routes/colocation'));
app.use('/api/face-registration', require('./routes/faceRegistration'));
app.use('/api/employees/face', require('./routes/faceRegistration'));
app.use('/api/employees', require('./routes/users'));
app.use('/api/hr/employees', require('./routes/users'));
app.use('/api/v1', require('./routes/apiV1Routes'));
app.use('/api/onboarding', require('./routes/onboarding'));
app.use('/api/performance', require('./routes/performance'));
app.use('/api/shifts', require('./routes/shifts'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/benefits', require('./routes/benefits'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/chatbot', require('./routes/chatbot'));
app.use('/api', require('./routes/rankingRoutes'));
app.use('/api/intelligence', require('./routes/intelligenceRoutes'));
app.use('/api/cost-intelligence', require('./routes/costIntelligenceRoutes'));
app.use('/api/iris', require('./routes/irisRoutes'));
app.use('/api/communication-stress-tests', require('./routes/communicationStressTests'));

// Health check — lightweight keep-alive ping for Render / UptimeRobot
// Safe to call every 10 minutes — does NOT run any DB logic
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Cron job endpoint
const { runDailyCron } = require('./controllers/cronController');
app.get('/api/cron', runDailyCron);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown to prevent Prisma connection pool exhaustion on nodemon restart

const gracefulShutdown = async () => {
  console.log('Shutting down gracefully, closing database connections...');
  try {
    eventDispatcher.stop();
    await prisma.basePrisma.$disconnect();
    console.log('Database connections closed.');
  } catch (err) {
    console.error('Error during disconnection:', err);
  }
  process.exit(0);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
process.on('SIGUSR2', gracefulShutdown); // For nodemon restarts
