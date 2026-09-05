import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Users, Zap, Clock, CalendarDays, Wallet, Building, ArrowRight, CheckCircle2, BarChart3, Fingerprint, Menu, X } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Footerdemo } from '../components/ui/footer-section';
import { HeroSection } from '../components/ui/retro-grid-hero';
import { motion, AnimatePresence } from 'framer-motion';

const fadeIn = {
  hidden: { opacity: 0, y: 24, filter: 'blur(8px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.7, ease: [0.32, 0.72, 0, 1] } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.1
    }
  }
};

const Landing = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % 3);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const slides = [
    { title: "Real-Time Tracking", desc: "Monitor employee check-ins instantly.", icon: Clock },
    { title: "Automated Payroll", desc: "One-click accurate salary generation.", icon: Wallet },
    { title: "Leave Management", desc: "Approve time-off requests effortlessly.", icon: CalendarDays }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#FAF9F6] font-sans">
      
      {/* ── FLOATING GLASS NAV ── */}
      <motion.nav 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
        className={`fixed w-full top-0 z-50 transition-all duration-[600ms] ease-[cubic-bezier(0.32,0.72,0,1)] ${
          isScrolled 
            ? "border-b border-[#EAE7E0] bg-white/80 backdrop-blur-xl shadow-xs" 
            : "bg-transparent border-transparent"
        }`}
      >
        <div className="w-full px-6 md:px-12 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/crew-new.png" alt="Crew HRMS Logo" className="h-12 sm:h-14 w-auto object-contain drop-shadow-xs" />
          </div>
          <div className="hidden md:flex gap-4 items-center">
            <Link to="/login" className="text-sm font-display font-bold text-[#1F2B4D] hover:text-[#141C33] border border-[#EAE7E0] hover:border-[#CBD5E1] bg-white px-6 py-2.5 rounded-full transition-all duration-[500ms] ease-[cubic-bezier(0.32,0.72,0,1)] hover:shadow-xs active:scale-[0.97]">
              Sign In
            </Link>
            <Link to="/signup">
              <div className="rounded-full bg-[#1F2B4D] px-6 py-2.5 text-sm font-display font-bold text-white hover:bg-[#141C33] shadow-[0_4px_12px_rgba(31,43,77,0.15)] hover:shadow-[0_8px_24px_rgba(31,43,77,0.25)] transition-all duration-[500ms] ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97]">
                Get Started
              </div>
            </Link>
          </div>
          <button 
            className="md:hidden p-2 text-[#1F2B4D] hover:text-[#141C33] transition-colors focus:outline-none"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-white/95 backdrop-blur-xl border-b border-[#EAE7E0] shadow-lg overflow-hidden"
            >
              <div className="px-6 py-6 flex flex-col gap-4">
                <Link to="/login" onClick={() => setIsMobileMenuOpen(false)} className="w-full text-center text-base font-display font-bold text-[#1F2B4D] border border-[#EAE7E0] bg-[#FAF9F6] hover:bg-white py-3 rounded-xl transition-all duration-300">
                  Sign In
                </Link>
                <Link to="/signup" onClick={() => setIsMobileMenuOpen(false)} className="w-full text-center text-base font-display font-bold text-white bg-[#1F2B4D] hover:bg-[#141C33] py-3 rounded-xl shadow-md transition-all duration-300">
                  Get Started
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      <main className="flex-grow">
        
        {/* HERO SECTION */}
        <HeroSection>
          {/* Right Side Animation Slider */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.32, 0.72, 0, 1] }}
            className="relative block h-[350px] sm:h-[400px] lg:h-[450px] w-full mt-12 lg:mt-0"
          >
            {/* Doppelrand Outer Shell */}
            <div className="absolute inset-0 bg-[#F4F1EA] rounded-[2rem] border border-[#EAE7E0] shadow-[0_1px_2px_rgba(29,27,22,0.04),0_8px_20px_rgba(29,27,22,0.06)] p-2">
              {/* Inner Core */}
              <div className="w-full h-full bg-white rounded-[calc(2rem-0.5rem)] border border-[#EAE7E0] shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)] flex items-center justify-center overflow-hidden relative">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentSlide}
                    initial={{ opacity: 0, x: 80, scale: 0.96 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -80, scale: 0.96 }}
                    transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
                    className="text-center p-6 sm:p-10 max-w-[90%] sm:max-w-md lg:max-w-lg w-full mx-auto flex flex-col items-center"
                  >
                    {(() => {
                      const SlideIcon = slides[currentSlide].icon;
                      return (
                        <>
                          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[#F0F3F9] border border-[#EAE7E0] text-[#1F2B4D] rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-8 shadow-xs">
                            <SlideIcon className="w-8 h-8 sm:w-10 sm:h-10" strokeWidth={1.5} />
                          </div>
                          <h3 className="text-xl sm:text-3xl font-serif font-bold text-[#1D1B16] mb-2 sm:mb-4">{slides[currentSlide].title}</h3>
                          <p className="text-sm sm:text-lg text-[#6B655C] leading-relaxed">{slides[currentSlide].desc}</p>
                        </>
                      );
                    })()}
                  </motion.div>
                </AnimatePresence>
                
                {/* Slider Dots */}
                <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-3">
                  {slides.map((_, i) => (
                    <div key={i} className={`h-2 rounded-full transition-all duration-[500ms] ease-[cubic-bezier(0.32,0.72,0,1)] ${i === currentSlide ? 'w-10 bg-[#1F2B4D]' : 'w-2 bg-[#EAE7E0]'}`} />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </HeroSection>

        {/* ── SOCIAL PROOF ── */}
        <section className="border-y border-[#EAE7E0] bg-white py-12 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 text-center">
            <p className="text-[10px] font-display font-bold text-[#9A948A] uppercase tracking-[0.2em] mb-8">Trusted by modern teams worldwide</p>
            <div className="flex justify-center gap-12 sm:gap-20 opacity-30 grayscale flex-wrap">
              {['Acme Corp', 'Globex', 'Soylent', 'Initech', 'Umbrella'].map((logo, i) => (
                <div key={i} className="text-lg font-display font-bold tracking-tighter flex items-center gap-2 text-[#1D1B16]">
                  <Fingerprint size={20} strokeWidth={1.5} /> {logo}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FEATURES GRID ── */}
        <section className="py-28 bg-[#FAF9F6] relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            
            <motion.div 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={fadeIn}
              className="text-center mb-20"
            >
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-display font-bold uppercase tracking-[0.2em] text-[#6B655C] bg-white border border-[#EAE7E0] mb-6">
                Core Capabilities
              </span>
              <h2 className="text-3xl sm:text-5xl font-serif font-bold text-[#1D1B16] tracking-tight mb-5 leading-tight">Everything you need, <br />nothing you don't.</h2>
              <p className="text-[#6B655C] text-lg max-w-2xl mx-auto font-medium">Built for growing companies that demand a reliable, beautiful, and blazing-fast HR solution.</p>
            </motion.div>
            
            <motion.div 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={staggerContainer}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {[
                { icon: ShieldCheck, title: 'Secure RBAC', desc: 'Role-based access control with JWT authentication. Employees see only their data; Admins manage everything.' },
                { icon: Clock, title: 'Real-Time Attendance', desc: 'Check In / Check Out system with live status indicators. Track working hours and break times automatically.' },
                { icon: Wallet, title: 'Automated Payroll', desc: 'Auto-compute Basic, HRA, PF, LTA, Professional Tax and Fixed Allowance from a single wage input.' },
                { icon: Users, title: 'Employee Directory', desc: 'Visual employee cards with status indicators. Click any card to view full profile in read-only mode.' },
                { icon: CalendarDays, title: 'Leave Management', desc: 'Paid, Sick, and Unpaid leave types. Employees request, Admins approve/reject with one click.' },
                { icon: BarChart3, title: 'Dynamic Dashboards', desc: 'Beautiful, interactive charts and heatmaps that give you an instant overview of your workforce.' },
              ].map(({ icon: Icon, title, desc }, i) => (
                <motion.div key={i} variants={fadeIn}>
                  {/* Doppelrand Card Architecture */}
                  <div className="h-full rounded-[24px] bg-[#F4F1EA] border border-[#EAE7E0] p-1.5 hover:shadow-[0_6px_24px_-4px_rgba(29,27,22,0.08),0_12px_32px_-6px_rgba(29,27,22,0.10)] transition-all duration-[700ms] ease-[cubic-bezier(0.32,0.72,0,1)] group">
                    <div className="h-full bg-white rounded-[calc(24px-6px)] p-8 shadow-[inset_0_1px_1px_rgba(255,255,255,0.5)] border border-[#EAE7E0]/50">
                      <div className="w-12 h-12 bg-[#F0F3F9] border border-[#EAE7E0] text-[#1F2B4D] rounded-2xl flex items-center justify-center mb-6 group-hover:scale-105 transition-transform duration-[700ms] ease-[cubic-bezier(0.32,0.72,0,1)]">
                        <Icon size={24} strokeWidth={1.5} />
                      </div>
                      <h3 className="text-lg font-display font-bold text-[#1D1B16] mb-3">{title}</h3>
                      <p className="text-[#6B655C] leading-relaxed text-[15px]">{desc}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── HOW IT WORKS / STATS ── */}
        <section className="py-28 bg-[#1F2B4D] text-white relative overflow-hidden">
          {/* Ambient gradient glow */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-[#2A3A6B] rounded-full opacity-20 blur-[128px] -translate-x-1/2 -translate-y-1/2"></div>
            <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-[#10B981] rounded-full opacity-10 blur-[128px] translate-x-1/3 translate-y-1/3"></div>
          </div>
           
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              
              <motion.div 
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeIn}
              >
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-display font-bold uppercase tracking-[0.2em] text-white/60 border border-white/10 mb-8">
                  Why Crew?
                </span>
                <h2 className="text-3xl sm:text-5xl font-serif font-bold tracking-tight mb-6 leading-tight">
                  Onboard in minutes.<br/> Scale for years.
                </h2>
                <p className="text-white/50 text-lg mb-10 leading-relaxed font-medium">
                  Say goodbye to messy spreadsheets and disconnected tools. Crew brings everything under one roof with a workflow designed for speed.
                </p>
                <ul className="space-y-5">
                  {[
                    'Add employees and assign roles instantly',
                    'Employees self-serve their check-ins and time off',
                    'Generate accurate payroll with a single click'
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-white/80 font-medium">
                      <span className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
                        <CheckCircle2 size={14} className="text-emerald-400" />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, scale: 0.92 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
                viewport={{ once: true }}
                className="relative"
              >
                {/* Doppelrand Mock Dashboard */}
                <div className="bg-[#141C33] rounded-[2rem] border border-white/10 shadow-2xl p-2 relative z-10">
                  <div className="bg-[#0F172A] rounded-[calc(2rem-0.5rem)] overflow-hidden border border-white/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
                    <div className="h-8 bg-[#141C33] border-b border-white/5 flex items-center px-4 gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></div>
                    </div>
                    <div className="p-6">
                      <div className="h-3 bg-white/5 rounded w-1/3 mb-6"></div>
                      <div className="flex gap-4 mb-6">
                        <div className="h-20 bg-white/5 rounded-xl flex-1"></div>
                        <div className="h-20 bg-white/5 rounded-xl flex-1"></div>
                        <div className="h-20 bg-white/5 rounded-xl flex-1"></div>
                      </div>
                      <div className="h-32 bg-white/5 rounded-xl w-full"></div>
                    </div>
                  </div>
                </div>
              </motion.div>

            </div>
          </div>
        </section>

        {/* ── BOTTOM CTA ── */}
        <section className="py-28 bg-[#FAF9F6] relative overflow-hidden">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
            className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10"
          >
            {/* Doppelrand CTA Block */}
            <div className="rounded-[2.5rem] bg-[#F4F1EA] border border-[#EAE7E0] p-2 shadow-[0_1px_2px_rgba(29,27,22,0.04),0_8px_20px_rgba(29,27,22,0.06)]">
              <div className="rounded-[calc(2.5rem-0.5rem)] bg-white border border-[#EAE7E0]/50 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)] p-12 sm:p-20 flex flex-col items-center">
                <img src="/crew-new.png" alt="Crew HRMS Logo" className="h-10 sm:h-12 w-auto object-contain mb-6 drop-shadow-xs" />
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-display font-bold uppercase tracking-[0.2em] text-[#6B655C] bg-[#FAF9F6] border border-[#EAE7E0] mb-8">
                  Get Started Today
                </span>
                <h2 className="text-4xl sm:text-6xl font-serif font-bold text-[#1D1B16] tracking-tight mb-6 leading-tight">
                  Ready to upgrade your HR?
                </h2>
                <p className="text-lg text-[#6B655C] mb-10 max-w-2xl mx-auto font-medium">
                  Join hundreds of forward-thinking companies that use Crew to manage their workforce effortlessly.
                </p>
                <Link to="/signup">
                  <div className="inline-flex rounded-full bg-[#1F2B4D] hover:bg-[#141C33] text-white font-display font-bold px-10 py-5 text-lg shadow-[0_8px_24px_rgba(31,43,77,0.15)] hover:shadow-[0_12px_32px_rgba(31,43,77,0.25)] transition-all duration-[500ms] ease-[cubic-bezier(0.32,0.72,0,1)] hover:scale-[1.03] active:scale-[0.97] items-center gap-3">
                    Get Started Now
                    <span className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center">
                      <ArrowRight size={18} strokeWidth={2.5} />
                    </span>
                  </div>
                </Link>
              </div>
            </div>
          </motion.div>
        </section>

      </main>
      
      <Footerdemo />
    </div>
  );
};

export default Landing;
