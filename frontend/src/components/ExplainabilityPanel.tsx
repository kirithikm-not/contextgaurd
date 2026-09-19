'use client';

import React from 'react';
import { AccessEvaluationResult } from '@/types/contextguard';
import { 
  Bot, 
  ShieldCheck, 
  AlertCircle, 
  Sparkles, 
  TrendingUp, 
  SlidersHorizontal,
  FileText,
  Lock,
  ChevronRight
} from 'lucide-react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts';

interface ExplainabilityPanelProps {
  evaluation: AccessEvaluationResult | null;
}

export const ExplainabilityPanel: React.FC<ExplainabilityPanelProps> = ({ evaluation }) => {
  if (!evaluation) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-sm">
        <SlidersHorizontal className="w-10 h-10 mx-auto mb-3 opacity-40 animate-pulse text-indigo-400" />
        <p className="text-sm font-medium">Select or replay a scenario to view real-time risk explainability</p>
      </div>
    );
  }

  // Prepare chart data for 7 categories
  const radarData = [
    { subject: 'Identity', score: evaluation.category_scores.identity?.score || 0, weighted: evaluation.category_scores.identity?.weighted_score || 0 },
    { subject: 'Device', score: evaluation.category_scores.device?.score || 0, weighted: evaluation.category_scores.device?.weighted_score || 0 },
    { subject: 'Location', score: evaluation.category_scores.location?.score || 0, weighted: evaluation.category_scores.location?.weighted_score || 0 },
    { subject: 'Behavior', score: evaluation.category_scores.behavior?.score || 0, weighted: evaluation.category_scores.behavior?.weighted_score || 0 },
    { subject: 'Resource', score: evaluation.category_scores.resource?.score || 0, weighted: evaluation.category_scores.resource?.weighted_score || 0 },
    { subject: 'History', score: evaluation.category_scores.history?.score || 0, weighted: evaluation.category_scores.history?.weighted_score || 0 },
    { subject: 'Threat', score: evaluation.category_scores.threat?.score || 0, weighted: evaluation.category_scores.threat?.weighted_score || 0 },
  ];

  const getSeverityStyle = (sev: string) => {
    switch (sev.toLowerCase()) {
      case 'critical':
        return 'bg-rose-50 text-rose-800 border-rose-200 font-bold';
      case 'high':
        return 'bg-orange-50 text-orange-800 border-orange-200 font-bold';
      case 'medium':
        return 'bg-amber-50 text-amber-800 border-amber-200 font-bold';
      default:
        return 'bg-indigo-50 text-indigo-800 border-indigo-200 font-bold';
    }
  };

  const agent = evaluation.agent_reasoning;

  return (
    <div className="space-y-6">
      {/* AI SOC Analyst Card (Renders distinctly when agent is invoked) */}
      {evaluation.agent_invoked && agent && (
        <div className="relative overflow-hidden rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50/70 via-white to-sky-50/70 p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-indigo-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-100 text-indigo-700 border border-indigo-200 shadow-xs">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-base font-bold text-slate-900 tracking-tight">
                    Contextual Risk Reasoning Agent
                  </h4>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200 font-medium">
                    SOC AI Analyst
                  </span>
                </div>
                <p className="text-xs text-slate-500">Escalated via Ambiguous Zone / Conflicting Context Signals</p>
              </div>
            </div>

            {/* Confidence Gauge */}
            <div className="flex items-center gap-3 bg-white px-3.5 py-1.5 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-right">
                <div className="text-[10px] uppercase font-mono text-slate-500">AI Confidence</div>
                <div className="text-sm font-bold font-mono text-indigo-700">
                  {Math.round(agent.confidence * 100)}%
                </div>
              </div>
              <div className="w-16 bg-slate-200 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-indigo-500 to-sky-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.round(agent.confidence * 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Baseline vs Override Alert */}
          {agent.overrode_baseline ? (
            <div className="mt-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs flex items-center justify-between gap-2 shadow-xs">
              <div className="flex items-center gap-2 text-amber-900 font-medium">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong className="font-bold">Deterministic Override:</strong> Baseline rule result was{' '}
                  <span className="font-mono underline">{evaluation.deterministic_decision}</span> ({evaluation.deterministic_score}/100). Agent escalated outcome to{' '}
                  <span className="font-mono font-bold text-rose-800">{agent.decision}</span> ({evaluation.final_score}/100).
                </span>
              </div>
            </div>
          ) : (
            <div className="mt-4 p-3 rounded-xl bg-indigo-50/80 border border-indigo-200 text-xs flex items-center gap-2 text-indigo-900 shadow-xs">
              <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>
                Agent corroborated deterministic decision <span className="font-mono font-bold">{agent.decision}</span> with deep contextual analysis.
              </span>
            </div>
          )}

          {/* Agent Plain-English Narrative */}
          <div className="mt-4 space-y-2">
            <h5 className="text-xs font-semibold text-slate-700 uppercase tracking-wider font-mono flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-600" />
              SOC Investigation Narrative
            </h5>
            <div className="p-4 rounded-xl bg-white border border-slate-200 text-slate-800 text-sm leading-relaxed italic shadow-xs">
              &ldquo;{agent.narrative}&rdquo;
            </div>
          </div>

          {/* Key Contributing Signals & Step-Up Control */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Key Factors */}
            <div className="space-y-2">
              <h5 className="text-xs font-semibold text-slate-600 uppercase tracking-wider font-mono">
                Decisive Context Factors
              </h5>
              <ul className="space-y-1.5 text-xs text-slate-700">
                {agent.key_factors.map((factor, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <ChevronRight className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                    <span>{factor}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Recommended Control */}
            {agent.recommended_step_up_control && (
              <div className="space-y-2">
                <h5 className="text-xs font-semibold text-slate-600 uppercase tracking-wider font-mono">
                  Recommended Enforcement Action
                </h5>
                <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 flex items-start gap-2.5 shadow-xs">
                  <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span className="font-medium">{agent.recommended_step_up_control}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Visual Risk Breakdown: Radar Chart & Sub-Scores */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar Chart */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              7-Signal Risk Surface (Sub-Scores 0–100)
            </h4>
            <span className="text-[11px] font-mono text-slate-500">Multi-Dimensional</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="subject" stroke="#64748b" tick={{ fill: '#475569', fontSize: 11 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#cbd5e1" tick={{ fill: '#94a3b8', fontSize: 9 }} />
                <Radar
                  name="Category Risk (0-100)"
                  dataKey="score"
                  stroke="#6366f1"
                  fill="#818cf8"
                  fillOpacity={0.35}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Weighted Category Contribution Bars */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
              Weighted Contribution to Composite Score
            </h4>
            <span className="text-[11px] font-mono text-indigo-700 font-bold">
              Composite: {evaluation.deterministic_score}/100
            </span>
          </div>

          <div className="space-y-2.5 pt-1">
            {radarData.map((cat) => {
              const weightPct = Math.round((evaluation.category_scores[cat.subject.toLowerCase()]?.weight || 0) * 100);
              return (
                <div key={cat.subject} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-700 flex items-center gap-1.5">
                      {cat.subject}
                      <span className="text-[10px] text-slate-400 font-normal">({weightPct}% wt)</span>
                    </span>
                    <span className="text-slate-700">
                      <span className="text-indigo-700 font-bold">+{cat.weighted.toFixed(1)}</span>
                      <span className="text-slate-400 text-[10px]"> (raw: {cat.score})</span>
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-indigo-400 to-sky-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(0, cat.score))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Triggered Rules Breakdown */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            <h4 className="text-sm font-semibold text-slate-900">
              Triggered Policy Rules ({evaluation.fired_rules.length})
            </h4>
          </div>
          <span className="text-xs font-mono text-slate-500">
            {evaluation.fired_rules.filter(r => r.severity === 'critical' || r.severity === 'high').length} High/Critical
          </span>
        </div>

        {evaluation.fired_rules.length === 0 ? (
          <p className="text-xs text-slate-500 italic">No risk rules fired. All context dimensions within baseline parameters.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {evaluation.fired_rules.map((rule, idx) => (
              <div 
                key={idx} 
                className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 flex items-start gap-3 hover:border-slate-300 transition-all shadow-xs"
              >
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase shrink-0 border ${getSeverityStyle(rule.severity)}`}>
                  {rule.severity}
                </span>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-800">
                    <span className="font-bold">{rule.rule_id}</span>
                    <span className="text-amber-800 font-bold">+{rule.score_impact} pts</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug">
                    {rule.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
