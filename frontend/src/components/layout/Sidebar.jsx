import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Users, CalendarDays, Wallet, UserPlus, UserCheck, Clock, ShieldCheck,
  Mail, Bell, Settings, LogOut, User, LayoutDashboard, FileText,
  UploadCloud, Terminal, Network, LifeBuoy, CreditCard, Target,
  Megaphone, HeartHandshake, BarChart3, Briefcase, Laptop,
  FolderKanban, Activity, TrendingUp, IndianRupee, ChevronLeft, ChevronRight,
  Bot, Cpu, Crown, BrainCircuit, Receipt
} from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import axios from 'axios';
import { hasPermission } from '../../lib/permissions';

const Sidebar = ({ user, onCloseMobile }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const roleLevel = user?.roleDefinition?.level ?? 99;
  const isOwner = roleLevel === 0;

  // Fine-grained permission flags — all driven purely by hasPermission()
  const canViewReports = hasPermission(user, 'view_reports');
  const canApproveLeaves = hasPermission(user, 'approve_leaves');
  const canManageOrg = hasPermission(user, 'manage_organization');
  const canEditEmployees = hasPermission(user, 'edit_all_employees');
  const canViewEmployees = hasPermission(user, 'view_all_employees');
  const canRecruit = hasPermission(user, 'manage_recruitment');
  const canPayroll = hasPermission(user, 'generate_payroll');
  const canManageShifts = hasPermission(user, 'manage_shifts');
  const canManageExpenses = hasPermission(user, 'manage_expenses');
  const canManagePerf = hasPermission(user, 'manage_performance');
  const canManageBenefits = hasPermission(user, 'manage_benefits');
  const canManageHelpdesk = hasPermission(user, 'manage_helpdesk');
  const canApproveAdv = hasPermission(user, 'approve_advances');
  const isAdminOrCEO = roleLevel <= 1;


  const nameParts = (user?.displayName || 'User').trim().split(/\s+/);
  const initials = nameParts.length >= 2
    ? `${nameParts[0][0].toUpperCase()}.${nameParts[nameParts.length - 1][0].toUpperCase()}`
    : nameParts[0].substring(0, 2).toUpperCase();

  const [inboxCount, setInboxCount] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const fetchInboxCount = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/inbox`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setInboxCount(res.data.length);
    } catch (err) {
      console.error('Failed to fetch inbox count', err);
    }
  };

  useEffect(() => {
    fetchInboxCount();

    const handleUpdate = (e) => {
      if (['inbox:updated', 'leave:requested'].includes(e.detail?.eventName)) {
        fetchInboxCount();
      }
    };
    window.addEventListener('app-realtime-update', handleUpdate);
    return () => window.removeEventListener('app-realtime-update', handleUpdate);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  const handleNavClick = (path) => {
    navigate(path);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const getLinkClass = (path) => {
    const isActive = path === '/dashboard'
      ? location.pathname === '/dashboard' || location.pathname === '/dashboard/'
      : location.pathname === path || location.pathname.startsWith(path + '/');
    if (isCollapsed) {
      return `flex items-center justify-center w-9 h-9 rounded-full aspect-square shrink-0 my-1 mx-auto transition-all text-xs font-semibold relative ${isActive
          ? 'bg-white/[0.16] border border-white/25 shadow-sm [&_svg]:text-[#38BDF8]'
          : 'text-slate-300/70 bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 hover:text-white [&_svg]:text-slate-300/70 hover:[&_svg]:text-white'
        }`;
    }
    return `flex items-center gap-2.5 px-3 py-2 mb-0.5 rounded-full transition-all text-[13.5px] font-bold relative ${isActive
        ? 'bg-white/[0.14] text-white border border-white/15 shadow-sm scale-[1.01] [&_svg]:text-[#38BDF8]'
        : 'text-slate-300/80 hover:bg-white/10 hover:text-white [&_svg]:text-slate-300/80 hover:[&_svg]:text-white'
      }`;
  };

  return (
    <div className={`sidebar-ember ${isCollapsed ? 'collapsed p-2 py-3' : 'p-2'} flex flex-col h-full relative transition-all duration-300 ${isCollapsed ? 'w-full md:w-[68px]' : 'w-full md:w-[210px]'
      }`}>
      {/* Minimize / Expand Toggle Button Notch */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={`hidden md:flex absolute ${isCollapsed ? '-right-3 top-6' : '-right-3.5 top-10'} w-7 h-7 rounded-full bg-sb-pill-bg text-sb-pill-text items-center justify-center shadow-[0_0_12px_rgba(56,189,248,0.35)] hover:scale-110 transition-transform z-30 cursor-pointer border border-sky-300/50`}
        title={isCollapsed ? "Expand sidebar" : "Minimize sidebar"}
      >
        {isCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
      </button>

      {/* Company Logo area */}
      <div className={`flex items-center justify-center ${isCollapsed ? 'py-2 px-1 mb-2' : 'pt-3 pb-4 px-3 mb-4'} w-full overflow-hidden shrink-0`}>
        <img
          src="/crew-new.png"
          alt="Crew HR Logo"
          className={`object-contain mix-blend-screen opacity-95 transition-all ${
            isCollapsed ? 'h-7 w-auto max-w-[44px]' : 'h-14 sm:h-16 w-auto max-w-[190px]'
          }`}
        />
      </div>

      <nav className={`flex flex-col ${isCollapsed ? 'gap-2 py-1 items-center px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' : 'gap-1 px-1'} flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar`}>
        <div onClick={() => handleNavClick('/dashboard')} className={getLinkClass('/dashboard') + ' cursor-pointer'} title={isCollapsed ? (canViewEmployees ? "Employees" : "Dashboard") : undefined}>
          {canViewEmployees ? <Users size={16} className="shrink-0" /> : <LayoutDashboard size={16} className="shrink-0" />}
          {!isCollapsed && <span className="whitespace-nowrap">{canViewEmployees ? "Employees" : "Dashboard"}</span>}
        </div>

        <div onClick={() => handleNavClick('/dashboard/inbox')} className={getLinkClass('/dashboard/inbox') + ' cursor-pointer'} title={isCollapsed ? "Unified Inbox" : undefined}>
          <Bell size={16} className="shrink-0" />
          {!isCollapsed ? (
            <div className="flex items-center justify-between flex-1">
              <span className="whitespace-nowrap">Inbox</span>
              {inboxCount > 0 && (
                <span className="bg-[#1F2B4D] text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/20">
                  {inboxCount}
                </span>
              )}
            </div>
          ) : (
            inboxCount > 0 && (
              <span className="bg-[#1F2B4D] text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center absolute top-1 right-1 border border-white/20">
                {inboxCount}
              </span>
            )
          )}
        </div>

        <div onClick={() => handleNavClick('/dashboard/attendance')} className={getLinkClass('/dashboard/attendance') + ' cursor-pointer'} title={isCollapsed ? "Attendance" : undefined}>
          <Clock size={16} className="shrink-0" />
          {!isCollapsed && <span className="whitespace-nowrap">Attendance</span>}
        </div>

        <div onClick={() => handleNavClick('/dashboard/org-chart')} className={getLinkClass('/dashboard/org-chart') + ' cursor-pointer'} title={isCollapsed ? "Org Chart" : undefined}>
          <Network size={16} className="shrink-0" />
          {!isCollapsed && <span className="whitespace-nowrap truncate">Org Chart</span>}
        </div>

        <div onClick={() => handleNavClick('/dashboard/time-off')} className={getLinkClass('/dashboard/time-off') + ' cursor-pointer'} title={isCollapsed ? "Time Off" : undefined}>
          <CalendarDays size={16} className="shrink-0" />
          {!isCollapsed && <span className="whitespace-nowrap">Time Off</span>}
        </div>

        <div onClick={() => handleNavClick('/dashboard/performance')} className={getLinkClass('/dashboard/performance') + ' cursor-pointer'} title={isCollapsed ? "Performance" : undefined}>
          <Target size={16} className="shrink-0" />
          {!isCollapsed && <span className="whitespace-nowrap">Performance</span>}
        </div>

        <div onClick={() => handleNavClick('/dashboard/engagement')} className={getLinkClass('/dashboard/engagement') + ' cursor-pointer'} title={isCollapsed ? "Engagement" : undefined}>
          <Megaphone size={16} className="shrink-0" />
          {!isCollapsed && <span className="whitespace-nowrap">Engagement</span>}
        </div>

        <div onClick={() => handleNavClick('/dashboard/shift-scheduling')} className={getLinkClass('/dashboard/shift-scheduling') + ' cursor-pointer'} title={isCollapsed ? "Shift Rostering" : undefined}>
          <CalendarDays size={16} className="shrink-0" />
          {!isCollapsed && <span className="whitespace-nowrap">Shift Rostering</span>}
        </div>

        <div onClick={() => handleNavClick('/dashboard/expenses')} className={getLinkClass('/dashboard/expenses') + ' cursor-pointer'} title={isCollapsed ? "Expenses" : undefined}>
          <Wallet size={16} className="shrink-0" />
          {!isCollapsed && <span className="whitespace-nowrap">Expenses</span>}
        </div>

        <div onClick={() => handleNavClick('/dashboard/salary-advance')} className={getLinkClass('/dashboard/salary-advance') + ' cursor-pointer'} title={isCollapsed ? "Salary Advance" : undefined}>
          <IndianRupee size={16} className="shrink-0 text-emerald-400" />
          {!isCollapsed && <span className="whitespace-nowrap">Salary Advance</span>}
        </div>

        <div onClick={() => handleNavClick('/dashboard/documents')} className={getLinkClass('/dashboard/documents') + ' cursor-pointer'} title={isCollapsed ? "Documents" : undefined}>
          <FileText size={16} className="shrink-0" />
          {!isCollapsed && <span className="whitespace-nowrap">Documents</span>}
        </div>

        <div onClick={() => handleNavClick('/dashboard/benefits')} className={getLinkClass('/dashboard/benefits') + ' cursor-pointer'} title={isCollapsed ? "Benefits" : undefined}>
          <HeartHandshake size={16} className="shrink-0" />
          {!isCollapsed && <span className="whitespace-nowrap">Benefits</span>}
        </div>

        {canViewReports && (
          <div onClick={() => handleNavClick('/dashboard/analytics')} className={getLinkClass('/dashboard/analytics') + ' cursor-pointer'} title={isCollapsed ? "Analytics" : undefined}>
            <BarChart3 size={16} className="shrink-0" />
            {!isCollapsed && <span className="whitespace-nowrap">Analytics & Reports</span>}
          </div>
        )}
        {canViewReports && isAdminOrCEO && (
          <div onClick={() => handleNavClick('/dashboard/intelligence-radar')} className={getLinkClass('/dashboard/intelligence-radar') + ' cursor-pointer group'} title={isCollapsed ? "Intelligence Radar" : undefined}>
            <BrainCircuit size={16} className="shrink-0 group-hover:animate-pulse" />
            {!isCollapsed && <span className="whitespace-nowrap flex items-center gap-1.5">Intelligence Radar</span>}
          </div>
        )}
        {canViewReports && isAdminOrCEO && (
          <div onClick={() => handleNavClick('/dashboard/cost-intelligence')} className={getLinkClass('/dashboard/cost-intelligence') + ' cursor-pointer'} title={isCollapsed ? "Cost Intelligence" : undefined}>
            <Receipt size={16} className="shrink-0" />
            {!isCollapsed && <span className="whitespace-nowrap">Cost Intelligence</span>}
          </div>
        )}
        {canViewReports && isAdminOrCEO && (
          <div onClick={() => handleNavClick('/dashboard/scenario-simulator')} className={getLinkClass('/dashboard/scenario-simulator') + ' cursor-pointer'} title={isCollapsed ? "Scenario Simulator" : undefined}>
            <TrendingUp size={16} className="shrink-0" />
            {!isCollapsed && <span className="whitespace-nowrap">Scenario Simulator</span>}
          </div>
        )}
        <div onClick={() => handleNavClick('/dashboard/timesheets')} className={getLinkClass('/dashboard/timesheets') + ' cursor-pointer'} title={isCollapsed ? "Timesheets" : undefined}>
          <Clock size={16} className="shrink-0" />
          {!isCollapsed && <span className="whitespace-nowrap">Timesheets</span>}
        </div>
        <div onClick={() => handleNavClick('/dashboard/1on1s')} className={getLinkClass('/dashboard/1on1s') + ' cursor-pointer'} title={isCollapsed ? "1:1 Meetings" : undefined}>
          <Users size={16} className="shrink-0" />
          {!isCollapsed && <span className="whitespace-nowrap">1:1 Meetings</span>}
        </div>
        <div onClick={() => handleNavClick('/dashboard/pulse')} className={getLinkClass('/dashboard/pulse') + ' cursor-pointer'} title={isCollapsed ? "Pulse Surveys" : undefined}>
          <Activity size={16} className="shrink-0" />
          {!isCollapsed && <span className="whitespace-nowrap">Pulse Surveys</span>}
        </div>

        <div onClick={() => handleNavClick('/dashboard/helpdesk')} className={getLinkClass('/dashboard/helpdesk') + ' cursor-pointer'} title={isCollapsed ? "Helpdesk" : undefined}>
          <LifeBuoy size={16} className="shrink-0" />
          {!isCollapsed && <span className="whitespace-nowrap truncate">Helpdesk</span>}
        </div>

        {canApproveLeaves && (
          <div onClick={() => handleNavClick('/dashboard/leave-approvals')} className={getLinkClass('/dashboard/leave-approvals') + ' cursor-pointer'} title={isCollapsed ? "Leave Approvals" : undefined}>
            <CalendarDays size={16} className="shrink-0" />
            {!isCollapsed && <span className="whitespace-nowrap truncate">Leave Approvals</span>}
          </div>
        )}

        {/* Fraud Alerts — needs to see employees */}
        {canViewEmployees && (
          <div onClick={() => handleNavClick('/dashboard/proxy-alerts')} className={getLinkClass('/dashboard/proxy-alerts') + ' cursor-pointer'} title={isCollapsed ? "Fraud Alerts" : undefined}>
            <ShieldCheck size={16} className="shrink-0 text-red-400" />
            {!isCollapsed && <span className="whitespace-nowrap truncate">Fraud Alerts</span>}
          </div>
        )}

        {canApproveLeaves && (
          <div onClick={() => handleNavClick('/dashboard/leave-settings')} className={getLinkClass('/dashboard/leave-settings') + ' cursor-pointer'} title={isCollapsed ? "Leave Settings" : undefined}>
            <CalendarDays size={16} className="shrink-0" />
            {!isCollapsed && <span className="whitespace-nowrap truncate">Leave Settings</span>}
          </div>
        )}

        {(canEditEmployees || canManageOrg || canRecruit) && (
          <>
            {!isCollapsed ? (
              <div className="mt-4 mb-2 px-2 whitespace-nowrap">
                <span className="text-[11.5px] font-bold text-[rgba(224,231,255,0.45)] uppercase tracking-wider">
                  Management
                </span>
              </div>
            ) : (
              <div className="my-2 border-t border-[rgba(224,231,255,0.1)] w-8 mx-auto" />
            )}
            {canEditEmployees && (
              <div onClick={() => handleNavClick('/dashboard/add-employee')} className={getLinkClass('/dashboard/add-employee') + ' cursor-pointer'} title={isCollapsed ? "Add Employee" : undefined}>
                <UserPlus size={16} className="shrink-0" />
                {!isCollapsed && <span className="whitespace-nowrap truncate">Add Employee</span>}
              </div>
            )}
            {canManageOrg && (
              <div onClick={() => handleNavClick('/dashboard/assets')} className={getLinkClass('/dashboard/assets') + ' cursor-pointer'} title={isCollapsed ? "Asset Directory" : undefined}>
                <Laptop size={16} className="shrink-0" />
                {!isCollapsed && <span className="whitespace-nowrap truncate">Asset Directory</span>}
              </div>
            )}
            {canManageOrg && (
              <div onClick={() => handleNavClick('/dashboard/projects')} className={getLinkClass('/dashboard/projects') + ' cursor-pointer'} title={isCollapsed ? "Projects" : undefined}>
                <FolderKanban size={16} className="shrink-0" />
                {!isCollapsed && <span className="whitespace-nowrap truncate">Projects</span>}
              </div>
            )}
            {canRecruit && (
              <div onClick={() => handleNavClick('/dashboard/recruitment')} className={getLinkClass('/dashboard/recruitment') + ' cursor-pointer'} title={isCollapsed ? "Recruitment" : undefined}>
                <Briefcase size={16} className="shrink-0" />
                {!isCollapsed && <span className="whitespace-nowrap truncate">Recruitment</span>}
              </div>
            )}
            {canEditEmployees && (
              <div onClick={() => handleNavClick('/dashboard/invite-employee')} className={getLinkClass('/dashboard/invite-employee') + ' cursor-pointer'} title={isCollapsed ? "Invite Employees" : undefined}>
                <Mail size={16} className="shrink-0" />
                {!isCollapsed && <span className="whitespace-nowrap truncate">Invite Employees</span>}
              </div>
            )}
            {canEditEmployees && (
              <div onClick={() => handleNavClick('/dashboard/onboarding-pipeline')} className={getLinkClass('/dashboard/onboarding-pipeline') + ' cursor-pointer'} title={isCollapsed ? "Onboarding Pipeline" : undefined}>
                <UserCheck size={16} className="shrink-0" />
                {!isCollapsed && <span className="whitespace-nowrap truncate">Onboarding</span>}
              </div>
            )}
          </>
        )}

        {/* Admin tools — gated by respective permissions */}
        {(canViewReports || canPayroll || canManageOrg || isOwner) && (
          <>
            {canViewReports && (
              <div onClick={() => handleNavClick('/dashboard/org-pulse')} className={getLinkClass('/dashboard/org-pulse') + ' cursor-pointer'} title={isCollapsed ? "Org Pulse" : undefined}>
                <Activity size={16} className="shrink-0 text-sky-400" />
                {!isCollapsed && <span className="whitespace-nowrap truncate">Org Pulse</span>}
              </div>
            )}
            {canPayroll && (
              <>
                <div onClick={() => handleNavClick('/dashboard/payroll')} className={getLinkClass('/dashboard/payroll') + ' cursor-pointer'} title={isCollapsed ? "Payroll" : undefined}>
                  <Wallet size={16} className="shrink-0" />
                  {!isCollapsed && <span className="whitespace-nowrap truncate">Payroll</span>}
                </div>
                <div onClick={() => handleNavClick('/dashboard/payroll-forecast')} className={getLinkClass('/dashboard/payroll-forecast') + ' cursor-pointer'} title={isCollapsed ? "Payroll Forecast" : undefined}>
                  <TrendingUp size={16} className="shrink-0" />
                  {!isCollapsed && <span className="whitespace-nowrap truncate">Payroll Forecast</span>}
                </div>
              </>
            )}
            {isOwner && (
              <div onClick={() => handleNavClick('/dashboard/manage-admins')} className={getLinkClass('/dashboard/manage-admins') + ' cursor-pointer'} title={isCollapsed ? "Manage Admins" : undefined}>
                <ShieldCheck size={16} className="shrink-0" />
                {!isCollapsed && <span className="whitespace-nowrap truncate">Manage Admins</span>}
              </div>
            )}
            {canManageOrg && (
              <div onClick={() => handleNavClick('/dashboard/data-import')} className={getLinkClass('/dashboard/data-import') + ' cursor-pointer'} title={isCollapsed ? "Data Import" : undefined}>
                <UploadCloud size={16} className="shrink-0" />
                {!isCollapsed && <span className="whitespace-nowrap truncate">Bulk Import</span>}
              </div>
            )}

            {isOwner && (
              <div onClick={() => handleNavClick('/dashboard/billing')} className={getLinkClass('/dashboard/billing') + ' cursor-pointer'} title={isCollapsed ? "Billing & Subscription" : undefined}>
                <CreditCard size={16} className="shrink-0" />
                {!isCollapsed && <span className="whitespace-nowrap truncate">Billing</span>}
              </div>
            )}

            {canManageOrg && (
              <div onClick={() => handleNavClick('/dashboard/audit-logs')} className={getLinkClass('/dashboard/audit-logs') + ' cursor-pointer'} title={isCollapsed ? "Audit Logs" : undefined}>
                <FileText size={16} className="shrink-0" />
                {!isCollapsed && <span className="whitespace-nowrap truncate">Audit Logs</span>}
              </div>
            )}
          </>
        )}

        {/* AI Chatbot — Level 0 & 1 only */}
        {roleLevel <= 1 && (
          <>
            {!isCollapsed ? (
              <div className="mt-4 mb-2 px-2 whitespace-nowrap">
                <span className="text-[11.5px] font-bold text-[rgba(224,231,255,0.45)] uppercase tracking-wider">
                  AI Tools
                </span>
              </div>
            ) : (
              <div className="my-2 border-t border-[rgba(224,231,255,0.1)] w-8 mx-auto" />
            )}
            <div onClick={() => handleNavClick('/dashboard/ai-chatbot')} className={getLinkClass('/dashboard/ai-chatbot') + ' cursor-pointer'} title={isCollapsed ? "AI Chatbot" : undefined}>
              <div className="w-5 h-5 rounded-[4px] bg-[#0F172A] flex items-center justify-center shrink-0 shadow-sm border border-[#1E293B]">
                <Cpu size={12} className="text-sky-400" />
              </div>
              {!isCollapsed && (
                <span className="whitespace-nowrap truncate font-semibold flex items-center gap-1.5 text-white">
                  Iris <Crown size={13} className="text-sky-400 shrink-0" strokeWidth={2.5} />
                </span>
              )}
            </div>
          </>
        )}
      </nav>

      {/* Bottom Profile Info */}
      <div className={`mt-auto pt-3 pb-2 flex flex-col items-center gap-2 overflow-hidden border-t border-white/5 ${isCollapsed ? 'mx-0' : 'mx-2'}`}>
        <Link
          to="/dashboard/my-profile"
          onClick={onCloseMobile}
          className={`flex flex-col items-center justify-center gap-2 hover:bg-white/5 ${isCollapsed ? 'p-1' : 'p-2'} rounded-xl transition-colors w-full text-center`}
          title={user?.displayName || 'My Profile'}
        >
          <Avatar size={isCollapsed ? "sm" : "lg"} src={user?.avatar} initials={initials} className="bg-sb-pill-bg text-sb-pill-text font-bold shrink-0 shadow-sm mx-auto" />
          {!isCollapsed && (
            <div className="flex flex-col items-center w-full min-w-0 px-1">
              <span className="text-[14px] font-bold text-sky-100 break-words whitespace-normal leading-tight text-center w-full">{user?.displayName || 'User'}</span>
              <span className="text-[11.5px] text-[rgba(224,231,255,0.6)] break-words whitespace-normal font-medium leading-tight mt-1.5 text-center w-full">{user?.jobPosition || user?.roleDefinition?.name || user?.role || 'Employee'}</span>
            </div>
          )}
        </Link>

        <button
          onClick={handleLogout}
          className={isCollapsed
            ? "w-9 h-9 rounded-full bg-red-500/10 text-red-400 border border-red-500/30 flex items-center justify-center hover:bg-red-600 hover:text-white transition-all shadow-sm my-1 shrink-0"
            : "w-full flex items-center justify-center gap-2 text-[rgba(245,235,220,0.6)] hover:text-red-400 hover:bg-red-500/10 py-2 rounded-lg transition-colors text-xs font-semibold shrink-0"
          }
          title="Log Out"
        >
          <LogOut size={16} />
          {!isCollapsed && <span>Log Out</span>}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;

