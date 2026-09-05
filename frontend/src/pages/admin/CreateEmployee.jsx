import React, { useState, useEffect, useRef } from 'react';
import { UserPlus, Copy, Check, Shield, ChevronDown, AlertCircle, Info, X } from 'lucide-react';
import { API_BASE } from '../../lib/api';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';

// System Role → numeric level mapping (mirrors backend)
const SYSTEM_ROLE_TO_LEVEL = { CEO: 0, SuperAdmin: 0, Admin: 1, Manager: 2, Employee: 3 };

// Get the level badge color based on role level (Premium Palette)
const getLevelColor = (level) => {
  if (level === 0) return 'bg-[#F0F3F9] text-[#1F2B4D] border-[#CBD5E1]'; // Exec Navy
  if (level === 1) return 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]'; // Emerald
  if (level === 2) return 'bg-[#FDF8F3] text-[#8C5722] border-[#EEDCCE]'; // Attention/Amber
  return 'bg-[#F4F1EA] text-[#6B655C] border-[#EAE7E0]'; // Standard Slate
};

const CreateEmployee = () => {
  const location = useLocation();
  const atsData = location.state?.ATSData || {};

  const [formData, setFormData] = useState(() => {
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    
    // Safely extract name from atsData, which might come in different shapes depending on ATS mapping
    const prefillName = atsData.name || atsData.candidateName || atsData.displayName || '';
    const prefillEmail = atsData.email || atsData.candidateEmail || '';
    const prefillPhone = atsData.phone || atsData.contactNumber || '';
    const prefillJob = atsData.jobPosition || atsData.appliedRole || atsData.jobTitle || '';
    const prefillDept = atsData.department || '';

    return {
      email: prefillEmail,
      displayName: prefillName,
      customRole: '',
      department: prefillDept,
      phone: prefillPhone,
      jobPosition: prefillJob,
      gender: atsData.gender || 'Male',
      location: atsData.location || atsData.city || '',
      entityId: '',
      officeId: storedUser.officeId || '',
      workingDaysPerWeek: 6,
      breakTimeHrs: 1.0
    };
  });

  const [legalEntities, setLegalEntities] = useState([]);
  const [tenantRoles, setTenantRoles] = useState([]);
  const [assignableRoles, setAssignableRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [rolesError, setRolesError] = useState('');
  const [departments, setDepartments] = useState([]);
  const [offices, setOffices] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState(null);
  const [copied, setCopied] = useState(false);

  const containerRef = useRef(null);

  // GSAP Choreographed Intro Sequence (Safely Guarded Target Selectors)
  useGSAP(() => {
    if (rolesLoading) return;

    const container = containerRef.current;
    if (!container) return;

    const introHeader = container.querySelector('.intro-header');
    const introFormContainer = container.querySelector('.intro-form-container');
    const introFormGroups = container.querySelectorAll('.intro-form-group');
    const introHierarchy = container.querySelector('.intro-hierarchy');

    const tl = gsap.timeline({ defaults: { ease: "power4.out" } });

    if (introHeader) tl.from(introHeader, { y: -20, opacity: 0, duration: 0.6 });
    if (introFormContainer) tl.from(introFormContainer, { scale: 0.95, opacity: 0, duration: 0.6, clearProps: "all" }, "-=0.3");
    if (introFormGroups.length > 0) tl.from(introFormGroups, { y: 15, opacity: 0, duration: 0.4, stagger: 0.08, clearProps: "all" }, "-=0.3");
    if (introHierarchy) tl.from(introHierarchy, { y: 15, opacity: 0, duration: 0.4, clearProps: "all" }, "-=0.2");

  }, { dependencies: [rolesLoading], scope: containerRef });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const headers = { 'Authorization': `Bearer ${token}` };

    Promise.all([
      fetch(`${API_BASE}/api/tenant-settings/legal-entities`, { headers }).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/api/tenant-settings/roles`, { headers }).then(r => r.ok ? r.json() : null),
      fetch(`${API_BASE}/api/console/offices`, { headers }).then(r => r.ok ? r.json() : [])
    ]).then(([entities, rolesData, officesData]) => {
      setLegalEntities(entities || []);
      setOffices(officesData || []);

      if (!rolesData || !Array.isArray(rolesData.customRoles)) {
        setRolesError('No role hierarchy found. Please ask the company owner to configure roles in registration.');
        setRolesLoading(false);
        return;
      }

      const allRoles = rolesData.customRoles;
      setTenantRoles(allRoles);
      setDepartments(rolesData.departments || []);

      const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      const inviterLevel = storedUser.roleDefinition?.level ?? 99;

      const allowed = allRoles.filter(r => inviterLevel === 0 || r.level > inviterLevel);

      setAssignableRoles(allowed);

      if (allowed.length > 0) {
        const sorted = [...allowed].sort((a, b) => b.level - a.level);
        setFormData(prev => ({ ...prev, customRole: sorted[0].name }));
      }

      setRolesLoading(false);
    }).catch(err => {
      console.error('Failed to load tenant configuration:', err);
      setRolesError('Failed to load role configuration. Please refresh the page.');
      setRolesLoading(false);
    });
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessData(null);
    setCopied(false);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create employee');
      }

      setSuccessData(data);
      setFormData(prev => ({ 
        ...prev,
        email: '', displayName: '', department: '', 
        phone: '', jobPosition: '', gender: 'Male', location: '', entityId: '', officeId: '',
        workingDaysPerWeek: 6, breakTimeHrs: 1.0 
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    const textToCopy = `Email: ${successData.user.email}\nEmployee ID: ${successData.user.employeeId}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const selectedRoleDef = tenantRoles.find(r => r.name === formData.customRole);

  const alertVariants = {
    hidden: { opacity: 0, y: -10, scale: 0.98, height: 0, marginBottom: 0 },
    visible: { opacity: 1, y: 0, scale: 1, height: 'auto', marginBottom: 12, transition: { type: 'spring', stiffness: 260, damping: 20 } },
    exit: { opacity: 0, scale: 0.98, height: 0, marginBottom: 0, transition: { duration: 0.2 } }
  };

  return (
    <div ref={containerRef} className="w-full min-h-full flex flex-col gap-3.5 sm:gap-4 p-3 sm:p-5 md:p-6 bg-[#FAF9F6]">
      <div className="w-full max-w-5xl mx-auto flex flex-col gap-3.5 sm:gap-4">
        
        {/* ── TOP EXECUTIVE HEADER ── */}
        <div className="intro-header flex flex-col min-[600px]:flex-row min-[600px]:items-center justify-between gap-2.5 pb-3 border-b border-[#EAE7E0] w-full">
          <div>
            <h1 className="font-serif font-bold text-lg sm:text-2xl md:text-3xl text-[#1F2B4D] tracking-tight leading-tight flex items-center gap-2.5">
              <div className="p-1.5 bg-white rounded-xl shadow-2xs border border-[#EAE7E0]">
                <UserPlus className="text-[#1F2B4D] w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <span>Add New Employee</span>
            </h1>
            <p className="text-[#6B655C] mt-0.5 text-xs sm:text-sm font-medium">
              Create an account for a new team member. Roles are defined by your company's organizational structure.
            </p>
          </div>
        </div>

        {/* Dynamic Alerts */}
        <AnimatePresence mode="popLayout">
          {rolesLoading && (
            <motion.div variants={alertVariants} initial="hidden" animate="visible" exit="exit" className="p-3.5 sm:p-4 bg-white rounded-2xl border border-[#EAE7E0] shadow-2xs flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-[#1F2B4D] border-t-transparent rounded-full animate-spin shrink-0" />
              <span className="text-xs font-bold text-[#1F2B4D]">Loading company role hierarchy...</span>
            </motion.div>
          )}

          {error && (
            <motion.div variants={alertVariants} initial="hidden" animate="visible" exit="exit" className="p-3.5 sm:p-4 bg-rose-50 rounded-2xl border border-rose-200 flex items-start gap-2.5 shadow-2xs relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-600" />
              <AlertCircle size={18} className="shrink-0 mt-0.5 text-rose-700" />
              <div className="flex-1">
                <span className="font-bold text-rose-800 text-xs sm:text-sm">Creation Failed</span>
                <p className="text-xs text-rose-700 font-medium mt-0.5 leading-relaxed">{error}</p>
              </div>
              <button type="button" onClick={() => setError('')} className="p-1 text-rose-700 hover:text-rose-900"><X size={16}/></button>
            </motion.div>
          )}

          {successData && (
            <motion.div variants={alertVariants} initial="hidden" animate="visible" exit="exit" className="p-4 sm:p-5 bg-white rounded-2xl border border-emerald-200 shadow-2xs flex flex-col sm:flex-row items-start gap-3 relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />
              <div className="bg-emerald-50 p-2 rounded-xl text-emerald-700 shrink-0 border border-emerald-200">
                <Check size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-emerald-800 font-serif font-bold text-sm sm:text-base tracking-tight">🎉 Employee Created Successfully!</h3>
                <p className="text-emerald-700 text-xs mt-0.5 font-medium">
                  Login credentials have been securely dispatched to the employee's email.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <div className="text-xs font-mono font-bold bg-[#FAF8F5] border border-[#EAE7E0] px-3 py-1.5 rounded-xl text-[#1F2B4D]">
                    <span className="text-[#6B655C] font-sans font-medium">Email:</span> {successData.user?.email}
                  </div>
                  <div className="text-xs font-mono font-bold bg-[#FAF8F5] border border-[#EAE7E0] px-3 py-1.5 rounded-xl text-[#1F2B4D]">
                    <span className="text-[#6B655C] font-sans font-medium">ID:</span> {successData.user?.employeeId}
                  </div>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 text-[10px] font-display font-bold uppercase tracking-wider text-[#1F2B4D] hover:bg-[#1F2B4D] hover:text-white bg-[#F0F3F9] border border-[#CBD5E1] px-3 py-1.5 rounded-xl transition-all shadow-2xs"
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    <span>{copied ? 'Copied!' : 'Copy Info'}</span>
                  </button>
                </div>
              </div>
              <button type="button" onClick={() => setSuccessData(null)} className="p-1 text-[#6B655C] hover:text-[#1F2B4D] self-end sm:self-start"><X size={16}/></button>
            </motion.div>
          )}

          {rolesError && !rolesLoading && (
            <motion.div variants={alertVariants} initial="hidden" animate="visible" exit="exit" className="p-3.5 sm:p-4 bg-amber-50 rounded-2xl border border-amber-200 flex items-start gap-2.5 shadow-2xs relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-600" />
              <AlertCircle size={18} className="shrink-0 mt-0.5 text-amber-700" />
              <div>
                <p className="text-xs sm:text-sm font-bold text-amber-800">Role Configuration Missing</p>
                <p className="text-xs font-medium text-amber-700 mt-0.5">{rolesError}</p>
              </div>
            </motion.div>
          )}

          {offices.length === 0 && !rolesLoading && (
            <motion.div variants={alertVariants} initial="hidden" animate="visible" exit="exit" className="p-3.5 sm:p-4 bg-rose-50 rounded-2xl border border-rose-200 flex flex-col sm:flex-row items-start gap-2.5 shadow-2xs relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-600" />
              <AlertCircle size={18} className="shrink-0 mt-0.5 text-rose-700" />
              <div className="flex-1">
                <p className="text-xs sm:text-sm font-bold text-rose-800">No Office Branches Found</p>
                <p className="text-xs font-medium text-rose-700 mt-0.5 mb-2 leading-relaxed">
                  You must create at least 1 Office Branch in Organization Settings before you can add employees.
                </p>
                <button
                  type="button"
                  onClick={() => window.open(`${import.meta.env.VITE_MARKETING_URL || 'http://localhost:3001'}/dashboard?tab=offices`, '_blank')}
                  className="bg-rose-700 hover:bg-rose-800 text-white px-3.5 py-1.5 rounded-xl text-[10px] font-display font-bold uppercase tracking-wider transition-colors shadow-2xs inline-flex items-center gap-1.5"
                >
                  <span>Configure Offices</span> <span>→</span>
                </button>
              </div>
            </motion.div>
          )}

          {!rolesLoading && !rolesError && assignableRoles.length > 0 && (
            <motion.div variants={alertVariants} initial="hidden" animate="visible" exit="exit" className="p-3.5 sm:p-4 bg-white rounded-2xl border border-[#EAE7E0] flex items-start gap-2.5 shadow-2xs">
              <Info size={18} className="shrink-0 mt-0.5 text-[#1F2B4D]" />
              <div>
                <p className="text-xs sm:text-sm font-bold text-[#1F2B4D]">Company-Defined Roles</p>
                <p className="text-xs text-[#6B655C] font-medium mt-0.5 leading-relaxed">
                  Assignable roles for your permission level: <strong className="text-[#1F2B4D]">{assignableRoles.map(r => r.name).join(', ')}</strong>
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── MAIN FORM CONTAINER (DOPPELRAND) ── */}
        <div className="intro-form-container double-bezel-outer bg-[#F4F1EA] p-1 rounded-2xl w-full">
          <div className="double-bezel-inner bg-white rounded-xl p-3.5 sm:p-6 md:p-8 w-full">
            
            <form onSubmit={handleSubmit} className="flex flex-col gap-6 sm:gap-8">
              
              {/* Primary Details Fieldset */}
              <div className="intro-form-group">
                <h3 className="text-[10px] font-display font-bold text-[#6B655C] uppercase tracking-wider mb-3 pb-2 border-b border-[#F4F1EA]">Primary Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-[10px] font-display font-bold text-[#6B655C] uppercase tracking-wider mb-1">Full Name</label>
                    <input 
                      type="text" name="displayName" value={formData.displayName} onChange={handleChange}
                      placeholder="John Doe" required
                      className="w-full px-3 py-2 bg-white border border-[#EAE7E0] rounded-xl focus:ring-2 focus:ring-[#1F2B4D] outline-none text-[#1F2B4D] text-xs font-bold transition-all placeholder:text-[#9A948A]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-display font-bold text-[#6B655C] uppercase tracking-wider mb-1">Email Address</label>
                    <input 
                      type="email" name="email" value={formData.email} onChange={handleChange}
                      placeholder="john.doe@company.com" required
                      className="w-full px-3 py-2 bg-white border border-[#EAE7E0] rounded-xl focus:ring-2 focus:ring-[#1F2B4D] outline-none text-[#1F2B4D] text-xs font-bold transition-all placeholder:text-[#9A948A]"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-display font-bold text-[#6B655C] uppercase tracking-wider mb-1">Phone Number</label>
                    <input 
                      type="tel" name="phone" value={formData.phone} onChange={handleChange}
                      placeholder="+1 (555) 000-0000" required
                      className="w-full px-3 py-2 bg-white border border-[#EAE7E0] rounded-xl focus:ring-2 focus:ring-[#1F2B4D] outline-none text-[#1F2B4D] text-xs font-bold transition-all placeholder:text-[#9A948A]"
                    />
                  </div>
                </div>
              </div>

              {/* Employment Details Fieldset */}
              <div className="intro-form-group">
                <h3 className="text-[10px] font-display font-bold text-[#6B655C] uppercase tracking-wider mb-3 pb-2 border-b border-[#F4F1EA]">Employment Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-[10px] font-display font-bold text-[#6B655C] uppercase tracking-wider mb-1">Department</label>
                    {departments.length > 0 ? (
                      <select
                        name="department" value={formData.department} onChange={handleChange}
                        className="w-full px-3 py-2 bg-white border border-[#EAE7E0] rounded-xl focus:ring-2 focus:ring-[#1F2B4D] outline-none text-[#1F2B4D] text-xs font-bold transition-all"
                      >
                        <option value="" disabled>Select Department...</option>
                        {departments.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    ) : (
                      <input 
                        type="text" name="department" value={formData.department} onChange={handleChange}
                        placeholder="Engineering" required
                        className="w-full px-3 py-2 bg-white border border-[#EAE7E0] rounded-xl focus:ring-2 focus:ring-[#1F2B4D] outline-none text-[#1F2B4D] text-xs font-bold transition-all placeholder:text-[#9A948A]"
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-[10px] font-display font-bold text-[#6B655C] uppercase tracking-wider mb-1">Job Position / Title</label>
                    <input 
                      type="text" name="jobPosition" value={formData.jobPosition} onChange={handleChange}
                      placeholder="Senior Developer" required
                      className="w-full px-3 py-2 bg-white border border-[#EAE7E0] rounded-xl focus:ring-2 focus:ring-[#1F2B4D] outline-none text-[#1F2B4D] text-xs font-bold transition-all placeholder:text-[#9A948A]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-display font-bold text-[#6B655C] uppercase tracking-wider mb-1">Work Location</label>
                    <input 
                      type="text" name="location" value={formData.location} onChange={handleChange}
                      placeholder="Mumbai HQ / Remote" required
                      className="w-full px-3 py-2 bg-white border border-[#EAE7E0] rounded-xl focus:ring-2 focus:ring-[#1F2B4D] outline-none text-[#1F2B4D] text-xs font-bold transition-all placeholder:text-[#9A948A]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-display font-bold text-[#6B655C] uppercase tracking-wider mb-1">Company / Subsidiary</label>
                    <select 
                      name="entityId" value={formData.entityId} onChange={handleChange}
                      className="w-full px-3 py-2 bg-white border border-[#EAE7E0] rounded-xl focus:ring-2 focus:ring-[#1F2B4D] outline-none text-[#1F2B4D] text-xs font-bold transition-all"
                    >
                      <option value="">Unassigned (Default)</option>
                      {legalEntities.map(entity => (
                        <option key={entity.id} value={entity.id}>{entity.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-display font-bold text-[#6B655C] uppercase tracking-wider mb-1">Office / Branch</label>
                    <select 
                      name="officeId" value={formData.officeId} onChange={handleChange} required
                      className="w-full px-3 py-2 bg-white border border-[#EAE7E0] rounded-xl focus:ring-2 focus:ring-[#1F2B4D] outline-none text-[#1F2B4D] text-xs font-bold transition-all"
                    >
                      <option value="" disabled>Select a branch...</option>
                      {offices.map(office => (
                        <option key={office.id} value={office.id}>{office.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Specs Fieldset */}
              <div className="intro-form-group">
                <h3 className="text-[10px] font-display font-bold text-[#6B655C] uppercase tracking-wider mb-3 pb-2 border-b border-[#F4F1EA]">Schedules & Demographics</h3>
                <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-[10px] font-display font-bold text-[#6B655C] uppercase tracking-wider mb-1">Working Days / Week</label>
                    <input 
                      type="number" min="1" max="7" name="workingDaysPerWeek" value={formData.workingDaysPerWeek} onChange={handleChange}
                      required
                      className="w-full px-3 py-2 bg-white border border-[#EAE7E0] rounded-xl focus:ring-2 focus:ring-[#1F2B4D] outline-none text-[#1F2B4D] text-xs font-bold transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-display font-bold text-[#6B655C] uppercase tracking-wider mb-1">Daily Break Time (Hrs)</label>
                    <input 
                      type="number" step="0.5" min="0" max="4" name="breakTimeHrs" value={formData.breakTimeHrs} onChange={handleChange}
                      required
                      className="w-full px-3 py-2 bg-white border border-[#EAE7E0] rounded-xl focus:ring-2 focus:ring-[#1F2B4D] outline-none text-[#1F2B4D] text-xs font-bold transition-all"
                    />
                  </div>
                  <div className="min-[480px]:col-span-2 lg:col-span-1">
                    <label className="block text-[10px] font-display font-bold text-[#6B655C] uppercase tracking-wider mb-1">Gender</label>
                    <select 
                      name="gender" value={formData.gender} onChange={handleChange}
                      className="w-full px-3 py-2 bg-white border border-[#EAE7E0] rounded-xl focus:ring-2 focus:ring-[#1F2B4D] outline-none text-[#1F2B4D] text-xs font-bold transition-all"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Role Assignment Fieldset */}
              <div className="intro-form-group">
                <h3 className="text-[10px] font-display font-bold text-[#6B655C] uppercase tracking-wider mb-3 pb-2 border-b border-[#F4F1EA] flex items-center gap-1.5">
                  <Shield size={14} className="text-[#1F2B4D]" /> Organizational Role & Access
                </h3>
                
                {rolesLoading ? (
                  <div className="h-10 rounded-xl border border-[#EAE7E0] bg-[#FAF8F5] animate-pulse" />
                ) : assignableRoles.length === 0 ? (
                  <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-xs font-bold text-amber-800">
                    {rolesError || 'No assignable roles available for your permission level.'}
                  </div>
                ) : (
                  <div className="relative">
                    <select 
                      name="customRole" value={formData.customRole} onChange={handleChange}
                      required
                      className="w-full px-3 py-2 bg-white border border-[#EAE7E0] rounded-xl focus:ring-2 focus:ring-[#1F2B4D] outline-none text-[#1F2B4D] text-xs font-bold transition-all"
                    >
                      <option value="" disabled>Select a role...</option>
                      {assignableRoles.map(role => (
                        <option key={role.name} value={role.name}>
                          {role.name} — Level {role.level}
                        </option>
                      ))}
                    </select>

                    <AnimatePresence>
                      {selectedRoleDef && (
                        <motion.div 
                          initial={{ opacity: 0, y: -10, height: 0 }}
                          animate={{ opacity: 1, y: 0, height: 'auto' }}
                          exit={{ opacity: 0, y: -10, height: 0 }}
                          className="mt-2.5 overflow-hidden"
                        >
                          <div className={`p-3 rounded-xl border flex flex-wrap items-center gap-2 ${getLevelColor(selectedRoleDef.level)} shadow-2xs text-xs`}>
                            <span className="font-extrabold">L{selectedRoleDef.level}</span>
                            <span className="font-bold">{selectedRoleDef.name}</span>
                            <span className="w-1 h-1 rounded-full bg-current opacity-40"></span>
                            <span className="opacity-80 font-medium">{selectedRoleDef.description}</span>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
              
              <div className="pt-3 sm:pt-4 border-t border-[#F4F1EA] flex justify-end w-full">
                <button
                  type="submit"
                  disabled={loading || rolesLoading || assignableRoles.length === 0 || offices.length === 0 || !formData.officeId}
                  className="relative overflow-hidden group inline-flex items-center justify-center gap-1.5 bg-[#1F2B4D] hover:bg-[#141C33] text-white px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-[9.5px] min-[360px]:text-[10.5px] sm:text-xs font-display font-bold uppercase tracking-wide shadow-2xs transition-all duration-300 active:scale-95 whitespace-nowrap shrink-0 w-full sm:w-auto disabled:opacity-50"
                >
                  <span className="absolute inset-0 bg-[#0F172A] translate-y-[100%] group-hover:translate-y-0 transition-transform duration-500 cubic-bezier(0.34, 1.56, 0.64, 1) z-0" />
                  <UserPlus size={14} className="relative z-10 text-white shrink-0 sm:w-4 sm:h-4" />
                  <span className="relative z-10 text-white whitespace-nowrap">{loading ? 'Creating Account...' : 'Create Employee Account'}</span>
                </button>
              </div>

            </form>
          </div>
        </div>

        {/* Tenant Role Hierarchy Viewer */}
        <div className="intro-hierarchy mt-2">
          {!rolesLoading && tenantRoles.length > 0 && (
            <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-[#EAE7E0] shadow-2xs">
              <h3 className="text-xs sm:text-sm font-bold text-[#1F2B4D] mb-3 flex flex-wrap items-center gap-1.5 tracking-tight">
                <Shield size={16} className="text-[#1F2B4D]" />
                <span>Your Company's Role Hierarchy</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B655C]">(Set by Owner)</span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {[...tenantRoles].sort((a, b) => a.level - b.level).map(role => (
                  <div
                    key={role.name}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium shadow-2xs ${getLevelColor(role.level)}`}
                  >
                    <span className="font-extrabold text-xs">L{role.level}</span>
                    <span className="font-bold">{role.name}</span>
                    {role.locked && <span className="opacity-50 text-[10px]" title="System Role (Locked)">🔒</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default CreateEmployee;
