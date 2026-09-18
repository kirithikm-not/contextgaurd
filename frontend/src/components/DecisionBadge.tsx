'use client';

import React from 'react';
import { DecisionType } from '@/types/contextguard';
import { CheckCircle2, AlertTriangle, ShieldAlert, XCircle, Sparkles } from 'lucide-react';

interface DecisionBadgeProps {
  decision: DecisionType;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showIcon?: boolean;
  isOverride?: boolean;
}

export const DecisionBadge: React.FC<DecisionBadgeProps> = ({
  decision,
  size = 'md',
  showIcon = true,
  isOverride = false,
}) => {
  const getBadgeStyle = () => {
    switch (decision) {
      case 'Allow':
        return {
          bg: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400',
          glow: 'shadow-emerald-500/20 shadow-lg',
          icon: CheckCircle2,
          pulse: 'bg-emerald-400',
        };
      case 'Challenge':
        return {
          bg: 'bg-amber-500/15 border-amber-500/40 text-amber-400',
          glow: 'shadow-amber-500/20 shadow-lg',
          icon: AlertTriangle,
          pulse: 'bg-amber-400',
        };
      case 'Restrict':
        return {
          bg: 'bg-orange-500/15 border-orange-500/40 text-orange-400',
          glow: 'shadow-orange-500/20 shadow-lg',
          icon: ShieldAlert,
          pulse: 'bg-orange-400',
        };
      case 'Deny':
        return {
          bg: 'bg-rose-500/15 border-rose-500/40 text-rose-400',
          glow: 'shadow-rose-500/20 shadow-lg',
          icon: XCircle,
          pulse: 'bg-rose-400',
        };
      default:
        return {
          bg: 'bg-slate-800 border-slate-700 text-slate-300',
          glow: '',
          icon: AlertTriangle,
          pulse: 'bg-slate-400',
        };
    }
  };

  const style = getBadgeStyle();
  const Icon = style.icon;

  const sizeClasses = {
    sm: 'text-xs px-2.5 py-0.5 gap-1.5',
    md: 'text-sm px-3.5 py-1 gap-2',
    lg: 'text-base px-4 py-1.5 gap-2.5 font-bold',
    xl: 'text-xl px-6 py-2.5 gap-3 font-extrabold tracking-wide',
  };

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
    xl: 'w-6 h-6',
  };

  return (
    <div className="relative inline-flex items-center">
      <span
        className={`inline-flex items-center rounded-full border font-mono uppercase tracking-wider backdrop-blur-md transition-all duration-300 ${style.bg} ${style.glow} ${sizeClasses[size]}`}
      >
        {showIcon && <Icon className={`${iconSizes[size]} shrink-0`} />}
        <span>{decision}</span>
        {isOverride && (
          <span className="flex items-center gap-1 text-[10px] font-sans font-semibold normal-case px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/40">
            <Sparkles className="w-3 h-3 text-cyan-400" /> AI Override
          </span>
        )}
      </span>
    </div>
  );
};
