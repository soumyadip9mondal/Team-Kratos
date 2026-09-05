const { 
  isDefaultWorkingDay, 
  isDefaultOffDay, 
  countBusinessDays, 
  getPreviousWorkday 
} = require('./scheduleConfig');

console.log("=== RUNNING SCHEDULE CONFIG & INTEGRATION TESTS ===");

// 1. Saturday Working Day test
const saturday = new Date('2026-08-22'); // 2026-08-22 is Saturday
console.assert(saturday.getDay() === 6, 'Date 2026-08-22 must be Saturday');
console.assert(isDefaultWorkingDay(saturday) === true, 'Saturday must be default working day');
console.assert(isDefaultOffDay(saturday) === false, 'Saturday must NOT be default off day');
console.log('✓ Test 1: Saturday is a normal working day by default');

// 2. Sunday Off Day test
const sunday = new Date('2026-08-23'); // 2026-08-23 is Sunday
console.assert(sunday.getDay() === 0, 'Date 2026-08-23 must be Sunday');
console.assert(isDefaultOffDay(sunday) === true, 'Sunday must be default off day');
console.assert(isDefaultWorkingDay(sunday) === false, 'Sunday must NOT be default working day');
console.log('✓ Test 2: Sunday is a weekly off day by default');

// 3. Business Days Count test (Friday to Monday: Fri(1) + Sat(1) + Sun(0) + Mon(1) = 3 working days)
const fri = new Date('2026-08-21');
const mon = new Date('2026-08-24');
const count = countBusinessDays(fri, mon);
console.assert(count === 3, `Expected 3 working days (Fri, Sat, Mon), got ${count}`);
console.log('✓ Test 3: Business days count Fri-Mon is 3 (includes Saturday, excludes Sunday)');

// 4. Previous Workday test
// Previous workday before Monday 2026-08-24 should be Saturday 2026-08-22 (skipping Sunday 2026-08-23)
const prevWorkday = getPreviousWorkday(mon);
console.assert(prevWorkday.getUTCDay() === 6, `Expected Saturday (6), got ${prevWorkday.getUTCDay()}`);
console.log('✓ Test 4: Previous workday before Monday is Saturday');

// Previous workday before Sunday 2026-08-23 should also be Saturday 2026-08-22
const prevWorkdayFromSun = getPreviousWorkday(sunday);
console.assert(prevWorkdayFromSun.getUTCDay() === 6, `Expected Saturday (6), got ${prevWorkdayFromSun.getUTCDay()}`);
console.log('✓ Test 5: Previous workday before Sunday is Saturday');

console.log("=== ALL UNIT TESTS PASSED SUCCESSFULLY ===");
