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
          bg: 'bg-emerald-50/90 border-emerald-300 text-emerald-800',
          glow: 'shadow-xs shadow-emerald-200/60',
          icon: CheckCircle2,
          pulse: 'bg-emerald-500',
        };
      case 'Challenge':
        return {
          bg: 'bg-amber-50/90 border-amber-300 text-amber-900',
          glow: 'shadow-xs shadow-amber-200/60',
          icon: AlertTriangle,
          pulse: 'bg-amber-500',
        };
      case 'Restrict':
        return {
          bg: 'bg-orange-50/90 border-orange-300 text-orange-900',
          glow: 'shadow-xs shadow-orange-200/60',
          icon: ShieldAlert,
          pulse: 'bg-orange-500',
        };
      case 'Deny':
        return {
          bg: 'bg-rose-50/90 border-rose-300 text-rose-900',
          glow: 'shadow-xs shadow-rose-200/60',
          icon: XCircle,
          pulse: 'bg-rose-500',
        };
      default:
        return {
          bg: 'bg-slate-100 border-slate-300 text-slate-800',
          glow: '',
          icon: AlertTriangle,
          pulse: 'bg-slate-500',
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
        className={`inline-flex items-center rounded-full border font-mono uppercase tracking-wider font-bold transition-all duration-300 ${style.bg} ${style.glow} ${sizeClasses[size]}`}
      >
        {showIcon && <Icon className={`${iconSizes[size]} shrink-0`} />}
        <span>{decision}</span>
        {isOverride && (
          <span className="flex items-center gap-1 text-[10px] font-sans font-semibold normal-case px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
            <Sparkles className="w-3 h-3 text-indigo-600" /> AI Override
          </span>
        )}
      </span>
    </div>
  );
};
