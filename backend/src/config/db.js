const { PrismaClient } = require('@prisma/client');
const tenantStorage = require('../middleware/tenantContext');
const { generateAuditHash } = require('../utils/auditHashing');

// Use DATABASE_URL exactly as configured in .env — all Neon/PgBouncer params set there directly
const buildDatabaseUrl = () => process.env.DATABASE_URL || '';

// ── Neon Cold-Start Retry Logic ──────────────────────────────────────────
// Neon free-tier suspends compute after inactivity. The first query after a
// cold start fails immediately with "Can't reach database server". This
// wrapper transparently retries transient connection errors up to 4 times
// with exponential back-off, covering the ~3-5s Neon wake-up window.
const isTransientError = (err) => {
  const msg = err?.message || '';
  return (
    msg.includes("Can't reach database server") ||
    msg.includes('Server has closed the connection') ||
    msg.includes('Connection reset') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('ECONNRESET') ||
    msg.includes('Timed out fetching a new connection') ||
    msg.includes('connection pool') ||
    err?.code === 'P1001' ||
    err?.code === 'P1002' ||
    err?.code === 'P1008' ||
    err?.code === 'P1017'
  );
};

// maxRetries=7, delayMs=2000, factor=2x → total window: 2+4+8+16+32+64+128 = ~254s
// Neon free-tier cold starts take 3-30s; this covers even the worst case comfortably.
const withRetry = async (fn, maxRetries = 7, delayMs = 2000) => {
  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries && isTransientError(err)) {
        const wait = Math.min(delayMs * Math.pow(2, attempt), 30000); // cap at 30s per attempt
        console.warn(`[DB] Transient connection error (attempt ${attempt + 1}/${maxRetries}), retrying in ${Math.round(wait / 1000)}s...`);
        await new Promise(r => setTimeout(r, wait));
      } else {
        throw err;
      }
    }
  }
  throw lastErr;
};

const basePrisma = new PrismaClient({
  log: ['error'],
  datasourceUrl: buildDatabaseUrl(),
});

// Warm up the connection immediately on startup (non-blocking)
// withRetry will keep re-attempting until Neon's compute wakes (~3-30s on cold start)
withRetry(() => basePrisma.$queryRaw`SELECT 1`)
  .then(() => {
    console.log('[DB] Connection warmed up successfully.');
    // Keep-alive: ping every 4 min to prevent Neon free-tier compute suspension (suspends after 5 min idle)
    setInterval(() => {
      basePrisma.$queryRaw`SELECT 1`
        .catch(() => {}); // silent — if it fails, withRetry on next real query will recover
    }, 4 * 60 * 1000);
  })
  .catch(err => console.warn('[DB] Warm-up ping exhausted retries (non-fatal):', err.message));

const prisma = basePrisma.$extends({
  query: {
    auditLog: {
      async create({ args, query }) {
        const tenantId = args.data.tenantId || tenantStorage.getStore();
        if (!tenantId || tenantId === 'SUPER_ADMIN_BYPASS') {
          // If no tenantId, we can't lock or hash properly per-tenant.
          // This should ideally not happen for auditLog.
        }

        return basePrisma.$transaction(async (tx) => {
          if (tenantId && tenantId !== 'SUPER_ADMIN_BYPASS') {
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId}))`;
          }

          const lastLog = await tx.auditLog.findFirst({
            where: { 
              tenantId: tenantId || null,
              hash: { not: null }
            },
            orderBy: { createdAt: 'desc' },
            select: { hash: true },
          });

          const prevHash = lastLog?.hash || 'GENESIS_HASH';
          args.data.prevHash = prevHash;

          const payloadToHash = {
            actorId: args.data.actorId,
            action: args.data.action,
            targetId: args.data.targetId,
            details: args.data.details,
          };
          args.data.hash = generateAuditHash(prevHash, payloadToHash);

          // If tenantId wasn't in args but we fetched it from store, add it
          if (!args.data.tenantId && tenantId && tenantId !== 'SUPER_ADMIN_BYPASS') {
            args.data.tenantId = tenantId;
          }

          return tx.auditLog.create({ data: args.data });
        }, {
          maxWait: 10000,
          timeout: 15000
        });
      },
    },
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const tenantId = tenantStorage.getStore();
        
        // Models that are inherently global and not scoped to a specific tenant
        const globalModels = ['Tenant']; 
        
        if (globalModels.includes(model)) {
          return query(args);
        }

        if (!tenantId) {
          // Strict enforcement: prevent accidental cross-tenant queries when context is missing.
          // For system-level operations (like login or signup), use prisma.basePrisma directly.
          throw new Error(`[Security] Attempted to query ${model} without a tenant context. Use prisma.basePrisma or provide a context via tenantStorage.`);
        }

        if (tenantId === 'SUPER_ADMIN_BYPASS') {
          // SuperAdmin requests bypass row-level security for cross-tenant management
          return query(args);
        }

        // Intercept and inject tenantId automatically
        const readWriteOperations = [
          'findUnique', 'findFirst', 'findMany', 'update', 'updateMany', 
          'delete', 'deleteMany', 'count', 'aggregate', 'groupBy'
        ];
        
        if (readWriteOperations.includes(operation)) {
          args.where = { ...args.where, tenantId };
        } else if (['create', 'createMany'].includes(operation)) {
          if (args.data) {
            if (Array.isArray(args.data)) {
              args.data = args.data.map(d => ({ ...d, tenantId }));
            } else {
              args.data.tenantId = tenantId;
            }
          }
        } else if (operation === 'upsert') {
          if (args.where) args.where = { ...args.where, tenantId };
          if (args.create) args.create.tenantId = tenantId;
        }

        return query(args);
      }
    }
  }
});

// Export the secured client as default, and attach basePrisma for internal auth routes
prisma.basePrisma = basePrisma;
prisma.withRetry = withRetry;

module.exports = prisma;
