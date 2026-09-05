import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { clearSession, getSession } from '@crew/auth-client';
import { 
  Building2, GitFork, ShieldCheck, DollarSign, MapPin, Users, 
  LogOut, Crown, Sparkles, ChevronRight, Layers, LayoutDashboard,
  PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import CompanyProfile from '../components/CompanyProfile';
import RoleHierarchy from '../components/RoleHierarchy';
import PayrollConfig from '../components/PayrollConfig';
import AccessPermissions from '../components/AccessPermissions';
import OfficeEntityManagement from '../components/OfficeEntityManagement';
import EmployeeRoster from '../components/EmployeeRoster';

export default function Dashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const { user } = getSession();
  
  const activeTab = searchParams.get('tab') || 'profile';

  const setActiveTab = (tab) => {
    setSearchParams({ tab });
  };

  const handleLogout = () => {
    clearSession();
    navigate('/');
  };

  const navItems = [
    { id: 'profile', label: 'Company Profile', icon: Building2, desc: 'Legal identity & statutory data' },
    { id: 'hierarchy', label: 'Role Hierarchy', icon: GitFork, desc: 'L0-L3 tier definitions' },
    { id: 'permissions', label: 'Access Permissions', icon: ShieldCheck, desc: 'Feature access matrix' },
    { id: 'payroll', label: 'Payroll Config', icon: DollarSign, desc: 'Statutory allowances & PF' },
    { id: 'offices', label: 'Offices & Entities', icon: MapPin, desc: 'Geofence & subsidiaries' },
    { id: 'roster', label: 'Employee Roster', icon: Users, desc: 'Personnel directory' }
  ];

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#1D1B16] font-sans antialiased flex selection:bg-[#1F2B4D] selection:text-white overflow-hidden relative">
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-[#1D1B16]/20 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Executive Dark Slate Sidebar */}
      <aside className={`fixed md:sticky top-0 left-0 h-screen bg-[#10121A] text-white shadow-2xl z-50 flex flex-col justify-between border-r border-[#181B26] shrink-0 overflow-x-hidden overflow-y-auto transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
        isSidebarOpen ? 'w-72 p-6 translate-x-0' : 'w-20 py-6 px-3 -translate-x-full md:translate-x-0'
      }`}>
        <div>
          {/* Brand Header & Toggle Control */}
          {isSidebarOpen ? (
            <div className="flex items-center justify-between gap-3 mb-8 pb-6 border-b border-[#1E2333]">
              <div className="flex items-center gap-3 min-w-0">
                <img src="/crew-new.png" alt="Crew HR Logo" className="h-12 sm:h-14 w-auto max-w-[170px] object-contain mix-blend-screen opacity-95" />
              </div>

              <button 
                onClick={() => setIsSidebarOpen(false)}
                title="Collapse Sidebar"
                className="p-1.5 rounded-lg bg-[#181B26] hover:bg-[#262C3F] text-[#94A3B8] hover:text-white transition-colors cursor-pointer border border-white/5 shrink-0"
              >
                <PanelLeftClose size={16} />
              </button>
            </div>
          ) : (
            <div className="hidden md:flex flex-col items-center gap-3 mb-8 pb-6 border-b border-[#1E2333]">
              <img src="/crew-new.png" alt="Crew HR Logo" className="h-8 w-auto max-w-[44px] object-contain mix-blend-screen opacity-95" />
              <button 
                onClick={() => setIsSidebarOpen(true)}
                title="Expand Sidebar"
                className="p-2 rounded-xl bg-[#1F2B4D] hover:bg-[#2A3B66] text-white transition-all cursor-pointer border border-white/10 shadow-sm active:scale-95"
              >
                <PanelLeftOpen size={16} />
              </button>
            </div>
          )}

          {/* Active Tenant / User Badge */}
          {isSidebarOpen ? (
            <div className="mb-6 p-3.5 rounded-2xl bg-[#181B26] border border-[#262C3F] flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#1F2B4D] flex items-center justify-center text-amber-400 font-bold shrink-0">
                <Crown size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-white truncate">{user?.displayName || 'Administrator'}</div>
                <div className="text-[11px] font-medium text-[#94A3B8] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  Level {user?.roleDefinition?.level ?? 0} ({user?.roleDefinition?.name || 'Owner'})
                </div>
              </div>
            </div>
          ) : (
            <div className="hidden md:flex mb-6 justify-center" title={`${user?.displayName || 'Administrator'} (Level ${user?.roleDefinition?.level ?? 0})`}>
              <div className="w-10 h-10 rounded-2xl bg-[#181B26] border border-[#262C3F] flex items-center justify-center text-amber-400 font-bold shadow-xs">
                <Crown size={18} />
              </div>
            </div>
          )}

          {/* Navigation Items */}
          {isSidebarOpen && (
            <div className="text-[11px] font-bold tracking-wider uppercase text-[#64748B] mb-3 px-2">
              CONSOLE MANAGEMENT
            </div>
          )}

          <nav className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              
              if (!isSidebarOpen) {
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                    }}
                    title={item.label}
                    className={`hidden md:flex w-full items-center justify-center p-3 rounded-xl cursor-pointer transition-all duration-200 ${
                      isActive
                        ? 'bg-[#1F2B4D] text-white font-bold shadow-md border-l-4 border-[#3B82F6]'
                        : 'text-[#94A3B8] hover:text-white hover:bg-[#181B26]'
                    }`}
                  >
                    <Icon size={20} className={isActive ? 'text-white' : 'text-[#64748B] transition-colors'} />
                  </button>
                );
              }

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    if (window.innerWidth < 768) setIsSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all duration-200 group text-left ${
                    isActive
                      ? 'bg-[#1F2B4D] text-white font-bold shadow-md border-l-4 border-[#3B82F6]'
                      : 'text-[#94A3B8] hover:text-white hover:bg-[#181B26]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon size={18} className={isActive ? 'text-white' : 'text-[#64748B] group-hover:text-white transition-colors'} />
                    <div className="truncate">
                      <div className="text-xs tracking-tight font-semibold">{item.label}</div>
                      <div className={`text-[10px] truncate ${isActive ? 'text-white/70' : 'text-[#64748B]'}`}>
                        {item.desc}
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={14} className={`shrink-0 transition-transform ${isActive ? 'translate-x-0.5 text-white' : 'opacity-0 group-hover:opacity-100 text-[#64748B]'}`} />
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="pt-6 border-t border-[#1E2333]">
          {isSidebarOpen ? (
            <button 
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-[0_4px_12px_rgba(225,29,72,0.25)] text-xs font-bold transition-all duration-200 cursor-pointer"
            >
              <LogOut size={15} />
              <span>Terminate Session</span>
            </button>
          ) : (
            <button 
              onClick={handleLogout}
              title="Terminate Session"
              className="hidden md:flex w-full items-center justify-center p-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-[0_4px_12px_rgba(225,29,72,0.25)] transition-all duration-200 cursor-pointer"
            >
              <LogOut size={18} />
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Viewport */}
      <main className="flex-1 overflow-y-auto bg-[#FAF9F6] relative flex flex-col h-screen w-full">
        
        {/* Top Floating Header */}
        <div className="sticky top-0 z-30 bg-[#FAF9F6] pt-4 pb-2 px-4 md:px-8 w-full">
          <header className="px-4 md:px-6 py-4 rounded-2xl bg-white border border-[#EAE7E0] shadow-[0_1px_2px_rgba(29,27,22,0.04)] flex justify-between items-center">
          <div className="flex items-center gap-3 md:gap-4 w-full md:w-auto">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 rounded-xl bg-[#F4F1EA] hover:bg-[#EAE7E0] text-[#1F2B4D] transition-colors border border-[#EAE7E0] cursor-pointer"
            >
              <PanelLeftOpen size={18} />
            </button>
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 md:gap-2 px-2.5 md:px-3 py-1 rounded-full bg-[#F4F1EA] text-[#1F2B4D] border border-[#EAE7E0] text-[9px] md:text-[11px] font-bold tracking-wider uppercase mb-1">
                <Sparkles size={10} className="md:w-3 md:h-3" /> <span className="truncate">ENTERPRISE CONTROL PLANE</span>
              </div>
              <h1 className="text-lg md:text-2xl font-extrabold text-[#1D1B16] tracking-tight truncate">
                Welcome, {user?.displayName?.split(' ')[0] || 'Admin'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden lg:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0F172A] text-white text-xs font-bold shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="truncate max-w-[150px]">{user?.companyName || 'Crew HRMS'}</span>
            </span>
          </div>
        </header>
      </div>

        {/* Dynamic Tab Body (Doppelrand Canvas Wrapper) */}
        <div className="p-4 md:p-8 pb-20 max-w-7xl mx-auto w-full flex-1">
          {activeTab === 'profile' && <CompanyProfile user={user} />}
          {activeTab === 'hierarchy' && <RoleHierarchy user={user} />}
          {activeTab === 'permissions' && <AccessPermissions user={user} />}
          {activeTab === 'payroll' && <PayrollConfig user={user} />}
          {activeTab === 'offices' && <OfficeEntityManagement user={user} />}
          {activeTab === 'roster' && <EmployeeRoster />}
        </div>
      </main>

    </div>
  );
}
