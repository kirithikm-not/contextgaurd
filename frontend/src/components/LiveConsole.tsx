'use client';

import React from 'react';
import { AccessEvaluationResult, DemoScenario } from '@/types/contextguard';
import { DecisionBadge } from '@/components/DecisionBadge';
import { 
  Play, 
  Sparkles, 
  ShieldAlert, 
  User, 
  Laptop, 
  MapPin, 
  Clock, 
  Database,
  Radio,
  RotateCcw
} from 'lucide-react';

interface LiveConsoleProps {
  scenarios: DemoScenario[];
  activeScenarioId: string | null;
  evaluation: AccessEvaluationResult | null;
  loading: boolean;
  onSelectScenario: (scenarioId: string) => void;
  onReplay: () => void;
}

export const LiveConsole: React.FC<LiveConsoleProps> = ({
  scenarios,
  activeScenarioId,
  evaluation,
  loading,
  onSelectScenario,
  onReplay,
}) => {
  const getScoreColor = (score: number) => {
    if (score < 30) return 'text-emerald-700 border-emerald-300';
    if (score < 55) return 'text-amber-800 border-amber-300';
    if (score < 80) return 'text-orange-800 border-orange-300';
    return 'text-rose-800 border-rose-300';
  };

  const getScoreBg = (score: number) => {
    if (score < 30) return 'bg-emerald-400';
    if (score < 55) return 'bg-amber-400';
    if (score < 80) return 'bg-orange-400';
    return 'bg-rose-400';
  };

  return (
    <div className="space-y-6">
      {/* 4 Canonical Scenario Buttons */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider font-mono flex items-center gap-2">
            <Radio className="w-4 h-4 text-indigo-600 animate-pulse" />
            Canonical Access Scenarios (Same Identity: Sarah Chen)
          </h3>
          <span className="text-xs text-slate-500 font-mono">Proof: Context Beats Role</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
          {scenarios.map((scen, idx) => {
            const isActive = activeScenarioId === scen.id;
            return (
              <button
                key={scen.id}
                onClick={() => onSelectScenario(scen.id)}
                className={`p-4 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                  isActive
                    ? 'border-indigo-300 bg-indigo-50/80 shadow-sm ring-1 ring-indigo-300'
                    : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/30 shadow-xs'
                }`}
              >
                {isActive && (
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500" />
                )}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                      Scenario {idx + 1}
                    </span>
                    <span className={`text-[11px] font-mono font-bold ${
                      scen.expected_decision === 'Allow' ? 'text-emerald-700' :
                      scen.expected_decision === 'Challenge' ? 'text-amber-800' :
                      scen.expected_decision === 'Restrict' ? 'text-orange-800' : 'text-rose-800'
                    }`}>
                      ➔ {scen.expected_decision}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 leading-snug">
                    {scen.title.split('. ')[1] || scen.title}
                  </h4>
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {scen.description}
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-500">Expected Decision</span>
                  <span className="text-indigo-600 font-semibold flex items-center gap-1">
                    <Play className="w-3 h-3 fill-indigo-600 text-indigo-600" /> Run Evaluation
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Real-Time Decision & Risk Score Display */}
      {evaluation && (
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
                <span>EVALUATION ID:</span>
                <span className="text-indigo-600 font-bold">{evaluation.evaluation_id}</span>
                <span className="text-slate-300">•</span>
                <span>{new Date(evaluation.timestamp).toLocaleTimeString()}</span>
              </div>
              <h3 className="text-xl font-extrabold text-slate-900 mt-1 flex items-center gap-2">
                Access Decision Resolution
              </h3>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={onReplay}
                disabled={loading}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-mono text-slate-700 flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Re-Evaluate
              </button>
              <DecisionBadge 
                decision={evaluation.final_decision} 
                size="xl" 
                isOverride={Boolean(evaluation.agent_reasoning?.overrode_baseline)}
              />
            </div>
          </div>

          {/* Score Meters: Baseline vs Final Score */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {/* Main Score Circular Gauge / Box */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-5 flex flex-col items-center justify-center text-center space-y-2">
              <div className="text-xs uppercase font-mono text-slate-500">Composite Risk Score</div>
              <div className={`text-5xl font-extrabold font-mono tracking-tight ${getScoreColor(evaluation.final_score).split(' ')[0]}`}>
                {evaluation.final_score.toFixed(1)}
                <span className="text-sm text-slate-400 font-normal">/100</span>
              </div>
              <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden mt-2">
                <div 
                  className={`h-full rounded-full transition-all duration-700 ${getScoreBg(evaluation.final_score)}`}
                  style={{ width: `${Math.min(100, Math.max(0, evaluation.final_score))}%` }}
                />
              </div>
              <span className="text-[11px] font-mono text-slate-600 font-medium">
                {evaluation.final_score < 30 ? 'Low Risk Tier' :
                 evaluation.final_score < 55 ? 'Medium Risk Tier (Step-up Required)' :
                 evaluation.final_score < 80 ? 'High Risk Tier (Sandboxed)' : 'Critical Threat (Blocked)'}
              </span>
            </div>

            {/* Score Comparison & Ambiguity Flag */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-5 space-y-3 md:col-span-2">
              <div className="flex items-center justify-between text-xs font-mono border-b border-slate-200 pb-2">
                <span className="text-slate-500">Deterministic Engine Score:</span>
                <span className="text-slate-900 font-bold">{evaluation.deterministic_score.toFixed(1)}/100</span>
                <span className="text-slate-500">Deterministic Decision:</span>
                <span className="font-bold text-slate-800">{evaluation.deterministic_decision}</span>
              </div>

              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-500">Ambiguity Zone Triggered:</span>
                <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                  evaluation.is_ambiguous ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-slate-200/80 text-slate-600'
                }`}>
                  {evaluation.is_ambiguous ? 'YES (Escalated to Agent)' : 'NO (Deterministic Resolution)'}
                </span>
                <span className="text-slate-500">Agent Invoked:</span>
                <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                  evaluation.agent_invoked ? 'bg-indigo-100 text-indigo-900 border border-indigo-200' : 'bg-slate-200/80 text-slate-600'
                }`}>
                  {evaluation.agent_invoked ? 'TRUE' : 'FALSE'}
                </span>
              </div>

              {/* Rationale Bar */}
              <div className="pt-2 text-xs text-slate-700 leading-relaxed bg-white p-3 rounded-lg border border-slate-200 font-sans shadow-xs">
                <strong className="text-indigo-700 font-mono">Decision Rationale: </strong>
                {evaluation.decision_rationale}
              </div>
            </div>
          </div>

          {/* Context Signals Snapshot */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
            <div className="p-3 rounded-lg border border-slate-200 bg-white text-xs space-y-1 font-mono shadow-xs">
              <div className="text-slate-500 flex items-center gap-1"><User className="w-3 h-3 text-indigo-600" /> Identity</div>
              <div className="text-slate-900 font-bold truncate">{evaluation.context.identity.user_id}</div>
              <div className="text-[10px] text-slate-500 truncate">{evaluation.context.identity.role}</div>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 bg-white text-xs space-y-1 font-mono shadow-xs">
              <div className="text-slate-500 flex items-center gap-1"><Laptop className="w-3 h-3 text-emerald-600" /> Device</div>
              <div className="text-slate-900 font-bold truncate">{evaluation.context.device.device_id}</div>
              <div className="text-[10px] text-slate-500">
                {evaluation.context.device.is_managed ? 'Managed MDM' : 'BYOD / Unmanaged'}
              </div>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 bg-white text-xs space-y-1 font-mono shadow-xs">
              <div className="text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3 text-purple-600" /> Location</div>
              <div className="text-slate-900 font-bold truncate">
                {evaluation.context.location.geo_ip_city}, {evaluation.context.location.geo_ip_country}
              </div>
              <div className="text-[10px] text-slate-500">
                {evaluation.context.location.is_corporate_network ? 'Corporate IP' : 'External Subnet'}
              </div>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 bg-white text-xs space-y-1 font-mono shadow-xs">
              <div className="text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3 text-amber-600" /> Request Time</div>
              <div className="text-slate-900 font-bold">{evaluation.context.behavior.request_time_hour.toString().padStart(2, '0')}:00</div>
              <div className="text-[10px] text-slate-500">
                {evaluation.context.behavior.is_outside_working_hours ? 'Off-Hours Anomaly' : 'Business Hours'}
              </div>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 bg-white text-xs space-y-1 font-mono shadow-xs">
              <div className="text-slate-500 flex items-center gap-1"><Database className="w-3 h-3 text-sky-600" /> Resource</div>
              <div className="text-slate-900 font-bold truncate">{evaluation.context.resource.resource_id}</div>
              <div className="text-[10px] uppercase font-bold text-amber-800">
                {evaluation.context.resource.sensitivity_tier} ({evaluation.context.resource.action})
              </div>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 bg-white text-xs space-y-1 font-mono shadow-xs">
              <div className="text-slate-500 flex items-center gap-1"><ShieldAlert className="w-3 h-3 text-rose-600" /> Threat Intel</div>
              <div className={`font-bold ${
                evaluation.context.threat.known_bad_ip || evaluation.context.threat.leaked_credential_flag ? 'text-rose-700' : 'text-emerald-700'
              }`}>
                {evaluation.context.threat.known_bad_ip || evaluation.context.threat.leaked_credential_flag ? 'THREAT MATCH' : 'CLEAN FEED'}
              </div>
              <div className="text-[10px] text-slate-500">
                {evaluation.context.threat.leaked_credential_flag ? 'Credential Leaked' : 'No Active Dump'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
