import React from 'react';
import { AlertTriangle, ShieldCheck, Info, CheckCircle2 } from 'lucide-react';

const BAND_CONFIG = {
  LOW: {
    label: 'Low Friction',
    bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    gaugeColor: '#10B981',
    icon: CheckCircle2,
    desc: 'Message is clear, balanced, and unlikely to cause team friction.',
  },
  MODERATE: {
    label: 'Moderate Friction',
    bg: 'bg-amber-50 text-amber-800 border-amber-200',
    gaugeColor: '#F59E0B',
    icon: Info,
    desc: 'Contains minor ambiguity or workload concerns. Consider reviewing.',
  },
  HIGH: {
    label: 'High Friction',
    bg: 'bg-orange-50 text-orange-800 border-orange-200',
    gaugeColor: '#F97316',
    icon: AlertTriangle,
    desc: 'Significant risk of deadline, testing, or clarity pushback.',
  },
  CRITICAL: {
    label: 'Critical Friction',
    bg: 'bg-rose-50 text-rose-800 border-rose-200',
    gaugeColor: '#EF4444',
    icon: AlertTriangle,
    desc: 'High risk of after-hours pressure, policy issue, or team burnout.',
  },
};

const DIMENSIONS = [
  { key: 'clarity', label: 'Clarity', weight: '25%' },
  { key: 'workload', label: 'Workload & Capacity', weight: '25%' },
  { key: 'fairness', label: 'Fairness & Tone', weight: '20%' },
  { key: 'delivery', label: 'Delivery & Release', weight: '20%' },
  { key: 'tone', label: 'Tone', weight: '10%' },
];

export const FrictionScoreCard = ({ score = 0, band = 'LOW', dimensionScores = {} }) => {
  const config = BAND_CONFIG[band] || BAND_CONFIG.LOW;
  const BandIcon = config.icon;

  return (
    <div className="bg-white rounded-2xl border border-[#EAE7E0] p-5 shadow-xs">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#EAE7E0]">
        {/* Left: Radial Score Indicator */}
        <div className="flex items-center gap-4">
          <div className="relative flex items-center justify-center w-20 h-20 shrink-0">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-slate-100"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                strokeWidth="3.5"
                strokeDasharray={`${score}, 100`}
                strokeLinecap="round"
                stroke={config.gaugeColor}
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-xl font-bold font-serif text-[#1D1B16]">{score}</span>
              <span className="text-[9px] uppercase font-bold text-[#6B655C] tracking-wider">/ 100</span>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${config.bg}`}>
                <BandIcon size={13} /> {config.label}
              </span>
            </div>
            <p className="text-xs text-[#6B655C] font-medium leading-relaxed max-w-sm">{config.desc}</p>
          </div>
        </div>
      </div>

      {/* Right / Bottom: 5 Dimension Bars */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {DIMENSIONS.map((dim) => {
          const dimScore = dimensionScores[dim.key] || 0;
          return (
            <div key={dim.key} className="space-y-1">
              <div className="flex justify-between items-center text-[11px] font-medium">
                <span className="text-[#1D1B16] font-semibold">{dim.label}</span>
                <span className="text-[#6B655C] font-mono font-bold">{dimScore}%</span>
              </div>
              <div className="w-full bg-[#F4F1EA] h-2 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${Math.min(100, Math.max(0, dimScore))}%`,
                    backgroundColor:
                      dimScore >= 75 ? '#EF4444' : dimScore >= 50 ? '#F97316' : dimScore >= 25 ? '#F59E0B' : '#10B981',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
