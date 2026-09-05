import React, { useState, useEffect, useRef } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Plus, X, Calendar as CalendarIcon, UploadCloud, Info, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfYear, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getDay, isAfter, isBefore, startOfDay, subMonths } from 'date-fns';
import { StatCardSkeleton, Skeleton } from '../components/ui/Skeleton';

const HOLIDAYS = [
  { date: '2026-01-26', name: 'Republic Day' },
  { date: '2026-03-03', name: 'Maha Shivaratri' },
  { date: '2026-03-24', name: 'Holi' },
  { date: '2026-08-15', name: 'Independence Day' },
  { date: '2026-10-02', name: 'Gandhi Jayanti' },
  { date: '2026-11-08', name: 'Diwali' },
  { date: '2026-12-25', name: 'Christmas Day' }
];

const LEAVE_COLORS = {
  Approved: 'bg-emerald-500',
  Pending: 'bg-amber-400',
  Rejected: 'bg-red-500',
};

const LargeSlidingCalendar = ({ leaves = [] }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const handlePrevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const daysInMonth = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const startDay = getDay(startOfMonth(currentMonth));

  const getLeavesForDate = (date) => {
    return (leaves || []).filter(leave => {
      const start = startOfDay(new Date(leave.startDate));
      const end = startOfDay(new Date(leave.endDate));
      const target = startOfDay(date);
      return (isSameDay(target, start) || isAfter(target, start)) && (isSameDay(target, end) || isBefore(target, end));
    });
  };

  return (
    <div className="bg-white rounded-[20px] shadow-xs border border-[#EAE7E0] overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-[#EAE7E0] bg-[#FAF8F5]">
        <h2 className="font-serif font-bold text-xl md:text-2xl text-[#1F2B4D] tracking-tight">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <div className="flex items-center gap-2">
          <button 
            type="button"
            onClick={handlePrevMonth}
            className="p-2 text-[#1F2B4D] hover:bg-[#E2E8F0] bg-[#F0F3F9] rounded-xl transition-all border border-[#CBD5E1] shadow-xs"
          >
            <ChevronLeft size={18} />
          </button>
          <button 
            type="button"
            onClick={handleNextMonth}
            className="p-2 text-[#1F2B4D] hover:bg-[#E2E8F0] bg-[#F0F3F9] rounded-xl transition-all border border-[#CBD5E1] shadow-xs"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="p-2 md:p-4 overflow-x-hidden">
        <div className="w-full">
          <div className="grid grid-cols-7 gap-1 md:gap-3 mb-2.5">
            {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, i) => (
              <div key={i} className="text-[10px] md:text-xs font-display font-bold text-[#6B655C] text-center uppercase tracking-wider">
                <span className="hidden md:inline">{day.slice(0,3)}</span>
                <span className="md:hidden">{day.slice(0,1)}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 md:gap-3 w-full">
              {Array.from({ length: startDay }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[50px] md:min-h-[100px] bg-[#FAF9F6] rounded-xl border border-[#EAE7E0]/60"></div>
              ))}
              
              {daysInMonth.map((date) => {
                const isWeekend = getDay(date) === 0; // Sunday is Weekly Off Day; Saturday is Working Day
                const isHoliday = HOLIDAYS.find(h => isSameDay(new Date(h.date), date));
                const isToday = isSameDay(date, new Date());
                const dayLeaves = getLeavesForDate(date);

                return (
                  <div 
                    key={date.toISOString()} 
                    className={`min-h-[50px] md:min-h-[100px] rounded-xl border p-1 md:p-2 flex flex-col transition-all
                      ${isToday ? 'border-[#1F2B4D] ring-2 ring-[#1F2B4D]/10 shadow-xs bg-[#F0F3F9]/40' : 'border-[#EAE7E0] hover:border-[#CBD5E1]'}
                      ${isWeekend && !isToday ? 'bg-[#FAF9F6]' : 'bg-white'}
                      ${isHoliday && !isToday ? 'bg-[#F0F3F9]/60 border-[#D0D9E8]' : ''}
                    `}
                  >
                    <div className="flex justify-center md:justify-between items-start mb-0.5 md:mb-1">
                      <span className={`text-[10px] md:text-xs font-serif font-bold ${isToday ? 'text-white bg-[#1F2B4D] px-2 py-0.5 rounded-md shadow-xs' : (isWeekend ? 'text-[#9A948A]' : 'text-[#1F2B4D]')}`}>
                        {format(date, 'd')}
                      </span>
                      {isHoliday && (
                        <span className="hidden md:block text-[10px] font-display font-bold text-[#1F2B4D] max-w-[75px] leading-tight text-right line-clamp-2 uppercase">
                          {isHoliday.name}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex-1 space-y-0.5 md:space-y-1 mt-1 flex flex-col items-center md:items-stretch">
                      {dayLeaves.map((leave, i) => (
                        <div 
                          key={i} 
                          className={`text-[8px] md:text-[10px] font-display font-bold p-0.5 md:px-1.5 md:py-1 rounded-md flex items-center justify-center md:justify-start gap-1 shadow-2xs uppercase tracking-wider
                            ${leave.status === 'Approved' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 
                              leave.status === 'Rejected' ? 'bg-rose-50 text-rose-800 border border-rose-200' : 
                              'bg-amber-50 text-amber-800 border border-amber-200'}
                          `}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${leave.status === 'Approved' ? 'bg-emerald-500' : leave.status === 'Rejected' ? 'bg-rose-500' : 'bg-amber-500'}`} />
                          <span className="truncate hidden md:inline">{leave.leavePolicy?.name || leave.type}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
};

const RangePicker = ({ startDate, endDate, onChange }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [hoverDate, setHoverDate] = useState(null);
  const [selecting, setSelecting] = useState(false);

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });

  const handleDateClick = (date) => {
    if (!selecting || !startDate) {
      onChange(date, null);
      setSelecting(true);
    } else {
      if (isBefore(date, startDate)) {
        onChange(date, startDate);
      } else {
        onChange(startDate, date);
      }
      setSelecting(false);
    }
  };

  const handleMouseEnter = (date) => {
    if (selecting && startDate) {
      setHoverDate(date);
    }
  };

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(addMonths(currentMonth, -1));

  return (
    <div className="bg-white border border-[#EAE7E0] rounded-xl p-4 shadow-xs select-none">
      <div className="flex justify-between items-center mb-3">
        <button type="button" onClick={prevMonth} className="p-1 hover:bg-[#FAF8F5] text-[#1F2B4D] rounded-lg transition-colors font-bold">&lt;</button>
        <span className="font-serif font-bold text-sm text-[#1F2B4D]">{format(currentMonth, 'MMMM yyyy')}</span>
        <button type="button" onClick={nextMonth} className="p-1 hover:bg-[#FAF8F5] text-[#1F2B4D] rounded-lg transition-colors font-bold">&gt;</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day, i) => (
          <div key={i} className="text-[10px] font-display font-bold text-[#6B655C] uppercase tracking-wider">{day}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {Array.from({ length: getDay(startOfMonth(currentMonth)) }).map((_, i) => (
          <div key={`empty-${i}`} className="h-8"></div>
        ))}
        {days.map((date) => {
          let isSelected = false;
          let isInRange = false;
          
          const start = startDate ? startOfDay(startDate) : null;
          const end = endDate ? startOfDay(endDate) : (hoverDate ? startOfDay(hoverDate) : null);
          const current = startOfDay(date);

          if (start && isSameDay(current, start)) isSelected = true;
          if (endDate && isSameDay(current, startOfDay(endDate))) isSelected = true;

          if (start && end) {
            const rangeStart = isBefore(start, end) ? start : end;
            const rangeEnd = isBefore(start, end) ? end : start;
            if ((isAfter(current, rangeStart) || isSameDay(current, rangeStart)) && (isBefore(current, rangeEnd) || isSameDay(current, rangeEnd))) {
              isInRange = true;
            }
          }

          let className = "h-8 flex items-center justify-center text-xs font-medium rounded-lg cursor-pointer transition-all ";
          if (isSelected) {
            className += "bg-[#1F2B4D] text-white font-bold shadow-xs";
          } else if (isInRange) {
            className += "bg-[#F0F3F9] text-[#1F2B4D] font-bold";
          } else {
            className += "hover:bg-[#FAF8F5] text-[#1F2B4D]";
          }

          return (
            <div
              key={date.toISOString()}
              className={className}
              onClick={() => handleDateClick(date)}
              onMouseEnter={() => handleMouseEnter(date)}
            >
              {format(date, 'd')}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const NewTimeOffModal = ({ isOpen, onClose, user, onSuccess, policies, balances }) => {
  const [formData, setFormData] = useState({
    policyGroupId: '',
    startDate: null,
    endDate: null,
    reason: '',
    durationType: 'FullDay',
    attachment: null
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  // Auto-select first policy when policies load
  useEffect(() => {
    if (policies.length > 0 && !formData.policyGroupId) {
      setFormData(prev => ({ ...prev, policyGroupId: policies[0].policyGroupId }));
    }
  }, [policies]);

  if (!isOpen) return null;

  const selectedPolicy = policies.find(p => p.policyGroupId === formData.policyGroupId);
  const selectedBalance = balances.find(b => b.policyGroupId === formData.policyGroupId);

  const calculateDays = () => {
    if (formData.durationType === 'HalfDay') return 0.5;
    if (!formData.startDate || !formData.endDate) return 0;
    const start = startOfDay(formData.startDate);
    const end = startOfDay(formData.endDate);
    const rangeStart = isBefore(start, end) ? start : end;
    const rangeEnd = isBefore(start, end) ? end : start;
    
    let days = 0;
    const interval = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
    interval.forEach(date => {
      const day = getDay(date);
      if (day !== 0) days++; // Sunday (0) is off, Mon-Sat (1-6) are working days
    });
    return days;
  };

  const allocatedDays = calculateDays();
  const insufficientBalance = selectedBalance && !selectedPolicy?.allowNegativeBalance && allocatedDays > selectedBalance.available;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.policyGroupId) {
      setError('Please select a leave type.');
      return;
    }
    if (formData.durationType === 'FullDay' && (!formData.startDate || !formData.endDate)) {
      setError('Please select a valid date range.');
      return;
    }
    if (formData.durationType === 'HalfDay' && !formData.startDate) {
      setError('Please select a date for your half-day leave.');
      return;
    }
    if (selectedPolicy?.requiresAttachment && !formData.attachment) {
      setError(`A supporting document is required for ${selectedPolicy.name} requests.`);
      return;
    }
    if (insufficientBalance) {
      setError(`Insufficient balance. Available: ${selectedBalance.available} days.`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = new FormData();
      payload.append('policyGroupId', formData.policyGroupId);
      payload.append('durationType', formData.durationType);
      const startDate = formData.startDate ? format(formData.startDate, 'yyyy-MM-dd') : '';
      payload.append('startDate', startDate);
      payload.append('endDate', formData.durationType === 'HalfDay' ? startDate : (formData.endDate ? format(formData.endDate, 'yyyy-MM-dd') : startDate));
      payload.append('reason', formData.reason || `Applied via self-view (${allocatedDays} days)`);
      if (formData.attachment) {
        payload.append('attachment', formData.attachment);
      }

      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/leave/apply`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: payload
      });

      if (!res.ok) {
        const data = await res.json().catch(()=>({}));
        throw new Error(data.error || 'Failed to submit request');
      }
      
      onSuccess();
      onClose();
      setFormData({ policyGroupId: policies[0]?.policyGroupId || '', startDate: null, endDate: null, reason: '', durationType: 'FullDay', attachment: null });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F2B4D]/20 backdrop-blur-xs p-4">
      <div className="bg-white rounded-[24px] border border-[#EAE7E0] shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b border-[#EAE7E0] bg-[#FAF8F5]">
          <h2 className="font-serif font-bold text-xl text-[#1F2B4D]">
            New Time Off
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 text-[#6B655C] hover:text-[#1F2B4D] hover:bg-[#EAE7E0] rounded-xl transition-colors">
            <X size={18} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          {error && (
            <div className="mb-5 p-4 bg-rose-50 text-rose-700 text-xs font-medium rounded-xl border border-rose-200 flex items-start gap-2">
              <Info size={16} className="mt-0.5 shrink-0 text-rose-600" /> {error}
            </div>
          )}

          <form id="timeoff-form" onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-display font-bold text-[#6B655C] uppercase tracking-wider mb-1.5">Employee</label>
                <div className="w-full p-2.5 bg-[#FAF8F5] border border-[#EAE7E0] rounded-xl text-[#6B655C] text-xs font-medium cursor-not-allowed">
                  {user?.displayName || 'Loading...'} (You)
                </div>
              </div>
              <div>
                <label className="block text-xs font-display font-bold text-[#6B655C] uppercase tracking-wider mb-1.5">Leave Type</label>
                <select 
                  value={formData.policyGroupId} 
                  onChange={e => setFormData({...formData, policyGroupId: e.target.value})}
                  className="w-full p-2.5 border border-[#EAE7E0] rounded-xl focus:ring-2 focus:ring-[#1F2B4D]/10 focus:border-[#1F2B4D] outline-none text-xs transition-all text-[#1F2B4D] font-medium bg-white"
                >
                  {policies.length === 0 && <option value="">No policies configured</option>}
                  {policies.map(p => (
                    <option key={p.policyGroupId} value={p.policyGroupId}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Duration Type Toggle */}
            <div>
              <label className="block text-xs font-display font-bold text-[#6B655C] uppercase tracking-wider mb-2">Duration</label>
              <div className="flex gap-2">
                {['FullDay', 'HalfDay'].map(dt => (
                  <button
                    key={dt}
                    type="button"
                    onClick={() => setFormData({...formData, durationType: dt})}
                    className={`px-4 py-2 rounded-xl text-xs font-display font-bold transition-all border ${
                      formData.durationType === dt
                        ? 'bg-[#F0F3F9] text-[#1F2B4D] border-[#CBD5E1] shadow-xs'
                        : 'bg-white text-[#6B655C] border-[#EAE7E0] hover:bg-[#FAF8F5]'
                    }`}
                  >
                    {dt === 'FullDay' ? 'Full Day' : 'Half Day'}
                  </button>
                ))}
              </div>
            </div>

            {/* Date Picker — only show range for FullDay */}
            <div>
              <label className="block text-xs font-display font-bold text-[#6B655C] uppercase tracking-wider mb-1.5">
                {formData.durationType === 'HalfDay' ? 'Select Date' : 'Validity Period'}
                <span className="text-[#9A948A] font-normal normal-case ml-1">
                  {formData.durationType === 'HalfDay' ? '(Click a date)' : '(Click start & end dates)'}
                </span>
              </label>
              <RangePicker 
                startDate={formData.startDate} 
                endDate={formData.durationType === 'HalfDay' ? formData.startDate : formData.endDate}
                onChange={(start, end) => {
                  if (formData.durationType === 'HalfDay') {
                    setFormData({...formData, startDate: start, endDate: start});
                  } else {
                    setFormData({...formData, startDate: start, endDate: end});
                  }
                }}
              />
            </div>

            {/* Allocation + Balance Info */}
            <div className="p-4 bg-[#FAF8F5] rounded-xl border border-[#EAE7E0] flex justify-between items-center">
              <div>
                <span className="text-xs font-display font-bold text-[#1F2B4D]">Allocation</span>
                {selectedBalance && (
                  <span className="text-xs text-[#6B655C] ml-2">
                    (Available: <span className="font-serif font-bold text-[#1F2B4D]">{selectedBalance.available}</span> days)
                  </span>
                )}
              </div>
              <span className={`text-base font-serif font-bold ${insufficientBalance ? 'text-rose-600' : 'text-[#1F2B4D]'}`}>
                {allocatedDays} <span className="text-xs font-sans font-medium text-[#6B655C]">Days</span>
              </span>
            </div>

            {insufficientBalance && (
              <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200 flex items-center gap-2 font-medium">
                <Info size={14} className="shrink-0 text-rose-600" />
                Insufficient balance for this request.
              </div>
            )}

            {/* Attachment — conditional based on policy */}
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="block text-xs font-display font-bold text-[#6B655C] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                Supporting Document {selectedPolicy?.requiresAttachment && <span className="text-rose-500">*</span>}
              </label>
              <p className="text-xs text-[#6B655C] mb-2 font-medium">
                {selectedPolicy?.requiresAttachment ? 'Required proof for this leave type.' : 'Optional — attach if you have a supporting document.'}
              </p>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#EAE7E0] rounded-xl p-5 text-center cursor-pointer hover:border-[#1F2B4D] hover:bg-[#FAF8F5] transition-all group"
              >
                <UploadCloud size={22} className="mx-auto text-[#9A948A] mb-1.5 group-hover:text-[#1F2B4D] transition-colors" />
                <span className="text-xs font-display font-bold text-[#6B655C] group-hover:text-[#1F2B4D]">
                  {formData.attachment ? formData.attachment.name : 'Click to upload document'}
                </span>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  onChange={e => setFormData({...formData, attachment: e.target.files[0]})} 
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                />
              </div>
            </div>
          </form>
        </div>

        <div className="p-5 border-t border-[#EAE7E0] flex justify-end gap-2.5 bg-[#FAF8F5]">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-4 py-2 rounded-xl text-xs font-display font-bold text-[#6B655C] bg-white border border-[#EAE7E0] hover:bg-[#FAF8F5] transition-all"
          >
            Discard
          </button>
          <button 
            type="submit" 
            form="timeoff-form" 
            disabled={loading || insufficientBalance} 
            className="bg-[#F0F3F9] hover:bg-[#E2E8F0] text-[#1F2B4D] border border-[#CBD5E1] px-5 py-2 rounded-xl font-display font-bold text-xs transition-all hover:scale-[1.02] active:scale-95 shadow-xs disabled:opacity-50"
          >
            {loading ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
};

const GRADIENT_PALETTES = [
  'from-blue-500 to-indigo-600 shadow-indigo-500/20',
  'from-emerald-400 to-teal-500 shadow-teal-500/20',
  'from-purple-500 to-violet-600 shadow-violet-500/20',
  'from-amber-400 to-orange-500 shadow-orange-500/20',
  'from-rose-400 to-pink-500 shadow-pink-500/20',
  'from-cyan-400 to-sky-500 shadow-sky-500/20',
];

const TimeOff = ({ user }) => {
  const [leaves, setLeaves] = useState([]);
  const [balances, setBalances] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchMyLeaves = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/leave/me`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setLeaves(Array.isArray(data) ? data : []);
    } catch (e) { console.error('Failed to fetch leaves:', e); }
  };

  const fetchBalances = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/leave/balances`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBalances(Array.isArray(data) ? data : []);
      }
    } catch (e) { console.error('Failed to fetch balances:', e); }
  };

  const fetchPolicies = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/leave/policies`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPolicies(Array.isArray(data) ? data : []);
      }
    } catch (e) { console.error('Failed to fetch policies:', e); }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchMyLeaves(), fetchBalances(), fetchPolicies()]).finally(() => setLoading(false));
  }, []);

  const handleLeaveSuccess = () => {
    fetchMyLeaves();
    fetchBalances();
  };

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto min-h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 pb-4 border-b border-[#EAE7E0] gap-3">
        <div>
          <h1 className="font-serif font-bold text-3xl md:text-4xl text-[#1F2B4D] tracking-tight leading-none">Time Off</h1>
          <p className="text-xs md:text-sm text-[#6B655C] mt-1.5 font-medium">Manage your leaves and track your available balances.</p>
        </div>
        <button 
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="bg-[#F0F3F9] hover:bg-[#E2E8F0] text-[#1F2B4D] border border-[#CBD5E1] font-display font-bold px-4.5 py-2 rounded-xl transition-all hover:scale-[1.02] active:scale-95 flex items-center text-xs gap-1.5 shadow-xs"
        >
          <Plus size={16} strokeWidth={2.5} /> NEW
        </button>
      </div>

      {/* Dynamic Balance Cards — one per policy */}
      <div className={`grid grid-cols-1 ${balances.length === 1 ? 'md:grid-cols-1' : balances.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-4 mb-5`}>
        {loading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : balances.length === 0 ? (
          <div className="p-6 border-dashed border-2 border-[#EAE7E0] rounded-[20px] col-span-full bg-[#FAF8F5] text-center">
            <p className="text-xs text-[#6B655C] font-medium">No leave policies configured yet. Ask your admin to set up leave policies.</p>
          </div>
        ) : (
          balances.map((bal, idx) => {
            const denominator = bal.allocated > 0 ? bal.allocated : bal.annualQuota;
            
            const getColorTheme = (index = 0) => {
              const themes = [
                { color: '#3654F0', tint: '#EAEDFE' }, // Blue
                { color: '#D64550', tint: '#FBEAEB' }, // Red
                { color: '#12876F', tint: '#E7F5F1' }, // Emerald
                { color: '#7C4DE0', tint: '#F1EAFB' }, // Purple
                { color: '#E87C21', tint: '#FDEDDF' }, // Orange
                { color: '#0369a1', tint: '#e0f2fe' }, // Sky
                { color: '#b45309', tint: '#fef3c7' }, // Amber
                { color: '#be123c', tint: '#ffe4e6' }, // Rose
              ];
              return themes[index % themes.length];
            };

            const theme = getColorTheme(idx);
            const ticksCount = Math.min(denominator, 25);
            
            return (
              <div key={bal.policyGroupId || idx} className="h-full group double-bezel-outer bg-[#F4F1EA] p-1 rounded-2xl sm:rounded-[26px] hover:border-[#1F2B4D]/10 transition-all duration-300">
                <div className="double-bezel-inner bg-[#FAF8F5] rounded-xl sm:rounded-[22px] shadow-2xs hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 p-3.5 sm:p-5 flex flex-col justify-between h-full">
                  <div className="flex flex-col justify-between h-full">
                    <div>
                        {/* Card Head: Swatch + Type Name & Quota Badge */}
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 sm:mb-4">
                        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-[3px] shrink-0 shadow-2xs" style={{ background: theme.color }} />
                          <span className="font-palagio italic font-bold text-base sm:text-[18px] tracking-wide text-black truncate min-w-0">
                            {bal.policyName}
                          </span>
                        </div>
                        <span 
                          className="font-mono text-[10px] sm:text-[11px] font-bold px-2.5 sm:px-3.5 py-1 rounded-full whitespace-nowrap border border-current/15 shadow-2xs shrink-0"
                          style={{ background: theme.tint, color: theme.color }}
                        >
                          Quota {denominator}d
                        </span>
                      </div>

                      {/* Count Row: Big Number + Days Available */}
                      <div className="flex items-baseline gap-2 mb-1.5">
                        <span className="font-sans font-black text-3xl sm:text-4xl leading-none tracking-tight text-black">
                          {bal.available}
                        </span>
                        <span className="font-mono text-[10px] sm:text-[11px] font-extrabold text-[#1e293b] uppercase tracking-[0.06em]">
                          days available
                        </span>
                      </div>

                      {/* Used & Pending row */}
                      <div className="flex items-center gap-3 sm:gap-4 mb-5 sm:mb-6 mt-2">
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: theme.color }} />
                          <span className="text-[11px] sm:text-[13px] font-medium text-[#475569]">Used <span className="font-bold text-black">{bal.used}d</span></span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#94A3B8]" />
                          <span className="text-[11px] sm:text-[13px] font-medium text-[#475569]">Pending <span className="font-bold text-black">{bal.pending}d</span></span>
                        </div>
                      </div>
                    </div>

                    {/* Progress Track */}
                    <div className="mt-auto">
                      <div className="flex justify-between items-center mb-1.5 sm:mb-2">
                        <span className="text-[9px] sm:text-[10px] font-mono font-bold text-[#64748B]">0</span>
                        <span className="text-[9px] sm:text-[10px] font-mono font-bold text-[#64748B]">{denominator}d quota</span>
                      </div>
                      <div className="flex gap-1 h-1.5 sm:h-2 w-full">
                        {Array.from({ length: ticksCount }).map((_, i) => {
                          const isUsed = i < Math.floor(bal.used);
                          const isPending = !isUsed && i < Math.floor(bal.used + bal.pending);
                          return (
                            <div 
                              key={i} 
                              className="flex-1 rounded-full opacity-90"
                              style={{ 
                                background: isUsed ? theme.color : isPending ? '#CBD5E1' : '#F1F5F9'
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-5 flex-1">
        <div className="flex-1 flex flex-col w-full">
          <LargeSlidingCalendar leaves={leaves} />
        </div>

        {/* Right Rail */}
        <div className="w-full lg:w-64 shrink-0 space-y-4">
          <div className="bg-white border border-[#EAE7E0] rounded-[20px] p-4.5 shadow-xs sticky top-6">
            <h3 className="font-display font-bold text-[#1F2B4D] text-xs uppercase tracking-wider mb-3.5">Legend</h3>
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-100"></div>
                <span className="text-xs font-semibold text-[#1F2B4D]">Validated</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-amber-100"></div>
                <span className="text-xs font-semibold text-[#1F2B4D]">To Approve</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-rose-100"></div>
                <span className="text-xs font-semibold text-[#1F2B4D]">Refused</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-[#EAE7E0] rounded-[20px] p-4.5 shadow-xs">
            <h3 className="font-display font-bold text-[#1F2B4D] text-xs uppercase tracking-wider mb-3.5">Public Holidays</h3>
            <div className="space-y-3">
              {HOLIDAYS.map((holiday, i) => (
                <div key={i} className="flex flex-col border-b border-[#F4F1EA] last:border-0 pb-2 last:pb-0">
                  <span className="font-serif text-xs font-bold text-[#1F2B4D] mb-0.5">
                    {format(new Date(holiday.date), 'MMM do, yyyy')}
                  </span>
                  <span className="text-xs font-medium text-[#6B655C] leading-snug">{holiday.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Leave History Table */}
      <div className="mt-6 bg-white border border-[#EAE7E0] rounded-[20px] p-6 shadow-xs">
        <h3 className="font-serif font-bold text-xl text-[#1F2B4D] mb-4">My Leave History</h3>
        {leaves.length === 0 ? (
          <p className="text-xs text-[#6B655C] font-medium italic">No leave records found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#EAE7E0] bg-[#FAF8F5] text-[10px] font-display font-bold uppercase tracking-wider text-[#6B655C]">
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Dates</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4 text-right">Document</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F4F1EA]">
                {leaves.map(leave => (
                  <tr key={leave.id} className="text-xs hover:bg-[#FAF9F6] transition-colors">
                    <td className="py-3.5 px-4 font-serif font-bold text-[#1F2B4D]">{leave.leavePolicy?.name || leave.type || '—'}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-0.5 rounded-md text-[10px] font-display font-bold uppercase tracking-wider bg-[#FAF9F6] text-[#6B655C] border border-[#EAE7E0]">
                        {leave.durationType === 'HalfDay' ? 'Half Day' : 'Full Day'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-[#6B655C] font-medium">
                      {new Date(leave.startDate).toLocaleDateString('en-IN')} - {new Date(leave.endDate).toLocaleDateString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-display font-bold uppercase tracking-wider border ${
                        leave.status === 'Approved' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 
                        leave.status === 'Rejected' ? 'bg-rose-50 text-rose-800 border-rose-200' : 
                        'bg-amber-50 text-amber-800 border-amber-200'
                      }`}>
                        {leave.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-[#6B655C]">
                      <div className="truncate max-w-[200px]" title={leave.reason}>{leave.reason}</div>
                      {leave.status === 'Rejected' && leave.adminRemarks && (
                        <div className="text-[11px] text-rose-600 mt-0.5 italic truncate" title={leave.adminRemarks}>
                          Reason: {leave.adminRemarks}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {leave.attachment ? (
                        <a 
                          href={leave.attachment} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="inline-flex items-center gap-1 text-xs font-display font-bold text-[#1F2B4D] hover:bg-[#E2E8F0] bg-[#F0F3F9] px-3 py-1.5 rounded-xl transition-all border border-[#CBD5E1] shadow-xs"
                        >
                          View Proof ↗
                        </a>
                      ) : (
                        <span className="text-xs text-[#9A948A] italic">None</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <NewTimeOffModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        user={user}
        policies={policies}
        balances={balances}
        onSuccess={handleLeaveSuccess}
      />
    </div>
  );
};

export default TimeOff;

