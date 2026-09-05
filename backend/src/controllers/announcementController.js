const prisma = require('../config/db');
const { sendNotification } = require('../utils/notificationEngine');
const { runBirthdayCheckForTenant } = require('../jobs/birthdayJob');

const VALID_CATEGORIES = ['General', 'Policy', 'Event', 'Birthday', 'Urgent'];

const createAnnouncement = async (req, res) => {
  try {
    const { title, message, category, stressTestId, stressTestVariant } = req.body;
    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required' });
    }

    const selectedCategory = category && VALID_CATEGORIES.includes(category) ? category : 'General';
    const tenantId = req.user.tenantId;

    // Validate stress-test linkage if provided
    let verifiedStressTestId = null;
    let verifiedStressTestVariant = null;

    if (stressTestId) {
      const stressTest = await prisma.basePrisma.communicationStressTest.findFirst({
        where: {
          id: stressTestId,
          tenantId,
          createdById: req.user.id,
        },
      });

      if (!stressTest) {
        return res.status(400).json({ error: 'Invalid stress test reference.' });
      }

      if (stressTest.sourceType !== 'ANNOUNCEMENT' || stressTest.status !== 'COMPLETED') {
        return res.status(400).json({ error: 'Stress test is not completed for announcements.' });
      }

      if (stressTest.expiresAt && new Date(stressTest.expiresAt) < new Date()) {
        return res.status(400).json({ error: 'Stress test reference has expired.' });
      }

      // Check if already linked to another announcement
      const existingLink = await prisma.basePrisma.announcement.findFirst({
        where: { stressTestId },
      });
      if (existingLink) {
        return res.status(400).json({ error: 'Stress test has already been linked to an announcement.' });
      }

      verifiedStressTestId = stressTest.id;
      verifiedStressTestVariant = stressTestVariant || 'ORIGINAL';

      // Record publication event
      const eventType =
        verifiedStressTestVariant === 'REWRITE'
          ? 'PUBLISHED_REWRITE'
          : verifiedStressTestVariant === 'EDITED_REWRITE'
          ? 'PUBLISHED_EDITED_REWRITE'
          : 'PUBLISHED_ORIGINAL';

      await prisma.basePrisma.communicationStressTestEvent.create({
        data: {
          tenantId,
          stressTestId: stressTest.id,
          actorId: req.user.id,
          eventType,
        },
      }).catch((e) => console.error('[Announcement] Event log error:', e.message));
    }

    const announcement = await prisma.announcement.create({
      data: {
        tenantId,
        adminId: req.user.id,
        title,
        category: selectedCategory,
        message,
        stressTestId: verifiedStressTestId,
        stressTestVariant: verifiedStressTestVariant,
      },
      include: {
        admin: { select: { displayName: true, avatar: true } },
        wishes: { include: { wisher: { select: { id: true, displayName: true } } } }
      }
    });

    // Real-time Socket.io broadcast to tenant room
    const io = req.app.get('io');
    if (io) {
      io.to(`tenant:${tenantId}`).emit('announcement:new', announcement);
    }

    // Trigger email notification for active users
    const users = await prisma.user.findMany({
      where: { tenantId, status: 'Active' },
      select: { id: true }
    });

    users.forEach(user => {
      sendNotification({
        userId: user.id,
        tenantId,
        type: 'COMPANY_ANNOUNCEMENT',
        data: {
          title,
          messageContent: message
        }
      });
    });

    res.status(201).json({ message: 'Announcement sent successfully', announcement });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getAnnouncements = async (req, res) => {
  try {
    const announcements = await prisma.announcement.findMany({
      where: { tenantId: req.user.tenantId },
      include: {
        admin: { select: { displayName: true, avatar: true } },
        wishes: {
          select: {
            id: true,
            wisherId: true,
            wisher: { select: { id: true, displayName: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(announcements);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Tenant-scoped manual trigger for birthday check (Admin Level ≤ 1 only).
 * Calls runBirthdayCheckForTenant with req.user.tenantId (zero cross-tenant risk).
 */
const triggerBirthdayCheck = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const result = await runBirthdayCheckForTenant(tenantId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * POST /api/announcements/:id/wish — Persistent, deduplicated birthday wish.
 * Checks cross-tenant access and blocks self-wishing.
 */
const wishBirthday = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;
    const userId = req.user.id;

    // 1. Find announcement
    const announcement = await prisma.announcement.findUnique({
      where: { id }
    });

    if (!announcement) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    // 2. Cross-Tenant Guard: reject if tenantId mismatch
    if (announcement.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Forbidden: Access denied to announcements outside your organization' });
    }

    // 3. Category Guard: must be a Birthday post
    if (announcement.category !== 'Birthday') {
      return res.status(400).json({ error: 'Wishes can only be sent for birthday announcements' });
    }

    // 4. Self-Wish Guard: check if wisher is trying to wish themselves
    if (announcement.adminId === userId) {
      return res.status(400).json({ error: 'You cannot wish yourself a happy birthday' });
    }

    // 5. Create BirthdayWish with @@unique([announcementId, wisherId]) deduplication
    try {
      const wish = await prisma.birthdayWish.create({
        data: {
          tenantId,
          announcementId: id,
          wisherId: userId
        },
        include: {
          wisher: { select: { id: true, displayName: true } }
        }
      });

      // Real-time Socket.io broadcast to tenant room (zero per-wish email spam)
      const io = req.app.get('io');
      if (io) {
        io.to(`tenant:${tenantId}`).emit('birthday:wish', {
          announcementId: id,
          wisherId: userId,
          wisherName: req.user.displayName || 'A colleague'
        });
      }

      // Notify the birthday employee(s) in their personal inbox
      const { sendNotification } = require('../utils/notificationEngine');
      const todayIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      const currentMonth = todayIST.getMonth() + 1;
      const currentDay = todayIST.getDate();

      prisma.user.findMany({
        where: { tenantId, status: 'Active', id: { not: userId } },
        select: { id: true, dateOfBirth: true }
      }).then(users => {
        const birthdayTargets = users.filter(u => {
          if (!u.dateOfBirth) return false;
          const dob = new Date(u.dateOfBirth);
          return (dob.getMonth() + 1) === currentMonth && dob.getDate() === currentDay;
        });

        for (const target of birthdayTargets) {
          sendNotification({
            userId: target.id,
            tenantId,
            type: 'CUSTOM',
            title: '🎂 New Birthday Wish!',
            message: `${req.user.displayName || 'A colleague'} wished you a Happy Birthday! 🎉`,
            link: '/dashboard/engagement'
          }).catch(err => console.error('[BirthdayWish] Notification error:', err));
        }
      }).catch(err => console.error('[BirthdayWish] User fetch error:', err));

      return res.status(201).json(wish);
    } catch (dbErr) {
      if (dbErr.code === 'P2002') {
        return res.status(400).json({ error: 'You have already wished a happy birthday on this announcement' });
      }
      throw dbErr;
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createAnnouncement,
  getAnnouncements,
  triggerBirthdayCheck,
  wishBirthday
};
