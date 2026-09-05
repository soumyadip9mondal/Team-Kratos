import { format, subDays, eachDayOfInterval, startOfMonth, endOfMonth, isSameDay, differenceInHours, differenceInMinutes, isBefore, isAfter, startOfDay, subMonths, subYears, eachMonthOfInterval } from 'date-fns';

/**
 * Calculates the current consecutive days worked streak.
 * @param {Array} attendanceData - Array of attendance records
 * @returns {number} Current streak in days
 */
export const calculateStreak = (attendanceData) => {
  if (!attendanceData || attendanceData.length === 0) return 0;
  
  // Sort descending by date
  const sorted = [...attendanceData].sort((a, b) => new Date(b.date) - new Date(a.date));
  let streak = 0;
  const today = startOfDay(new Date());

  for (let i = 0; i < sorted.length; i++) {
    const recordDate = startOfDay(new Date(sorted[i].date));
    
    // We only care about consecutive days
    const expectedDate = subDays(today, streak);
    
    if (isSameDay(recordDate, expectedDate) && (sorted[i].status === 'Present' || sorted[i].status === 'HalfDay')) {
      streak++;
    } else if (isBefore(recordDate, expectedDate)) {
      break; // Streak broken
    }
  }
  return streak;
};

/**
 * Generates data for the Recharts weekly check-in graph.
 * @param {Array} attendanceData 
 * @returns {Array} Array of last 7 days with hours worked.
 */
export const getWeeklyChartData = (attendanceData) => {
  const today = new Date();
  const last7Days = eachDayOfInterval({
    start: subDays(today, 6),
    end: today
  });

  return last7Days.map(date => {
    const record = attendanceData.find(a => isSameDay(new Date(a.date), date));
    let hoursWorked = 0;
    
    if (record && record.clockIn && record.clockOut) {
      const start = new Date(record.clockIn);
      const end = new Date(record.clockOut);
      hoursWorked = differenceInMinutes(end, start) / 60;
    } else if (record && (record.status === 'Present' || record.status === 'HalfDay')) {
      hoursWorked = record.status === 'HalfDay' ? 4 : 8;
    }

    return {
      day: format(date, 'EEE'),
      fullDate: format(date, 'MMM do'),
      hours: Number(hoursWorked.toFixed(1))
    };
  });
};

/**
 * Generates heatmap data for the current month.
 * @param {Array} attendanceData 
 * @param {Array} leaves 
 * @returns {Array} Array of objects { date, status, level }
 */
export const generateHeatmapData = (attendanceData, leaves) => {
  const today = new Date();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  return daysInMonth.map(date => {
    const attendanceRecord = attendanceData.find(a => isSameDay(new Date(a.date), date));
    
    const leaveRecord = leaves.find(l => {
      if (l.status !== 'Approved') return false;
      const lStart = startOfDay(new Date(l.startDate));
      const lEnd = startOfDay(new Date(l.endDate));
      const current = startOfDay(date);
      return (isSameDay(current, lStart) || isAfter(current, lStart)) && 
             (isSameDay(current, lEnd) || isBefore(current, lEnd));
    });

    let status = 'none';
    let level = 0;
    let label = 'No record';

    if (attendanceRecord && attendanceRecord.status === 'Present') {
      status = 'present';
      level = 2;
      label = 'Present';
      
      if (attendanceRecord.clockIn && attendanceRecord.clockOut) {
         const hrs = differenceInHours(new Date(attendanceRecord.clockOut), new Date(attendanceRecord.clockIn));
         if (hrs > 8) level = 3;
      }
    } else if (attendanceRecord && attendanceRecord.status === 'HalfDay') {
      status = 'halfday';
      level = 1;
      label = 'Half Day';
    } else if (leaveRecord) {
      status = 'leave';
      level = 1;
      label = `${leaveRecord.type} Leave`;
    } else if (isBefore(date, today) || isSameDay(date, today)) {
      const dayOfWeek = date.getDay();
      if (dayOfWeek !== 0) {
        status = 'absent';
        label = 'Absent';
      } else {
        status = 'weekend';
        label = 'Off Day';
      }
    }

    return {
      date,
      status,
      level,
      label,
      dateString: format(date, 'yyyy-MM-dd')
    };
  });
};

/**
 * Generates data for the interactive multi-metric graph (Weekly/Monthly/Yearly).
 * Mocks advanced metrics (Peak Output, Score, Lead Time) while calculating real hours.
 * @param {Array} attendanceData 
 * @param {string} filterType - 'weekly', 'monthly', or 'yearly'
 * @returns {Array} Array of data points for Recharts.
 */
export const getInteractiveChartData = (attendanceData, filterType = 'weekly') => {
  const today = new Date();
  let intervals = [];
  let formatString = '';

  if (filterType === 'weekly') {
    intervals = eachDayOfInterval({ start: subDays(today, 6), end: today });
    formatString = 'EEE'; // Mon, Tue
  } else if (filterType === 'monthly') {
    intervals = eachDayOfInterval({ start: subDays(today, 29), end: today });
    formatString = 'MMM dd'; // Oct 01
  } else if (filterType === 'yearly') {
    intervals = eachMonthOfInterval({ start: subMonths(today, 11), end: today });
    formatString = 'MMM'; // Jan, Feb
  }

  // Simple seeded random function for stable mock data
  const seededRandom = (seed) => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };

  return intervals.map((date, idx) => {
    let hoursWorked = 0;

    if (filterType === 'yearly') {
      // Aggregate monthly hours
      const monthRecords = attendanceData.filter(a => new Date(a.date).getMonth() === date.getMonth() && new Date(a.date).getFullYear() === date.getFullYear());
      hoursWorked = monthRecords.reduce((acc, record) => {
        if (record.clockIn && record.clockOut) {
          return acc + (differenceInMinutes(new Date(record.clockOut), new Date(record.clockIn)) / 60);
        } else if (record.status === 'Present' || record.status === 'HalfDay') {
          return acc + (record.status === 'HalfDay' ? 4 : 8);
        }
        return acc;
      }, 0);
    } else {
      // Daily hours
      const record = attendanceData.find(a => isSameDay(new Date(a.date), date));
      if (record && record.clockIn && record.clockOut) {
        hoursWorked = differenceInMinutes(new Date(record.clockOut), new Date(record.clockIn)) / 60;
      } else if (record && (record.status === 'Present' || record.status === 'HalfDay')) {
        hoursWorked = record.status === 'HalfDay' ? 4 : 8;
      }
    }

    // Generate stable mock data using date timestamp as seed
    const seed = date.getTime();
    
    // Peak Output (0-100%) - trending upwards generally
    const baseOutput = 65 + (idx * (30 / intervals.length));
    const peakOutput = Math.min(100, Math.max(40, baseOutput + (seededRandom(seed) * 20 - 10)));
    
    // Score (0-100%) - closely tracks peak output but slightly lagged
    const score = Math.min(100, Math.max(30, peakOutput - (seededRandom(seed + 1) * 15)));
    
    // Lead Time (1-8 hours/days depending on view)
    const maxLeadTime = filterType === 'yearly' ? 14 : 5;
    const leadTime = (seededRandom(seed + 2) * maxLeadTime) + 1;

    return {
      name: format(date, formatString),
      fullDate: format(date, 'MMM do, yyyy'),
      hours: Number(hoursWorked.toFixed(1)),
      peakOutput: Number(peakOutput.toFixed(1)),
      score: Number(score.toFixed(1)),
      leadTime: Number(leadTime.toFixed(1))
    };
  });
};
