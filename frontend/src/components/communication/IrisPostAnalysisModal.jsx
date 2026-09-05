import React, { useState, useEffect } from 'react';
import { Sparkles, X, CheckCircle2, AlertTriangle, ShieldAlert, ArrowRight, RefreshCw, Compass, Info, ListChecks, HelpCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { analyzeAnnouncementForEmployees } from '../../lib/communicationStressApi';

export const IrisPostAnalysisModal = ({ isOpen, onClose, announcement }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [analysis, setAnalysis] = useState(null);

  useEffect(() => {
    if (isOpen && announcement) {
      handleAnalyze();
    } else {
      setAnalysis(null);
      setError('');
    }
  }, [isOpen, announcement?.id]);

  if (!isOpen || !announcement) return null;

  const handleAnalyze = async () => {
    setLoading(true);
    setError('');

    try {
      const data = await analyzeAnnouncementForEmployees({
        title: announcement.title,
        message: announcement.message,
        category: announcement.category,
      });
      setAnalysis(data);
    } catch (err) {
      console.error('[IrisPostAnalysisModal] Error:', err);
      setError(err.message || 'Failed to analyze announcement with Iris AI.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col border border-[#EAE7E0] animate-in fade-in zoom-in-95 duration-200 my-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#EAE7E0] bg-[#FAF8F5] shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 shadow-xs">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-serif font-bold text-xl text-[#1D1B16] tracking-tight">
                  Iris AI Action Breakdown
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold uppercase tracking-wider">
                  Employee Guide
                </span>
              </div>
              <p className="text-xs text-[#6B655C]">
                Smart breakdown of what to do, what to avoid, and how to execute.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-[#6B655C] hover:text-[#1D1B16] hover:bg-[#EAE7E0] rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-[#FAF8F5]/40">
          
          {/* Post Header Card */}
          <div className="p-4 rounded-2xl bg-white border border-[#EAE7E0] shadow-xs space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B655C]">
              Announcement: "{announcement.title}"
            </span>
            <p className="text-xs text-[#1D1B16] font-medium line-clamp-2 italic">
              "{announcement.message}"
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-4 bg-rose-50 text-rose-800 text-xs rounded-2xl border border-rose-200 flex items-start gap-3 font-medium shadow-xs">
              <AlertTriangle size={16} className="shrink-0 text-rose-600 mt-0.5" />
              <div>
                <p className="font-bold">Analysis Failed</p>
                <p className="mt-0.5 text-rose-700">{error}</p>
                <Button
                  onClick={handleAnalyze}
                  className="mt-2 text-[11px] bg-rose-100 text-rose-800 hover:bg-rose-200 px-3 py-1 rounded-lg font-bold"
                >
                  Retry Analysis
                </Button>
              </div>
            </div>
          )}

          {/* Loading Skeleton */}
          {loading && (
            <div className="bg-white rounded-2xl border border-[#EAE7E0] p-8 text-center space-y-4">
              <div className="inline-flex p-4 rounded-full bg-indigo-50 text-indigo-600 animate-pulse">
                <Sparkles size={32} />
              </div>
              <div className="space-y-1">
                <h4 className="font-serif font-bold text-base text-[#1D1B16]">Iris AI is analyzing the announcement...</h4>
                <p className="text-xs text-[#6B655C]">
                  Extracting key takeaways, action steps, pitfalls to avoid, and timelines.
                </p>
              </div>
            </div>
          )}

          {/* Iris Breakdown Output */}
          {!loading && analysis && (
            <div className="space-y-5">
              {/* Executive Summary */}
              <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200/80 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-800 flex items-center gap-1.5">
                  <Compass size={13} /> Executive Summary
                </span>
                <p className="text-xs text-indigo-950 font-semibold leading-relaxed">
                  {analysis.summary}
                </p>
              </div>

              {/* 3 Action Pillars */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* 🎯 What To Do */}
                <div className="bg-white rounded-2xl border border-emerald-200 p-4 space-y-3 shadow-xs">
                  <div className="flex items-center gap-2 pb-2 border-b border-emerald-100">
                    <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
                      <CheckCircle2 size={16} />
                    </div>
                    <h3 className="font-bold text-xs text-emerald-950 uppercase tracking-wide">What To Do</h3>
                  </div>

                  <ul className="space-y-2">
                    {(analysis.whatToDo || []).map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-[#1D1B16] font-medium leading-normal">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 🚫 What NOT To Do */}
                <div className="bg-white rounded-2xl border border-rose-200 p-4 space-y-3 shadow-xs">
                  <div className="flex items-center gap-2 pb-2 border-b border-rose-100">
                    <div className="p-1.5 rounded-lg bg-rose-50 text-rose-700">
                      <ShieldAlert size={16} />
                    </div>
                    <h3 className="font-bold text-xs text-rose-950 uppercase tracking-wide">What NOT To Do</h3>
                  </div>

                  <ul className="space-y-2">
                    {(analysis.whatNotToDo || []).map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-[#1D1B16] font-medium leading-normal">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 📋 How To Do / Guidelines */}
                <div className="bg-white rounded-2xl border border-blue-200 p-4 space-y-3 shadow-xs">
                  <div className="flex items-center gap-2 pb-2 border-b border-blue-100">
                    <div className="p-1.5 rounded-lg bg-blue-50 text-blue-700">
                      <ListChecks size={16} />
                    </div>
                    <h3 className="font-bold text-xs text-blue-950 uppercase tracking-wide">How To Execute</h3>
                  </div>

                  <ul className="space-y-2">
                    {(analysis.howToDo || []).map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-[#1D1B16] font-medium leading-normal">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#EAE7E0] bg-[#FAF8F5] flex items-center justify-between gap-3 shrink-0">
          <p className="text-[11px] text-[#6B655C] font-medium">
            ✨ Powered by <strong>Iris AI Operating System</strong> for Crew HRMS.
          </p>
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-xs font-bold text-[#6B655C] hover:bg-[#EAE7E0] rounded-xl px-4 py-2"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
