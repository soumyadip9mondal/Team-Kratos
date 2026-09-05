import React from 'react';
import { Code, Users, Compass, AlertCircle, Quote, Sparkles } from 'lucide-react';

const PERSONA_ICONS = {
  senior_developer: { icon: Code, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  hr_people_partner: { icon: Users, color: 'text-pink-600 bg-pink-50 border-pink-200' },
  product_lead: { icon: Compass, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
};

const SEVERITY_STYLES = {
  LOW: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  MEDIUM: 'bg-amber-50 text-amber-700 border-amber-200',
  HIGH: 'bg-orange-50 text-orange-700 border-orange-200',
  CRITICAL: 'bg-rose-50 text-rose-700 border-rose-200 font-bold',
};

export const PersonaReactionCard = ({ persona }) => {
  const meta = PERSONA_ICONS[persona.key] || { icon: Users, color: 'text-slate-600 bg-slate-50 border-slate-200' };
  const IconComponent = meta.icon;

  const concerns = persona.concerns || [];

  return (
    <div className="bg-white rounded-2xl border border-[#EAE7E0] p-5 shadow-xs flex flex-col justify-between space-y-4">
      <div>
        {/* Header */}
        <div className="flex items-center gap-3 pb-3 border-b border-[#EAE7E0]">
          <div className={`p-2.5 rounded-xl border ${meta.color} shrink-0`}>
            <IconComponent size={18} />
          </div>
          <div>
            <h3 className="font-serif font-bold text-base text-[#1D1B16]">{persona.name}</h3>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B655C]">
              {persona.roleFamily || 'Workplace Lens'}
            </span>
          </div>
        </div>

        {/* Reaction Summary */}
        {persona.summary && (
          <p className="mt-3 text-xs text-[#1D1B16] font-medium leading-relaxed bg-[#FAF8F5] p-3 rounded-xl border border-[#EAE7E0]">
            "{persona.summary}"
          </p>
        )}

        {/* Concerns List */}
        <div className="mt-4 space-y-3">
          {concerns.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-100 font-medium">
              <Sparkles size={14} className="shrink-0 text-emerald-600" />
              <span>No major friction points identified by this lens.</span>
            </div>
          ) : (
            concerns.map((c, idx) => {
              const sevClass = SEVERITY_STYLES[c.severity?.toUpperCase()] || SEVERITY_STYLES.LOW;
              return (
                <div key={idx} className="p-3 rounded-xl border border-[#EAE7E0] bg-white space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold font-mono text-[#1D1B16] uppercase tracking-wide">
                      {c.type?.replace(/_/g, ' ')}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border uppercase ${sevClass}`}>
                      {c.severity}
                    </span>
                  </div>

                  {/* Evidence quote */}
                  {c.evidence && (
                    <div className="flex items-start gap-1.5 text-xs italic text-[#6B655C] bg-[#FAF8F5] p-2 rounded-lg border border-[#EAE7E0]">
                      <Quote size={12} className="shrink-0 text-[#8C5722] mt-0.5" />
                      <span>"{c.evidence}"</span>
                    </div>
                  )}

                  {/* Impact & Mitigation */}
                  <div className="text-xs text-[#1D1B16] space-y-1">
                    {c.impact && (
                      <p className="text-[11px] text-[#6B655C]">
                        <strong className="text-[#1D1B16]">Impact:</strong> {c.impact}
                      </p>
                    )}
                    {c.mitigation && (
                      <p className="text-[11px] text-emerald-800 bg-emerald-50/50 p-2 rounded-lg border border-emerald-100">
                        <strong className="text-emerald-900">Suggested Fix:</strong> {c.mitigation}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
