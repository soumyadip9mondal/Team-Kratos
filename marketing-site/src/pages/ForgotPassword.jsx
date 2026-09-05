import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { 
  Mail, KeyRound, Lock, ArrowRight, ArrowLeft, 
  CheckCircle2, AlertCircle, Sparkles, ShieldCheck 
} from 'lucide-react';

export default function ForgotPassword() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to request reset');
      
      setMessage(data.message || 'If the email exists, an OTP has been sent.');
      toast.success(data.message || 'OTP sent successfully');
      setStep(2);
    } catch (err) {
      setError(err.message);
      toast.error(err.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtpAndReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    if (step === 2) {
      if (!otp || otp.length !== 6) {
        setError("Please enter the 6-digit OTP");
        setLoading(false);
        return;
      }
      
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/auth/verify-reset-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, otp })
        });
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error || 'Invalid OTP');
        
        setStep(3);
        setMessage("OTP Verified. Please enter your new password.");
        toast.success('OTP Verified');
      } catch (err) {
        setError(err.message);
        toast.error(err.message || 'OTP Verification Failed');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Step 3 logic
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to reset password');
      
      setMessage('Password successfully reset! Redirecting to login...');
      toast.success('Password successfully reset!');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.message);
      toast.error(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#1D1B16] font-sans antialiased selection:bg-[#1F2B4D] selection:text-white flex flex-col justify-between">
      
      {/* Top Bar Navigation (Fixed Top Header Wrapper) */}
      <div className="sticky top-0 z-50 bg-[#FAF9F6] pt-4 pb-2 px-4 sm:px-6 md:px-10 w-full">
        <nav className="w-full max-w-5xl mx-auto flex items-center justify-between py-3.5 px-4 sm:px-6 rounded-2xl bg-white border border-[#EAE7E0] shadow-[0_1px_2px_rgba(29,27,22,0.04)]">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="p-2 rounded-xl bg-[#F4F1EA] border border-[#EAE7E0] group-hover:border-[#1F2B4D]/30 transition-all">
              <img src="/crew-new.png" alt="Crew HR Logo" className="h-9 w-auto object-contain" />
            </div>
            <div>
              <span className="font-heading font-extrabold text-[#1D1B16] text-base tracking-tight block leading-none">Crew HRMS</span>
              <span className="text-[10px] text-[#9A948A] font-semibold uppercase tracking-wider block mt-0.5">Security Portal</span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#0F172A] text-white border border-slate-700/60 text-xs font-bold shadow-xs">
              <ShieldCheck size={13} className="text-emerald-400" /> Executive Access
            </span>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#FAF9F6] text-[#6B655C] hover:text-[#1D1B16] border border-[#EAE7E0] hover:bg-[#F4F1EA] text-xs font-semibold transition-all cursor-pointer"
            >
              <ArrowLeft size={14} /> Back to Login
            </Link>
          </div>
        </nav>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 flex items-center justify-center py-10 px-4">
        <div className="w-full max-w-md">
          {/* Doppelrand Container (Double Bezel Architecture) */}
          <div className="rounded-[32px] bg-[#F4F1EA] p-4 sm:p-5 border border-[#EAE7E0] shadow-sm">
            <div className="rounded-[22px] bg-white p-6 sm:p-8 border border-[#E2E8F0] shadow-xs">
              
              {/* Badge & Title */}
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F4F1EA] text-[#1F2B4D] border border-[#EAE7E0] text-[11px] font-bold tracking-wider uppercase mb-3">
                  <Sparkles size={12} /> RECOVERY MODE
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1D1B16] tracking-tight">Account Recovery</h1>
                <p className="text-[#6B655C] text-xs sm:text-sm mt-1.5 leading-relaxed">
                  {step === 1 && "Enter your enterprise email to generate a secure one-time passcode."}
                  {step === 2 && `Enter the 6-digit verification code dispatched to ${email}`}
                  {step === 3 && "Construct your new credentials to restore workspace authorization."}
                </p>
              </div>

              {/* Error Banner */}
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2.5"
                >
                  <AlertCircle className="shrink-0 text-rose-600" size={16} />
                  <span>{error}</span>
                </motion.div>
              )}

              {/* Success Message Banner */}
              {message && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2.5"
                >
                  <CheckCircle2 className="shrink-0 text-emerald-600" size={16} />
                  <span>{message}</span>
                </motion.div>
              )}

              {/* Step 1: Send OTP */}
              {step === 1 && (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#6B655C] mb-2">
                      Enterprise Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9A948A]" size={18} />
                      <input
                        required
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@company.com"
                        className="w-full pl-10 pr-4 py-3 bg-[#FAF9F6] border border-[#EAE7E0] rounded-xl text-sm font-medium text-[#1D1B16] placeholder-[#9A948A] outline-none focus:border-[#1F2B4D] focus:bg-white focus:ring-2 focus:ring-[#1F2B4D]/15 transition-all"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 px-6 rounded-xl bg-[#1F2B4D] hover:bg-[#141C33] active:scale-[0.99] text-white text-sm font-bold transition-all duration-200 shadow-sm flex items-center justify-center gap-2 group disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>Send Security OTP</span>
                        <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center group-hover:translate-x-1 transition-transform">
                          <ArrowRight size={14} />
                        </div>
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Step 2 & 3: Verify OTP & New Password */}
              {step > 1 && (
                <form onSubmit={handleVerifyOtpAndReset} className="space-y-4">
                  {step === 2 && (
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#6B655C] mb-2">
                        6-Digit Verification OTP
                      </label>
                      <div className="relative">
                        <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9A948A]" size={18} />
                        <input
                          required
                          type="text"
                          maxLength={6}
                          value={otp}
                          onChange={(e) => setOtp(e.target.value)}
                          placeholder="000000"
                          className="w-full pl-10 pr-4 py-3 bg-[#FAF9F6] border border-[#EAE7E0] rounded-xl text-center text-lg font-bold tracking-[0.4em] text-[#1D1B16] placeholder-[#9A948A] outline-none focus:border-[#1F2B4D] focus:bg-white focus:ring-2 focus:ring-[#1F2B4D]/15 transition-all"
                        />
                      </div>
                    </div>
                  )}

                  {step === 3 && (
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#6B655C] mb-2">
                        New Security Password
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9A948A]" size={18} />
                        <input
                          required
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="••••••••••••"
                          className="w-full pl-10 pr-4 py-3 bg-[#FAF9F6] border border-[#EAE7E0] rounded-xl text-sm font-medium text-[#1D1B16] placeholder-[#9A948A] outline-none focus:border-[#1F2B4D] focus:bg-white focus:ring-2 focus:ring-[#1F2B4D]/15 transition-all"
                        />
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 px-6 rounded-xl bg-[#1F2B4D] hover:bg-[#141C33] active:scale-[0.99] text-white text-sm font-bold transition-all duration-200 shadow-sm flex items-center justify-center gap-2 group disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>{step === 2 ? 'Verify Code' : 'Update Credentials'}</span>
                        <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center group-hover:translate-x-1 transition-transform">
                          <ArrowRight size={14} />
                        </div>
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Footer navigation */}
              <div className="mt-6 pt-5 border-t border-[#EAE7E0] text-center">
                <button
                  onClick={() => navigate('/login')}
                  className="text-xs font-bold text-[#1F2B4D] hover:underline cursor-pointer"
                >
                  Return to Console Sign In
                </button>
              </div>

            </div>
          </div>
        </div>
      </main>


    </div>
  );
}
