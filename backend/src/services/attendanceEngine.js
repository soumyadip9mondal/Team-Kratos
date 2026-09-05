const prisma = require('../config/db');
const { isDefaultWorkingDay } = require('../config/scheduleConfig');

/**
 * Validates a Date object.
 */
function isValidDate(d) {
  return d instanceof Date && !isNaN(d);
}

/**
 * Maps AttendanceStatus to earned credit points.
 * Throws an error for unknown statuses to prevent silent data corruption.
 */
function getCreditForStatus(status) {
  switch (status) {
    case 'Present':
      return 1.0;
    case 'HalfDay':
      return 0.5;
    case 'Absent':
      return 0.0;
    case 'OnLeave':
      // OnLeave is typically excluded from denominator entirely,
      // but if an attendance record exists with this status, it earns 0 credits.
      return 0.0;
    default:
      throw new Error(`UNKNOWN_STATUS:${status}`);
  }
}

/**
 * Calculates the lifetime attendance percentage for a specific user.
 * 
 * Formula: (Total Earned Credits / Expected Working Days) * 100
 */
async function calculateLifetimeAttendance(userId, tenantId) {
  try {
    // 1. Fetch User Data (Joining Date and Shift Policy)
    const user = await prisma.basePrisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { 
        createdAt: true, 
        dateOfJoining: true,
        shiftPolicyId: true
      }
    });

    if (!user || (!user.createdAt && !user.dateOfJoining)) {
      return { percentage: 100, isDataInconsistent: false };
    }

    // 2. Define Date Range
    const rawJoining = new Date(user.dateOfJoining || user.createdAt);
    rawJoining.setHours(0, 0, 0, 0);

    const NinetyDaysAgo = new Date();
    NinetyDaysAgo.setDate(NinetyDaysAgo.getDate() - 90);
    NinetyDaysAgo.setHours(0, 0, 0, 0);

    const joiningDate = rawJoining < NinetyDaysAgo ? NinetyDaysAgo : rawJoining;

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Exclude today from expected full days if it's currently happening. 
    // To strictly include today only if the day is 'over', we can use yesterday as the end bound for calculations.
    
    // Use yesterday as the end date for expected working days to avoid penalizing employees for today's incomplete shift.
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() - 1);
    endDate.setHours(23, 59, 59, 999);

    if (joiningDate > endDate) {
      return { percentage: 100, isDataInconsistent: false }; // Joined today or in the future
    }

    // 3. Fetch Expected Working Days Base (using Shift Roster / Policy)
    // For a robust system, we check the ShiftRoster first. If absent, fallback to ShiftPolicy defaults.
    
    // Fetch all assignments for this user in the date range
    const assignments = await prisma.basePrisma.shiftAssignment.findMany({
      where: {
        employeeId: userId,
        tenantId,
        slot: { date: { gte: joiningDate, lte: endDate } }
      },
      include: { slot: true }
    });

    // Create a map of specific scheduled days
    const scheduledDatesMap = new Map();
    assignments.forEach(a => {
      if (a.slot && a.slot.date) {
        scheduledDatesMap.set(new Date(a.slot.date).toDateString(), true);
      }
    });

    let expectedWorkingDaysSet = new Set();
    
    // Fallback logic if rosters are not fully populated: 
    // We assume a standard 5-day work week (Mon-Fri) if no specific roster is found for a day.
    // In a mature system, this would strictly rely on the roster.
    let current = new Date(joiningDate);
    while (current <= endDate) {
      const dateString = current.toDateString();
      const dayOfWeek = current.getDay();
      
      if (scheduledDatesMap.has(dateString)) {
        // Day is explicitly scheduled in roster
        expectedWorkingDaysSet.add(dateString);
      } else {
        // Fallback: default schedule (Mon-Sat working, Sun off) if no explicit roster entry
        if (isDefaultWorkingDay(current)) { 
           expectedWorkingDaysSet.add(dateString);
        }
      }
      current.setDate(current.getDate() + 1);
    }

    // 4. Fetch and Remove Company Holidays
    // Note: The schema doesn't have a specific `Holiday` model in the provided snippet. 
    // If one existed (e.g., `CompanyHoliday`), we would query it here and remove matches from `expectedWorkingDaysSet`.
    // Example:
    // const holidays = await prisma.basePrisma.companyHoliday.findMany({ where: { date: { gte: joiningDate, lte: endDate } }});
    // holidays.forEach(h => expectedWorkingDaysSet.delete(new Date(h.date).toDateString()));

    // 5. Fetch and Remove Approved Leaves
    const approvedLeaves = await prisma.basePrisma.leave.findMany({
      where: {
        userId,
        tenantId,
        status: 'Approved',
        startDate: { lte: endDate },
        endDate: { gte: joiningDate }
      },
      select: { startDate: true, endDate: true }
    });

    for (const leave of approvedLeaves) {
      if (!isValidDate(leave.startDate) || !isValidDate(leave.endDate)) continue;
      
      let leaveCurr = new Date(leave.startDate < joiningDate ? joiningDate : leave.startDate);
      const leaveEnd = new Date(leave.endDate > endDate ? endDate : leave.endDate);
      
      while (leaveCurr <= leaveEnd) {
        expectedWorkingDaysSet.delete(leaveCurr.toDateString());
        leaveCurr.setDate(leaveCurr.getDate() + 1);
      }
    }

    const expectedWorkingDaysCount = expectedWorkingDaysSet.size;

    if (expectedWorkingDaysCount === 0) {
      return { percentage: 100, isDataInconsistent: false };
    }

    // 6. Calculate Earned Days (Credits)
    const attendanceRecords = await prisma.basePrisma.attendance.findMany({
      where: {
        userId,
        tenantId,
        date: { gte: joiningDate, lte: endDate },
      },
      select: { date: true, status: true },
      orderBy: { createdAt: 'desc' } // If there are duplicates for a day, the latest one might be a correction
    });

    let earnedCredits = 0;
    let isDataInconsistent = false;
    let inconsistencyType = null;
    let inconsistencyDetails = [];
    
    // Deduplicate attendance records per day (take the most recent status)
    const uniqueAttendanceMap = new Map();
    for (const att of attendanceRecords) {
      if (isValidDate(att.date)) {
        const dateStr = new Date(att.date).toDateString();
        if (!uniqueAttendanceMap.has(dateStr)) {
          uniqueAttendanceMap.set(dateStr, att.status);
        } else {
          isDataInconsistent = true; // Flag if we see multiple records for a single day
          inconsistencyType = "DUPLICATE_ATTENDANCE_RECORDS";
          inconsistencyDetails.push(`Multiple records for ${dateStr}`);
        }
      }
    }

    for (const [dateStr, status] of uniqueAttendanceMap.entries()) {
      // Only grant points if this was actually an expected working day 
      // (prevents >100% from checking in on weekends/holidays)
      if (expectedWorkingDaysSet.has(dateStr)) {
         try {
           earnedCredits += getCreditForStatus(status);
         } catch (err) {
           if (err.message.startsWith('UNKNOWN_STATUS')) {
             isDataInconsistent = true;
             inconsistencyType = "UNKNOWN_ATTENDANCE_STATUS";
             inconsistencyDetails.push(`Status ${status} on ${dateStr}`);
           }
         }
      }
    }

    let rawEarnedDays = earnedCredits;

    if (earnedCredits > expectedWorkingDaysCount) {
       isDataInconsistent = true;
       inconsistencyType = inconsistencyType || "EARNED_DAYS_EXCEED_EXPECTED";
       inconsistencyDetails.push(`Earned ${earnedCredits} credits but only expected ${expectedWorkingDaysCount}`);
       // We cap the math for display, but flag the inconsistency
       earnedCredits = expectedWorkingDaysCount; 
    }

    const percentage = expectedWorkingDaysCount === 0 ? 100 : (earnedCredits / expectedWorkingDaysCount) * 100;
    const finalPercentage = Math.min(Math.max(Math.round(percentage * 10) / 10, 0), 100);

    return { 
      percentage: finalPercentage, 
      rawEarnedDays,
      expectedWorkingDays: expectedWorkingDaysCount,
      isDataInconsistent,
      inconsistencyType,
      inconsistencyDetails
    };

  } catch (error) {
    console.error(`[AttendanceEngine] Error calculating for user ${userId}:`, error);
    return { 
      percentage: 100, 
      rawEarnedDays: 0,
      expectedWorkingDays: 0,
      isDataInconsistent: true,
      inconsistencyType: "CALCULATION_ENGINE_ERROR",
      inconsistencyDetails: [error.message]
    };
  }
}

