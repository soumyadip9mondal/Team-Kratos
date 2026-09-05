const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
const { withRetry } = prisma;
const tenantStorage = require('./tenantContext');

const authUserCache = new Map();

const auth = async (req, res, next) => {
  try {
    let token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token && req.cookies && req.cookies.jwt) {
      token = req.cookies.jwt;
    }
    if (!token) throw new Error('No token provided');

    if (!process.env.JWT_SECRET) {
      throw new Error('FATAL: JWT_SECRET environment variable is not defined.');
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // We use basePrisma here because we are authenticating and do not have a tenant context yet
    const userId = decoded._id || decoded.id;
    if (!userId) throw new Error('Invalid token payload');

    const now = Date.now();
    const cachedAuth = authUserCache.get(userId);
    let user;

    if (cachedAuth && (now - cachedAuth.timestamp < 30000) && cachedAuth.user.otpCode === null) {
      user = cachedAuth.user;
    } else {
      user = await withRetry(() => prisma.basePrisma.user.findUnique({ 
        where: { id: userId },
        include: { roleDefinition: true, shiftPolicy: true }
      }));
      if (!user) throw new Error();
      if (user.otpCode === null) {
        authUserCache.set(userId, { timestamp: now, user });
      } else {
        authUserCache.delete(userId);
      }
    }

    // CRITICAL SECURITY FIX: Prevent OTP bypass
    // If a user has a pending OTP, block them from all routes except the OTP verification endpoints.
    if (user.otpCode !== null) {
      const allowedPaths = ['/verify-otp', '/resend-otp'];
      if (!allowedPaths.some(p => req.originalUrl.includes(p))) {
        return res.status(401).json({ error: 'Please verify your OTP to continue.', requireOtp: true });
      }
    }

    req.token = token;
    req.user = user;

    // Inject the multi-tenant context for the remainder of the request lifecycle
    if (user.roleDefinition && user.roleDefinition.name === 'SuperAdmin') {
      tenantStorage.run('SUPER_ADMIN_BYPASS', () => {
        next();
      });
    } else if (user.tenantId) {
      tenantStorage.run(user.tenantId, () => {
        next();
      });
    } else {
      // User has no tenant (this shouldn't happen unless they are SuperAdmin, but fallback safely)
      next();
    }
    
  } catch (error) {
    res.status(401).send({ error: 'Please authenticate.' });
  }
};

auth.clearAuthUserCache = (userId) => {
  if (userId) authUserCache.delete(userId);
};

module.exports = auth;
