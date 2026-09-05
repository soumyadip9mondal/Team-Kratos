/**
 * Communication Stress-Test — Express Router
 *
 * All routes require authentication (auth middleware).
 * Individual routes use requirePermission() for permission-key RBAC.
 * The /capabilities endpoint is open to all authenticated users so the
 * frontend can decide what to render.
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requirePermission = require('../middleware/requirePermission');
const rateLimit = require('../middleware/communicationStressTestRateLimit');
const {
  capabilities,
  create,
  getById,
  retest,
  recordEvent,
  analyzeAnnouncement,
} = require('../controllers/communicationStressTestController');

// All routes require authentication
router.use(auth);

// Capabilities — any authenticated user (frontend uses this to toggle UI)
router.get('/capabilities', capabilities);

// Employee Post Analysis — any authenticated user can analyze an announcement post
router.post('/analyze-announcement', analyzeAnnouncement);

// Create stress-test — requires communication_stress_test permission + rate limiter
router.post('/', requirePermission('communication_stress_test'), rateLimit, create);

// Read one result — creator or view_all (enforced in controller)
router.get('/:id', requirePermission('communication_stress_test'), getById);

// Re-test — creator only (enforced in controller)
router.post('/:id/retest', requirePermission('communication_stress_test'), retest);

// Record interaction event — creator only (enforced in controller)
router.post('/:id/events', requirePermission('communication_stress_test'), recordEvent);

module.exports = router;
