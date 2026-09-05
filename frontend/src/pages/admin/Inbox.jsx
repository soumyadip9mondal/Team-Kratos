import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Bell, CalendarDays, Wallet, Briefcase, FileText, ExternalLink, CheckCircle2, Filter, Inbox as InboxIcon, UserPlus, BrainCircuit } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ListSkeleton } from '../../components/ui/Skeleton';

const Inbox = () => {
  const [inboxItems, setInboxItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState('ALL');
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    setCurrentUser(JSON.parse(localStorage.getItem('user') || '{}'));
    fetchInbox();

    const handleUpdate = (e) => {
      if (['inbox:updated', 'leave:requested'].includes(e.detail?.eventName)) {
        fetchInbox();
      }
    };
    window.addEventListener('app-realtime-update', handleUpdate);
    return () => window.removeEventListener('app-realtime-update', handleUpdate);
  }, []);

  const fetchInbox = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/inbox`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setInboxItems(res.data);
    } catch (error) {
      toast.error('Failed to load inbox');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'Leave': return <CalendarDays className="text-[#1F2B4D]" size={20} />;
      case 'SalaryAdvance': return <Wallet className="text-[#1F2B4D]" size={20} />;
      case 'ExpenseClaim': return <FileText className="text-[#1F2B4D]" size={20} />;
      case 'OnboardingTask': return <Briefcase className="text-[#1F2B4D]" size={20} />;
      case 'Recruitment': return <Briefcase className="text-[#1F2B4D]" size={20} />;
      case 'IntelligenceAlert': return <BrainCircuit className="text-red-500" size={20} />;
      case 'IrisRecommendation': return <BrainCircuit className="text-indigo-600" size={20} />;
      default: return <Bell className="text-[#1F2B4D]" size={20} />;
    }
  };

  const filteredItems = selectedFilter === 'ALL' 
    ? inboxItems 
    : inboxItems.filter(item => {
        if (selectedFilter === 'LEAVE') return item.type === 'Leave';
        if (selectedFilter === 'EXPENSE') return item.type === 'ExpenseClaim' || item.type === 'SalaryAdvance';
        if (selectedFilter === 'TASK') return item.type === 'OnboardingTask' || item.type === 'Recruitment';
        if (selectedFilter === 'IRIS') return item.type === 'IrisRecommendation';
        if (selectedFilter === 'ALERT') return item.type === 'IntelligenceAlert';
        return false;
      });

  const filterCategories = [
    { key: 'ALL', label: 'All Items', count: inboxItems.length },
    { key: 'LEAVE', label: 'Leaves', count: inboxItems.filter(i => i.type === 'Leave').length },
    { key: 'EXPENSE', label: 'Expenses', count: inboxItems.filter(i => i.type === 'ExpenseClaim' || i.type === 'SalaryAdvance').length },
    { key: 'TASK', label: 'Tasks', count: inboxItems.filter(i => i.type === 'OnboardingTask' || i.type === 'Recruitment').length },
    { key: 'IRIS', label: 'Iris Actions', count: inboxItems.filter(i => i.type === 'IrisRecommendation').length },
    { key: 'ALERT', label: 'Alerts', count: inboxItems.filter(i => i.type === 'IntelligenceAlert').length }
  ];

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto min-h-full flex flex-col gap-6">
      
      {/* Page Header */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 pb-4 border-b border-[#EAE7E0]">
        <div className="w-full xl:w-auto">
          <h1 className="font-serif font-bold text-2xl sm:text-3xl md:text-4xl text-[#1F2B4D] tracking-tight leading-none flex items-center gap-2.5 flex-wrap">
            <InboxIcon className="text-[#1F2B4D] w-6 h-6 sm:w-7 sm:h-7 shrink-0" />
            <span>Unified Action Inbox</span>
          </h1>
          <p className="text-[#6B655C] mt-2 text-xs md:text-sm font-medium leading-relaxed">Your centralized queue for pending approvals, workflows, and task requests.</p>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-stretch gap-1 bg-[#FAF8F5] p-1 rounded-xl border border-[#EAE7E0] w-full xl:w-auto shrink-0 shadow-xs">
          {filterCategories.map(cat => (
            <button
              key={cat.key}
              type="button"
              onClick={() => setSelectedFilter(cat.key)}
              className={`flex-1 xl:flex-none flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 px-1 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-all ${
                selectedFilter === cat.key
                  ? 'bg-white text-[#1F2B4D] border border-[#EAE7E0] shadow-sm'
                  : 'text-[#6B655C] hover:text-[#1F2B4D] border border-transparent hover:bg-white/50'
              }`}
            >
              <span className="text-[10px] sm:text-[11px] font-display font-bold tracking-wide truncate max-w-[50px] sm:max-w-full">
                {cat.label === 'All Items' ? 'All' : cat.label}
              </span>
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-mono leading-none ${
                selectedFilter === cat.key 
                  ? 'bg-[#F0F3F9] text-[#1F2B4D]' 
                  : 'bg-[#EAE7E0] text-[#6B655C]'
              }`}>
                {cat.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <ListSkeleton items={4} />
      ) : filteredItems.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 md:p-12 bg-[#FAF8F5] border border-[#EAE7E0] rounded-[24px] shadow-xs my-4 md:my-8">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center mb-4 shadow-2xs">
            <CheckCircle2 size={32} />
          </div>
          <h2 className="font-serif font-bold text-2xl text-[#1F2B4D]">Inbox Zero</h2>
          <p className="text-xs md:text-sm text-[#6B655C] max-w-md mt-2 font-medium">
            You have no pending approvals or action items in this queue. Excellent work!
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {filteredItems.map(item => (
            <div key={item.id} className="bg-white border border-[#EAE7E0] p-4 md:p-5 rounded-[20px] shadow-xs hover:shadow-md hover:border-[#CBD5E1] transition-all duration-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 md:gap-6 group">
              <div className="flex items-start gap-3 md:gap-4 min-w-0 w-full sm:flex-1">
                <div className="p-2.5 md:p-3 bg-[#F0F3F9] text-[#1F2B4D] rounded-xl border border-[#CBD5E1] shrink-0 shadow-2xs mt-0.5 sm:mt-0">
                  {getIcon(item.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-serif font-bold text-[#1F2B4D] text-[15px] md:text-base group-hover:text-[#141C33] transition-colors break-words">
                    {item.title}
                  </h3>
                  <p className="text-xs text-[#6B655C] font-medium mt-1 line-clamp-2 md:line-clamp-none leading-relaxed">
                    {item.description}
                  </p>
                  <div className="flex items-center gap-2 md:gap-3 mt-3 flex-wrap">
                    <span className="text-[10px] md:text-[11px] font-mono font-medium text-[#9A948A]">
                      {new Date(item.createdAt).toLocaleDateString('en-IN')} at {new Date(item.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="px-2 md:px-2.5 py-0.5 rounded-full text-[9px] md:text-[10px] font-display font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                      {item.status || 'Pending'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto sm:shrink-0 pt-3 sm:pt-0 border-t border-slate-100 sm:border-t-0 mt-3 sm:mt-0">
                {item.type === 'Recruitment' && item.title?.toLowerCase().includes('hired') && currentUser?.roleDefinition?.level <= 1 && (
                  <Link
                    to="/admin/create-employee"
                    state={{ ATSData: item.metaData || item.data || {} }}
                    className="w-full sm:w-auto shrink-0 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-display font-bold text-[11px] md:text-xs px-3 md:px-4 py-2 rounded-xl transition-all hover:scale-[1.02] active:scale-95 shadow-xs flex items-center justify-center gap-1.5"
                  >
                    <UserPlus size={14} /> Add Employee
                  </Link>
                )}
                {item.type === 'IntelligenceAlert' && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      toast.success('Iris AI has been dispatched to investigate this anomaly.');
                      // Note: Deep integration will connect to the Risk Radar UI once built
                    }}
                    className="w-full sm:w-auto shrink-0 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-display font-bold text-[11px] md:text-xs px-3 md:px-4 py-2 rounded-xl transition-all hover:scale-[1.02] active:scale-95 shadow-xs flex items-center justify-center gap-1.5"
                  >
                    <BrainCircuit size={14} /> Investigate with Iris AI
                  </button>
                )}
                <Link 
                  to={item.actionUrl && item.actionUrl !== '#' ? item.actionUrl : '/dashboard/engagement'} 
                  className="w-full sm:w-auto shrink-0 bg-[#F0F3F9] hover:bg-[#E2E8F0] text-[#1F2B4D] border border-[#CBD5E1] font-display font-bold text-[11px] md:text-xs px-3 md:px-4 py-2 rounded-xl transition-all hover:scale-[1.02] active:scale-95 shadow-xs flex items-center justify-center gap-1.5"
                >
                  Review <ExternalLink size={14} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Inbox;
