import React from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  Building2, ArrowRight, ShieldCheck, Zap, 
  Crown, Clock, Layers, ArrowUpRight, Sparkles, UserCheck, Shield
} from 'lucide-react';

export default function Landing() {
  const { scrollY } = useScroll();

  // Continuously map real-time scrollY (0px to 200px) to navbar dimensions
  const rawWidth = useTransform(scrollY, [0, 200], ['64rem', '44rem']);
  const rawPaddingY = useTransform(scrollY, [0, 200], ['0.75rem', '0.45rem']);
  const rawPaddingX = useTransform(scrollY, [0, 200], ['1.25rem', '0.875rem']);
  const rawLogoHeight = useTransform(scrollY, [0, 200], ['3.25rem', '2.25rem']);

  // Apply fluid spring physics for buttery smooth motion (Outcrowd style)
  const smoothWidth = useSpring(rawWidth, { stiffness: 280, damping: 28 });
  const smoothPaddingY = useSpring(rawPaddingY, { stiffness: 280, damping: 28 });
  const smoothPaddingX = useSpring(rawPaddingX, { stiffness: 280, damping: 28 });
  const smoothLogoHeight = useSpring(rawLogoHeight, { stiffness: 280, damping: 28 });

  const cubicTransition = { duration: 0.8, ease: [0.32, 0.72, 0, 1] };

  // Scroll reveal variants
  const revealUp = {
    hidden: { opacity: 0, y: 40, filter: 'blur(10px)' },
    visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: cubicTransition }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.15 } }
  };

  return (
    <div className="min-h-[100dvh] bg-[#FAF9F6] text-[#1D1B16] font-sans selection:bg-[#F0F3F9] selection:text-[#0B1121] overflow-hidden relative">
      
      {/* Noise Texture Overlay */}
      <div className="pointer-events-none fixed inset-0 z-50 opacity-[0.03] mix-blend-multiply bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>

      {/* Floating Island Navbar (Outcrowd Real-Time Scroll Linked) */}
      <div className="fixed top-0 left-0 right-0 z-40 px-4 pt-4 md:pt-6 flex justify-center pointer-events-none">
        <motion.nav 
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
          style={{ 
            width: smoothWidth,
            maxWidth: '94vw',
            paddingTop: smoothPaddingY,
            paddingBottom: smoothPaddingY,
            paddingLeft: smoothPaddingX,
            paddingRight: smoothPaddingX,
          }}
          className="pointer-events-auto bg-white/85 backdrop-blur-2xl border border-[#EAE7E0] rounded-full flex items-center justify-between shadow-[0_8px_32px_-8px_rgba(29,27,22,0.12)]"
        >
          <Link to="/" className="flex items-center gap-3 group px-2">
            <motion.img 
              src="/crew-new.png" 
              alt="Crew HRMS Logo" 
              style={{ height: smoothLogoHeight }}
              className="w-auto object-contain drop-shadow-xs group-hover:scale-105 transition-transform duration-300" 
            />
          </Link>

          <div className="flex items-center gap-3">
            <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F4F1EA] text-[#6B655C] border border-[#EAE7E0] text-[10px] font-bold uppercase tracking-widest">
              <Crown size={12} className="text-[#1F2B4D]" /> Enterprise
            </span>
            <Link 
              to="/login" 
              className="group relative inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0B1121] hover:bg-[#050811] text-white text-xs font-bold transition-all duration-500 active:scale-[0.98]"
            >
              Console Login
              <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center group-hover:translate-x-0.5 group-hover:-translate-y-[1px] transition-transform duration-500">
                <ArrowUpRight size={12} strokeWidth={3} />
              </div>
            </Link>
          </div>
        </motion.nav>
      </div>

      {/* HERO SECTION: Editorial Split */}
      <main className="w-full max-w-[1400px] mx-auto px-6 md:px-12 pt-40 pb-24 min-h-[90vh] flex flex-col justify-center">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-8 items-center">
          
          {/* Left: Typography Block */}
          <motion.div 
            initial="hidden" 
            whileInView="visible" 
            viewport={{ once: true }} 
            variants={staggerContainer}
            className="flex flex-col items-start w-full"
          >
            <motion.div variants={revealUp} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#F4F1EA] text-[#0B1121] border border-[#EAE7E0] text-[10px] font-bold uppercase tracking-[0.2em] mb-8">
              <Sparkles size={14} className="text-[#1F2B4D]" />
              The Executive Standard
            </motion.div>

            <motion.h1 variants={revealUp} className="text-5xl md:text-6xl lg:text-7xl font-serif font-bold text-[#0B1121] leading-[1.05] tracking-tight mb-8">
              Architect the <br className="hidden md:block"/>
              future of your <br className="hidden md:block"/>
              <span className="relative inline-block text-[#1F2B4D] italic">
                workforce.
                <span className="absolute bottom-2 left-0 w-full h-[2px] bg-[#1F2B4D]/30"></span>
              </span>
            </motion.h1>

            <motion.p variants={revealUp} className="text-lg md:text-xl text-[#6B655C] font-medium leading-relaxed max-w-xl mb-12">
              A bespoke, high-performance platform engineered for executive teams. Seamlessly govern payroll, attendance, and organizational architecture with uncompromised precision.
            </motion.p>

            <motion.div variants={revealUp} className="flex flex-wrap gap-4">
              <Link 
                to="/register" 
                className="group flex items-center gap-4 bg-[#0B1121] text-white rounded-full pl-8 pr-2 py-2 hover:bg-[#050811] transition-all duration-500 active:scale-[0.98] shadow-[0_8px_24px_rgba(31,43,77,0.2)]"
              >
                <span className="font-bold text-sm tracking-wide">Initiate Platform</span>
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white group-hover:text-[#0B1121] transition-all duration-500 group-hover:translate-x-1 group-hover:-translate-y-[1px]">
                  <ArrowRight size={18} />
                </div>
              </Link>
            </motion.div>
          </motion.div>

          {/* Right: Z-Axis Cascade Interactive Elements */}
          <div className="relative w-full h-[500px] lg:h-[600px] flex items-center justify-center lg:justify-end">
            
            {/* Background Aesthetic Blur Orb (Tamed down for Executive look) */}
            <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-96 h-96 bg-[#EAE7E0] rounded-full mix-blend-multiply filter blur-[80px] opacity-60"></div>
            
            {/* Primary Card (Doppelrand) */}
            <motion.div 
              initial={{ opacity: 0, y: 60, rotate: 2 }}
              whileInView={{ opacity: 1, y: 0, rotate: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
              className="absolute right-0 md:right-12 z-20 w-full max-w-[420px] p-2 bg-[#F4F1EA] rounded-[32px] border border-[#EAE7E0] shadow-[0_24px_64px_-12px_rgba(29,27,22,0.15)]"
            >
              <div className="bg-white rounded-[24px] p-8 border border-[#EAE7E0] shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#F0F3F9] rounded-bl-full -z-10 opacity-50"></div>
                
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-[#0B1121] rounded-full flex items-center justify-center text-white shrink-0">
                    <Shield size={20} />
                  </div>
                  <div>
                    <div className="text-[#0B1121] font-bold text-lg">System Active</div>
                    <div className="text-[#6B655C] text-xs font-medium">SOC-2 Compliant Environment</div>
                  </div>
                </div>

                <div className="space-y-4">
                  {[
                    { title: 'Facial Recognition Linked', icon: UserCheck, color: 'text-[#10B981]' },
                    { title: 'Payroll Automation Engaged', icon: Zap, color: 'text-[#1F2B4D]' },
                    { title: 'WAI-ARIA APG Enforced', icon: Layers, color: 'text-[#0B1121]' },
                  ].map((item, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.5 + (i * 0.15), ...cubicTransition }}
                      className="flex items-center gap-3 p-4 rounded-[16px] border border-[#EAE7E0] bg-[#FAF9F6] hover:bg-[#F4F1EA] transition-colors cursor-pointer group"
                    >
                      <div className={`p-2 rounded-xl bg-white border border-[#EAE7E0] shadow-sm ${item.color} group-hover:scale-110 transition-transform`}>
                        <item.icon size={16} strokeWidth={2.5} />
                      </div>
                      <span className="text-sm font-bold text-[#0B1121]">{item.title}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Secondary Floating Card (Offset Depth) */}
            <motion.div 
              initial={{ opacity: 0, y: -40, rotate: -4 }}
              whileInView={{ opacity: 1, y: 0, rotate: -2 }}
              viewport={{ once: true }}
              transition={{ duration: 1.4, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="hidden md:block absolute bottom-8 right-[340px] z-30 w-64 p-1.5 bg-[#FAF9F6] rounded-[24px] border border-[#EAE7E0] shadow-[0_24px_48px_-12px_rgba(29,27,22,0.25)]"
            >
              <div className="bg-white rounded-[18px] p-5 border border-[#EAE7E0]">
                <div className="text-[10px] font-bold text-[#6B655C] uppercase tracking-widest mb-2">Live Workforce</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-serif font-bold text-[#0B1121]">10k+</span>
                  <span className="text-[#10B981] text-xs font-bold flex items-center">
                    <ArrowUpRight size={14} /> 24%
                  </span>
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </main>

      {/* FEATURE SECTION: The Asymmetrical Bento */}
      <section className="w-full bg-white border-t border-[#EAE7E0] py-20 px-6 md:px-12 relative z-10">
        <div className="max-w-[1400px] mx-auto">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="mb-12 max-w-2xl"
          >
            <motion.div variants={revealUp} className="text-[10px] font-bold text-[#6B655C] uppercase tracking-widest mb-4">Architecture Modules</motion.div>
            <motion.h2 variants={revealUp} className="text-4xl md:text-5xl font-serif font-bold text-[#0B1121] leading-[1.1] tracking-tight">
              Machined perfection. <br/> Zero compromises.
            </motion.h2>
          </motion.div>

          <div className="grid md:grid-cols-12 gap-6">
            
            {/* Bento 1: Large Span */}
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={cubicTransition}
              className="md:col-span-8 p-2 bg-[#F4F1EA] rounded-[32px] border border-[#EAE7E0]"
            >
              <div className="bg-white h-full rounded-[24px] p-8 md:p-10 border border-[#EAE7E0] relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#F0F3F9] via-transparent to-transparent opacity-60 group-hover:opacity-100 transition-opacity duration-700"></div>
                
                {/* Decorative Grid Pattern */}
                <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                
                <div className="w-16 h-16 bg-[#0B1121] rounded-2xl flex items-center justify-center text-white shadow-[0_8px_20px_rgba(31,43,77,0.2)] mb-6 relative z-10">
                  <Zap size={28} />
                </div>

                <div className="relative z-10">
                  <h3 className="text-2xl md:text-3xl font-bold text-[#0B1121] mb-3">Automated Payroll Ecosystem</h3>
                  <p className="text-[#6B655C] font-medium max-w-md leading-relaxed text-sm md:text-base">
                    Execute complex tax deductions, PF/ESI compliance, and salary disbursements with absolute cryptographic precision.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Bento 2: Small Span */}
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1, ...cubicTransition }}
              className="md:col-span-4 p-2 bg-[#FAF9F6] rounded-[32px] border border-[#EAE7E0]"
            >
              <div className="bg-[#0B1121] h-full rounded-[24px] p-8 md:p-10 border border-[#050811] relative overflow-hidden group">
                {/* Decorative Elements */}
                <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-white opacity-5 rounded-full blur-[40px] group-hover:scale-150 transition-transform duration-700"></div>
                <div className="absolute top-8 right-8 w-16 h-16 border border-white/10 rounded-full flex items-center justify-center opacity-20">
                  <div className="w-8 h-8 border border-white/20 rounded-full"></div>
                </div>

                <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-white backdrop-blur-md mb-6 group-hover:scale-110 transition-transform duration-500 relative z-10 shadow-[0_8px_16px_rgba(0,0,0,0.2)]">
                  <Clock size={24} />
                </div>

                <div className="relative z-10">
                  <h3 className="text-xl md:text-2xl font-bold text-white mb-2">Spatial Geofencing</h3>
                  <p className="text-white/60 font-medium text-sm leading-relaxed">
                    GPS boundary enforcement paired with neural-net biometric facial registration.
                  </p>
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#0B1121] pt-12 pb-8 px-6 md:px-12 text-white/60 text-sm border-t border-[#050811]">
        <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <img src="/crew-new.png" alt="Crew HRMS Logo" className="h-10 w-auto object-contain brightness-0 invert opacity-90" />
          </div>
          <p>© {new Date().getFullYear()} Crew Enterprise. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
