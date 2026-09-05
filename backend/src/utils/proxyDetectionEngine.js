const { getDistanceInMeters, getTravelSpeedKmh } = require('./geoUtils');
const { getPreviousWorkday } = require('../config/scheduleConfig');

const THRESHOLDS = {
  PROXIMITY_METERS: 1,
  SPEED_KMH: 900,               // unified with Feature 18
  TEMPORAL_SECONDS: 5,
  TEMPORAL_MIN_OCCURRENCES: 3,
  TEMPORAL_WINDOW_DAYS: 7,
};

function degradedTrustScoreCap(currentScore, severity) {
  const caps = { HIGH: 20, MEDIUM: 50, LOW: 70 };
  const current = currentScore !== null && currentScore !== undefined ? currentScore : 100;
  return Math.min(current, caps[severity]);
}

// getPreviousWorkday imported from ../config/scheduleConfig


function getDateMinusDays(date, days) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

function detectCoordinateProximity(records, tenantId, targetDate) {
  const alerts = [];
  for (let i = 0; i < records.length; i++) {
    for (let j = i + 1; j < records.length; j++) {
      const recA = records[i];
      const recB = records[j];
      if (recA.userId === recB.userId) continue;
      if (recA.latitude === null || recA.longitude === null || recB.latitude === null || recB.longitude === null) continue;

      const dist = getDistanceInMeters(recA.latitude, recA.longitude, recB.latitude, recB.longitude);
      if (dist < THRESHOLDS.PROXIMITY_METERS) {
        const [userA, userB] = recA.userId < recB.userId ? [recA, recB] : [recB, recA];
        alerts.push({
          tenantId,
          userId: userA.userId,
          targetUserId: userB.userId,
          alertType: 'coordinate_proximity',
          severity: 'HIGH',
          reason: `Coordinate proximity collision detected (< 1m) between ${userA.user?.displayName || 'Employee A'} and ${userB.user?.displayName || 'Employee B'}`,
          metadata: {
            distance: dist,
            coordinates: {
              lat1: userA.latitude,
              lon1: userA.longitude,
              lat2: userB.latitude,
              lon2: userB.longitude
            },
            timestamps: {
              time1: userA.checkIn,
              time2: userB.checkIn
            }
          },
          attendanceDate: targetDate
        });
      }
    }
  }
  return alerts;
}

function detectTravelSpeed(records, prevRecords, tenantId, targetDate) {
  const alerts = [];
  for (const rec of records) {
    if (rec.latitude === null || rec.longitude === null) continue;

    const prevRec = prevRecords.find(p => p.userId === rec.userId);
    if (!prevRec || prevRec.latitude === null || prevRec.longitude === null) continue;

    const speed = getTravelSpeedKmh(
      prevRec.latitude, prevRec.longitude, new Date(prevRec.checkIn).getTime(),
      rec.latitude, rec.longitude, new Date(rec.checkIn).getTime()
    );

    if (speed > THRESHOLDS.SPEED_KMH) {
      alerts.push({
        tenantId,
        userId: rec.userId,
        targetUserId: null,
        alertType: 'travel_speed',
        severity: 'MEDIUM',
        reason: `Implausible travel velocity day-over-day (${Math.round(speed)} km/h) for ${rec.user?.displayName || 'Employee'}`,
        metadata: {
          speed,
          coordinates: {
            lat1: prevRec.latitude,
            lon1: prevRec.longitude,
            lat2: rec.latitude,
            lon2: rec.longitude
          },
          timestamps: {
            time1: prevRec.checkIn,
            time2: rec.checkIn
          }
        },
        attendanceDate: targetDate
      });
    }
  }
  return alerts;
}

function detectTemporalClusters(weekRecords, tenantId, targetDate) {
  const alerts = [];
  const userIds = [...new Set(weekRecords.map(r => r.userId))];

  const userRecordsMap = {};
  const userDisplayNames = {};
  for (const rec of weekRecords) {
    if (!userRecordsMap[rec.userId]) {
      userRecordsMap[rec.userId] = [];
    }
    userRecordsMap[rec.userId].push(rec);
    if (rec.user?.displayName) {
      userDisplayNames[rec.userId] = rec.user.displayName;
    }
  }

  for (let i = 0; i < userIds.length; i++) {
    for (let j = i + 1; j < userIds.length; j++) {
      const userIdA = userIds[i];
      const userIdB = userIds[j];

      const recsA = userRecordsMap[userIdA];
      const recsB = userRecordsMap[userIdB];

      let occurrences = 0;
      const timestamps = [];

      for (let dayOffset = 0; dayOffset < THRESHOLDS.TEMPORAL_WINDOW_DAYS; dayOffset++) {
        const checkDate = getDateMinusDays(targetDate, dayOffset);
        const checkDateString = checkDate.toISOString().split('T')[0];

        const recA = recsA.find(r => r.date.toISOString().split('T')[0] === checkDateString);
        const recB = recsB.find(r => r.date.toISOString().split('T')[0] === checkDateString);

        if (recA && recB) {
          const timeA = new Date(recA.checkIn).getTime();
          const timeB = new Date(recB.checkIn).getTime();
          const diffMs = Math.abs(timeA - timeB);

          if (diffMs <= THRESHOLDS.TEMPORAL_SECONDS * 1000) {
            occurrences++;
            timestamps.push({
              date: checkDateString,
              time1: recA.checkIn,
              time2: recB.checkIn,
              diffSeconds: diffMs / 1000
            });
          }
        }
      }

      if (occurrences >= THRESHOLDS.TEMPORAL_MIN_OCCURRENCES) {
        const [idA, idB] = userIdA < userIdB ? [userIdA, userIdB] : [userIdB, userIdA];
        const nameA = userDisplayNames[idA] || 'Employee A';
        const nameB = userDisplayNames[idB] || 'Employee B';
        
        alerts.push({
          tenantId,
          userId: idA,
          targetUserId: idB,
          alertType: 'temporal_cluster',
          severity: 'LOW',
          reason: `Temporal cluster anomaly: ${nameA} and ${nameB} clocked in within 5s of each other on ${occurrences} of the last 7 days`,
          metadata: {
            occurrences,
            timestamps
          },
          attendanceDate: targetDate
        });
      }
    }
  }
  return alerts;
}

async function detectProxyAnomalies(prisma, tenantId, targetDate) {
  const alerts = [];

  const records = await prisma.attendance.findMany({
    where: { tenantId, date: targetDate },
    include: { user: { select: { displayName: true, employeeId: true } } },
  });

  alerts.push(...detectCoordinateProximity(records, tenantId, targetDate));

  const prevRecords = await prisma.attendance.findMany({
    where: { tenantId, date: getPreviousWorkday(targetDate) },
    include: { user: { select: { displayName: true } } },
  });
  alerts.push(...detectTravelSpeed(records, prevRecords, tenantId, targetDate));

  const weekRecords = await prisma.attendance.findMany({
    where: {
      tenantId,
      date: {
        gte: getDateMinusDays(targetDate, THRESHOLDS.TEMPORAL_WINDOW_DAYS - 1),
        lte: targetDate
      }
    },
    include: { user: { select: { displayName: true } } },
  });
  alerts.push(...detectTemporalClusters(weekRecords, tenantId, targetDate));

  return alerts;
}

module.exports = {
  detectProxyAnomalies,
  THRESHOLDS,
  degradedTrustScoreCap,
  getPreviousWorkday,
  getDateMinusDays
};
