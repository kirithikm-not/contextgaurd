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
    if (score < 30) return 'text-emerald-400 border-emerald-500';
    if (score < 55) return 'text-amber-400 border-amber-500';
    if (score < 80) return 'text-orange-400 border-orange-500';
    return 'text-rose-400 border-rose-500';
  };

  const getScoreBg = (score: number) => {
    if (score < 30) return 'bg-emerald-500';
    if (score < 55) return 'bg-amber-500';
    if (score < 80) return 'bg-orange-500';
    return 'bg-rose-500';
  };

  return (
    <div className="space-y-6">
      {/* 4 Canonical Scenario Buttons */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-mono flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
            Canonical Access Scenarios (Same Identity: Sarah Chen)
          </h3>
          <span className="text-xs text-slate-400 font-mono">Proof: Context Beats Role</span>
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
                    ? 'border-cyan-500 bg-cyan-950/30 shadow-lg shadow-cyan-950/40 ring-1 ring-cyan-500/50'
                    : 'border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-900/80'
                }`}
              >
                {isActive && (
                  <div className="absolute top-0 left-0 w-1 h-full bg-cyan-400" />
                )}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      Scenario {idx + 1}
                    </span>
                    <span className={`text-[11px] font-mono font-bold ${
                      scen.expected_decision === 'Allow' ? 'text-emerald-400' :
                      scen.expected_decision === 'Challenge' ? 'text-amber-400' :
                      scen.expected_decision === 'Restrict' ? 'text-orange-400' : 'text-rose-400'
                    }`}>
                      ➔ {scen.expected_decision}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white leading-snug">
                    {scen.title.split('. ')[1] || scen.title}
                  </h4>
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {scen.description}
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-500">Expected Decision</span>
                  <span className="text-slate-300 font-semibold flex items-center gap-1">
                    <Play className="w-3 h-3 text-cyan-400 fill-cyan-400" /> Run Evaluation
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Real-Time Decision & Risk Score Display */}
      {evaluation && (
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-md p-6 shadow-2xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                <span>EVALUATION ID:</span>
                <span className="text-cyan-400 font-bold">{evaluation.evaluation_id}</span>
                <span className="text-slate-600">•</span>
                <span>{new Date(evaluation.timestamp).toLocaleTimeString()}</span>
              </div>
              <h3 className="text-xl font-extrabold text-white mt-1 flex items-center gap-2">
                Access Decision Resolution
              </h3>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={onReplay}
                disabled={loading}
                className="px-3.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-200 flex items-center gap-1.5 transition-all disabled:opacity-50"
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
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 flex flex-col items-center justify-center text-center space-y-2">
              <div className="text-xs uppercase font-mono text-slate-400">Composite Risk Score</div>
              <div className={`text-5xl font-extrabold font-mono tracking-tight ${getScoreColor(evaluation.final_score).split(' ')[0]}`}>
                {evaluation.final_score.toFixed(1)}
                <span className="text-sm text-slate-500 font-normal">/100</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-2">
                <div 
                  className={`h-full rounded-full transition-all duration-700 ${getScoreBg(evaluation.final_score)}`}
                  style={{ width: `${Math.min(100, Math.max(0, evaluation.final_score))}%` }}
                />
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                {evaluation.final_score < 30 ? 'Low Risk Tier' :
                 evaluation.final_score < 55 ? 'Medium Risk Tier (Step-up Required)' :
                 evaluation.final_score < 80 ? 'High Risk Tier (Sandboxed)' : 'Critical Threat (Blocked)'}
              </span>
            </div>

            {/* Score Comparison & Ambiguity Flag */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-3 md:col-span-2">
              <div className="flex items-center justify-between text-xs font-mono border-b border-slate-800/80 pb-2">
                <span className="text-slate-400">Deterministic Engine Score:</span>
                <span className="text-white font-bold">{evaluation.deterministic_score.toFixed(1)}/100</span>
                <span className="text-slate-400">Deterministic Decision:</span>
                <span className="font-bold text-slate-200">{evaluation.deterministic_decision}</span>
              </div>

              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">Ambiguity Zone Triggered:</span>
                <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                  evaluation.is_ambiguous ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-800 text-slate-400'
                }`}>
                  {evaluation.is_ambiguous ? 'YES (Escalated to Agent)' : 'NO (Deterministic Resolution)'}
                </span>
                <span className="text-slate-400">Agent Invoked:</span>
                <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                  evaluation.agent_invoked ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-slate-800 text-slate-400'
                }`}>
                  {evaluation.agent_invoked ? 'TRUE' : 'FALSE'}
                </span>
              </div>

              {/* Rationale Bar */}
              <div className="pt-2 text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-3 rounded-lg border border-slate-800/60 font-sans">
                <strong className="text-cyan-400 font-mono">Decision Rationale: </strong>
                {evaluation.decision_rationale}
              </div>
            </div>
          </div>

          {/* Context Signals Snapshot */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
            <div className="p-3 rounded-lg border border-slate-800/80 bg-slate-950/40 text-xs space-y-1 font-mono">
              <div className="text-slate-500 flex items-center gap-1"><User className="w-3 h-3 text-cyan-400" /> Identity</div>
              <div className="text-white font-bold truncate">{evaluation.context.identity.user_id}</div>
              <div className="text-[10px] text-slate-400 truncate">{evaluation.context.identity.role}</div>
            </div>

            <div className="p-3 rounded-lg border border-slate-800/80 bg-slate-950/40 text-xs space-y-1 font-mono">
              <div className="text-slate-500 flex items-center gap-1"><Laptop className="w-3 h-3 text-emerald-400" /> Device</div>
              <div className="text-white font-bold truncate">{evaluation.context.device.device_id}</div>
              <div className="text-[10px] text-slate-400">
                {evaluation.context.device.is_managed ? 'Managed MDM' : 'BYOD / Unmanaged'}
              </div>
            </div>

            <div className="p-3 rounded-lg border border-slate-800/80 bg-slate-950/40 text-xs space-y-1 font-mono">
              <div className="text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3 text-purple-400" /> Location</div>
              <div className="text-white font-bold truncate">
                {evaluation.context.location.geo_ip_city}, {evaluation.context.location.geo_ip_country}
              </div>
              <div className="text-[10px] text-slate-400">
                {evaluation.context.location.is_corporate_network ? 'Corporate IP' : 'External Subnet'}
              </div>
            </div>

            <div className="p-3 rounded-lg border border-slate-800/80 bg-slate-950/40 text-xs space-y-1 font-mono">
              <div className="text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3 text-amber-400" /> Request Time</div>
              <div className="text-white font-bold">{evaluation.context.behavior.request_time_hour.toString().padStart(2, '0')}:00</div>
              <div className="text-[10px] text-slate-400">
                {evaluation.context.behavior.is_outside_working_hours ? 'Off-Hours Anomaly' : 'Business Hours'}
              </div>
            </div>

            <div className="p-3 rounded-lg border border-slate-800/80 bg-slate-950/40 text-xs space-y-1 font-mono">
              <div className="text-slate-500 flex items-center gap-1"><Database className="w-3 h-3 text-cyan-400" /> Resource</div>
              <div className="text-white font-bold truncate">{evaluation.context.resource.resource_id}</div>
              <div className="text-[10px] uppercase font-bold text-amber-400">
                {evaluation.context.resource.sensitivity_tier} ({evaluation.context.resource.action})
              </div>
            </div>

            <div className="p-3 rounded-lg border border-slate-800/80 bg-slate-950/40 text-xs space-y-1 font-mono">
              <div className="text-slate-500 flex items-center gap-1"><ShieldAlert className="w-3 h-3 text-rose-400" /> Threat Intel</div>
              <div className={`font-bold ${
                evaluation.context.threat.known_bad_ip || evaluation.context.threat.leaked_credential_flag ? 'text-rose-400' : 'text-emerald-400'
              }`}>
                {evaluation.context.threat.known_bad_ip || evaluation.context.threat.leaked_credential_flag ? 'THREAT MATCH' : 'CLEAN FEED'}
              </div>
              <div className="text-[10px] text-slate-400">
                {evaluation.context.threat.leaked_credential_flag ? 'Credential Leaked' : 'No Active Dump'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
