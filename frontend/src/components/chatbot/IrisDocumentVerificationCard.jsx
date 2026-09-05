import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { 
  FileCheck, ShieldAlert, AlertTriangle, FileText, Upload, 
  RefreshCw, CheckCircle2, XCircle, Info, ChevronDown, ChevronUp, Lock
} from 'lucide-react';

export default function IrisDocumentVerificationCard({ documentData, onActionTriggered }) {
  const [showExplanation, setShowExplanation] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  if (!documentData) return null;

  const {
    documentId,
    documentType,
    status = 'UPLOADED',
    confidence,
    warnings = [],
    extractedData,
    explanation,
    version = 1,
    evidenceFingerprint,
    timelineEvents = [],
  } = documentData;

  const isVerified = status === 'VERIFIED';
  const isRequiresReview = status === 'REQUIRES_REVIEW';
  const isMissing = status === 'MISSING';

  // Handle direct document upload right from the card
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const toastId = toast.loading(`Uploading ${file.name} to ImageKit...`);

    try {
      const formData = new FormData();
      formData.append('document', file);
      formData.append('title', file.name);
      formData.append('type', documentType || 'IDENTITY_PROOF');

      const res = await axios.post(
        `${import.meta.env.VITE_API_URL || ''}/api/chatbot/documents/upload`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      toast.success(`Uploaded ${file.name}! Analyzing with Iris...`, { id: toastId });
      if (onActionTriggered) {
        onActionTriggered(`I have uploaded the ${documentType || 'IDENTITY_PROOF'} document (${file.name}). Please analyze it and update onboarding status.`);
      }
    } catch (err) {
      console.error('Card Document Upload Error:', err);
      toast.error(err.response?.data?.error || 'Failed to upload document.', { id: toastId });
    } finally {
      setIsUploading(false);
    }
  };

  const handleReanalyze = () => {
    if (onActionTriggered && documentId) {
      onActionTriggered(`Analyze document ID ${documentId} with Iris AI Document Intelligence.`);
    }
  };

  return (
    <div className="my-4 rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white via-slate-50/50 to-indigo-50/20 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden transition-all duration-300">
      {/* Header Banner */}
      <div className={`p-4 sm:p-5 border-b flex items-center justify-between ${
        isVerified ? 'bg-emerald-50/80 border-emerald-200/70 text-emerald-900' :
        isRequiresReview ? 'bg-amber-50/80 border-amber-200/70 text-amber-900' :
        'bg-rose-50/80 border-rose-200/70 text-rose-900'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl shadow-xs ${
            isVerified ? 'bg-emerald-500 text-white' :
            isRequiresReview ? 'bg-amber-500 text-white' :
            'bg-rose-500 text-white'
          }`}>
            {isVerified ? <FileCheck size={20} /> :
             isRequiresReview ? <AlertTriangle size={20} /> :
             <ShieldAlert size={20} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold tracking-tight uppercase">
                {(documentType || 'Document').replace('_', ' ')}
              </h4>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-white/70 border border-current/20">
                v{version}
              </span>
            </div>
            <p className="text-[12px] font-medium opacity-80 mt-0.5">
              {isVerified ? 'Verified & Matched with Employee Profile' :
               isRequiresReview ? 'Human HR Review Required' :
               'Required Document Missing'}
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <span className={`text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-xs ${
          isVerified ? 'bg-emerald-600 text-white' :
          isRequiresReview ? 'bg-amber-600 text-white animate-pulse' :
          'bg-rose-600 text-white'
        }`}>
          {status}
        </span>
      </div>

      {/* Main Body */}
      <div className="p-4 sm:p-5 flex flex-col gap-4">
        {/* PII Masked Data & Fingerprint */}
        {extractedData && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-3.5 rounded-xl border border-slate-200/70 shadow-2xs">
            {extractedData.extractedName && (
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Extracted Name</span>
                <span className="text-xs font-semibold text-slate-800">{extractedData.extractedName}</span>
              </div>
            )}
            {extractedData.documentNumberMasked && (
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Masked Document ID</span>
                <span className="text-xs font-mono font-bold text-slate-800 flex items-center gap-1">
                  <Lock size={11} className="text-slate-400" />
                  {extractedData.documentNumberMasked}
                </span>
              </div>
            )}
            {evidenceFingerprint && (
              <div className="sm:col-span-2 pt-1 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-400">SHA-256 Fingerprint:</span>
                <span className="text-[10px] font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                  {evidenceFingerprint}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Warnings Banner */}
        {warnings && warnings.length > 0 && (
          <div className="bg-amber-50/90 border border-amber-200/80 rounded-xl p-3.5 text-xs text-amber-900 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-amber-800">
              <AlertTriangle size={14} />
              <span>Evidence Discrepancy Warnings ({warnings.length}):</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11.5px] font-medium text-amber-900/90 pl-1">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* "Why Did Iris Decide This?" Toggle */}
        {explanation && (
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
            <button
              onClick={() => setShowExplanation(!showExplanation)}
              className="w-full px-4 py-2.5 flex items-center justify-between bg-slate-50 hover:bg-slate-100/80 text-xs font-bold text-slate-700 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Info size={14} className="text-indigo-600" />
                Why Did Iris Decide This? (Evidence Panel)
              </span>
              {showExplanation ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showExplanation && (
              <div className="p-4 space-y-3 text-xs text-slate-700 bg-white border-t border-slate-200">
                <p className="font-medium italic text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  "{explanation.decisionReason}"
                </p>

                {/* Deterministic Checks Grid */}
                {explanation.deterministicChecks && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Deterministic Checks</span>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="flex items-center gap-1.5 font-medium">
                        {explanation.deterministicChecks.nameMatch ? <CheckCircle2 size={13} className="text-emerald-500" /> : <XCircle size={13} className="text-rose-500" />}
                        <span>Name Match</span>
                      </div>
                      <div className="flex items-center gap-1.5 font-medium">
                        {explanation.deterministicChecks.expiryValid ? <CheckCircle2 size={13} className="text-emerald-500" /> : <XCircle size={13} className="text-rose-500" />}
                        <span>Expiry Date Valid</span>
                      </div>
                      <div className="flex items-center gap-1.5 font-medium">
                        {explanation.deterministicChecks.noInternalConflicts ? <CheckCircle2 size={13} className="text-emerald-500" /> : <XCircle size={13} className="text-rose-500" />}
                        <span>No Internal Conflicts</span>
                      </div>
                      <div className="flex items-center gap-1.5 font-medium">
                        {explanation.deterministicChecks.promptInjectionIsolated ? <CheckCircle2 size={13} className="text-emerald-500" /> : <XCircle size={13} className="text-rose-500" />}
                        <span>Prompt Injection Isolated</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Card Action Buttons */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-200/70">
          {/* Direct File Upload Input */}
          <label className="flex-1 inline-flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs active:scale-[0.98]">
            <Upload size={14} />
            <span>{isUploading ? 'Uploading...' : 'Upload Document'}</span>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.docx"
              onChange={handleFileUpload}
              disabled={isUploading}
              className="hidden"
            />
          </label>

          {documentId && (
            <button
              onClick={handleReanalyze}
              disabled={isAnalyzing}
              className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-[0.98]"
            >
              <RefreshCw size={13} className={isAnalyzing ? 'animate-spin' : ''} />
              <span>Re-Analyze</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
