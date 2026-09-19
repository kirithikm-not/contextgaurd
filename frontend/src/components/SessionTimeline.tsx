'use client';

import React, { useState } from 'react';
import { DecisionBadge } from '@/components/DecisionBadge';
import { Play, Clock, ArrowRight, Shield, ShieldAlert, Sparkles, CheckCircle2, ChevronRight } from 'lucide-react';

interface TimelineStep {
  step: number;
  time_label: string;
  event_description: string;
  context_diff: string;
  expected_decision: string;
  evaluation: any;
}

interface SessionTimelineProps {
  onRunDrift: () => Promise<TimelineStep[]>;
  loading: boolean;
}

export const SessionTimeline: React.FC<SessionTimelineProps> = ({
  onRunDrift,
  loading,
}) => {
  const [timeline, setTimeline] = useState<TimelineStep[]>([]);
  const [selectedStep, setSelectedStep] = useState<TimelineStep | null>(null);

  const handleRun = async () => {
    const steps = await onRunDrift();
    setTimeline(steps);
    if (steps.length > 0) {
      setSelectedStep(steps[0]);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-600" />
              Continuous Session Risk Drift Timeline
            </h3>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium">
              Not Just One-Time Login
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Re-evaluates risk per request throughout an active session. Shows automated privileges stepping down dynamically as device posture degrades and impossible travel is detected.
          </p>
        </div>

        <button
          onClick={handleRun}
          disabled={loading}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-sky-500 hover:from-indigo-600 hover:to-sky-600 text-white font-bold text-xs font-mono flex items-center gap-2 shadow-sm shadow-indigo-200 transition-all disabled:opacity-50"
        >
          <Play className={`w-3.5 h-3.5 fill-current ${loading ? 'animate-spin' : ''}`} />
          Run Live Session Drift Simulation
        </button>
      </div>

      {/* Horizontal Step Timeline */}
      {timeline.length > 0 ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {timeline.map((item) => {
              const isSelected = selectedStep?.step === item.step;
              const decision = item.evaluation.final_decision;
              return (
                <div
                  key={item.step}
                  onClick={() => setSelectedStep(item)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all relative overflow-hidden flex flex-col justify-between ${
                    isSelected
                      ? 'border-indigo-300 bg-indigo-50/80 shadow-sm ring-1 ring-indigo-300'
                      : 'border-slate-200 bg-slate-50/70 hover:border-indigo-200 hover:bg-white shadow-xs'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-500">{item.time_label}</span>
                      <span className="text-[11px] font-bold text-indigo-700">Step {item.step}</span>
                    </div>

                    <div className="py-1">
                      <DecisionBadge decision={decision} size="sm" />
                    </div>

                    <div className="text-xs text-slate-900 font-semibold line-clamp-2 leading-snug">
                      {item.event_description}
                    </div>

                    <div className="text-[11px] font-mono text-slate-500 pt-1 border-t border-slate-200">
                      Score: <span className="text-slate-900 font-bold">{item.evaluation.final_score.toFixed(1)}/100</span>
                    </div>
                  </div>

                  <div className="mt-3 text-[10px] font-mono text-indigo-600 font-semibold flex items-center gap-1">
                    <span>Inspect Step Telemetry</span>
                    <ChevronRight className="w-3 h-3" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected Step Deep Dive Drawer */}
          {selectedStep && (
            <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-3 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-indigo-700">
                    STEP {selectedStep.step} DRIFT TELEMETRY ({selectedStep.time_label})
                  </span>
                </div>
                <DecisionBadge decision={selectedStep.evaluation.final_decision} size="sm" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <span className="text-slate-500 font-mono">Contextual Transition:</span>
                  <p className="text-slate-900 font-semibold">{selectedStep.event_description}</p>
                  <p className="text-[11px] text-amber-800 font-mono pt-1">Diff: {selectedStep.context_diff}</p>
                </div>

                <div className="space-y-1 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-slate-500 font-mono">Executive Rationale:</span>
                  <p className="text-slate-700 leading-relaxed">{selectedStep.evaluation.decision_rationale}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-8 text-center text-slate-500 rounded-xl border border-dashed border-slate-300 bg-slate-50/50">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-40 animate-pulse text-indigo-400" />
          <p className="text-sm font-medium">Click &ldquo;Run Live Session Drift Simulation&rdquo; to execute the continuous multi-hour sequence.</p>
        </div>
      )}
    </div>
  );
};
