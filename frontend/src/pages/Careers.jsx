import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Briefcase, MapPin, Building, ChevronRight, UploadCloud, Loader2 } from 'lucide-react';

const inputBase = "w-full rounded-xl border border-[#EAE7E0] bg-[#FAF9F6] px-4 py-3 text-[#1D1B16] placeholder:text-[#9A948A] outline-none transition-all duration-[400ms] ease-[cubic-bezier(0.32,0.72,0,1)] focus:border-[#1F2B4D] focus:bg-white focus:ring-2 focus:ring-[#1F2B4D]/10 focus:shadow-xs";

const Careers = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Parse path: /jobs, /jobs/job/:id, /jobs/:tenant, /jobs/:tenant/job/:id (or /careers equivalent)
  const pathParts = location.pathname.split('/').filter(Boolean);
  const basePrefix = pathParts[0] === 'jobs' ? '/jobs' : '/careers';
  let tenantId = null;
  let jobId = null;
  
  if (pathParts.length === 2 && pathParts[1] !== 'job') {
    tenantId = pathParts[1];
  } else if (pathParts.length === 3 && pathParts[1] === 'job') {
    jobId = pathParts[2];
  } else if (pathParts.length === 4 && pathParts[2] === 'job') {
    tenantId = pathParts[1];
    jobId = pathParts[3];
  }

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState(null);
  const [applyForm, setApplyForm] = useState({ firstName: '', lastName: '', email: '', phone: '', resumeText: '', resumeFile: null });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchPublicJobs = async () => {
      try {
        const url = tenantId 
          ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/ats/public/jobs/${tenantId}`
          : `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/ats/public/jobs`;
        const res = await axios.get(url);
        setJobs(res.data);
        if (jobId) {
          const job = res.data.find(j => j.id === jobId);
          if (job) setSelectedJob(job);
        }
      } catch (error) {
        toast.error('Failed to load open positions.');
      } finally {
        setLoading(false);
      }
    };
    fetchPublicJobs();
  }, [tenantId, jobId]);

  const handleSelectJob = (job) => {
    setSelectedJob(job);
    if (job) {
      if (tenantId) navigate(`${basePrefix}/${tenantId}/job/${job.id}`, { replace: true });
      else navigate(`${basePrefix}/job/${job.id}`, { replace: true });
    } else {
      if (tenantId) navigate(`${basePrefix}/${tenantId}`, { replace: true });
      else navigate(`${basePrefix}`, { replace: true });
    }
  };

  const handleApply = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('tenantId', selectedJob.tenantId || tenantId);
      formData.append('jobRequisitionId', selectedJob.id);
      formData.append('firstName', applyForm.firstName);
      formData.append('lastName', applyForm.lastName);
      formData.append('email', applyForm.email);
      formData.append('phone', applyForm.phone);
      if (applyForm.resumeFile) {
        formData.append('resumeFile', applyForm.resumeFile);
      } else {
        formData.append('resumeText', applyForm.resumeText);
      }

      await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/ats/public/apply`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success("Application submitted successfully!");
      setSelectedJob(null);
      setApplyForm({ firstName: '', lastName: '', email: '', phone: '', resumeText: '', resumeFile: null });
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to submit application");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] mesh-bg font-sans relative">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-[#EAE7E0] py-5 sticky top-0 z-50 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <img src="/crew-new.png" alt="Crew HRMS Logo" className="h-10 sm:h-12 w-auto object-contain drop-shadow-xs" />
            <div className="h-6 w-[1px] bg-[#EAE7E0] mx-1" />
            <h1 className="text-xl font-serif font-bold text-[#1D1B16] italic tracking-tight">Careers</h1>
          </div>
          <button 
            onClick={() => navigate('/')}
            className="text-sm font-display font-bold text-[#6B655C] hover:text-[#1F2B4D] transition-colors"
          >
            Crew Home
          </button>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 lg:px-12 py-12 lg:py-16">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <div className="relative flex items-center justify-center w-20 h-20">
              <div className="absolute inset-0 rounded-full border-[3px] border-[#EAE7E0] border-t-[#1F2B4D] animate-spin"></div>
            </div>
            <p className="font-display font-bold text-[#1D1B16] tracking-widest uppercase text-sm animate-pulse">Loading Positions...</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-32 double-bezel-outer bg-white/50 backdrop-blur-sm max-w-2xl mx-auto">
            <div className="double-bezel-inner py-16 px-8 flex flex-col items-center">
              <Briefcase size={48} className="text-[#9A948A] mb-4 opacity-50" />
              <h2 className="text-2xl font-serif font-bold text-[#1D1B16] mb-3 italic">No Open Positions</h2>
              <p className="text-[#6B655C] font-medium max-w-md">We don't have any open roles at the moment. Check back later for new opportunities to join the team.</p>
            </div>
          </div>
        ) : !selectedJob ? (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out">
            <div className="mb-12 text-center md:text-left">
              <h2 className="text-4xl md:text-5xl font-serif font-bold text-[#1D1B16] mb-4 italic">Open Positions</h2>
              <p className="text-lg text-[#6B655C] font-medium max-w-2xl">Discover your next career move and help us build the future of work.</p>
            </div>
            
            <div className="grid gap-5">
              {jobs.map((job, index) => (
                <div 
                  key={job.id} 
                  onClick={() => handleSelectJob(job)}
                  className="bg-white border border-[#EAE7E0] p-6 md:p-8 rounded-[24px] shadow-[0_2px_10px_rgba(29,27,22,0.04)] hover:shadow-[0_12px_30px_rgba(31,43,77,0.1)] hover:border-[#1F2B4D]/30 transition-all duration-300 cursor-pointer group flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex-1">
                    <h3 className="text-2xl font-display font-bold text-[#1D1B16] group-hover:text-[#1F2B4D] transition-colors mb-4">{job.title}</h3>
                    <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-[#6B655C]">
                      {job.department && (
                        <div className="flex items-center gap-1.5 bg-[#FAF9F6] border border-[#EAE7E0] px-3 py-1.5 rounded-lg">
                          <Building size={16} className="text-[#1F2B4D]" /> {job.department}
                        </div>
                      )}
                      {job.location && (
                        <div className="flex items-center gap-1.5 bg-[#FAF9F6] border border-[#EAE7E0] px-3 py-1.5 rounded-lg">
                          <MapPin size={16} className="text-[#1F2B4D]" /> {job.location}
                        </div>
                      )}
                      <span className="bg-[#1F2B4D]/5 text-[#1F2B4D] border border-[#1F2B4D]/10 px-3 py-1.5 rounded-lg uppercase tracking-wider text-xs">
                        {job.employmentType}
                      </span>
                    </div>
                  </div>
                  <div className="h-12 w-12 shrink-0 bg-[#FAF9F6] border border-[#EAE7E0] rounded-full flex items-center justify-center group-hover:bg-[#1F2B4D] transition-colors duration-300 self-end md:self-auto">
                    <ChevronRight size={20} className="text-[#9A948A] group-hover:text-white transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="double-bezel-outer animate-in zoom-in-95 duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]">
            <div className="double-bezel-inner flex flex-col lg:flex-row overflow-hidden bg-white">
              
              {/* Left side: Job Details */}
              <div className="lg:w-7/12 p-8 lg:p-14 border-b lg:border-b-0 lg:border-r border-[#EAE7E0] bg-[#FAF9F6]/50">
                <button 
                  onClick={() => handleSelectJob(null)}
                  className="text-sm font-display font-bold text-[#6B655C] hover:text-[#1F2B4D] flex items-center gap-2 mb-10 transition-colors group"
                >
                  <span className="group-hover:-translate-x-1 transition-transform">&larr;</span> Back to all roles
                </button>
                
                <h2 className="text-4xl lg:text-5xl font-serif font-bold text-[#1D1B16] mb-6 italic leading-tight">{selectedJob.title}</h2>
                <div className="flex flex-wrap items-center gap-3 mb-12 text-sm font-semibold text-[#6B655C]">
                  {selectedJob.department && (
                    <span className="flex items-center gap-1.5 bg-white border border-[#EAE7E0] px-3.5 py-2 rounded-xl shadow-sm">
                      <Building size={16} className="text-[#1F2B4D]" /> {selectedJob.department}
                    </span>
                  )}
                  {selectedJob.location && (
                    <span className="flex items-center gap-1.5 bg-white border border-[#EAE7E0] px-3.5 py-2 rounded-xl shadow-sm">
                      <MapPin size={16} className="text-[#1F2B4D]" /> {selectedJob.location}
                    </span>
                  )}
                  <span className="bg-[#1F2B4D] text-white px-3.5 py-2 rounded-xl uppercase tracking-wider text-xs shadow-sm">
                    {selectedJob.employmentType}
                  </span>
                </div>

                <div className="prose prose-slate max-w-none prose-p:leading-relaxed prose-headings:font-display prose-headings:font-bold prose-headings:text-[#1D1B16] prose-p:text-[#4A453D] prose-p:font-medium text-[15px]">
                  <h4 className="text-xl mb-4">Role Overview</h4>
                  <div className="whitespace-pre-line bg-white p-6 md:p-8 rounded-[20px] border border-[#EAE7E0] shadow-sm mb-8">
                    {selectedJob.description || "No description provided."}
                  </div>
                  
                  {selectedJob.requirements && (
                    <>
                      <h4 className="text-xl mb-4">Requirements</h4>
                      <div className="whitespace-pre-line bg-white p-6 md:p-8 rounded-[20px] border border-[#EAE7E0] shadow-sm">
                        {selectedJob.requirements}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Right side: Application Form */}
              <div className="lg:w-5/12 p-8 lg:p-14 bg-white relative">
                <div className="sticky top-24">
                  <h3 className="text-3xl font-serif font-bold text-[#1D1B16] mb-2 italic">Submit Application</h3>
                  <p className="text-[#6B655C] text-sm font-medium mb-8">Fill out the form below to apply for this role.</p>
                  
                  <form onSubmit={handleApply} className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <input required placeholder="First Name *" className={inputBase} value={applyForm.firstName} onChange={e => setApplyForm({...applyForm, firstName: e.target.value})} />
                      </div>
                      <div>
                        <input required placeholder="Last Name *" className={inputBase} value={applyForm.lastName} onChange={e => setApplyForm({...applyForm, lastName: e.target.value})} />
                      </div>
                    </div>
                    
                    <div>
                      <input required type="email" placeholder="Email Address *" className={inputBase} value={applyForm.email} onChange={e => setApplyForm({...applyForm, email: e.target.value})} />
                    </div>
                    
                    <div>
                      <input type="tel" placeholder="Phone Number" className={inputBase} value={applyForm.phone} onChange={e => setApplyForm({...applyForm, phone: e.target.value})} />
                    </div>
                    
                    <div className="mt-2">
                      <div className="relative group">
                        <input 
                          type="file" 
                          accept=".pdf"
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          onChange={e => setApplyForm({...applyForm, resumeFile: e.target.files[0]})}
                        />
                        <div className={`w-full flex items-center justify-between rounded-xl border-2 border-dashed ${applyForm.resumeFile ? 'border-emerald-400 bg-emerald-50' : 'border-[#EAE7E0] bg-[#FAF9F6] group-hover:border-[#1F2B4D]/40 group-hover:bg-[#1F2B4D]/5'} px-5 py-4 transition-all duration-300`}>
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${applyForm.resumeFile ? 'bg-emerald-100 text-emerald-600' : 'bg-white border border-[#EAE7E0] text-[#9A948A] group-hover:text-[#1F2B4D]'}`}>
                              <UploadCloud size={20} />
                            </div>
                            <div>
                              <p className={`text-sm font-bold ${applyForm.resumeFile ? 'text-emerald-700' : 'text-[#1D1B16]'}`}>
                                {applyForm.resumeFile ? applyForm.resumeFile.name : 'Upload Resume'}
                              </p>
                              <p className="text-xs text-[#9A948A] font-medium mt-0.5">PDF up to 5MB</p>
                            </div>
                          </div>
                          {applyForm.resumeFile && (
                            <div className="text-emerald-500 font-bold text-sm">Selected</div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="pt-4">
                      <button 
                        type="submit" 
                        disabled={submitting}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#1F2B4D] px-4 py-4 font-display font-bold text-white text-lg hover:bg-[#141C33] transition-all duration-[500ms] ease-[cubic-bezier(0.32,0.72,0,1)] disabled:opacity-60 disabled:cursor-wait shadow-[0_4px_12px_rgba(31,43,77,0.15)] hover:shadow-[0_8px_24px_rgba(31,43,77,0.25)] active:scale-[0.98]"
                      >
                        {submitting ? (
                          <>
                            <Loader2 size={20} className="animate-spin" />
                            Submitting...
                          </>
                        ) : 'Send Application'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Careers;
