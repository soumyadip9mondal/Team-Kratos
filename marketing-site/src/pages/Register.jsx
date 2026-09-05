import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, Crown } from 'lucide-react';
import RegistrationFlow from '../components/RegistrationFlow';

function Register() {
  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#1D1B16] flex flex-col items-center justify-between font-sans selection:bg-[#F0F3F9] selection:text-[#1F2B4D]">
      
      {/* Brand Header & Topbar (Fixed Top Header Wrapper) */}
      <div className="sticky top-0 z-50 bg-[#FAF9F6] pt-4 pb-2 px-4 sm:px-6 md:px-10 w-full flex justify-center">
        <nav className="w-full max-w-5xl mx-auto flex items-center justify-between py-3.5 px-4 sm:px-6 rounded-2xl bg-white border border-[#EAE7E0] shadow-[0_1px_2px_rgba(29,27,22,0.04)]">
          <Link to="/" replace className="flex items-center gap-3 group">
            <div className="p-2 rounded-xl bg-[#F4F1EA] border border-[#EAE7E0] group-hover:border-[#1F2B4D]/30 transition-all">
              <img src="/crew-new.png" alt="Crew HR Logo" className="h-9 w-auto object-contain" />
            </div>
            <div>
              <span className="font-heading font-extrabold text-[#1D1B16] text-base tracking-tight block leading-none">Crew HRMS</span>
              <span className="text-[10px] text-[#9A948A] font-semibold uppercase tracking-wider block mt-0.5">Enterprise Setup</span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            {/* Executive C-Suite Rank Badge */}
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0F172A] text-white border border-slate-700/60 text-xs font-bold shadow-xs">
              <Crown className="w-3.5 h-3.5 text-slate-300" />
              Executive Workspace
            </span>

            <Link 
              to="/" 
              replace 
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#FAF9F6] text-[#6B655C] hover:text-[#1D1B16] border border-[#EAE7E0] hover:bg-[#F4F1EA] text-xs font-semibold transition-all cursor-pointer"
            >
              <ArrowLeft size={14} /> Back to Home
            </Link>
          </div>
        </nav>
      </div>

      {/* Main Registration Flow Container */}
      <main className="w-full flex justify-center z-10 my-auto px-4 py-6">
        <motion.div 
          initial={{ opacity: 0, y: 15 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }} 
          className="w-full"
        >
          <RegistrationFlow />
        </motion.div>
      </main>


    </div>
  );
}

export default Register;
