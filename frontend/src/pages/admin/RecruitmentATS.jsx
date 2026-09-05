import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Plus, UploadCloud, FileText, ExternalLink, X, ArrowUpRight, MoreHorizontal } from 'lucide-react';
import { API_BASE } from '../../lib/api';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { motion, AnimatePresence } from 'framer-motion';

const STAGES = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected'];

const RecruitmentATS = () => {
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [applications, setApplications] = useState([]);
  const [offices, setOffices] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [showJobModal, setShowJobModal] = useState(false);
  const [showCandidateModal, setShowCandidateModal] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [atsResult, setAtsResult] = useState(null);
  const [explanation, setExplanation] = useState(null);
  const [fetchingExplain, setFetchingExplain] = useState(false);
  const [rankingExplanation, setRankingExplanation] = useState(null);
  const [fetchingRankingExplain, setFetchingRankingExplain] = useState(false);
  const [rankings, setRankings] = useState([]);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Form states
  const [jobForm, setJobForm] = useState({ title: '', department: '', employmentType: 'Full-time', description: '', location: '' });
  const [candidateForm, setCandidateForm] = useState({ firstName: '', lastName: '', email: '', resumeText: '' });

  const containerRef = useRef(null);

  // GSAP 3x2 Matrix Staggered Reveal (Safely Guarded)
  useGSAP(() => {
    if (loading) return;

    const container = containerRef.current;
    if (!container) return;

    const header = container.querySelector('.cinematic-header');
    const selector = container.querySelector('.cinematic-selector');
    const gridBoxes = container.querySelectorAll('.cinematic-grid-box');
    const cards = container.querySelectorAll('.cinematic-card');

    const tl = gsap.timeline({ defaults: { ease: "back.out(1.2)" } });

    if (header) {
      tl.fromTo(header, 
        { opacity: 0, y: -15 },
        { opacity: 1, y: 0, duration: 0.6 }
      );
    }
    if (selector) {
      tl.fromTo(selector, 
        { opacity: 0, y: -10 },
        { opacity: 1, y: 0, duration: 0.5 }, 
        "-=0.4"
      );
    }
    if (gridBoxes.length > 0) {
      tl.fromTo(gridBoxes, 
        { scale: 0.94, opacity: 0, y: 20 },
        { scale: 1, opacity: 1, y: 0, duration: 0.7, stagger: 0.08 }, 
        "-=0.3"
      );
    }
    if (cards.length > 0) {
      tl.fromTo(cards, 
        { scale: 0.9, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.4, stagger: 0.02, clearProps: "all" }, 
        "-=0.4"
      );
    }

  }, { dependencies: [loading, selectedJob], scope: containerRef });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (selectedApplication && selectedApplication.atsStatus === 'COMPLETED') {
      axios.get(`${API_BASE}/api/ats/applications/${selectedApplication.id}/ats-result`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      }).then(res => {
        setAtsResult(res.data);
        setExplanation(res.data?.explanation || null);
      }).catch(err => console.error(err));
    } else {
      setAtsResult(null);
      setExplanation(null);
    }
  }, [selectedApplication]);

  const handleExplain = async () => {
    if (!selectedApplication) return;
    setFetchingExplain(true);
    try {
      const res = await axios.get(`${API_BASE}/api/ats/applications/${selectedApplication.id}/explain`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setExplanation(res.data.explanation);
    } catch (error) {
      toast.error('Failed to generate explanation');
    }
    setFetchingExplain(false);
  };

  const handleExplainRanking = async (jobId, applicationId) => {
    setFetchingRankingExplain(true);
    try {
      const res = await axios.get(`${API_BASE}/api/jobs/${jobId}/rankings/${applicationId}/explain`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setRankingExplanation(res.data.explanation);
    } catch (error) {
      toast.error('Failed to generate ranking explanation');
    }
    setFetchingRankingExplain(false);
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchJobs(), fetchApplications(), fetchOffices()]).finally(() => setLoading(false));
  }, []);

  const fetchJobs = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/ats/jobs`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setJobs(res.data);
      if (res.data.length > 0 && !selectedJob) {
        setSelectedJob(res.data[0].id);
      }
    } catch (error) {
      toast.error('Failed to fetch job requisitions');
    }
  };

  const fetchApplications = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/ats/applications`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setApplications(res.data);
      setLoading(false);
    } catch (error) {
      toast.error('Failed to fetch applications');
      setLoading(false);
    }
  };

  const fetchRankings = async (jobId) => {
    if (!jobId) {
      setRankings([]);
      return;
    }
    try {
      const res = await axios.get(`${API_BASE}/api/jobs/${jobId}/rankings`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setRankings(res.data.candidates || []);
    } catch (error) {
      console.error('Failed to fetch rankings', error);
      setRankings([]);
    }
  };

  useEffect(() => {
    if (selectedJob) {
      fetchRankings(selectedJob);
    }
  }, [selectedJob, applications]);

  const handleRecalculateRankings = async () => {
    if (!selectedJob) return;
    try {
      await axios.post(`${API_BASE}/api/jobs/${selectedJob}/rankings/recalculate`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      toast.success('Rankings recalculated');
      fetchRankings(selectedJob);
    } catch (error) {
      toast.error('Failed to recalculate rankings');
    }
  };

  const fetchOffices = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/console/offices`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setOffices(res.data || []);
    } catch (error) {
      console.error('Failed to fetch offices', error);
    }
  };

  const handleCreateJob = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/api/ats/jobs`, jobForm, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      toast.success('Job created successfully');
      setShowJobModal(false);
      setJobForm({ title: '', department: '', employmentType: 'Full-time', description: '', location: '' });
      fetchJobs();
    } catch (error) {
      toast.error('Failed to create job');
    }
  };

  const handleAddCandidate = async (e) => {
    e.preventDefault();
    try {
      let parsedData = null;
      if (candidateForm.resumeText) {
        const parseRes = await axios.post(`${API_BASE}/api/ats/candidates/parse-resume`, { resumeText: candidateForm.resumeText }, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        parsedData = parseRes.data;
      }

      const candRes = await axios.post(`${API_BASE}/api/ats/candidates`, {
        firstName: candidateForm.firstName || parsedData?.firstName || 'Unknown',
        lastName: candidateForm.lastName || parsedData?.lastName || 'Unknown',
        email: candidateForm.email || parsedData?.email,
        parsedData: parsedData
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      await axios.post(`${API_BASE}/api/ats/applications`, {
        candidateId: candRes.data.id,
        jobRequisitionId: selectedJob,
        stage: 'Applied'
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      toast.success('Candidate added to job');
      setShowCandidateModal(false);
      setCandidateForm({ firstName: '', lastName: '', email: '', resumeText: '' });
      fetchApplications();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to add candidate');
    }
  };

  const handleCloseJob = async () => {
    if (!selectedJob) return;
    if (!await window.confirmDialog()) return;
    try {
      await axios.patch(`${API_BASE}/api/ats/jobs/${selectedJob}`, { status: 'Closed' }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      toast.success('Job closed successfully');
      fetchJobs();
    } catch (error) {
      toast.error('Failed to close job');
    }
  };

  // Drag and Drop handlers
  const handleDragStart = (e, appId) => {
    e.dataTransfer.setData('appId', appId);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (e, targetStage) => {
    e.preventDefault();
    const appId = e.dataTransfer.getData('appId');
    if (!appId) return;
    
    // Optimistic update
    setApplications(prev => prev.map(app => app.id === appId ? { ...app, stage: targetStage } : app));

    try {
      await axios.patch(`${API_BASE}/api/ats/applications/${appId}/stage`, { stage: targetStage }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (targetStage === 'Hired') {
        toast.success("Candidate Hired! Welcome aboard.", { icon: '🎉' });
      }
    } catch (error) {
      toast.error('Failed to update stage');
      fetchApplications(); // revert
    }
  };

  const visibleJobs = React.useMemo(() => jobs.filter(j => j.status !== 'Closed' || (currentTime - new Date(j.updatedAt).getTime() < 60000)), [jobs, currentTime]);

  useEffect(() => {
    if (visibleJobs.length > 0 && (!selectedJob || !visibleJobs.find(j => j.id === selectedJob))) {
      setSelectedJob(visibleJobs[0].id);
    } else if (visibleJobs.length === 0 && selectedJob) {
      setSelectedJob(null);
    }
  }, [visibleJobs, selectedJob]);

  // High-Density Modal Physics
  const modalVariants = {
    hidden: { opacity: 0, scale: 0.95, filter: "blur(4px)" },
    visible: { 
      opacity: 1, 
      scale: 1, 
      filter: "blur(0px)",
      transition: { type: 'spring', stiffness: 300, damping: 28 }
    },
    exit: { 
      opacity: 0, 
      scale: 0.98, 
      filter: "blur(2px)",
      transition: { duration: 0.2 }
    }
  };

  const currentJobApplications = applications.filter(a => a.jobRequisitionId === selectedJob);

  if (loading) return (
    <div className="min-h-[100dvh] bg-transparent flex items-center justify-center">
      <span className="text-[11px] font-bold text-[#9A948A] tracking-[0.15em] uppercase">Loading...</span>
    </div>
  );

  return (
    <div ref={containerRef} className="py-6 md:py-8 px-4 md:px-6 lg:px-8 min-h-[100dvh] bg-transparent font-sans">
      <div className="mx-auto w-full max-w-[1400px]">
        
        {/* Compact Dashboard Header */}
        <div className="cinematic-header flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-[26px] font-extrabold text-[#1D1B16] tracking-tight leading-none mb-1">Recruitment</h1>
            <p className="text-[#6B655C] text-[13px] font-medium tracking-tight">
              Manage pipelines and applicant velocity.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <a 
              href="/jobs" 
              target="_blank" rel="noreferrer" 
              className="group flex items-center bg-white border border-[#EAE7E0] text-[#1D1B16] pl-3 pr-1 py-1 rounded-full text-[12px] font-bold shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-[0.97] active:translate-y-0 transition-all duration-300"
              title="Open public jobs portal"
            >
              <span className="mr-2">Public Jobs Portal</span>
              <div className="w-6 h-6 rounded-full bg-[#FAF9F6] border border-[#EAE7E0] flex items-center justify-center group-hover:bg-[#1D1B16] group-hover:text-white transition-colors duration-300">
                <ExternalLink size={12} strokeWidth={2.5} className="group-hover:-translate-y-[1px] group-hover:translate-x-[1px] transition-transform duration-300" />
              </div>
            </a>

            {/* Premium Button-in-Button CTAs */}
            <button 
              onClick={() => setShowJobModal(true)} 
              className="group flex items-center bg-white border border-[#EAE7E0] text-[#1D1B16] pl-3 pr-1 py-1 rounded-full text-[12px] font-bold shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-[0.97] active:translate-y-0 transition-all duration-300"
            >
              <span className="mr-2">New Job</span>
              <div className="w-6 h-6 rounded-full bg-[#FAF9F6] border border-[#EAE7E0] flex items-center justify-center group-hover:bg-[#1D1B16] group-hover:text-white transition-colors duration-300">
                <Plus size={14} strokeWidth={2.5} className="group-hover:rotate-90 transition-transform duration-300" />
              </div>
            </button>
            
            <button 
              onClick={() => { if(selectedJob) setShowCandidateModal(true); else toast.error('Select a job first'); }} 
              className="group flex items-center bg-[#1D1B16] text-white pl-3 pr-1 py-1 rounded-full text-[12px] font-bold shadow-sm hover:shadow-lg hover:shadow-[#1D1B16]/20 hover:-translate-y-0.5 active:scale-[0.97] active:translate-y-0 transition-all duration-300"
            >
              <span className="mr-2">Add Candidate</span>
              <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white group-hover:text-[#1D1B16] transition-colors duration-300">
                <UploadCloud size={14} strokeWidth={2.5} className="group-hover:-translate-y-[1px] transition-transform duration-300" />
              </div>
            </button>
          </div>
        </div>

        {/* Compact Job Selector */}
        <div className="cinematic-selector mb-8 flex flex-wrap items-center gap-3">
          <div className="relative group min-w-[260px]">
            <select 
              className="appearance-none w-full bg-white border border-[#EAE7E0] text-[#1D1B16] text-[13px] font-bold tracking-tight rounded-lg px-3 py-2 pr-8 focus:ring-2 focus:ring-[#1D1B16] focus:outline-none transition-shadow shadow-sm hover:shadow-md cursor-pointer"
              value={selectedJob || ''}
              onChange={(e) => setSelectedJob(e.target.value)}
            >
              {visibleJobs.length === 0 && <option value="">No roles available</option>}
              {visibleJobs.map(j => (
                <option key={j.id} value={j.id}>{j.title} ({j.department}) {j.status === 'Closed' ? '[CLOSED]' : ''}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[#1D1B16]">
              <svg className="fill-current h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
            </div>
          </div>
          
          {selectedJob && (
            <a 
              href={`/jobs/job/${selectedJob}`}
              target="_blank" rel="noreferrer"
              className="px-3.5 py-2 bg-white border border-[#EAE7E0] text-[#1F2B4D] rounded-full text-[12px] font-bold hover:bg-[#FAF9F6] hover:border-[#1F2B4D]/30 hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-300 shadow-sm flex items-center gap-1.5"
              title="Open public posting for selected job"
            >
              <span>View Job Posting</span>
              <ExternalLink size={12} />
            </a>
          )}

          {selectedJob && jobs.find(j => j.id === selectedJob)?.status === 'Open' && (
            <button 
              onClick={handleCloseJob}
              className="px-4 py-2 bg-white border border-[#EAE7E0] text-[#B91C1C] rounded-full text-[12px] font-bold hover:bg-[#FEF2F2] hover:border-[#FECACA] hover:-translate-y-0.5 active:scale-[0.97] active:translate-y-0 transition-all duration-300 shadow-sm hover:shadow-md"
            >
              Close Role
            </button>
          )}
        </div>

        {/* TOP CANDIDATES SECTION */}
        {selectedJob && (
          <div className="mb-8 p-6 bg-white ring-1 ring-black/5 rounded-[24px] shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-extrabold text-[#1D1B16] text-[18px]">Top Candidates (Ranked)</h3>
              <button 
                onClick={handleRecalculateRankings}
                className="px-4 py-1.5 bg-[#FAF9F6] border border-[#EAE7E0] text-[#1D1B16] rounded-full text-[12px] font-bold hover:bg-[#F4F1EA] transition-colors shadow-sm"
              >
                Recalculate Rankings
              </button>
            </div>
            
            {rankings.length === 0 ? (
              <div className="text-center py-6 bg-[#FAF9F6] border border-dashed border-[#EAE7E0] rounded-xl">
                <p className="text-[14px] text-[#6B655C] font-medium">No candidates have been ranked for this job yet.</p>
                <p className="text-[12px] text-[#9A948A] mt-1">Click "Recalculate Rankings" above to run the deterministic engine.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rankings.slice(0, 3).map((r, idx) => {
                  const app = applications.find(a => a.id === r.applicationId);
                  return (
                    <div 
                      key={r.applicationId} 
                      onClick={() => app && setSelectedApplication(app)}
                      className="p-4 border border-[#EAE7E0] rounded-xl bg-[#FAF9F6] flex flex-col gap-2 relative cursor-pointer hover:border-[#1D1B16] transition-colors"
                    >
                      <div className="absolute top-4 right-4 text-[24px]">
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                      </div>
                      <div>
                        <h4 className="font-bold text-[16px] text-[#1D1B16] leading-none mb-1">
                          #{r.rank} {r.candidateName}
                        </h4>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${r.eligibilityStatus === 'ELIGIBLE' ? 'bg-green-100 text-green-800' : r.eligibilityStatus === 'REVIEW_REQUIRED' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                        {r.eligibilityStatus.replace('_', ' ')}
                      </span>
                    </div>
                    
                    <div className="mt-2 text-[13px] text-[#6B655C]">
                      <span className="font-bold text-[#1D1B16]">{r.rankingScore}</span> Ranking Score
                    </div>
                    
                    <div className="text-[11px] text-[#9A948A] mt-1">
                      ATS: {r.scoreBreakdown?.atsMatch || 0} • Skills: {r.scoreBreakdown?.requiredSkillCoverage || 0}% • Exp: {r.scoreBreakdown?.experience || 0}
                    </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* EXECUTIVE 3x2 GRID MATRIX */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {STAGES.map((stage) => {
            const appsInStage = currentJobApplications.filter(a => a.stage === stage);
            
            return (
              <div 
                key={stage}
                className="cinematic-grid-box flex flex-col bg-white ring-1 ring-black/5 rounded-[24px] overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-500"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, stage)}
              >
                {/* Premium Dashboard Grid Header */}
                <div className="flex justify-between items-center px-5 py-4 border-b border-[#F4F1EA] bg-[#FAF9F6]">
                  <h3 className="font-extrabold text-[#1D1B16] text-[15px] tracking-tight">{stage}</h3>
                  <div className="h-6 min-w-6 px-2 rounded-full bg-white border border-[#EAE7E0] shadow-xs flex items-center justify-center">
                    <span className="text-[11px] font-bold text-[#6B655C]">{appsInStage.length}</span>
                  </div>
                </div>
                
                {/* Dashboard Grid Body */}
                <div className="flex-1 p-4 flex flex-col gap-3 min-h-[220px] bg-white">
                  {appsInStage.map((app) => (
                    <div 
                      key={app.id} 
                      draggable
                      onDragStart={(e) => handleDragStart(e, app.id)}
                      onClick={() => setSelectedApplication(app)}
                      className="cinematic-card group cursor-grab active:cursor-grabbing p-3 bg-white border border-[#EAE7E0] rounded-[16px] shadow-sm hover:border-[#D5D2CC] hover:-translate-y-1 hover:scale-[1.02] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] transition-all duration-300 relative z-10 hover:z-20"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1 overflow-hidden">
                          <h4 className="font-bold text-[14px] text-[#1D1B16] tracking-tight truncate leading-tight">
                            {app.candidate.firstName} {app.candidate.lastName}
                          </h4>
                          <p className="text-[12px] font-medium text-[#9A948A] mt-1 truncate leading-tight">
                            {app.candidate.email}
                          </p>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal size={16} strokeWidth={2.5} className="text-[#9A948A]" />
                        </div>
                      </div>
                      
                      <div className="mt-4 flex items-center justify-between">
                        {app.candidate.resumeUrl ? (
                          <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#6B655C] bg-white border border-[#EAE7E0] px-2.5 py-1 rounded-md shadow-xs">
                            <FileText size={12} strokeWidth={2.5} /> Resume
                          </span>
                        ) : <span />}
                        {app.atsStatus === 'PROCESSING' && (
                          <span className="text-[10px] font-bold text-blue-600 animate-pulse">⏳ Processing...</span>
                        )}
                        {app.atsStatus === 'COMPLETED' && (
                          <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200">
                            {app.atsResults && app.atsResults.length > 0 ? `ATS Score: ${app.atsResults[0].score}` : 'ATS Scored'}
                          </span>
                        )}
                        {app.atsStatus === 'FAILED' && (
                          <span className="text-[10px] font-bold text-red-600">Failed</span>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {/* Empty State Drop Zone */}
                  {appsInStage.length === 0 && (
                    <div className="flex-1 border-2 border-dashed border-[#F4F1EA] rounded-[16px] flex flex-col items-center justify-center gap-2 text-[#9A948A] transition-colors hover:border-[#D5D2CC]">
                      <UploadCloud size={20} strokeWidth={2} className="text-[#D5D2CC]" />
                      <span className="text-[10px] font-bold uppercase tracking-[0.1em]">Drop Candidate Here</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Compact Modals with AnimatePresence */}
        <AnimatePresence>
          {showJobModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
                className="absolute inset-0 bg-black/20 backdrop-blur-md"
                onClick={() => setShowJobModal(false)}
              />
              <motion.div 
                variants={modalVariants} initial="hidden" animate="visible" exit="exit"
                className="relative w-full max-w-md bg-white ring-1 ring-black/5 shadow-[0_24px_48px_rgba(0,0,0,0.12)] rounded-[24px] overflow-hidden flex flex-col"
              >
                <div className="px-6 py-5 border-b border-[#F4F1EA] flex justify-between items-center bg-[#FAF9F6]">
                  <h2 className="text-[18px] font-extrabold text-[#1D1B16] tracking-tight">Create Job Requisition</h2>
                  <button onClick={() => setShowJobModal(false)} className="w-8 h-8 flex items-center justify-center text-[#9A948A] hover:text-[#1D1B16] hover:bg-[#EAE7E0] rounded-full transition-colors">
                    <X size={18} strokeWidth={2.5} />
                  </button>
                </div>
                <form onSubmit={handleCreateJob} className="p-6 space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-[#6B655C] uppercase tracking-[0.1em] mb-1.5 ml-1">Job Title</label>
                    <input required className="w-full px-4 py-3 bg-[#FAF9F6] border border-[#EAE7E0] rounded-xl focus:ring-2 focus:ring-[#1D1B16] outline-none text-[#1D1B16] font-bold text-[14px] tracking-tight transition-shadow placeholder:text-[#9A948A]" value={jobForm.title} onChange={e => setJobForm({...jobForm, title: e.target.value})} placeholder="Senior Frontend Engineer" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#6B655C] uppercase tracking-[0.1em] mb-1.5 ml-1">Department</label>
                    <input className="w-full px-4 py-3 bg-[#FAF9F6] border border-[#EAE7E0] rounded-xl focus:ring-2 focus:ring-[#1D1B16] outline-none text-[#1D1B16] font-bold text-[14px] tracking-tight transition-shadow placeholder:text-[#9A948A]" value={jobForm.department} onChange={e => setJobForm({...jobForm, department: e.target.value})} placeholder="Engineering" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#6B655C] uppercase tracking-[0.1em] mb-1.5 ml-1">Office / Location</label>
                    <select required className="w-full px-4 py-3 bg-[#FAF9F6] border border-[#EAE7E0] rounded-xl focus:ring-2 focus:ring-[#1D1B16] outline-none text-[#1D1B16] font-bold text-[14px] tracking-tight transition-shadow appearance-none cursor-pointer" value={jobForm.location || ''} onChange={e => setJobForm({...jobForm, location: e.target.value})}>
                      <option value="" disabled>Select Office</option>
                      {offices.map(office => (
                        <option key={office.id} value={office.name}>{office.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#6B655C] uppercase tracking-[0.1em] mb-1.5 ml-1">Job Description</label>
                    <textarea rows={4} className="w-full px-4 py-3 bg-[#FAF9F6] border border-[#EAE7E0] rounded-xl focus:ring-2 focus:ring-[#1D1B16] outline-none text-[#1D1B16] font-medium text-[14px] transition-shadow placeholder:text-[#9A948A] resize-none" value={jobForm.description} onChange={e => setJobForm({...jobForm, description: e.target.value})} placeholder="Responsibilities..." />
                  </div>
                  <div className="pt-3 flex justify-end gap-3">
                    <button type="button" onClick={() => setShowJobModal(false)} className="px-5 py-2.5 border border-[#EAE7E0] bg-[#FAF9F6] text-[#1D1B16] text-[13px] font-bold rounded-full hover:bg-white hover:-translate-y-0.5 hover:shadow-sm active:scale-[0.97] active:translate-y-0 transition-all duration-300">Cancel</button>
                    <button type="submit" className="px-6 py-2.5 bg-[#1D1B16] text-white text-[13px] font-bold rounded-full shadow-sm hover:shadow-md hover:shadow-[#1D1B16]/20 hover:-translate-y-0.5 active:scale-[0.97] active:translate-y-0 transition-all duration-300">Create</button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showCandidateModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
                className="absolute inset-0 bg-black/20 backdrop-blur-md"
                onClick={() => setShowCandidateModal(false)}
              />
              <motion.div 
                variants={modalVariants} initial="hidden" animate="visible" exit="exit"
                className="relative w-full max-w-md bg-white ring-1 ring-black/5 shadow-[0_24px_48px_rgba(0,0,0,0.12)] rounded-[24px] overflow-hidden flex flex-col"
              >
                <div className="px-6 py-5 border-b border-[#F4F1EA] flex justify-between items-center bg-[#FAF9F6]">
                  <h2 className="text-[18px] font-extrabold text-[#1D1B16] tracking-tight">Add Candidate</h2>
                  <button onClick={() => setShowCandidateModal(false)} className="w-8 h-8 flex items-center justify-center text-[#9A948A] hover:text-[#1D1B16] hover:bg-[#EAE7E0] rounded-full transition-colors">
                    <X size={18} strokeWidth={2.5} />
                  </button>
                </div>
                <form onSubmit={handleAddCandidate} className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-[#6B655C] uppercase tracking-[0.1em] mb-1.5 ml-1">First Name</label>
                      <input className="w-full px-4 py-3 bg-[#FAF9F6] border border-[#EAE7E0] rounded-xl focus:ring-2 focus:ring-[#1D1B16] outline-none text-[#1D1B16] font-bold text-[14px] tracking-tight transition-shadow" value={candidateForm.firstName} onChange={e => setCandidateForm({...candidateForm, firstName: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#6B655C] uppercase tracking-[0.1em] mb-1.5 ml-1">Last Name</label>
                      <input className="w-full px-4 py-3 bg-[#FAF9F6] border border-[#EAE7E0] rounded-xl focus:ring-2 focus:ring-[#1D1B16] outline-none text-[#1D1B16] font-bold text-[14px] tracking-tight transition-shadow" value={candidateForm.lastName} onChange={e => setCandidateForm({...candidateForm, lastName: e.target.value})} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#6B655C] uppercase tracking-[0.1em] mb-1.5 ml-1">Email</label>
                    <input type="email" required className="w-full px-4 py-3 bg-[#FAF9F6] border border-[#EAE7E0] rounded-xl focus:ring-2 focus:ring-[#1D1B16] outline-none text-[#1D1B16] font-bold text-[14px] tracking-tight transition-shadow" value={candidateForm.email} onChange={e => setCandidateForm({...candidateForm, email: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#6B655C] uppercase tracking-[0.1em] mb-1.5 ml-1">Resume Text (Parse)</label>
                    <textarea 
                      rows={3} 
                      className="w-full px-4 py-3 bg-[#FAF9F6] border border-[#EAE7E0] rounded-xl focus:ring-2 focus:ring-[#1D1B16] outline-none text-[#1D1B16] font-medium text-[13px] transition-shadow resize-none placeholder:text-[#9A948A]" 
                      value={candidateForm.resumeText} 
                      onChange={e => setCandidateForm({...candidateForm, resumeText: e.target.value})} 
                      placeholder="Paste raw text..."
                    />
                  </div>
                  <div className="pt-3 flex justify-end gap-3">
                    <button type="button" onClick={() => setShowCandidateModal(false)} className="px-5 py-2.5 border border-[#EAE7E0] bg-[#FAF9F6] text-[#1D1B16] text-[13px] font-bold rounded-full hover:bg-white hover:-translate-y-0.5 hover:shadow-sm active:scale-[0.97] active:translate-y-0 transition-all duration-300">Cancel</button>
                    <button type="submit" className="px-6 py-2.5 bg-[#1D1B16] text-white text-[13px] font-bold rounded-full shadow-sm hover:shadow-md hover:shadow-[#1D1B16]/20 hover:-translate-y-0.5 active:scale-[0.97] active:translate-y-0 transition-all duration-300">Add</button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {selectedApplication && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
                className="absolute inset-0 bg-black/20 backdrop-blur-md"
                onClick={() => {
                  setSelectedApplication(null);
                  setRankingExplanation(null);
                }}
              />
              <motion.div 
                variants={modalVariants} initial="hidden" animate="visible" exit="exit"
                className="relative w-full max-w-2xl bg-white ring-1 ring-black/5 shadow-[0_24px_48px_rgba(0,0,0,0.12)] rounded-[24px] flex flex-col max-h-[90vh] overflow-hidden"
              >
                <div className="px-7 py-6 border-b border-[#F4F1EA] bg-[#FAF9F6] flex justify-between items-start shrink-0">
                  <div>
                    <h2 className="text-[22px] font-extrabold text-[#1D1B16] tracking-tight leading-none mb-2">
                      {selectedApplication.candidate.firstName} {selectedApplication.candidate.lastName}
                    </h2>
                    <p className="text-[#6B655C] font-bold text-[14px]">{selectedApplication.candidate.email}</p>
                  </div>
                  <button onClick={() => {
                    setSelectedApplication(null);
                    setRankingExplanation(null);
                  }} className="w-9 h-9 flex items-center justify-center text-[#9A948A] hover:text-[#1D1B16] hover:bg-[#EAE7E0] rounded-full transition-colors">
                    <X size={20} strokeWidth={2.5} />
                  </button>
                </div>
                
                <div className="p-7 overflow-y-auto flex-1 bg-white custom-scrollbar">
                  
                  {/* ATS Match Engine Section */}
                  <div className="mb-8">
                    
                    {/* Disclaimer */}
                    <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
                      <span className="text-yellow-600 font-bold mt-0.5">⚠</span>
                      <p className="text-[12px] text-yellow-800 leading-snug">
                        <strong>Decision Support Only:</strong> This ATS match score is generated by AI to assist your review process. It does not automatically disqualify or reject candidates. You are the ultimate decision-maker.
                      </p>
                    </div>

                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-extrabold text-[#1D1B16] text-[16px]">ATS Match Analysis</h3>
                      {selectedApplication.atsStatus === 'PROCESSING' && <span className="text-[12px] font-bold text-blue-600 animate-pulse">⏳ Processing...</span>}
                      {selectedApplication.atsStatus === 'PENDING' && <span className="text-[12px] font-bold text-gray-500">Pending Background Job...</span>}
                      {selectedApplication.atsStatus === 'FAILED' && <span className="text-[12px] font-bold text-red-500">❌ Processing Failed</span>}
                    </div>

                    {atsResult && (
                      <div className="bg-[#FAF9F6] border border-[#EAE7E0] rounded-2xl overflow-hidden shadow-sm">
                        <div className="p-5 border-b border-[#EAE7E0] flex justify-between items-center">
                          <div>
                            <div className="text-[28px] font-black text-[#1D1B16] leading-none">{atsResult.score}<span className="text-[16px] text-[#9A948A]">/100</span></div>
                            <div className="text-[12px] font-bold text-[#6B655C] uppercase tracking-[0.05em] mt-1">Match Score</div>
                          </div>
                          <button 
                            onClick={handleExplain} 
                            disabled={fetchingExplain}
                            className="flex items-center gap-2 px-4 py-2 bg-[#1D1B16] text-white text-[12px] font-bold rounded-full hover:bg-black transition-colors disabled:opacity-50"
                          >
                            {fetchingExplain ? 'Thinking...' : 'Explain Why?'}
                          </button>
                        </div>
                        
                        {explanation && (
                          <div className="p-5 bg-blue-50/50 border-b border-[#EAE7E0]">
                            <h4 className="text-[11px] font-bold text-blue-800 uppercase tracking-wider mb-2 flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                              Gemini Explanation
                            </h4>
                            <p className="text-[13px] text-[#1D1B16] leading-relaxed whitespace-pre-wrap">{explanation}</p>
                          </div>
                        )}

                        <div className="p-0">
                          <table className="w-full text-left text-[13px]">
                            <thead className="bg-[#F4F1EA] text-[#6B655C] font-bold text-[11px] uppercase tracking-wider">
                              <tr>
                                <th className="px-5 py-3">Requirement</th>
                                <th className="px-5 py-3">Match</th>
                                <th className="px-5 py-3">Evidence / Similarity</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#EAE7E0]">
                              {(atsResult.matchEvidence || []).map((ev, idx) => {
                                let badgeClass = "bg-gray-100 text-gray-700";
                                let icon = "?";
                                if (ev.matched === 'MATCH') { badgeClass = "bg-green-100 text-green-800"; icon = "✓"; }
                                else if (ev.matched === 'PARTIAL') { badgeClass = "bg-yellow-100 text-yellow-800"; icon = "⚠"; }
                                else if (ev.matched === 'NOT FOUND') { badgeClass = "bg-red-100 text-red-800"; icon = "✕"; }

                                return (
                                  <tr key={idx} className="hover:bg-white transition-colors">
                                    <td className="px-5 py-3 font-medium text-[#1D1B16] max-w-[200px] truncate" title={ev.requirement}>{ev.requirement}</td>
                                    <td className="px-5 py-3">
                                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${badgeClass}`}>
                                        {icon} {ev.matched}
                                      </span>
                                    </td>
                                    <td className="px-5 py-3 text-[#6B655C] max-w-[250px] truncate" title={ev.candidateEvidence?.[0]?.text}>
                                      {ev.candidateEvidence?.[0]?.text || '-'} 
                                      {ev.semanticSimilarity > 0 && ev.semanticSimilarity < 1 && ` (${Math.round(ev.semanticSimilarity * 100)}%)`}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Ranking Analysis Section */}
                  {rankings.find(r => r.applicationId === selectedApplication.id) && (
                    <div className="mb-8 bg-[#FAF9F6] border border-[#EAE7E0] rounded-2xl overflow-hidden shadow-sm p-5">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="font-extrabold text-[#1D1B16] text-[16px]">Why this rank?</h3>
                        <button 
                          onClick={() => handleExplainRanking(selectedJob, selectedApplication.id)} 
                          disabled={fetchingRankingExplain}
                          className="flex items-center gap-2 px-4 py-2 bg-[#1D1B16] text-white text-[12px] font-bold rounded-full hover:bg-black transition-colors disabled:opacity-50"
                        >
                          {fetchingRankingExplain ? 'Thinking...' : 'Explain this ranking'}
                        </button>
                      </div>
                      
                      {rankingExplanation && (
                        <div className="mb-4 p-4 bg-blue-50/50 border border-blue-100 rounded-xl">
                          <h4 className="text-[11px] font-bold text-blue-800 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                            Gemini Explanation
                          </h4>
                          <p className="text-[13px] text-[#1D1B16] leading-relaxed whitespace-pre-wrap">{rankingExplanation}</p>
                        </div>
                      )}
                      
                      {(() => {
                        const rankInfo = rankings.find(r => r.applicationId === selectedApplication.id);
                        return (
                          <div>
                            <div className="flex gap-4 mb-4">
                              <div>
                                <div className="text-[24px] font-black text-[#1D1B16] leading-none">#{rankInfo.rank}</div>
                                <div className="text-[12px] font-bold text-[#6B655C] uppercase tracking-[0.05em] mt-1">Overall Rank</div>
                              </div>
                              <div className="border-l border-[#EAE7E0] pl-4">
                                <div className="text-[24px] font-black text-[#1D1B16] leading-none">{rankInfo.rankingScore}</div>
                                <div className="text-[12px] font-bold text-[#6B655C] uppercase tracking-[0.05em] mt-1">Ranking Score</div>
                              </div>
                              <div className="border-l border-[#EAE7E0] pl-4">
                                <div className="text-[24px] font-black text-[#1D1B16] leading-none">{rankInfo.evidenceCoverage}%</div>
                                <div className="text-[12px] font-bold text-[#6B655C] uppercase tracking-[0.05em] mt-1">Evidence Coverage</div>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-6 mt-4">
                              <div>
                                <h4 className="text-[12px] font-bold text-green-700 uppercase tracking-wider mb-2">Strengths</h4>
                                <ul className="space-y-1">
                                  {rankInfo.rankingEvidence?.positive?.map((p, i) => (
                                    <li key={i} className="text-[13px] text-[#1D1B16] flex items-start gap-2">
                                      <span className="text-green-600 mt-0.5">✓</span> {p}
                                    </li>
                                  ))}
                                  {!rankInfo.rankingEvidence?.positive?.length && <li className="text-[13px] text-[#9A948A]">-</li>}
                                </ul>
                              </div>
                              <div>
                                <h4 className="text-[12px] font-bold text-red-700 uppercase tracking-wider mb-2">Gaps</h4>
                                <ul className="space-y-1">
                                  {rankInfo.rankingEvidence?.negative?.map((n, i) => (
                                    <li key={i} className="text-[13px] text-[#1D1B16] flex items-start gap-2">
                                      <span className="text-yellow-600 mt-0.5">⚠</span> {n}
                                    </li>
                                  ))}
                                  {!rankInfo.rankingEvidence?.negative?.length && <li className="text-[13px] text-[#9A948A]">-</li>}
                                </ul>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  <h3 className="font-extrabold text-[#1D1B16] text-[15px] mb-4">Resume Document</h3>
                  {selectedApplication.candidate.resumeUrl ? (
                    <div className="border border-[#EAE7E0] rounded-2xl h-[400px] overflow-hidden shadow-sm">
                      <iframe src={selectedApplication.candidate.resumeUrl} className="w-full h-full" title="Resume" />
                    </div>
                  ) : (
                    <div className="py-12 bg-[#FAF9F6] rounded-2xl border border-dashed border-[#D5D2CC] flex flex-col items-center justify-center gap-3">
                      <FileText size={28} strokeWidth={1.5} className="text-[#9A948A]" />
                      <p className="text-[#6B655C] text-[13px] font-bold">No resume payload.</p>
                    </div>
                  )}

                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
};

export default RecruitmentATS;