const lifetimeCache = new Map();
const CACHE_TTL = 120000; // 2 minutes TTL

/**
 * Calculates lifetime attendance for an array of users efficiently.
 */
async function attachAttendancePercentages(users, tenantId) {
  if (!users || users.length === 0) return users;

  const now = Date.now();
  const NinetyDaysAgo = new Date();
  NinetyDaysAgo.setDate(NinetyDaysAgo.getDate() - 90);
  NinetyDaysAgo.setHours(0, 0, 0, 0);

  // Check cache first
  const uncachedUsers = [];
  const cachedResults = new Map();

  for (const u of users) {
    const cached = lifetimeCache.get(u.id);
    if (cached && (now - cached.timestamp < CACHE_TTL)) {
      cachedResults.set(u.id, cached.data);
    } else {
      uncachedUsers.push(u);
    }
  }

  // If all users are cached, return immediately
  if (uncachedUsers.length === 0) {
    return users.map(u => ({ ...u, ...cachedResults.get(u.id) }));
  }

  const userIds = uncachedUsers.map(u => u.id);

  // Bulk Fetch 1: Uncached Users (Joining Dates)
  const usersData = await prisma.basePrisma.user.findMany({
    where: { id: { in: userIds }, tenantId },
    select: { id: true, createdAt: true, dateOfJoining: true, shiftPolicyId: true }
  });
  const userMap = new Map(usersData.map(u => [u.id, u]));

  // Bulk Fetch 2: Shift Assignments within 90-day window
  const allAssignments = await prisma.basePrisma.shiftAssignment.findMany({
    where: { 
      employeeId: { in: userIds }, 
      tenantId,
      slot: { date: { gte: NinetyDaysAgo } }
    },
    include: { slot: true }
  });
  const assignmentsByUser = {};
  allAssignments.forEach(a => {
    if (!assignmentsByUser[a.employeeId]) assignmentsByUser[a.employeeId] = [];
    assignmentsByUser[a.employeeId].push(a);
  });

  // Bulk Fetch 3: Approved Leaves within 90-day window
  const allLeaves = await prisma.basePrisma.leave.findMany({
    where: { 
      userId: { in: userIds }, 
      tenantId, 
      status: 'Approved',
      endDate: { gte: NinetyDaysAgo }
    },
    select: { userId: true, startDate: true, endDate: true }
  });
  const leavesByUser = {};
  allLeaves.forEach(l => {
    if (!leavesByUser[l.userId]) leavesByUser[l.userId] = [];
    leavesByUser[l.userId].push(l);
  });

  // Bulk Fetch 4: Attendances within 90-day window
  const allAttendances = await prisma.basePrisma.attendance.findMany({
    where: { 
      userId: { in: userIds }, 
      tenantId,
      date: { gte: NinetyDaysAgo }
    },
    select: { userId: true, date: true, status: true },
    orderBy: { createdAt: 'desc' }
  });
  const attendancesByUser = {};
  allAttendances.forEach(a => {
    if (!attendancesByUser[a.userId]) attendancesByUser[a.userId] = [];
    attendancesByUser[a.userId].push(a);
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const globalEndDate = new Date(today);
  globalEndDate.setDate(globalEndDate.getDate() - 1);
  globalEndDate.setHours(23, 59, 59, 999);

  const newlyComputed = uncachedUsers.map(user => {
    try {
      const uData = userMap.get(user.id);
      if (!uData || (!uData.createdAt && !uData.dateOfJoining)) {
        return { ...user, attendancePercentage: 100, isDataInconsistent: false };
      }

      // Cap calculation lookback window to max 90 days to prevent CPU thread lock
      const NinetyDaysAgo = new Date(globalEndDate);
      NinetyDaysAgo.setDate(NinetyDaysAgo.getDate() - 90);
      NinetyDaysAgo.setHours(0, 0, 0, 0);

      const rawJoining = new Date(uData.dateOfJoining || uData.createdAt);
      rawJoining.setHours(0, 0, 0, 0);
      const joiningDate = rawJoining < NinetyDaysAgo ? NinetyDaysAgo : rawJoining;

      if (joiningDate > globalEndDate) {
        return { ...user, attendancePercentage: 100, isDataInconsistent: false };
      }

      const userAssignments = assignmentsByUser[user.id] || [];
      const scheduledDatesMap = new Map();
      userAssignments.forEach(a => {
        if (a.slot && a.slot.date) {
          const dTime = new Date(a.slot.date).getTime();
          if (dTime >= joiningDate.getTime() && dTime <= globalEndDate.getTime()) {
            scheduledDatesMap.set(new Date(a.slot.date).toDateString(), true);
          }
        }
      });

      let expectedWorkingDaysSet = new Set();
      let current = new Date(joiningDate);
      while (current <= globalEndDate) {
        const dateString = current.toDateString();
        const dayOfWeek = current.getDay();
        if (scheduledDatesMap.has(dateString)) {
          expectedWorkingDaysSet.add(dateString);
        } else {
          if (isDefaultWorkingDay(current)) { 
             expectedWorkingDaysSet.add(dateString);
          }
        }
        current.setDate(current.getDate() + 1);
      }

      const userLeaves = leavesByUser[user.id] || [];
      for (const leave of userLeaves) {
        if (!isValidDate(leave.startDate) || !isValidDate(leave.endDate)) continue;
        let leaveCurr = new Date(leave.startDate < joiningDate ? joiningDate : leave.startDate);
        const leaveEnd = new Date(leave.endDate > globalEndDate ? globalEndDate : leave.endDate);
        while (leaveCurr <= leaveEnd) {
          expectedWorkingDaysSet.delete(leaveCurr.toDateString());
          leaveCurr.setDate(leaveCurr.getDate() + 1);
        }
      }

      const expectedWorkingDaysCount = expectedWorkingDaysSet.size;
      if (expectedWorkingDaysCount === 0) {
        return { ...user, attendancePercentage: 100, isDataInconsistent: false };
      }

      const userAttendances = attendancesByUser[user.id] || [];
      let earnedCredits = 0;
      let isDataInconsistent = false;
      let inconsistencyType = null;
      let inconsistencyDetails = [];

      const uniqueAttendanceMap = new Map();
      for (const att of userAttendances) {
        if (isValidDate(att.date)) {
          const dTime = new Date(att.date).getTime();
          if (dTime >= joiningDate.getTime() && dTime <= globalEndDate.getTime()) {
            const dateStr = new Date(att.date).toDateString();
            if (!uniqueAttendanceMap.has(dateStr)) {
              uniqueAttendanceMap.set(dateStr, att.status);
            } else {
              isDataInconsistent = true;
              inconsistencyType = "DUPLICATE_ATTENDANCE_RECORDS";
              inconsistencyDetails.push(`Multiple records for ${dateStr}`);
            }
          }
        }
      }

      for (const [dateStr, status] of uniqueAttendanceMap.entries()) {
        if (expectedWorkingDaysSet.has(dateStr)) {
           try {
             earnedCredits += getCreditForStatus(status);
           } catch (err) {
             if (err.message.startsWith('UNKNOWN_STATUS')) {
               isDataInconsistent = true;
               inconsistencyType = "UNKNOWN_ATTENDANCE_STATUS";
               inconsistencyDetails.push(`Status ${status} on ${dateStr}`);
             }
           }
        }
      }

      let rawEarnedDays = earnedCredits;
      if (earnedCredits > expectedWorkingDaysCount) {
         isDataInconsistent = true;
         inconsistencyType = inconsistencyType || "EARNED_DAYS_EXCEED_EXPECTED";
         inconsistencyDetails.push(`Earned ${earnedCredits} credits but expected ${expectedWorkingDaysCount}`);
         earnedCredits = expectedWorkingDaysCount; 
      }

      const percentage = expectedWorkingDaysCount === 0 ? 100 : (earnedCredits / expectedWorkingDaysCount) * 100;
      const finalPercentage = Math.min(Math.max(Math.round(percentage * 10) / 10, 0), 100);

      const resultStats = { 
        attendancePercentage: finalPercentage, 
        rawEarnedDays,
        expectedWorkingDays: expectedWorkingDaysCount,
        hasAttendanceInconsistency: isDataInconsistent,
        inconsistencyType,
        inconsistencyDetails
      };
      lifetimeCache.set(user.id, { timestamp: Date.now(), data: resultStats });
      return { ...user, ...resultStats };
    } catch (err) {
      console.error(err);
      return { 
        ...user, 
        attendancePercentage: 100, 
        hasAttendanceInconsistency: true,
        inconsistencyType: "SYSTEM_FAILURE"
      }; 
    }
  });

  return users.map(u => {
    const cached = cachedResults.get(u.id);
    if (cached) return { ...u, ...cached };
    const freshlyComputed = newlyComputed.find(nc => nc.id === u.id);
    return freshlyComputed || u;
  });
}

module.exports = {
  calculateLifetimeAttendance,
  attachAttendancePercentages
};
