/**
 * Organization-wide Central Schedule Configuration
 * 
 * Default Schedule:
 * - Saturday = NORMAL WORKING DAY (1..6 = Mon..Sat)
 * - Sunday   = WEEKLY OFF DAY (0 = Sun)
 */

const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5, 6]; // Monday (1) to Saturday (6)
const DEFAULT_OFF_DAYS = [0]; // Sunday (0)
const DEFAULT_WORKING_DAYS_PER_WEEK = 6;

/**
 * Checks if a given Date object (or date string) falls on a default working day.
 * @param {Date|string} date 
 * @returns {boolean}
 */
function isDefaultWorkingDay(date) {
  const d = new Date(date);
  const day = d.getDay();
  return DEFAULT_WORKING_DAYS.includes(day);
}

/**
 * Checks if a given Date object (or date string) falls on a default weekly off day.
 * @param {Date|string} date 
 * @returns {boolean}
 */
function isDefaultOffDay(date) {
  const d = new Date(date);
  const day = d.getDay();
  return DEFAULT_OFF_DAYS.includes(day);
}

/**
 * Counts expected working days between startDate and endDate (inclusive).
 * Mon-Sat = working, Sun = off.
 * @param {Date|string} startDate 
 * @param {Date|string} endDate 
 * @returns {number}
 */
function countBusinessDays(startDate, endDate) {
  let count = 0;
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  while (current <= end) {
    if (isDefaultWorkingDay(current)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

/**
 * Returns the previous expected working day for a given date.
 * If previous day is Sunday (off), steps back to Saturday (working).
 * @param {Date|string} date 
 * @returns {Date}
 */
function getPreviousWorkday(date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - 1);
  while (isDefaultOffDay(d)) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return d;
}

module.exports = {
  DEFAULT_WORKING_DAYS,
  DEFAULT_OFF_DAYS,
  DEFAULT_WORKING_DAYS_PER_WEEK,
  isDefaultWorkingDay,
  isDefaultOffDay,
  countBusinessDays,
  getPreviousWorkday
};
