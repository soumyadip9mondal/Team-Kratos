import React, { useState, useMemo, useCallback, useRef, useEffect, lazy, Suspense } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus, Search, Users, UserCheck, UserX, Clock, LayoutGrid, List, AlignJustify,
  ChevronDown, X, Mail, Phone, ArrowUpDown, ArrowUp, ArrowDown, UserPlus, SearchX,
  Sparkles, Building2, ExternalLink, Copy, Check, Filter, Command, Eye, CheckSquare, Square,
  Radio, Waves, Activity, Flame, SlidersHorizontal, Volume2, ScanFace, Sun,
  ChevronLeft, ChevronRight, History
} from 'lucide-react';
import { hasPermission } from '../../lib/permissions';
import { useEmployees } from '../../hooks/useEmployees';
import { getEmployeeStatus, getStatusClasses, getStatusDotColor } from '../../utils/employeeStatus';

import { API_BASE } from '../../lib/api';

const EmployeeDashboard = lazy(() => import('../EmployeeDashboard'));

// ── Debounce hook ──────────────────────────────────────────────────────────
function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// ── Department Style Map ──────────────────────────────────────────────────
const DEPARTMENT_STYLES = {
  'Engineering': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  'Product': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Design': 'bg-violet-50 text-violet-700 border-violet-200',
  'Marketing': 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
  'Sales': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'HR': 'bg-rose-50 text-rose-700 border-rose-200',
  'General': 'bg-slate-50 text-slate-700 border-slate-200',
};

const getDeptBadgeClass = (dept = 'General') => DEPARTMENT_STYLES[dept] || DEPARTMENT_STYLES['General'];

// ── Solid Flat Card Container (3D Movement Disabled) ─────────────────────
const TiltCard = ({ children, className = "", onClick, ...props }) => {
  return (
    <div
      onClick={onClick}
      className={className}
      {...props}
    >
      {children}
    </div>
  );
};

