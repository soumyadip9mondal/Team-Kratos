import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import Alert from '../components/ui/Alert';
import OTPVerification from '../components/shared/OTPVerification';
import ForgotPassword from '../components/shared/ForgotPassword';

export default function UniversalAuth({ defaultIsSignUp = false }) {
  const [isSignUp, setIsSignUp] = useState(defaultIsSignUp);
  const navigate = useNavigate();
  const location = useLocation();

  // Login State
  const [identifier, setIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Signup State
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    phone: '',
    department: '',
    password: '',
    confirmPassword: ''
  });
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupConfirmPassword, setShowSignupConfirmPassword] = useState(false);
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupError, setSignupError] = useState('');
  const [showLongLoading, setShowLongLoading] = useState(false);

  // OTP State
  const [showVerifyOTP, setShowVerifyOTP] = useState(false);
  const [tempAuthData, setTempAuthData] = useState(null);

  // Forgot Password State
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  useEffect(() => {
    let timeoutId;
    if (loginLoading || signupLoading) {
      timeoutId = setTimeout(() => {
        setShowLongLoading(true);
      }, 5000);
    } else {
      setShowLongLoading(false);
    }
    return () => clearTimeout(timeoutId);
  }, [loginLoading, signupLoading]);

  useEffect(() => {
    // If user is already authenticated with valid token & user, redirect to /dashboard
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
      try {
        const u = JSON.parse(userStr);
        if (u && u.id) {
          navigate('/dashboard', { replace: true });
        }
      } catch (_) {}
    }
  }, [navigate]);

  useEffect(() => {
    // If user navigates to /signup, switch to sign up panel, else login
    if (location.pathname === '/signup') {
      setIsSignUp(true);
    } else {
      setIsSignUp(false);
    }
  }, [location.pathname]);

  const togglePanel = (toSignUp) => {
    setIsSignUp(toSignUp);
    // Optionally update URL without reloading
    window.history.pushState(null, '', toSignUp ? '/signup' : '/login');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password: loginPassword })
      });
      
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (_) {
        data = { error: text || 'Login failed' };
      }
      
      if (!res.ok) throw new Error(data.error || 'Login failed');

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      if (data.requireOtp) {
        setTempAuthData(data);
        setShowVerifyOTP(true);
      } else if (data.user.mustChangePassword) {
        navigate('/change-password');
      } else {
        // Fallback if no OTP required and no password change required
        if (data.user.roleDefinition?.level === -1 || data.user.role === 'SuperAdmin') {
          navigate('/superadmin');
        } else {
          navigate('/dashboard');
        }
      }

    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSignupChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setSignupLoading(true);
    setSignupError('');

    if (formData.password !== formData.confirmPassword) {
      setSignupError('Passwords do not match');
      setSignupLoading(false);
      return;
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (_) {
        data = { error: text || 'Failed to sign up' };
      }
      
      if (!res.ok) throw new Error(data.error || 'Failed to sign up');

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      setTempAuthData(data);
      setShowVerifyOTP(true);

    } catch (err) {
      setSignupError(err.message);
    } finally {
      setSignupLoading(false);
    }
  };

  const handleOTPVerified = () => {
    setShowVerifyOTP(false);
    
    if (tempAuthData?.user?.mustChangePassword) {
      navigate('/change-password');
    } else if (tempAuthData?.user?.roleDefinition?.level === -1 || tempAuthData?.false) {
      navigate('/superadmin');
    } else {
      navigate('/dashboard');
    }
  };

  /* ── Shared input classname for consistent Doppelrand input styling ── */
  const inputBase = "w-full rounded-xl border border-[#EAE7E0] bg-[#FAF9F6] px-4 py-3 text-[#1D1B16] placeholder:text-[#9A948A] outline-none transition-all duration-[400ms] ease-[cubic-bezier(0.32,0.72,0,1)] focus:border-[#1F2B4D] focus:bg-white focus:ring-2 focus:ring-[#1F2B4D]/10 focus:shadow-xs";

  return (
    <div className="auth-page-bg mesh-bg relative">
      
      {/* 2FA OTP Modal Overlay */}
      {showVerifyOTP && tempAuthData && (
        <OTPVerification 
          user={tempAuthData.user} 
          onVerified={handleOTPVerified} 
        />
      )}

      {/* Forgot Password Modal Overlay */}
      {showForgotPassword && (
        <ForgotPassword onClose={() => setShowForgotPassword(false)} />
      )}

      {/* ── Executive Loading Overlay ── */}
      {(loginLoading || signupLoading) && !showLongLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#FAF9F6]/70 backdrop-blur-md transition-all">
          <div className="relative flex flex-col items-center justify-center">
            {/* Rings Container */}
            <div className="relative flex items-center justify-center w-28 h-28 mb-6">
              {/* Outer Glowing Ring */}
              <div className="absolute inset-0 rounded-full border-[3px] border-[#EAE7E0] border-t-[#1F2B4D] animate-spin"></div>
              {/* Inner Ring */}
              <div className="absolute inset-4 rounded-full border-[3px] border-[#EAE7E0] border-b-emerald-500 animate-[spin_1.5s_linear_reverse_infinite]"></div>
              {/* Center Logo */}
              <div className="absolute inset-0 flex items-center justify-center">
                <img src="/crew-new.png" alt="Crew HR Logo" className="h-12 w-auto object-contain animate-pulse drop-shadow-sm" />
              </div>
            </div>
            <div className="flex flex-col items-center">
              <span className="font-display font-bold text-[#1F2B4D] text-sm tracking-[0.2em] uppercase animate-pulse">
                {loginLoading ? 'Authenticating' : 'Initializing'}
              </span>
              <div className="flex gap-1.5 mt-3">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1F2B4D] animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#1F2B4D] animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#1F2B4D] animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Long Loading Toast */}
      {showLongLoading && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-[#FAF9F6]/60 backdrop-blur-sm p-4 transition-all">
          <div className="bg-white rounded-[24px] shadow-[0_1px_2px_rgba(29,27,22,0.04),0_8px_20px_rgba(29,27,22,0.06)] w-full max-w-sm overflow-hidden flex flex-col p-6 animate-in zoom-in-95 duration-200 border border-[#EAE7E0]">
            <div className="flex flex-col items-center text-center gap-4">
              <Loader2 size={36} className="animate-spin text-[#1F2B4D] shrink-0" />
              <div>
                <p className="font-display font-bold text-lg text-[#1D1B16]">Please wait...</p>
                <p className="text-sm mt-1 text-[#6B655C] font-medium">This is taking longer than usual. Hang tight!</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="auth-wrapper">
        <div className={`auth-container ${isSignUp ? 'right-panel-active' : ''}`}>
          
          {/* 1. SIGN UP PANEL */}
          <div className="auth-form-container sign-up-container">
            <form onSubmit={handleSignup} className="space-y-3.5">
              <div className="mb-4">
                <h1 className="text-3xl font-serif font-bold text-center text-[#1D1B16] mb-1.5 italic">Create Account</h1>
                <p className="text-center text-[#9A948A] text-xs font-medium">Join Crew and start your journey</p>
              </div>
              
              {signupError && <Alert type="error" message={signupError} className="mb-3" />}

              <input required name="displayName" type="text" placeholder="Full Name" value={formData.displayName} onChange={handleSignupChange} className={inputBase} />
              <input required name="email" type="email" placeholder="Email" value={formData.email} onChange={handleSignupChange} className={inputBase} />
              <input name="phone" type="tel" placeholder="Phone" value={formData.phone} onChange={handleSignupChange} className={inputBase} />
              <input required name="department" type="text" placeholder="Department" value={formData.department} onChange={handleSignupChange} className={inputBase} />
              
              <div className="flex flex-col gap-2">
                <div className="relative w-full">
                  <input required name="password" type={showSignupPassword ? "text" : "password"} placeholder="Password" value={formData.password} onChange={handleSignupChange} className={`${inputBase} pr-10`} />
                  <button type="button" onClick={() => setShowSignupPassword(!showSignupPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9A948A] hover:text-[#1F2B4D] transition-colors duration-300">
                    {showSignupPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {formData.password && (() => {
                  let score = 0;
                  if (formData.password.length >= 8) score++;
                  if (/[A-Z]/.test(formData.password)) score++;
                  if (/[a-z]/.test(formData.password)) score++;
                  if (/[0-9]/.test(formData.password)) score++;
                  if (/[^A-Za-z0-9]/.test(formData.password)) score++;
                  
                  let label = 'Weak';
                  let colorClass = 'bg-rose-500';
                  if (score >= 3) { label = 'Medium'; colorClass = 'bg-amber-500'; }
                  if (score >= 5) { label = 'Strong'; colorClass = 'bg-emerald-500'; }
                  
                  return (
                    <div className="flex items-center gap-2 px-1">
                      <div className="flex-1 h-1.5 bg-[#EAE7E0] rounded-full overflow-hidden">
                        <div className={`h-full ${colorClass} transition-all duration-[500ms] ease-[cubic-bezier(0.32,0.72,0,1)]`} style={{ width: `${(score/5)*100}%` }}></div>
                      </div>
                      <span className="text-xs font-display font-medium text-[#6B655C]">{label}</span>
                    </div>
                  );
                })()}

                <div className="relative w-full mt-1">
                  <input required name="confirmPassword" type={showSignupConfirmPassword ? "text" : "password"} placeholder="Confirm Password" value={formData.confirmPassword} onChange={handleSignupChange} className={`${inputBase} pr-10 ${formData.confirmPassword ? (formData.password === formData.confirmPassword ? '!border-emerald-400 focus:!border-emerald-400' : '!border-rose-400 focus:!border-rose-400') : ''}`} />
                  <button type="button" onClick={() => setShowSignupConfirmPassword(!showSignupConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9A948A] hover:text-[#1F2B4D] transition-colors duration-300">
                    {showSignupConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {formData.confirmPassword && (
                  <div className={`text-xs px-1 font-medium ${formData.password === formData.confirmPassword ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {formData.password === formData.confirmPassword ? 'Passwords match' : 'Passwords do not match'}
                  </div>
                )}
              </div>
              
              <button type="submit" disabled={signupLoading} className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#1F2B4D] px-4 py-3.5 font-display font-bold text-white hover:bg-[#141C33] transition-all duration-[500ms] ease-[cubic-bezier(0.32,0.72,0,1)] disabled:opacity-60 disabled:cursor-wait shadow-[0_4px_12px_rgba(31,43,77,0.15)] hover:shadow-[0_8px_24px_rgba(31,43,77,0.25)] active:scale-[0.98]">
                {signupLoading ? 'Creating Account...' : 'Sign Up'}
              </button>

              {/* Mobile toggle link */}
              <div className="mt-4 text-center md:hidden">
                <button type="button" onClick={() => togglePanel(false)} className="text-sm text-[#6B655C]">
                  Already have an account? <span className="text-[#1F2B4D] font-bold">Sign In</span>
                </button>
              </div>
            </form>
          </div>

          {/* 2. SIGN IN PANEL */}
          <div className="auth-form-container sign-in-container">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="mb-6">
                <h1 className="text-3xl font-serif font-bold text-center text-[#1D1B16] mb-1.5 italic">Welcome Back</h1>
                <p className="text-center text-[#9A948A] text-xs font-medium">Enter your credentials to continue</p>
              </div>
              
              {loginError && <Alert type="error" message={loginError} className="mb-4" />}

              <input required type="text" placeholder="Login Id / Email" value={identifier} onChange={(e) => setIdentifier(e.target.value)} className={inputBase} />
              
              <div className="relative w-full">
                <input required type={showLoginPassword ? "text" : "password"} placeholder="Password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className={`${inputBase} pr-10`} />
                <button type="button" onClick={() => setShowLoginPassword(!showLoginPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9A948A] hover:text-[#1F2B4D] transition-colors duration-300">
                  {showLoginPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>

              <div className="flex justify-end w-full">
                <button type="button" onClick={() => setShowForgotPassword(true)} className="text-sm text-[#1F2B4D] font-display font-bold hover:underline transition-all">
                  Forgot Password?
                </button>
              </div>
              
              <button type="submit" disabled={loginLoading} className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#1F2B4D] px-4 py-3.5 mt-2 font-display font-bold text-white hover:bg-[#141C33] transition-all duration-[500ms] ease-[cubic-bezier(0.32,0.72,0,1)] disabled:opacity-60 disabled:cursor-wait shadow-[0_4px_12px_rgba(31,43,77,0.15)] hover:shadow-[0_8px_24px_rgba(31,43,77,0.25)] active:scale-[0.98]">
                {loginLoading ? 'Signing In...' : 'Sign In'}
              </button>

              {/* Mobile toggle link */}
              <div className="mt-4 text-center md:hidden">
                <button type="button" onClick={() => togglePanel(true)} className="text-sm text-[#6B655C]">
                  Don't have an account? <span className="text-[#1F2B4D] font-bold">Sign Up</span>
                </button>
              </div>

            </form>
          </div>

          {/* 3. DESKTOP OVERLAY CONTAINER (Hidden on Mobile) */}
          <div className="auth-overlay-container hidden md:block">
            <div className="auth-overlay mesh-bg">
              
              {/* Left Overlay (Shown when signing up) */}
              <div className="auth-overlay-panel auth-overlay-left">
                <h2 className="text-3xl font-serif font-bold mb-4 italic">Welcome Back!</h2>
                <p className="text-sm mb-8 text-white/70 font-medium">To keep connected with us please login with your personal info</p>
                <button onClick={() => togglePanel(false)} className="rounded-xl border-2 border-white/40 hover:border-white px-12 py-3 font-display font-bold text-white hover:bg-white hover:text-[#1F2B4D] transition-all duration-[500ms] ease-[cubic-bezier(0.32,0.72,0,1)] shadow-xs active:scale-[0.97]">
                  Sign In
                </button>
              </div>
              
              {/* Right Overlay (Shown when signing in) */}
              <div className="auth-overlay-panel auth-overlay-right">
                <h2 className="text-3xl font-serif font-bold mb-4 italic">Hello, Friend!</h2>
                <p className="text-sm mb-8 text-white/70 font-medium">Enter your personal details and start your journey with us</p>
                <button onClick={() => togglePanel(true)} className="rounded-xl border-2 border-white/40 hover:border-white px-12 py-3 font-display font-bold text-white hover:bg-white hover:text-[#1F2B4D] transition-all duration-[500ms] ease-[cubic-bezier(0.32,0.72,0,1)] shadow-xs active:scale-[0.97]">
                  Sign Up
                </button>
              </div>

            </div>
          </div>

        </div>

        {/* Company Registration Link (Outside the main container) */}
        <div className="absolute -bottom-16 left-0 right-0 text-center">
          <p className="text-sm text-[#6B655C] font-medium bg-white/50 backdrop-blur-md inline-block px-6 py-2 rounded-full shadow-xs border border-[#EAE7E0]">
            New here? <a href={import.meta.env.VITE_MARKETING_URL || "http://localhost:3001"} className="text-[#1F2B4D] font-bold hover:underline transition-all ml-1">Register your company</a>
          </p>
        </div>
      </div>
    </div>
  );
}
