import React, { useState, useEffect } from 'react';
import { ShieldCheck, X, Sparkles, AlertTriangle, ArrowLeft, RefreshCw, Send } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { FrictionScoreCard } from './FrictionScoreCard';
import { PersonaReactionCard } from './PersonaReactionCard';
import { RewriteComparison } from './RewriteComparison';
import { createStressTest, recordEvent } from '../../lib/communicationStressApi';

export const CommunicationReviewDialog = ({
  isOpen,
  onClose,
  initialDraft = { title: '', category: 'General', message: '' },
  onApplyRewrite = null, // If provided, allows applying rewrite to caller's state
  readOnly = false,      // If true, manager review-only panel mode (no broadcast)
}) => {
  const [draft, setDraft] = useState(initialDraft);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  // Sync draft when initialDraft changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setDraft(initialDraft);
      setError('');
      // Automatically run analysis if valid draft text was passed in
      if (initialDraft.message && initialDraft.message.trim().length >= 20) {
        handleRunTest(initialDraft);
      } else {
        setResult(null);
      }
    }
  }, [isOpen, initialDraft.title, initialDraft.message]);

  if (!isOpen) return null;

  const handleRunTest = async (draftToTest = draft) => {
    if (!draftToTest.title || !draftToTest.title.trim()) {
      setError('Please provide a message title.');
      return;
    }
    if (!draftToTest.message || draftToTest.message.trim().length < 20) {
      setError('Message content must be at least 20 characters.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await createStressTest({
        sourceType: 'ANNOUNCEMENT',
        title: draftToTest.title,
        category: draftToTest.category || 'General',
        message: draftToTest.message,
      });

      setResult(data);
      // Track VIEWED event
      if (data.id) {
        recordEvent(data.id, { eventType: 'VIEWED' });
      }
    } catch (err) {
      console.error('[CommunicationReviewDialog] Test error:', err);
      setError(err.message || 'Failed to complete stress test.');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = (rewriteText) => {
    if (onApplyRewrite) {
      onApplyRewrite(rewriteText);
      if (result && result.id) {
        recordEvent(result.id, { eventType: 'REWRITE_APPLIED' });
      }
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-[#EAE7E0] animate-in fade-in zoom-in-95 duration-200 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#EAE7E0] bg-[#FAF8F5] shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 shadow-xs">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h2 className="font-serif font-bold text-xl text-[#1D1B16] tracking-tight">
                Communication Stress-Test
              </h2>
              <p className="text-xs text-[#6B655C]">
                Simulate role-based workplace lenses before broadcasting.
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

        {/* Dialog Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-[#FAF8F5]/40">
          {/* Error Banner */}
          {error && (
            <div className="p-4 bg-rose-50 text-rose-800 text-xs rounded-2xl border border-rose-200 flex items-start gap-3 font-medium shadow-xs">
              <AlertTriangle size={16} className="shrink-0 text-rose-600 mt-0.5" />
              <div>
                <p className="font-bold">Execution Error</p>
                <p className="mt-0.5 text-rose-700">{error}</p>
                <p className="mt-1 text-[11px] text-rose-600">Your draft message has been safely preserved below.</p>
              </div>
            </div>
          )}

          {/* Draft Input Form (If no result yet or in review-only mode edit) */}
          {(!result || readOnly) && (
            <div className="bg-white rounded-2xl border border-[#EAE7E0] p-5 shadow-xs space-y-4">
              <h3 className="font-serif font-bold text-sm text-[#1D1B16]">Draft Message to Review</h3>
              
              <div>
                <label className="block text-[10px] font-bold text-[#6B655C] uppercase tracking-wider mb-1">
                  Title
                </label>
                <Input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="e.g. Urgent Delivery Timeline Update"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#6B655C] uppercase tracking-wider mb-1">
                  Message Content
                </label>
                <textarea
                  rows={4}
                  value={draft.message}
                  onChange={(e) => setDraft({ ...draft, message: e.target.value })}
                  placeholder="Write or paste draft message to stress test..."
                  className="w-full p-3 border border-[#EAE7E0] rounded-xl focus:ring-2 focus:ring-[#1F2B4D] outline-none text-xs text-[#1D1B16] font-medium"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => handleRunTest(draft)}
                  disabled={loading}
                  className="bg-[#1F2B4D] hover:bg-[#2B3A63] text-white text-xs px-5 py-2 rounded-xl font-bold flex items-center gap-2 shadow-xs"
                >
                  {loading ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" /> Analyzing Draft...
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={14} /> Run Stress Test
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Loading Skeleton */}
          {loading && (
            <div className="bg-white rounded-2xl border border-[#EAE7E0] p-8 text-center space-y-4">
              <div className="inline-flex p-4 rounded-full bg-amber-50 text-amber-700 animate-pulse">
                <ShieldCheck size={32} />
              </div>
              <div className="space-y-1">
                <h4 className="font-serif font-bold text-base text-[#1D1B16]">Simulating Workplace Lenses...</h4>
                <p className="text-xs text-[#6B655C]">
                  Analyzing draft against Senior Developer, HR Partner, and Product Lead perspectives.
                </p>
              </div>
            </div>
          )}

          {/* Analysis Results Display */}
          {!loading && result && (
            <div className="space-y-6">
              {/* 1. Friction Score Card */}
              <FrictionScoreCard
                score={result.overallFrictionScore || 0}
                band={result.frictionBand || 'LOW'}
                dimensionScores={result.dimensionScores || {}}
              />

              {/* 2. Rewrite Comparison */}
              {result.rewrite && (
                <RewriteComparison
                  originalMessage={draft.message}
                  rewrite={result.rewrite}
                  onApplyRewrite={onApplyRewrite ? handleApply : null}
                />
              )}

              {/* 3. Persona Reaction Cards (3 Columns) */}
              <div className="space-y-2">
                <h3 className="font-serif font-bold text-sm text-[#1D1B16] flex items-center gap-2">
                  <Sparkles size={16} className="text-amber-700" /> Workplace Lenses Feedback
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(result.personas || []).map((persona) => (
                    <PersonaReactionCard key={persona.key} persona={persona} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Disclaimer & Actions */}
        <div className="p-4 border-t border-[#EAE7E0] bg-[#FAF8F5] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <p className="text-[11px] text-[#6B655C] font-medium leading-tight text-center sm:text-left">
            🔒 <strong>Advisory Only:</strong> Crew never automatically publishes, blocks, or alters your draft.
          </p>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
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
    </div>
  );
};
