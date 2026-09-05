import React, { useState } from 'react';
import { Sparkles, Check, Copy, ArrowRight, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/Button';

export const RewriteComparison = ({ originalMessage = '', rewrite = null, onApplyRewrite }) => {
  const [copied, setCopied] = useState(false);

  if (!rewrite || !rewrite.message) {
    return null;
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(rewrite.message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-2xl border border-[#EAE7E0] p-5 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#EAE7E0]">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-purple-50 text-purple-700 border border-purple-200">
            <Sparkles size={16} />
          </div>
          <h3 className="font-serif font-bold text-base text-[#1D1B16]">AI-Suggested Rewrite</h3>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleCopy}
            className="text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-[#6B655C] hover:bg-[#FAF8F5]"
          >
            {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </Button>

          {onApplyRewrite && (
            <Button
              onClick={() => onApplyRewrite(rewrite.message)}
              className="text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5 bg-[#1F2B4D] hover:bg-[#2B3A63] text-white"
            >
              <Sparkles size={14} />
              <span>Apply to Composer</span>
            </Button>
          )}
        </div>
      </div>

      {/* Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Original */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B655C]">Original Draft</span>
          <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#EAE7E0] text-xs text-[#1D1B16] font-medium leading-relaxed whitespace-pre-wrap min-h-[120px]">
            {originalMessage}
          </div>
        </div>

        {/* Rewrite */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 flex items-center gap-1">
            <Sparkles size={12} /> Suggested Rewrite
          </span>
          <div className="p-3.5 rounded-xl bg-purple-50/40 border border-purple-200/60 text-xs text-[#1D1B16] font-medium leading-relaxed whitespace-pre-wrap min-h-[120px]">
            {rewrite.message}
          </div>
        </div>
      </div>

      {/* Metadata / Key Changes & Unresolved Risks */}
      <div className="pt-3 border-t border-[#EAE7E0] grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        {/* Preserved Intent & Key Changes */}
        {rewrite.changesMade && rewrite.changesMade.length > 0 && (
          <div className="space-y-2">
            <span className="font-bold text-[#1D1B16] flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-600" /> Key Improvements
            </span>
            <ul className="space-y-1 pl-5 list-disc text-[11px] text-[#6B655C]">
              {rewrite.changesMade.map((change, idx) => (
                <li key={idx}>{change}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Unresolved Risks */}
        {rewrite.unresolvedRisks && rewrite.unresolvedRisks.length > 0 && (
          <div className="space-y-2">
            <span className="font-bold text-[#1D1B16] flex items-center gap-1.5">
              <ShieldAlert size={14} className="text-amber-600" /> Action Required (Offline Confirmation)
            </span>
            <ul className="space-y-1 pl-5 list-disc text-[11px] text-[#6B655C]">
              {rewrite.unresolvedRisks.map((risk, idx) => (
                <li key={idx}>{risk}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
