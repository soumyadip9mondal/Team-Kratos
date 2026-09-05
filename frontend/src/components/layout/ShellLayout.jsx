import React, { useState } from 'react';
import Sidebar from './Sidebar';
import { Menu, X, AlertTriangle } from 'lucide-react';

const ShellLayout = ({ user, children }) => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="flex h-screen w-screen bg-[#FAF9F6] overflow-hidden p-0 gap-0 relative flex-col">
      {/* Top Banner for Unverified Email */}
      {user && !user.emailVerified && (
        <div className="bg-rose-500 text-white px-4 py-2 text-center text-xs sm:text-sm font-medium z-[60] flex items-center justify-center gap-2 w-full shrink-0">
          <AlertTriangle size={16} className="shrink-0" />
          <span>Your email address is not verified. Please go to your Profile to verify it.</span>
        </div>
      )}

      {/* Top Mobile Header */}
      <div className="md:hidden w-full h-14 sm:h-16 bg-[#FAF9F6] border-b border-slate-200/80 flex items-center px-4 shrink-0 z-30 justify-between">
        <button 
          className="p-2 -ml-2 text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors shrink-0"
          onClick={() => setIsMobileOpen(true)}
          aria-label="Open navigation menu"
        >
          <Menu size={24} />
        </button>
        <div className="flex flex-1 justify-start ml-2">
          <img src="/crew-new.png" alt="Crew HR" className="h-8 sm:h-10 object-contain" />
        </div>
      </div>

      {/* Main Workspace Row */}
      <div className="flex flex-1 flex-row min-h-0 min-w-0 overflow-hidden w-full h-full relative p-0 md:p-3 md:gap-3">
        
        {/* Mobile Overlay */}
        {isMobileOpen && (
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 md:hidden transition-opacity" 
            onClick={() => setIsMobileOpen(false)}
          />
        )}

        {/* Sidebar Container */}
        <div className={`
          fixed md:static inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          bg-transparent p-3 h-full w-[280px] md:w-auto shrink-0
        `}>
          {/* Mobile close button inside the sidebar */}
          <button 
            className="md:hidden absolute top-6 right-6 p-1.5 text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-full z-50 transition-all border border-white/10"
            onClick={() => setIsMobileOpen(false)}
            aria-label="Close navigation menu"
          >
            <X size={20} />
          </button>
          <Sidebar user={user} onCloseMobile={() => setIsMobileOpen(false)} />
        </div>
        
        {/* Main Content Area */}
        <main className="flex-1 min-h-0 min-w-0 rounded-none md:rounded-[28px] bg-[#FAF9F6] overflow-y-auto relative w-full h-full">
          {children}
        </main>
      </div>
    </div>
  );
};

export default ShellLayout;

