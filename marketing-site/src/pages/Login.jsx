import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { login, setSession, verifyOtp } from '@crew/auth-client';
import toast from 'react-hot-toast';
import { 
  Loader2, Mail, Lock, Eye, EyeOff, ShieldCheck, ArrowRight, 
  ArrowLeft, Crown, Sparkles, KeyRound, AlertCircle 
} from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [tempAuthData, setTempAuthData] = useState(null);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const data = await login(API_BASE, email, password, window.location.origin, 'console');
      
      if (data.requireOtp) {
        setTempAuthData(data);
        setShowOtp(true);
        toast.success('OTP sent to your email');
      } else {
        setSession(data.token, data.user);
        toast.success('Login successful');
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message);
      toast.error(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const data = await verifyOtp(API_BASE, tempAuthData.token, otpCode);
      
      setSession(data.token, data.user);
      toast.success('Verification successful');
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
      toast.error(err.message || 'OTP Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#1D1B16] flex flex-col justify-between font-sans selection:bg-[#F0F3F9] selection:text-[#1F2B4D]">
      
      {/* Top Bar Navigation (Fixed Top Header Wrapper) */}
      <div className="sticky top-0 z-50 bg-[#FAF9F6] pt-4 pb-2 px-4 sm:px-6 md:px-10 w-full">
        <nav className="w-full max-w-5xl mx-auto flex items-center justify-between py-3.5 px-4 sm:px-6 rounded-2xl bg-white border border-[#EAE7E0] shadow-[0_1px_2px_rgba(29,27,22,0.04)]">
          <Link to="/" replace className="flex items-center gap-3 group">
            <div className="p-2 rounded-xl bg-[#F4F1EA] border border-[#EAE7E0] group-hover:border-[#1F2B4D]/30 transition-all">
              <img src="/crew-new.png" alt="Crew HR Logo" className="h-9 w-auto object-contain" />
            </div>
            <div>
              <span className="font-heading font-extrabold text-[#1D1B16] text-base tracking-tight block leading-none">Crew HRMS</span>
              <span className="text-[10px] text-[#9A948A] font-semibold uppercase tracking-wider block mt-0.5">Console Access</span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            {/* Executive C-Suite Rank Badge */}
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0F172A] text-white border border-slate-700/60 text-xs font-bold shadow-xs">
              <Crown className="w-3.5 h-3.5 text-slate-300" />
              Executive Console
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

      {/* Main Login Card */}
      <main className="w-full max-w-md mx-auto my-auto z-10 px-4 py-6">
        <motion.div 
          initial={{ opacity: 0, y: 15 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }} 
          className="w-full"
        >
          {/* Doppelrand Outer Shell Bezel */}
          <div className="rounded-[32px] bg-[#F4F1EA] border border-[#EAE7E0] shadow-[0_1px_2px_rgba(29,27,22,0.04),0_8px_20px_rgba(29,27,22,0.06)] p-3 sm:p-4 relative overflow-hidden">
            
            {/* Doppelrand Inner Core Surface */}
            <div className="rounded-[22px] bg-white border border-[#E2E8F0] p-7 sm:p-9 relative overflow-hidden shadow-xs">
              
              {/* Header */}
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F0F3F9] text-[#1F2B4D] text-xs font-bold mb-3 shadow-xs">
                  <ShieldCheck size={14} /> RESTRICTED CONSOLE PORTAL
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1D1B16] tracking-tight">
                  Console Login
                </h2>
                <p className="text-xs text-[#6B655C] mt-1.5">
                  Enter your master administrator credentials to access your organization's console.
                </p>
              </div>

              {/* Error Banner */}
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -8 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2.5"
                >
                  <AlertCircle className="shrink-0 text-rose-600" size={16} />
                  <span>{error}</span>
                </motion.div>
              )}

              {/* OTP Verification View */}
              {showOtp ? (
                <form onSubmit={handleVerifyOtp} className="space-y-5">
                  <div className="text-center">
                    <p className="text-xs text-[#6B655C] mb-3">
                      Enter the 6-digit authentication code sent to your email.
                    </p>
                    <div className="relative flex items-center rounded-xl bg-[#FAF9F6] border border-[#EAE7E0] focus-within:border-[#1F2B4D] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#1F2B4D]/20 transition-all">
                      <div className="pl-3.5 text-[#1F2B4D]"><KeyRound size={17} /></div>
                      <input 
                        type="text" 
                        required 
                        maxLength={6} 
                        placeholder="••••••" 
                        value={otpCode} 
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                        className="w-full bg-transparent text-[#1D1B16] placeholder:text-[#9A948A] px-3.5 py-3 text-center text-lg font-mono font-bold tracking-[0.4em] outline-none"
                      />
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    disabled={loading || otpCode.length !== 6}
                    className="relative group w-full rounded-xl bg-[#1F2B4D] hover:bg-[#141C33] text-white py-3.5 font-bold shadow-md hover:shadow-lg active:scale-[0.99] transition-all duration-300 flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin text-white" />
                    ) : (
                      <>
                        <span>Verify & Access Console</span>
                        <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center group-hover:translate-x-1 transition-transform">
                          <ArrowRight size={15} />
                        </div>
                      </>
                    )}
                  </button>
                </form>
              ) : (
                /* Login Form */
                <form onSubmit={handleLogin} className="space-y-4">
                  {/* Email Field */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#1D1B16] mb-1.5">
                      Email Address
                    </label>
                    <div className="relative flex items-center rounded-xl bg-[#FAF9F6] border border-[#EAE7E0] focus-within:border-[#1F2B4D] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#1F2B4D]/20 transition-all shadow-xs">
                      <div className="pl-3.5 pr-1 text-[#1F2B4D] shrink-0">
                        <Mail size={17} />
                      </div>
                      <input 
                        type="email" 
                        required 
                        value={email} 
                        onChange={(e) => setEmail(e.target.value)} 
                        placeholder="alex@company.com" 
                        className="w-full bg-transparent text-[#1D1B16] placeholder:text-[#9A948A] px-3.5 py-3 text-sm font-medium outline-none"
                      />
                    </div>
                  </div>

                  {/* Password Field */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#1D1B16] mb-1.5">
                      Password
                    </label>
                    <div className="relative flex items-center rounded-xl bg-[#FAF9F6] border border-[#EAE7E0] focus-within:border-[#1F2B4D] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#1F2B4D]/20 transition-all shadow-xs">
                      <div className="pl-3.5 pr-1 text-[#1F2B4D] shrink-0">
                        <Lock size={17} />
                      </div>
                      <input 
                        type={showPassword ? 'text' : 'password'} 
                        required 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                        placeholder="••••••••••••" 
                        className="w-full bg-transparent text-[#1D1B16] placeholder:text-[#9A948A] px-3.5 py-3 text-sm font-medium outline-none"
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowPassword(!showPassword)} 
                        className="pr-3.5 text-[#6B655C] hover:text-[#1D1B16] transition-colors cursor-pointer shrink-0"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Forgot Password Link */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-[#6B655C]">Admin privileges required</span>
                    <button 
                      type="button" 
                      onClick={() => navigate('/forgot-password')} 
                      className="text-xs font-bold text-[#1F2B4D] hover:underline cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  </div>

                  {/* Submit CTA Button */}
                  <div className="pt-2">
                    <button 
                      type="submit" 
                      disabled={loading}
                      className="relative group w-full rounded-xl bg-[#1F2B4D] hover:bg-[#141C33] text-white py-3.5 font-bold shadow-md hover:shadow-lg active:scale-[0.99] transition-all duration-300 flex items-center justify-center gap-3 cursor-pointer disabled:opacity-60"
                    >
                      {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin text-white" />
                      ) : (
                        <>
                          <span>Sign In to Console</span>
                          <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center group-hover:translate-x-1 transition-transform">
                            <ArrowRight size={15} />
                          </div>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* Bottom Register Redirect Prompt */}
              <div className="mt-6 pt-5 border-t border-[#EAE7E0] text-center text-xs text-[#6B655C]">
                Need a new company workspace?{' '}
                <Link to="/register" className="font-bold text-[#1F2B4D] hover:underline">
                  Create Workspace
                </Link>
              </div>

            </div>
          </div>
        </motion.div>
      </main>


    </div>
  );
}