// ── Daily Attendance Pill-Spectrum Widget (Inspired by Reference Design) ──
const DailyAttendanceSpectrumWidget = ({ stats, targetDate, setTargetDate }) => {
  const [hoveredDay, setHoveredDay] = useState(null);
  const [dynamicWeekData, setDynamicWeekData] = useState(null);
  
  const [baseWeekDate, setBaseWeekDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay());
    return d;
  });

  useEffect(() => {
    let isMounted = true;
    const fetchSpectrum = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        
        const dateStr = new Date(Date.UTC(baseWeekDate.getFullYear(), baseWeekDate.getMonth(), baseWeekDate.getDate())).toISOString().split('T')[0];
        const res = await fetch(`${API_BASE}/api/attendance/weekly-spectrum?date=${dateStr}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data?.weekData) {
            setDynamicWeekData(data);
          }
        }
      } catch (err) {
        console.error('Failed to fetch weekly attendance spectrum:', err);
      }
    };
    fetchSpectrum();
    return () => { isMounted = false; };
  }, [baseWeekDate]);

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const realNow = new Date();
  realNow.setHours(0, 0, 0, 0);
  
  const currentWeekSunday = new Date(realNow);
  currentWeekSunday.setDate(currentWeekSunday.getDate() - currentWeekSunday.getDay());

  const totalEmps = dynamicWeekData?.totalEmployees || stats.total || 1;
  const currPresent = stats.present || 0;
  const currHalfDay = stats.halfDay || 0;
  const currAbsent = stats.absent || 0;
  const currLeave = stats.onLeave || 0;

  const weeklyData = useMemo(() => {
    const targetSunday = new Date(baseWeekDate);
    targetSunday.setDate(targetSunday.getDate() - targetSunday.getDay());

    const baseData = dynamicWeekData?.weekData?.length === 7 
      ? dynamicWeekData.weekData 
      : daysOfWeek.map((dayName, idx) => {
          const todayIdx = realNow.getDay();
          const isPast = idx < todayIdx;
          const isToday = idx === todayIdx;
          const isFuture = idx > todayIdx;
          const isWeekend = idx === 0; // Sunday is Weekly Off Day; Saturday is Working Day

          let presentCount = isToday && !isWeekend ? currPresent : 0;
          let halfDayCount = isToday && !isWeekend ? currHalfDay : 0;
          let leaveCount = isToday && !isWeekend ? currLeave : 0;
          let absentCount = isToday && !isWeekend ? currAbsent : 0;

          return {
            dayName,
            idx,
            isPast,
            isToday,
            isFuture,
            isWeekend,
            presentCount,
            halfDayCount,
            absentCount,
            leaveCount,
            presentPct: 0,
            halfDayPct: 0,
            absentPct: 0,
            leavePct: 0,
            totalRecorded: 0
          };
        });

    return baseData.map((day, idx) => {
      const d = new Date(targetSunday);
      d.setDate(d.getDate() + idx);
      return { ...day, dateStr: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) };
    });
  }, [dynamicWeekData, baseWeekDate]);

  const handlePrevWeek = () => {
    setBaseWeekDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  };

  const handleNextWeek = () => {
    setBaseWeekDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  };

  const isCurrentWeek = baseWeekDate.getTime() === currentWeekSunday.getTime();
  const targetSunday = new Date(baseWeekDate);
  targetSunday.setDate(targetSunday.getDate() - targetSunday.getDay());
  const targetSaturday = new Date(targetSunday);
  targetSaturday.setDate(targetSaturday.getDate() + 6);
  const weekLabel = `${targetSunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric'})} - ${targetSaturday.toLocaleDateString('en-US', { month: 'short', day: 'numeric'})}`;

  return (
    <TiltCard className="bg-[#FAF8F5] rounded-[24px] border border-[#EAE7E0] p-6 shadow-xs flex flex-col gap-6 relative overflow-hidden group">
      {/* Header & Legend */}
      {/* Header & Legend */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h3 className="font-serif font-bold text-lg text-[#1F2B4D] tracking-tight">Daily Attendance Statistic</h3>
            <div className="flex items-center gap-1 bg-[#1F2B4D] text-white rounded-full shadow-xs px-2 py-1 shrink-0">
              <button 
                onClick={handlePrevWeek} 
                className="p-1 hover:bg-white/20 rounded-full transition-colors"
                title="Previous Week"
              >
                <ChevronLeft size={12} />
              </button>
              <span className="text-[10px] font-display font-bold uppercase tracking-wider px-1">
                {isCurrentWeek ? `LIVE: ${weekLabel}` : weekLabel}
              </span>
              <button 
                onClick={handleNextWeek}
                disabled={isCurrentWeek}
                className={`p-1 rounded-full transition-colors ${isCurrentWeek ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/20'}`}
                title="Next Week"
              >
                <ChevronRight size={12} />
              </button>
            </div>
          </div>
          <p className="text-xs text-[#6B655C] font-medium mt-1.5 line-clamp-2">Weekly attendance spectrum waveform across organization divisions.</p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-xs font-display font-bold flex-wrap lg:flex-nowrap justify-start xl:justify-end mt-2 xl:mt-0">
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="w-3 h-3 rounded-full bg-[#10B981] shadow-xs inline-block" />
            <span className="text-[#1F2B4D]">Present Today</span>
          </div>
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="w-3 h-3 rounded-full bg-[#F59E0B] shadow-xs inline-block" />
            <span className="text-[#1F2B4D]">Half Day Today</span>
          </div>
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="w-3 h-3 rounded-full bg-[#F43F5E] shadow-xs inline-block" />
            <span className="text-[#1F2B4D]">Absent Today</span>
          </div>
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="w-3 h-3 rounded-full bg-[#A855F7] shadow-xs inline-block" />
            <span className="text-[#6B655C]">Past Days</span>
          </div>
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="w-3 h-3 rounded-full bg-[#CBD5E1] border border-dashed border-[#94A3B8] shadow-xs inline-block" />
            <span className="text-[#9A948A]">Upcoming</span>
          </div>
          <span className="text-[#9A948A] italic opacity-80 whitespace-nowrap ml-1">(Leave shown separately)</span>
        </div>
      </div>

      {/* Bar Chart Spectrum Grid */}
      <div className="relative pt-6 pb-2 px-1 sm:px-4 flex items-end justify-between gap-1 sm:gap-4 md:gap-6 min-h-[180px] sm:min-h-[220px] w-full">
        {/* Y-Axis Guidelines */}
          <div className="absolute inset-x-0 top-6 bottom-10 flex flex-col justify-between pointer-events-none opacity-20">
            <div className="border-b border-dashed border-[#1F2B4D] w-full" />
            <div className="border-b border-dashed border-[#1F2B4D] w-full" />
            <div className="border-b border-dashed border-[#1F2B4D] w-full" />
          </div>

        {weeklyData.map((d) => {
          const isHovered = hoveredDay === d.idx;
          const isSelected = targetDate === d.dateStr;

          // Colors:
          // Today: Vibrant Green (#10B981) for Present, Vibrant Red (#F43F5E) for Absent
          // Past: Muted Violet (#A855F7) for Present, Corporate Blue (#3B82F6) for Absent
          // Future: Light Gray (#E2E8F0)
          const presentColor = d.isToday ? 'bg-[#10B981]' : d.isPast ? 'bg-[#A855F7]' : 'bg-[#E2E8F0]';
          const halfDayColor = d.isToday ? 'bg-[#F59E0B]' : d.isPast ? 'bg-[#FCD34D]' : 'bg-[#FEF3C7]';
          const absentColor = d.isToday ? 'bg-[#F43F5E]' : d.isPast ? 'bg-[#3B82F6]' : 'bg-[#CBD5E1]/40';

          const isWeekend = d.isWeekend;
          const isEmpty = d.isPast && d.totalRecorded === 0;
          const presentH = d.isFuture || isEmpty || isWeekend ? 0 : Math.max(16, (d.presentCount / totalEmps) * 140);
          const halfDayH = d.isFuture || isEmpty || isWeekend ? 0 : Math.max(16, (d.halfDayCount / totalEmps) * 140);
          const absentH = d.isFuture || isEmpty || isWeekend ? 0 : Math.max(16, (d.absentCount / totalEmps) * 140);

          const handlePillClick = () => {
            if (d.isFuture) return;
            if (d.isToday) {
              setTargetDate(null);
            } else {
              setTargetDate(d.dateStr);
            }
          };

          return (
            <div
              key={d.dayName}
              onMouseEnter={() => setHoveredDay(d.idx)}
              onMouseLeave={() => setHoveredDay(null)}
              onClick={handlePillClick}
              className={`relative flex-1 min-w-[28px] sm:min-w-[48px] shrink flex flex-col items-center group ${d.isFuture ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {/* Floating Tooltip */}
              {isHovered && (
                <div className="absolute -top-20 z-30 bg-[#1F2B4D] text-white px-3.5 py-2 rounded-2xl shadow-xl text-[11px] font-medium flex flex-col gap-1 whitespace-nowrap animate-in fade-in zoom-in-95 duration-150 border border-white/10 pointer-events-none">
                  <div className="font-bold border-b border-white/10 pb-1 text-emerald-400 flex items-center justify-between gap-3">
                    <span>{d.dayName} {d.isToday && !d.isWeekend ? '(Today in Swing)' : d.isPast ? '(Recorded)' : '(Upcoming)'}</span>
                  </div>
                  {d.isWeekend ? (
                    <span className="text-slate-300 italic">Weekly Off</span>
                  ) : d.isFuture ? (
                    <span className="text-slate-300 italic">Not recorded yet</span>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-emerald-300 font-semibold">Present:</span>
                        <span className="font-bold">{d.presentCount} ({d.presentPct}%)</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-amber-300 font-semibold">Half Day:</span>
                        <span className="font-bold">{d.halfDayCount} ({d.halfDayPct}%)</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-rose-300 font-semibold">Absent:</span>
                        <span className="font-bold">{d.absentCount} ({d.absentPct}%)</span>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Active Day Indicator Ring Dot (Matching Reference Image "Thu" Dot) */}
              {d.isToday && !d.isWeekend && (
                <div className="mb-2 w-6 h-6 rounded-full bg-[#1F2B4D] p-1 flex items-center justify-center shadow-md animate-bounce">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
                </div>
              )}
              {(!d.isToday || d.isWeekend) && <div className="mb-2 h-6" />}

              {/* Vertical Stacked Pill Bar Container */}
              <div
                className={`w-full max-w-[36px] sm:max-w-[48px] h-[120px] sm:h-[160px] rounded-full flex flex-col justify-end overflow-hidden transition-all duration-300 p-0.5 sm:p-1 ${
                  isSelected
                    ? 'bg-white shadow-lg border-2 border-[#1F2B4D] ring-4 ring-[#1F2B4D]/20 scale-105'
                    : d.isToday && !d.isWeekend
                    ? 'bg-white shadow-md border-2 border-[#10B981] ring-4 ring-[#10B981]/10 scale-105'
                    : d.isWeekend
                    ? 'bg-[#F0F3F9] border-2 border-dashed border-[#CBD5E1] opacity-70'
                    : d.isFuture
                    ? 'bg-[#FAF9F6] border-2 border-dashed border-[#CBD5E1]'
                    : 'bg-white shadow-xs border border-[#EAE7E0] hover:border-[#1F2B4D]/50 hover:shadow-md'
                }`}
              >
                {d.isWeekend ? (
                  <div className="w-full h-full rounded-full bg-gradient-to-b from-[#F0F3F9]/60 to-[#E2E8F0]/40 flex items-center justify-center">
                    <span className="text-[8px] sm:text-[10px] font-bold text-[#9A948A] uppercase tracking-wider -rotate-90">Off Day</span>
                  </div>
                ) : d.isFuture ? (
                  <div className="w-full h-full rounded-full bg-gradient-to-b from-[#E2E8F0]/30 to-[#CBD5E1]/20 flex items-center justify-center">
                    <span className="text-[8px] sm:text-[10px] font-bold text-[#9A948A] uppercase tracking-wider -rotate-90">Pending</span>
                  </div>
                ) : isEmpty ? (
                  <div className="w-full h-full rounded-full bg-gradient-to-b from-[#F3F4F6]/50 to-[#E5E7EB]/30 flex items-center justify-center">
                    <span className="text-[8px] sm:text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider -rotate-90">Empty</span>
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col justify-end gap-1.5 rounded-full overflow-hidden">
                    {/* Top Segment: Absent */}
                    <div
                      style={{ height: `${absentH}px` }}
                      className={`w-full rounded-full transition-all duration-500 shadow-xs flex items-center justify-center ${absentColor} ${
                        isHovered ? 'brightness-110 scale-[1.02]' : ''
                      }`}
                    >
                      {absentH > 24 && (
                        <span className="text-[6.5px] sm:text-[10px] font-bold text-white tracking-tight">
                          {d.absentPct}%
                        </span>
                      )}
                    </div>

                    {/* Middle Segment: Half Day */}
                    <div
                      style={{ height: `${halfDayH}px` }}
                      className={`w-full rounded-full transition-all duration-500 shadow-xs flex items-center justify-center ${halfDayColor} ${
                        isHovered ? 'brightness-110 scale-[1.02]' : ''
                      }`}
                    >
                      {halfDayH > 24 && (
                        <span className="text-[6.5px] sm:text-[10px] font-bold text-white tracking-tight">
                          {d.halfDayPct}%
                        </span>
                      )}
                    </div>

                    {/* Bottom Segment: Present */}
                    <div
                      style={{ height: `${presentH}px` }}
                      className={`w-full rounded-full transition-all duration-500 shadow-xs flex items-center justify-center ${presentColor} ${
                        isHovered ? 'brightness-110 scale-[1.02]' : ''
                      }`}
                    >
                      {presentH > 24 && (
                        <span className="text-[6.5px] sm:text-[10px] font-bold text-white tracking-tight">
                          {d.presentPct}%
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Day Name Label */}
              <div className="flex flex-col items-center mt-3">
                <span
                  className={`text-[9px] sm:text-xs font-display font-bold transition-colors truncate max-w-full ${
                    d.isToday
                      ? 'text-[#1F2B4D] bg-[#F0F3F9] px-1.5 sm:px-2.5 py-0.5 rounded-full border border-[#CBD5E1]'
                      : 'text-[#6B655C]'
                  }`}
                >
                  {d.dayName}
                </span>
                <span className="text-[8px] sm:text-[9px] text-[#9A948A] font-medium mt-0.5">{d.dateStr}</span>
              </div>
            </div>
          );
        })}
      </div>
    </TiltCard>
  );
};

// ── Stat Card (Clean Solid Corporate Widget) ──────────────────────────────
const StatCard = ({ icon: Icon, label, value, subtext, color, iconBg, isActive, onClick }) => (
  <TiltCard
    onClick={onClick}
    className={`bg-[#FAF8F5] rounded-[20px] border p-3 2xl:p-4.5 flex items-center justify-between cursor-pointer transition-all duration-300 ${
      isActive
        ? 'border-[#1F2B4D] ring-2 ring-[#1F2B4D]/10 shadow-md scale-[1.01]'
        : 'border-[#EAE7E0] shadow-xs hover:shadow-md hover:border-[#CBD5E1]'
    }`}
  >
    <div className="flex items-center gap-2 2xl:gap-3.5 min-w-0 flex-1">
      <div className={`w-9 h-9 2xl:w-11 2xl:h-11 rounded-xl flex items-center justify-center ${iconBg} ${color} border border-[#EAE7E0] shrink-0`}>
        <Icon className="w-4 h-4 2xl:w-5 2xl:h-5 opacity-95" />
      </div>
      <div className="min-w-0 pr-1">
        <p className="text-xl lg:text-2xl 2xl:text-3xl font-serif font-bold text-[#1F2B4D] tracking-tight leading-none">{value}</p>
        <p className="text-[9px] 2xl:text-[10px] font-display font-bold text-[#6B655C] uppercase tracking-wider mt-1.5 leading-tight">{label}</p>
      </div>
    </div>

    {subtext && (
      <span className={`hidden md:inline-flex items-center px-2 py-0.5 2xl:px-2.5 2xl:py-1 rounded-full text-[9px] 2xl:text-[10px] font-display font-bold tracking-wide border transition-colors shrink-0 ${
        isActive
          ? 'bg-[#1F2B4D] text-white border-[#1F2B4D]'
          : 'bg-[#F0F3F9] text-[#1F2B4D] border-[#D0D9E8]'
      }`}>
        {subtext}
      </span>
    )}
  </TiltCard>
);

// ── Filter Dropdown ────────────────────────────────────────────────────────
const FilterDropdown = ({ label, options, value, onChange }) => {
  return (
    <div className="relative flex items-center shrink-0">
      <div className={`pointer-events-none absolute left-3 z-10 flex items-center gap-1 text-[11px] font-bold ${value ? 'text-[#1F2B4D]' : 'text-[#6B655C]'}`}>
        <Filter size={12} className={value ? 'text-[#1F2B4D]' : 'opacity-60'} />
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`appearance-none cursor-pointer pl-8 pr-7 py-1.5 sm:py-2 rounded-xl text-[10px] sm:text-xs font-display font-bold tracking-wide transition-all duration-200 border outline-none shadow-xs ${
          value
            ? 'bg-[#F0F3F9] text-[#1F2B4D] border-[#CBD5E1] font-extrabold'
            : 'bg-white text-[#6B655C] border-[#EAE7E0] hover:border-[#CBD5E1]'
        }`}
      >
        <option value="">{label}</option>
        {options.map((opt) => {
          const optVal = typeof opt === 'string' ? opt : opt.label || opt.name;
          const optId = typeof opt === 'string' ? opt : opt.id || opt.name;
          return (
            <option key={optId} value={optVal} className="text-[#1F2B4D] font-medium bg-white py-1">
              {optVal}
            </option>
          );
        })}
      </select>
      <div className="pointer-events-none absolute right-2 z-10 text-[#6B655C]">
        <ChevronDown size={13} className="opacity-60" />
      </div>
    </div>
  );
};

// ── Copyable Employee ID ───────────────────────────────────────────────────
const CopyableEmployeeId = ({ employeeId }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (!employeeId) return;
    navigator.clipboard.writeText(employeeId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1 font-mono text-[11px] text-[#6B655C] hover:text-[#1F2B4D] bg-[#FAF9F6] border border-[#EAE7E0] px-2 py-0.5 rounded-md transition-colors"
      title="Click to copy ID"
    >
      <span>{employeeId || 'EMP-N/A'}</span>
      {copied ? <Check size={10} className="text-emerald-600" /> : <Copy size={10} className="opacity-50" />}
    </button>
  );
};

// ── Status Badge ───────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-display font-bold uppercase tracking-wider border ${getStatusClasses(status.variant)}`}>
    <span className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor(status.variant)} ${status.variant === 'emerald' ? 'animate-pulse-dot' : ''}`} />
    {status.text}
  </span>
);

// ── Employee Avatar ────────────────────────────────────────────────────────
const EmployeeAvatar = ({ emp, size = "md", statusVariant }) => {
  const initials = (emp.displayName || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const sizeClasses = size === 'lg' ? 'w-16 h-16 text-xl' : size === 'sm' ? 'w-8 h-8 text-xs' : 'w-11 h-11 text-sm';

  const ringColor = statusVariant === 'emerald' ? 'ring-emerald-400'
    : statusVariant === 'amber' ? 'ring-amber-400'
    : statusVariant === 'rose' ? 'ring-rose-400'
    : 'ring-[#EAE7E0]';

  return (
    <div className={`relative shrink-0 rounded-full ring-2 ${ringColor} ring-offset-2 ring-offset-white`}>
      <div className={`${sizeClasses} rounded-full flex items-center justify-center font-bold overflow-hidden bg-blue-50 text-[#3b82f6]`}>
        {emp.avatar ? (
          <img src={emp.avatar} alt={emp.displayName} className="w-full h-full object-cover" loading="lazy" decoding="async" />
        ) : (
          initials
        )}
      </div>
    </div>
  );
};

// ── Employee Grid Card ─────────────────────────────────────────────────────
const EmployeeGridCard = ({ emp, status, index, isSelected, onToggleSelect, onQuickView }) => (
  <TiltCard
    className={`bg-white rounded-[20px] border p-5 flex flex-col justify-between transition-all duration-300 hover:shadow-md group relative overflow-hidden ${
      isSelected ? 'border-[#1F2B4D] ring-2 ring-[#1F2B4D]/10 bg-[#F0F3F9]/30' : 'border-[#EAE7E0] shadow-xs hover:border-[#CBD5E1]'
    }`}
    style={{ animationDelay: `${index * 45}ms` }}
  >
    {/* Header controls: selection & quick view */}
    <div className="flex items-center justify-between mb-3 z-10">
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleSelect(emp.id); }}
        className="text-[#9A948A] hover:text-[#1F2B4D] transition-colors p-1 -ml-1 active:scale-90"
        aria-label={`Select ${emp.displayName}`}
      >
        {isSelected ? <CheckSquare size={18} className="text-[#1F2B4D]" /> : <Square size={18} className="opacity-50 hover:opacity-100" />}
      </button>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onQuickView(emp); }}
        className="inline-flex items-center gap-1 text-[11px] font-display font-bold text-[#6B655C] hover:text-[#1F2B4D] bg-[#FAF8F5] hover:bg-[#F0F3F9] px-2.5 py-1 rounded-lg border border-[#EAE7E0] opacity-0 group-hover:opacity-100 -translate-y-1 group-hover:translate-y-0 transition-all duration-200 shadow-xs active:scale-95"
      >
        <Eye size={12} /> Quick View
      </button>
    </div>

    {/* Main Link Content */}
    <Link to={`/dashboard/employee/${emp.id}`} className="flex flex-col flex-1 z-10">
      <div className="flex items-start gap-3.5 mb-4">
        <EmployeeAvatar emp={emp} size="lg" statusVariant={status.variant} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="font-serif font-bold text-[#1F2B4D] text-[15px] group-hover:text-[#141C33] transition-colors truncate">
              {emp.displayName}
            </h3>
            {emp.attendancePercentage !== undefined && (
              <div className="flex items-center gap-1.5 shrink-0">
                <span className={`px-1.5 py-0.5 rounded-[6px] text-[10px] font-display font-bold shadow-xs border ${
                  emp.attendancePercentage >= 90 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                  emp.attendancePercentage >= 75 ? 'bg-amber-50 text-amber-700 border-amber-100' :
                  'bg-rose-50 text-rose-700 border-rose-100'
                }`} title="Lifetime Attendance">
                  {emp.attendancePercentage}%
                </span>
                {emp.hasAttendanceInconsistency && (
                  <AlertTriangle size={12} className="text-amber-500" title="Data inconsistency detected (e.g., duplicates)" />
                )}
              </div>
            )}
          </div>
          <p className="text-xs text-[#6B655C] font-medium mt-0.5 truncate">{emp.jobPosition || emp.role || 'Employee'}</p>
          <div className="mt-1.5">
            <CopyableEmployeeId employeeId={emp.employeeId} />
          </div>
        </div>
      </div>

      {/* Info badges */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-display font-bold uppercase tracking-wider bg-[#FAF9F6] text-[#6B655C] border border-[#EAE7E0]">
          <Building2 size={11} className="opacity-70" />
          {emp.department || 'General'}
        </span>
        {(() => {
          if (!emp.shiftAssignments) return null;
          const upcomingShift = emp.shiftAssignments.find(a => new Date(a.slot.date).toDateString() !== new Date().toDateString());
          if (!upcomingShift) return null;
          
          const shiftDate = new Date(upcomingShift.slot.date);
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          const isTomorrow = shiftDate.toDateString() === tomorrow.toDateString();
          const dateLabel = isTomorrow ? 'TOMORROW' : shiftDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase();

          return (
            <span 
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-display font-bold tracking-wider uppercase bg-[#F0F3F9] text-[#1F2B4D] border border-[#D0D9E8]"
              title={`${shiftDate.toLocaleDateString()}`}
            >
              <Clock size={11} className="opacity-70 text-indigo-600" />
              {dateLabel}: {upcomingShift.slot.shiftType.replace(/_|-/g, ' ').replace(/\bSHIFT\b/i, '').trim()} SHIFT
            </span>
          );
        })()}
      </div>

      {/* Contact info */}
      <div className="flex flex-col gap-1.5 pb-4 border-b border-[#F4F1EA] mb-4">
        {emp.email && (
          <p className="text-[11px] text-[#6B655C] flex items-center gap-2 truncate hover:text-[#1F2B4D] transition-colors font-medium">
            <Mail size={11} className="shrink-0 text-[#1F2B4D]" /> {emp.email}
          </p>
        )}
        {emp.phone && (
          <p className="text-[11px] text-[#6B655C] flex items-center gap-2 font-mono">
            <Phone size={11} className="shrink-0 text-[#1F2B4D]" /> {emp.phone}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={status} />
          {(() => {
            const todayShift = emp.shiftAssignments ? emp.shiftAssignments.find(a => new Date(a.slot.date).toDateString() === new Date().toDateString()) : null;
            if (todayShift) {
              return (
                <span 
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-display font-bold tracking-wider uppercase bg-[#F0F3F9] text-[#1F2B4D] border border-[#D0D9E8]"
                  title={`Today's Shift: ${new Date(todayShift.slot.date).toLocaleDateString()}`}
                >
                  <Clock size={10} className="opacity-70 text-indigo-600" />
                  {todayShift.slot.shiftType.replace(/_|-/g, ' ').replace(/\bSHIFT\b/i, '').trim()} SHIFT
                </span>
              );
            }
            return (
              <span 
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-display font-bold tracking-wider uppercase bg-[#FAF9F6] text-[#6B655C] border border-[#EAE7E0]"
                title="Regular Default Shift"
              >
                <Clock size={10} className="opacity-50" />
                REGULAR SHIFT
              </span>
            );
          })()}
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-display font-bold text-[#1F2B4D] group-hover:text-[#141C33] transition-colors">
          Details <span aria-hidden="true" className="inline-block transition-transform duration-200 group-hover:translate-x-1.5">→</span>
        </span>
      </div>
    </Link>
  </TiltCard>
);

// ── Table Row View ─────────────────────────────────────────────────────────
const EmployeeTableRow = ({ emp, status, index, isSelected, onToggleSelect, onQuickView }) => (
  <tr
    className={`group transition-colors duration-200 border-b border-[#F4F1EA] last:border-0 ${
      isSelected ? 'bg-[#F0F3F9]/60' : 'hover:bg-[#FAF9F6]/80'
    }`}
    style={{ animationDelay: `${index * 25}ms` }}
  >
    <td className="py-4 px-4 w-10">
      <button type="button" onClick={() => onToggleSelect(emp.id)} className="text-[#9A948A] hover:text-[#1F2B4D] transition-colors">
        {isSelected ? <CheckSquare size={16} className="text-[#1F2B4D]" /> : <Square size={16} className="opacity-50 hover:opacity-100" />}
      </button>
    </td>
    <td className="py-4 px-5">
      <div className="flex items-center gap-3.5">
        <EmployeeAvatar emp={emp} size="sm" statusVariant={status.variant} />
        <div className="flex flex-col min-w-0">
          <Link to={`/dashboard/employee/${emp.id}`} className="font-serif font-bold text-[#1F2B4D] hover:text-[#141C33] transition-colors text-xs flex items-center gap-2">
            <span className="truncate">{emp.displayName}</span>
            {emp.attendancePercentage !== undefined && (
              <div className="flex items-center gap-1.5 shrink-0">
                <span className={`px-1.5 py-0.5 rounded-[6px] text-[9px] font-display font-bold shadow-xs border ${
                  emp.attendancePercentage >= 90 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                  emp.attendancePercentage >= 75 ? 'bg-amber-50 text-amber-700 border-amber-100' :
                  'bg-rose-50 text-rose-700 border-rose-100'
                }`} title="Lifetime Attendance">
                  {emp.attendancePercentage}%
                </span>
                {emp.hasAttendanceInconsistency && (
                  <AlertTriangle size={12} className="text-amber-500" title="Data inconsistency detected" />
                )}
              </div>
            )}
          </Link>
          <span className="text-[10px] text-[#6B655C] font-mono">{emp.employeeId}</span>
        </div>
      </div>
    </td>
    <td className="py-4 px-5">
      <div className="flex flex-col gap-1.5 items-start">
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-display font-bold uppercase tracking-wider bg-[#FAF9F6] text-[#6B655C] border border-[#EAE7E0]">
          {emp.department || 'General'}
        </span>
        {(() => {
          if (!emp.shiftAssignments) return null;
          const upcomingShift = emp.shiftAssignments.find(a => new Date(a.slot.date).toDateString() !== new Date().toDateString());
          if (!upcomingShift) return null;
          
          const shiftDate = new Date(upcomingShift.slot.date);
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          const isTomorrow = shiftDate.toDateString() === tomorrow.toDateString();
          const dateLabel = isTomorrow ? 'TOMORROW' : shiftDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase();

          return (
            <span 
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[10px] font-display font-bold tracking-wider uppercase bg-[#F0F3F9] text-[#1F2B4D] border border-[#D0D9E8]"
              title={`${shiftDate.toLocaleDateString()}`}
            >
              <Clock size={10} className="opacity-70 text-indigo-600" />
              {dateLabel}: {upcomingShift.slot.shiftType.replace(/_|-/g, ' ').replace(/\bSHIFT\b/i, '').trim()} SHIFT
            </span>
          );
        })()}
      </div>
    </td>
    <td className="py-4 px-5 hidden lg:table-cell">
      <span className="text-xs text-[#6B655C] font-medium">{emp.jobPosition || emp.role || '—'}</span>
    </td>
    <td className="py-4 px-5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={status} />
        {(() => {
          const todayShift = emp.shiftAssignments ? emp.shiftAssignments.find(a => new Date(a.slot.date).toDateString() === new Date().toDateString()) : null;
          if (todayShift) {
            return (
              <span 
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[9px] font-display font-bold tracking-wider uppercase bg-[#F0F3F9] text-[#1F2B4D] border border-[#D0D9E8]"
                title={`Today's Shift: ${new Date(todayShift.slot.date).toLocaleDateString()}`}
              >
                <Clock size={10} className="opacity-70 text-indigo-600" />
                {todayShift.slot.shiftType.replace(/_|-/g, ' ').replace(/\bSHIFT\b/i, '').trim()} SHIFT
              </span>
            );
          }
          return (
            <span 
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[9px] font-display font-bold tracking-wider uppercase bg-[#FAF9F6] text-[#6B655C] border border-[#EAE7E0]"
              title="Regular Default Shift"
            >
              <Clock size={10} className="opacity-50" />
              REGULAR SHIFT
            </span>
          );
        })()}
      </div>
    </td>
    <td className="py-4 px-5 text-right">
      <div className="inline-flex items-center gap-2">
        <button
          type="button"
          onClick={() => onQuickView(emp)}
          className="p-1.5 rounded-lg text-[#9A948A] hover:text-[#1F2B4D] hover:bg-[#F0F3F9] transition-colors"
          title="Quick View"
        >
          <Eye size={15} />
        </button>
        <Link
          to={`/dashboard/employee/${emp.id}`}
          className="inline-flex items-center gap-1 text-xs font-display font-bold text-[#1F2B4D] hover:text-[#141C33] transition-colors"
        >
          Details <span aria-hidden="true">→</span>
        </Link>
      </div>
    </td>
  </tr>
);

// ── Compact Row View ───────────────────────────────────────────────────────
const EmployeeCompactRow = ({ emp, status, index, isSelected, onToggleSelect, onQuickView }) => (
  <div
    className={`flex items-center gap-3.5 px-5 py-3 border-b border-[#F4F1EA] last:border-0 transition-colors duration-150 ${
      isSelected ? 'bg-[#F0F3F9]/60' : 'hover:bg-[#FAF9F6]/80'
    }`}
    style={{ animationDelay: `${index * 20}ms` }}
  >
    <button type="button" onClick={() => onToggleSelect(emp.id)} className="text-[#9A948A] hover:text-[#1F2B4D] transition-colors">
      {isSelected ? <CheckSquare size={16} className="text-[#1F2B4D]" /> : <Square size={16} className="opacity-50 hover:opacity-100" />}
    </button>
    <EmployeeAvatar emp={emp} size="sm" statusVariant={status.variant} />
    <Link to={`/dashboard/employee/${emp.id}`} className="flex-1 font-serif font-bold text-[#1F2B4D] text-xs hover:text-[#141C33] transition-colors truncate flex items-center gap-2">
      {emp.displayName}
      {emp.attendancePercentage !== undefined && (
        <div className="flex items-center gap-1.5">
          <span className={`px-1.5 py-0.5 rounded-[6px] text-[9px] font-display font-bold shadow-xs border ${
            emp.attendancePercentage >= 90 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
            emp.attendancePercentage >= 75 ? 'bg-amber-50 text-amber-700 border-amber-100' :
            'bg-rose-50 text-rose-700 border-rose-100'
          }`} title="Lifetime Attendance">
            {emp.attendancePercentage}%
          </span>
          {emp.hasAttendanceInconsistency && (
            <AlertTriangle size={12} className="text-amber-500 shrink-0" title="Data inconsistency detected" />
          )}
        </div>
      )}
    </Link>
    <span className="text-[10px] font-mono text-[#6B655C] hidden sm:block w-28 truncate">{emp.employeeId}</span>
    <span className="text-xs text-[#6B655C] hidden md:block w-32 truncate">{emp.department || 'General'}</span>
    <StatusBadge status={status} />
    <button
      type="button"
      onClick={() => onQuickView(emp)}
      className="p-1 rounded-lg text-[#9A948A] hover:text-[#1F2B4D] transition-colors ml-1"
      title="Quick View"
    >
      <Eye size={15} />
    </button>
  </div>
);

// ── Skeleton Loaders ───────────────────────────────────────────────────────
const SkeletonGrid = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
    {Array.from({ length: 8 }).map((_, i) => (
      <div key={i} className="bg-[#FAF8F5] rounded-[20px] border border-[#EAE7E0] p-5 space-y-4 animate-pulse">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-full bg-[#F0F3F9] shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-[#F0F3F9] rounded-lg w-3/4" />
            <div className="h-3 bg-[#EAE7E0] rounded w-1/2" />
          </div>
        </div>
        <div className="h-6 bg-[#EAE7E0] rounded-lg w-1/3" />
        <div className="flex justify-between items-center pt-2">
          <div className="h-6 bg-[#F0F3F9] rounded-full w-20" />
          <div className="h-4 bg-[#EAE7E0] rounded w-12" />
        </div>
      </div>
    ))}
  </div>
);

const SkeletonTable = () => (
  <div className="space-y-0">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-[#EAE7E0] bg-white animate-pulse">
        <div className="w-9 h-9 rounded-full bg-[#F0F3F9] shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-[#F0F3F9] rounded w-32" />
          <div className="h-3 bg-[#EAE7E0] rounded w-20" />
        </div>
        <div className="h-4 bg-[#EAE7E0] rounded w-20 hidden md:block" />
        <div className="h-5 bg-[#F0F3F9] rounded-full w-16" />
        <div className="h-4 bg-[#EAE7E0] rounded w-14" />
      </div>
    ))}
  </div>
);

// ── Empty State ────────────────────────────────────────────────────────────
const EmptyState = ({ hasFilters, onClear }) => {
  const Icon = hasFilters ? SearchX : UserPlus;
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#F0F3F9] flex items-center justify-center mb-4 border border-[#D0D9E8] shadow-xs">
        <Icon size={28} className="text-[#1F2B4D]" />
      </div>
      <h3 className="font-serif font-bold text-xl text-[#1F2B4D] mb-1.5 tracking-tight">
        {hasFilters ? 'No matching employees' : 'No team members added'}
      </h3>
      <p className="text-xs text-[#6B655C] max-w-sm mb-5 font-medium leading-relaxed">
        {hasFilters
          ? 'Try adjusting your search criteria or active filters to locate team members.'
          : 'Get started by adding your first employee to your workforce directory.'}
      </p>
      {hasFilters && (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-display font-bold text-[#1F2B4D] bg-[#F0F3F9] hover:bg-[#E2E8F0] border border-[#CBD5E1] shadow-xs transition-all active:scale-95"
        >
          Clear active filters
        </button>
      )}
    </div>
  );
};

// ── Quick View Slide-over Drawer ───────────────────────────────────────────
const QuickViewDrawer = ({ emp, onClose }) => {
  if (!emp) return null;
  const status = getEmployeeStatus(emp);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-[#1F2B4D]/20 backdrop-blur-xs transition-opacity" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white border-l border-[#EAE7E0] shadow-2xl p-6 flex flex-col justify-between overflow-y-auto">
          <div>
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#EAE7E0] mb-6">
              <span className="text-[10px] font-display font-bold uppercase tracking-wider text-[#1F2B4D] flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-500" /> Quick Profile Overview
              </span>
              <button type="button" onClick={onClose} className="p-1.5 rounded-xl text-[#6B655C] hover:text-[#1F2B4D] hover:bg-[#EAE7E0] transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Profile Header */}
            <div className="flex flex-col items-center text-center mb-6">
              <EmployeeAvatar emp={emp} size="lg" statusVariant={status.variant} />
              <h2 className="font-serif font-bold text-xl text-[#1F2B4D] mt-3">{emp.displayName}</h2>
              <p className="text-xs text-[#6B655C] font-medium mt-0.5">{emp.jobPosition || emp.role || 'Employee'}</p>
              <div className="mt-2">
                <StatusBadge status={status} />
              </div>
            </div>

            {/* Info Grid */}
            <div className="space-y-3.5 bg-[#FAF8F5] rounded-2xl p-4 border border-[#EAE7E0]">
              <div className="flex justify-between items-center text-xs py-1 border-b border-[#EAE7E0]">
                <span className="text-[#6B655C] font-medium">Employee ID</span>
                <CopyableEmployeeId employeeId={emp.employeeId} />
              </div>
              <div className="flex justify-between items-center text-xs py-1 border-b border-[#EAE7E0]">
                <span className="text-[#6B655C] font-medium">Department</span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-display font-bold uppercase tracking-wider bg-[#FAF9F6] text-[#6B655C] border border-[#EAE7E0]">
                  {emp.department || 'General'}
                </span>
              </div>
              {emp.email && (
                <div className="flex justify-between items-center text-xs py-1 border-b border-[#EAE7E0]">
                  <span className="text-[#6B655C] font-medium">Email</span>
                  <a href={`mailto:${emp.email}`} className="text-[#1F2B4D] font-medium hover:underline truncate max-w-[200px]">
                    {emp.email}
                  </a>
                </div>
              )}
              {emp.phone && (
                <div className="flex justify-between items-center text-xs py-1">
                  <span className="text-[#6B655C] font-medium">Phone</span>
                  <a href={`tel:${emp.phone}`} className="text-[#1F2B4D] font-mono hover:underline">
                    {emp.phone}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Drawer Actions */}
          <div className="pt-6 border-t border-[#EAE7E0] mt-6 flex gap-3">
            <Link
              to={`/dashboard/employee/${emp.id}`}
              className="flex-1 flex items-center justify-center gap-2 bg-[#F0F3F9] hover:bg-[#E2E8F0] text-[#1F2B4D] border border-[#CBD5E1] py-2.5 rounded-xl text-xs font-display font-bold shadow-xs active:scale-[0.98] transition-all"
            >
              View Full Profile <ExternalLink size={14} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Command-K Spotlight Modal ──────────────────────────────────────────────
const CommandKModal = ({ isOpen, onClose, employees, onSelect }) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 50);
  }, [isOpen]);

  if (!isOpen) return null;

  const results = query.trim()
    ? employees.filter(e =>
        (e.displayName || '').toLowerCase().includes(query.toLowerCase()) ||
        (e.employeeId || '').toLowerCase().includes(query.toLowerCase()) ||
        (e.department || '').toLowerCase().includes(query.toLowerCase())
      ).slice(0, 5)
    : employees.slice(0, 5);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      <div className="fixed inset-0 bg-[#1F2B4D]/20 backdrop-blur-xs transition-opacity" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-[24px] shadow-2xl border border-[#EAE7E0] overflow-hidden z-10">
        <div className="flex items-center px-4 border-b border-[#EAE7E0] bg-[#FAF8F5]">
          <Search size={16} className="text-[#1F2B4D] shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search employee name, ID, or department..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full py-4 bg-transparent text-xs font-medium text-[#1F2B4D] placeholder:text-[#9A948A] focus:outline-none"
          />
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#F4F1EA] text-[#6B655C] border border-[#EAE7E0]">ESC</kbd>
        </div>

        <div className="p-2 max-h-80 overflow-y-auto">
          {results.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#9A948A]">No matching employees found</div>
          ) : (
            results.map(emp => (
              <div
                key={emp.id}
                onClick={() => { onSelect(emp); onClose(); }}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-[#F0F3F9]/60 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <EmployeeAvatar emp={emp} size="sm" />
                  <div>
                    <p className="text-xs font-serif font-bold text-[#1F2B4D]">{emp.displayName}</p>
                    <p className="text-[10.5px] text-[#6B655C] font-mono">{emp.employeeId} · {emp.department || 'General'}</p>
                  </div>
                </div>
                <span className="text-[11px] font-display font-bold text-[#1F2B4D]">View →</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

const EmployeeDirectory = ({ user }) => {
  const isAdmin = hasPermission(user, 'view_all_employees');
  const [targetDate, setTargetDate] = useState(null);
  const { employees, loading, error, refetch } = useEmployees(isAdmin, targetDate);
  const navigate = useNavigate();

  // ── Realtime Guard ───────────────────────────────────────────────────────
  useEffect(() => {
    const handleRealtimeUpdate = () => {
      if (targetDate !== null) return; // viewing history — ignore live events
      refetch();
    };
    window.addEventListener('app-realtime-update', handleRealtimeUpdate);
    return () => window.removeEventListener('app-realtime-update', handleRealtimeUpdate);
  }, [targetDate, refetch]);

  // ── State & Selection ──────────────────────────────────────────────────
  const [view, setView] = useState(() => localStorage.getItem('emp-view') || 'grid');
  const [searchRaw, setSearchRaw] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortField, setSortField] = useState('displayName');
  const [sortDir, setSortDir] = useState('asc');

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [quickViewEmp, setQuickViewEmp] = useState(null);
  const [isCommandOpen, setIsCommandOpen] = useState(false);

  const [biometricUnlock, setBiometricUnlock] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    fetch(`${API_BASE}/api/face-registration/unlock-status`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setBiometricUnlock(data); })
      .catch(() => {});
  }, []);

  const searchTerm = useDebounce(searchRaw, 250);
  const searchRef = useRef(null);

  // Keyboard shortcut listener for ⌘K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Persist view preference
  useEffect(() => { localStorage.setItem('emp-view', view); }, [view]);

  // ── Derived data ────────────────────────────────────────────────────────
  const employeesWithStatus = useMemo(() =>
    employees.map(emp => ({ ...emp, _status: getEmployeeStatus(emp, targetDate) })),
    [employees, targetDate]
  );

  const departments = useMemo(() =>
    [...new Set(employees.map(e => (e.department || 'General').trim()))].filter(Boolean).sort(),
    [employees]
  );

  const statusOptions = ['Present', 'Absent', 'On Leave', 'Half Day', 'Offboarded'];

  const filtered = useMemo(() => {
    let list = employeesWithStatus;

    if (searchTerm) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter(emp =>
        (emp.displayName || '').toLowerCase().includes(q) ||
        (emp.employeeId || '').toLowerCase().includes(q) ||
        (emp.department || '').toLowerCase().includes(q) ||
        (emp.email || '').toLowerCase().includes(q) ||
        (emp.jobPosition || '').toLowerCase().includes(q)
      );
    }

    if (deptFilter) {
      const targetDept = deptFilter.trim().toLowerCase();
      list = list.filter(emp => (emp.department || 'General').trim().toLowerCase() === targetDept);
    }

    if (statusFilter) {
      const targetStatus = statusFilter.trim().toLowerCase();
      if (targetStatus === 'present') {
        list = list.filter(emp => emp._status.text === 'Present' || emp._status.text === 'Incomplete');
      } else if (targetStatus === 'half day') {
        list = list.filter(emp => emp._status.text.toLowerCase().includes('half day'));
      } else if (targetStatus === 'absent') {
        list = list.filter(emp => emp._status.text === 'Absent' || emp._status.text === 'Late / Pending');
      } else if (targetStatus === 'on leave') {
        list = list.filter(emp => emp._status.text === 'On Leave' || emp._status.text.toLowerCase().includes('leave'));
      } else if (targetStatus === 'offboarded') {
        list = list.filter(emp => emp.status === 'Inactive' || emp.status === 'Offboarded' || emp._status.text === 'Offboarded');
      } else {
        list = list.filter(emp => 
          emp._status.text.toLowerCase().includes(targetStatus) || 
          (emp.status || '').toLowerCase() === targetStatus
        );
      }
    }

    list = [...list].sort((a, b) => {
      let aVal, bVal;
      if (sortField === 'displayName') { aVal = a.displayName || ''; bVal = b.displayName || ''; }
      else if (sortField === 'department') { aVal = a.department || ''; bVal = b.department || ''; }
      else if (sortField === 'status') { aVal = a._status.text; bVal = b._status.text; }
      else { aVal = a.displayName || ''; bVal = b.displayName || ''; }
      const cmp = aVal.localeCompare(bVal);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [employeesWithStatus, searchTerm, deptFilter, statusFilter, sortField, sortDir]);

  // ── Stats ───────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const activeEmployees = employeesWithStatus.filter(e => e.status === 'Active');
    const total = activeEmployees.length;
    const present = activeEmployees.filter(e => e._status.text === 'Present' || e._status.text === 'Incomplete').length;
    const halfDay = activeEmployees.filter(e => e._status.text.includes('Half Day')).length;
    const onLeave = activeEmployees.filter(e => e._status.text === 'On Leave').length;
    const absent = activeEmployees.filter(e => e._status.text === 'Absent' || e._status.text === 'Late / Pending').length;
    const presentPct = total ? Math.round((present / total) * 100) : 0;
    const halfDayPct = total ? Math.round((halfDay / total) * 100) : 0;
    const onLeavePct = total ? Math.round((onLeave / total) * 100) : 0;
    const absentPct = total ? Math.round((absent / total) * 100) : 0;
    return { total, present, halfDay, onLeave, absent, presentPct, halfDayPct, onLeavePct, absentPct };
  }, [employees, employeesWithStatus]);

  const hasFilters = searchTerm || deptFilter || statusFilter;

  const clearAllFilters = useCallback(() => {
    setSearchRaw('');
    setDeptFilter('');
    setStatusFilter('');
  }, []);

  const toggleSort = useCallback((field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }, [sortField]);

  // Bulk Selection Handlers
  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(e => e.id)));
    }
  }, [filtered, selectedIds]);

  const toggleSelectOne = useCallback((id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ArrowUpDown size={12} className="opacity-30" />;
    return sortDir === 'asc' ? <ArrowUp size={12} className="text-[#1F2B4D]" /> : <ArrowDown size={12} className="text-[#1F2B4D]" />;
  };

  // ── Render ──────────────────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <Suspense fallback={<div className="flex items-center justify-center h-full min-h-[50vh]"><div className="w-8 h-8 border-4 border-[#D0D9E8] border-t-[#1F2B4D] rounded-full animate-spin" /></div>}>
        <EmployeeDashboard user={user} />
      </Suspense>
    );
  }

  return (
    <div className="relative p-4 md:p-6 flex flex-col max-w-[1500px] mx-auto w-full">
      
      {/* ── Biometric Unlock Banner ──────────────────────────────────── */}
      {biometricUnlock?.unlocked && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-amber-50 border border-amber-200 rounded-[20px] px-6 py-4 shadow-sm mb-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <ScanFace size={20} strokeWidth={2} />
            </div>
            <div>
              <p className="text-sm font-extrabold text-amber-800 tracking-tight">Biometric Update Available</p>
              <p className="text-xs text-amber-700 font-medium mt-0.5">
                Your biometrics have been unlocked for update by an admin.
                {biometricUnlock.expiresAt && (
                  <> Token expires <strong>{new Date(biometricUnlock.expiresAt).toLocaleString('en-IN')}</strong>.</>  
                )}
              </p>
            </div>
          </div>
          <a
            href={`/face-registration?uid=${user?.id}`}
            className="shrink-0 inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-5 py-2.5 rounded-full transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-95 shadow-sm hover:shadow-md whitespace-nowrap"
          >
            <ScanFace size={14} strokeWidth={2.5} />
            Update My Biometrics
          </a>
        </div>
      )}

      {/* HEADER */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#EAE7E0] mb-6">
          <div>
            <h1 className="font-serif font-bold text-3xl md:text-4xl text-[#1F2B4D] tracking-tight leading-none">
              Employees
            </h1>
            <p className="text-[#6B655C] text-sm mt-1.5 font-medium">
              {loading ? 'Loading directory...' : `${employees.length} registered team member${employees.length !== 1 ? 's' : ''} in organization`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('toggle-chatbot', { 
                  detail: { prompt: "Generate Weekly Workforce Brief" } 
                }));
              }}
              className="flex items-center justify-center gap-2 bg-[#1F2B4D] hover:bg-[#15203A] text-white border-0 px-4.5 py-2.5 rounded-xl font-display font-bold transition-all hover:scale-[1.02] active:scale-95 shadow-md shadow-[#1F2B4D]/20 text-[11px] sm:text-xs w-full sm:w-auto"
            >
              <Sparkles size={16} strokeWidth={2.5} className="text-white/80" />
              Generate Weekly Brief
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard/add-employee')}
              className="flex items-center justify-center gap-1.5 bg-[#F0F3F9] hover:bg-[#E2E8F0] text-[#1F2B4D] border border-[#CBD5E1] px-4.5 py-2.5 rounded-xl font-display font-bold transition-all hover:scale-[1.02] active:scale-95 shadow-xs text-[11px] sm:text-xs w-full sm:w-auto"
            >
              <Plus size={16} strokeWidth={2.5} /> Add Employee
            </button>
          </div>
        </div>

        {/* Historical Mode Indicator Banner */}
        {targetDate && (
          <div className="mb-6 flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 shadow-xs">
            <div className="flex items-center gap-2 text-amber-800">
              <History size={18} className="text-amber-600" />
              <span className="text-sm font-medium">
                Showing historical data for <strong className="font-bold">{targetDate}</strong>
              </span>
            </div>
            <button
              onClick={() => setTargetDate(null)}
              className="text-xs font-bold font-display uppercase tracking-wider text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              Return to Today
            </button>
          </div>
        )}

        {/* Stats Ribbon */}
        <div className={`space-y-4 mb-6 ${targetDate ? 'opacity-90 grayscale-[10%]' : ''}`}>
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 md:gap-4">
              <StatCard
                icon={Users}
                label="Total Workforce"
                value={stats.total}
                subtext="100% total"
                color="text-[#1F2B4D]"
                iconBg="bg-[#F0F3F9]"
                isActive={!statusFilter}
                onClick={() => setStatusFilter('')}
              />
              <StatCard
                icon={UserCheck}
                label="Present Today"
                value={stats.present}
                subtext={`${stats.presentPct}% active`}
                color="text-emerald-700"
                iconBg="bg-emerald-50"
                isActive={statusFilter === 'Present'}
                onClick={() => setStatusFilter(statusFilter === 'Present' ? '' : 'Present')}
              />
              <StatCard
                icon={Sun}
                label="Half Day"
                value={stats.halfDay}
                subtext={`${stats.halfDayPct}% active`}
                color="text-amber-700"
                iconBg="bg-amber-50"
                isActive={statusFilter === 'Half Day'}
                onClick={() => setStatusFilter(statusFilter === 'Half Day' ? '' : 'Half Day')}
              />
              <StatCard
                icon={Clock}
                label="On Leave"
                value={stats.onLeave}
                subtext={`${stats.onLeavePct}% scheduled`}
                color="text-amber-700"
                iconBg="bg-amber-50"
                isActive={statusFilter === 'On Leave'}
                onClick={() => setStatusFilter(statusFilter === 'On Leave' ? '' : 'On Leave')}
              />
              <StatCard
                icon={UserX}
                label="Absent"
                value={stats.absent}
                subtext={`${stats.absentPct}% unrecorded`}
                color="text-rose-700"
                iconBg="bg-rose-50"
                isActive={statusFilter === 'Absent'}
                onClick={() => setStatusFilter(statusFilter === 'Absent' ? '' : 'Absent')}
              />
            </div>

            {/* Daily Attendance Spectrum Widget (Inspired by Reference Design) */}
            {stats.total > 0 && (
              <div className="col-span-2 lg:col-span-3 xl:col-span-5 w-full order-first xl:order-none">
                <DailyAttendanceSpectrumWidget stats={stats} targetDate={targetDate} setTargetDate={setTargetDate} />
              </div>
            )}
          </div>

        {/* Search & Filter Controls */}
        {/* Search & Filter Controls */}
        <div className="p-2 sm:p-3 bg-[#FAF8F5] border border-[#EAE7E0] rounded-[20px] shadow-xs flex flex-col md:flex-row items-stretch md:items-center gap-2 sm:gap-3">
          {/* Search Bar */}
          <div className="relative flex-1 min-w-0">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A948A] pointer-events-none" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search name, ID, dept..."
              value={searchRaw}
              onChange={e => setSearchRaw(e.target.value)}
              className="w-full pl-9 pr-10 sm:pl-10 sm:pr-12 py-1.5 sm:py-2 rounded-xl bg-white text-[11px] sm:text-xs font-medium text-[#1F2B4D] placeholder:text-[#9A948A] border border-[#EAE7E0] focus:outline-none focus:border-[#1F2B4D] focus:ring-2 focus:ring-[#1F2B4D]/10 transition-all duration-200 shadow-xs"
              aria-label="Search employees"
            />
            {searchRaw ? (
              <button type="button" onClick={() => setSearchRaw('')} className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 text-[#9A948A] hover:text-[#1F2B4D] transition-colors" aria-label="Clear search">
                <X size={14} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsCommandOpen(true)}
                className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#FAF9F6] text-[10px] font-mono text-[#6B655C] border border-[#EAE7E0] hover:text-[#1F2B4D] transition-colors"
              >
                <Command size={10} />K
              </button>
            )}
          </div>

          {/* Filters & View Toggle (Forced into one row on mobile) */}
          <div className="flex items-center justify-between sm:justify-start gap-2 w-full md:w-auto overflow-x-auto custom-scrollbar pb-1 sm:pb-0">
            {/* Filter Dropdowns */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <FilterDropdown label="Department" options={departments} value={deptFilter} onChange={setDeptFilter} />
              <FilterDropdown label="Status" options={statusOptions} value={statusFilter} onChange={setStatusFilter} />
            </div>

            {/* View Toggle Controller */}
            <div className="flex items-center gap-0.5 sm:gap-1 bg-white rounded-xl p-1 shrink-0 border border-[#EAE7E0] shadow-xs sm:ml-auto">
              {[
                { key: 'grid', icon: LayoutGrid, label: 'Grid view' },
                { key: 'list', icon: List, label: 'List view' },
                { key: 'compact', icon: AlignJustify, label: 'Compact view' },
              ].map(({ key, icon: VIcon, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setView(key)}
                  className={`p-1 sm:p-1.5 rounded-lg transition-all duration-200 active:scale-[0.97] ${
                    view === key
                      ? 'bg-[#1F2B4D] text-white shadow-xs'
                      : 'text-[#9A948A] hover:text-[#1F2B4D] hover:bg-[#FAF8F5]'
                  }`}
                  aria-label={label}
                  aria-pressed={view === key}
                >
                  <VIcon size={14} className="sm:w-[15px] sm:h-[15px]" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bulk Selection Bar */}
        <div className="mt-3 flex items-center justify-between gap-2 text-xs px-1">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="inline-flex items-center gap-1.5 text-[#6B655C] hover:text-[#1F2B4D] font-display font-bold transition-colors text-xs"
            >
              {selectedIds.size > 0 && selectedIds.size === filtered.length ? <CheckSquare size={14} className="text-[#1F2B4D]" /> : <Square size={14} />}
              Select All ({filtered.length})
            </button>

            {selectedIds.size > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F0F3F9] text-[#1F2B4D] font-display font-bold text-[10px] border border-[#CBD5E1]">
                {selectedIds.size} selected
              </span>
            )}
          </div>

          {hasFilters && (
            <button type="button" onClick={clearAllFilters} className="font-display font-bold text-[11px] text-[#1F2B4D] hover:underline transition-all">
              Clear all filters
            </button>
          )}
        </div>
      </div>

      {/* CONTENT AREA */}
      <div className="pt-1 pb-8" role="region" aria-label="Employee directory" aria-live="polite">
        {loading ? (
          view === 'grid' ? <SkeletonGrid /> : <SkeletonTable />
        ) : filtered.length === 0 ? (
          <EmptyState hasFilters={!!hasFilters} onClear={clearAllFilters} />
        ) : view === 'grid' ? (
          /* Grid View */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 pt-1 pb-4" role="list">
            {filtered.map((emp, i) => (
              <EmployeeGridCard
                key={emp.id}
                emp={emp}
                status={emp._status}
                index={i}
                isSelected={selectedIds.has(emp.id)}
                onToggleSelect={toggleSelectOne}
                onQuickView={setQuickViewEmp}
              />
            ))}
          </div>
        ) : view === 'list' ? (
          /* Table View */
          <div className="bg-white rounded-[20px] shadow-xs border border-[#EAE7E0] overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left min-w-[640px]" role="grid" aria-label="Employee directory table">
                <thead>
                  <tr className="border-b border-[#EAE7E0] bg-[#FAF8F5] text-[10px] font-display font-bold uppercase tracking-wider text-[#6B655C]">
                    <th className="py-4 px-4 w-10">
                      <button type="button" onClick={toggleSelectAll} className="text-[#9A948A] hover:text-[#1F2B4D] transition-colors">
                        {selectedIds.size > 0 && selectedIds.size === filtered.length ? <CheckSquare size={16} className="text-[#1F2B4D]" /> : <Square size={16} />}
                      </button>
                    </th>
                    <th className="py-4 px-5 cursor-pointer select-none hover:text-[#1F2B4D] transition-colors" onClick={() => toggleSort('displayName')}>
                      <span className="flex items-center gap-1.5">Employee <SortIcon field="displayName" /></span>
                    </th>
                    <th className="py-4 px-5 cursor-pointer select-none hover:text-[#1F2B4D] transition-colors" onClick={() => toggleSort('department')}>
                      <span className="flex items-center gap-1.5">Department <SortIcon field="department" /></span>
                    </th>
                    <th className="py-4 px-5 hidden lg:table-cell">Position</th>
                    <th className="py-4 px-5 cursor-pointer select-none hover:text-[#1F2B4D] transition-colors" onClick={() => toggleSort('status')}>
                      <span className="flex items-center gap-1.5">Status <SortIcon field="status" /></span>
                    </th>
                    <th className="py-4 px-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((emp, i) => (
                    <EmployeeTableRow
                      key={emp.id}
                      emp={emp}
                      status={emp._status}
                      index={i}
                      isSelected={selectedIds.has(emp.id)}
                      onToggleSelect={toggleSelectOne}
                      onQuickView={setQuickViewEmp}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Compact View */
          <div className="bg-white rounded-[24px] shadow-sm shadow-slate-200/50 border border-slate-100 divide-y divide-slate-100 overflow-hidden" role="list">
            {filtered.map((emp, i) => (
              <EmployeeCompactRow
                key={emp.id}
                emp={emp}
                status={emp._status}
                index={i}
                isSelected={selectedIds.has(emp.id)}
                onToggleSelect={toggleSelectOne}
                onQuickView={setQuickViewEmp}
              />
            ))}
          </div>
        )}
      </div>

      {/* Slide-over Quick View Drawer */}
      <QuickViewDrawer emp={quickViewEmp} onClose={() => setQuickViewEmp(null)} />

      {/* Command-K Search Modal */}
      <CommandKModal
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        employees={employeesWithStatus}
        onSelect={(emp) => navigate(`/dashboard/employee/${emp.id}`)}
      />
    </div>
  );
};

export default EmployeeDirectory;
