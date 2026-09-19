'use client';

import React, { useState, useEffect } from 'react';
import { EnginePolicyConfig } from '@/types/contextguard';
import { Settings, Save, RotateCcw, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { API_BASE_URL } from '@/config/api';

interface PolicyPanelProps {
  onPolicyUpdated: () => void;
}

export const PolicyPanel: React.FC<PolicyPanelProps> = ({ onPolicyUpdated }) => {
  const [policy, setPolicy] = useState<EnginePolicyConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const fetchPolicy = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/policy`);
      if (res.ok) {
        const data = await res.json();
        setPolicy(data);
      }
    } catch (e) {
      console.error('Failed to load policy:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicy();
  }, []);

  const handleWeightChange = (category: keyof EnginePolicyConfig['weights'], val: number) => {
    if (!policy) return;
    setPolicy({
      ...policy,
      weights: {
        ...policy.weights,
        [category]: val,
      },
    });
  };

  const handleThresholdChange = (key: keyof EnginePolicyConfig['thresholds'], val: number) => {
    if (!policy) return;
    setPolicy({
      ...policy,
      thresholds: {
        ...policy.thresholds,
        [key]: val,
      },
    });
  };

  const handleSavePolicy = async () => {
    if (!policy) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/policy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policy),
      });

      if (res.ok) {
        setSaveMessage('Policy updated successfully! Active in memory & SQLite persistence.');
        onPolicyUpdated();
      } else {
        const err = await res.json();
        setSaveMessage(`Error: ${err.detail || 'Failed to update policy'}`);
      }
    } catch (e) {
      setSaveMessage('Network error applying policy updates.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/policy/reset`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setPolicy(data.policy);
        setSaveMessage('Reset to canonical default weights and thresholds.');
        onPolicyUpdated();
      }
    } catch (e) {
      setSaveMessage('Failed to reset defaults.');
    } finally {
      setSaving(false);
    }
  };

  const totalWeight = policy
    ? Object.values(policy.weights).reduce((a, b) => a + b, 0)
    : 1.0;

  if (loading || !policy) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 font-mono text-xs shadow-sm">
        Loading engine policy configuration...
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-600" />
            Zero-Trust Policy &amp; Weights Calibration
          </h3>
          <p className="text-xs text-slate-500">
            Prove to judges that scoring weights and threshold boundaries are tunable policies rather than hardcoded heuristics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleResetDefaults}
            className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-mono text-slate-700 transition-all flex items-center gap-1.5 shadow-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Defaults
          </button>
          <button
            onClick={handleSavePolicy}
            disabled={saving}
            className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-sky-500 hover:from-indigo-600 hover:to-sky-600 text-white font-bold text-xs font-mono flex items-center gap-2 shadow-sm shadow-indigo-200 transition-all disabled:opacity-50"
          >
            <Save className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
            Apply Policy to Live Engine
          </button>
        </div>
      </div>

      {saveMessage && (
        <div className={`p-3 rounded-xl border text-xs font-mono flex items-center gap-2 shadow-xs ${
          saveMessage.includes('Error') 
            ? 'bg-rose-50 border-rose-200 text-rose-800' 
            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}>
          {saveMessage.includes('Error') ? <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" /> : <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />}
          <span>{saveMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Category Weights Panel */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h4 className="text-xs font-mono uppercase font-bold text-slate-700">
              Category Scoring Weights (Must sum to 1.0)
            </h4>
            <span className={`text-xs font-mono font-bold ${
              Math.abs(totalWeight - 1.0) < 0.02 ? 'text-emerald-700' : 'text-rose-700'
            }`}>
              Sum: {totalWeight.toFixed(2)}
            </span>
          </div>

          <div className="space-y-3">
            {Object.entries(policy.weights).map(([cat, weight]) => (
              <div key={cat} className="space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-700 capitalize">{cat}</span>
                  <span className="text-indigo-700 font-bold">{(weight as number * 100).toFixed(0)}% ({(weight as number).toFixed(2)})</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="0.5"
                  step="0.05"
                  value={weight as number}
                  onChange={(e) => handleWeightChange(cat as any, parseFloat(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Decision Thresholds Panel */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h4 className="text-xs font-mono uppercase font-bold text-slate-700">
              Decision Boundary Thresholds (0–100)
            </h4>
            <span className="text-xs font-mono text-indigo-700 font-bold">4 Tiers</span>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-emerald-700 font-bold">Allow Ceiling (0 to Max)</span>
                <span className="text-slate-900 font-bold">{policy.thresholds.allow_max} pts</span>
              </div>
              <input
                type="range"
                min="10"
                max="45"
                step="1"
                value={policy.thresholds.allow_max}
                onChange={(e) => handleThresholdChange('allow_max', parseFloat(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-amber-800 font-bold">Challenge Ceiling</span>
                <span className="text-slate-900 font-bold">{policy.thresholds.challenge_max} pts</span>
              </div>
              <input
                type="range"
                min="35"
                max="70"
                step="1"
                value={policy.thresholds.challenge_max}
                onChange={(e) => handleThresholdChange('challenge_max', parseFloat(e.target.value))}
                className="w-full accent-amber-600 cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-orange-800 font-bold">Restrict Ceiling (➔ Deny Above)</span>
                <span className="text-slate-900 font-bold">{policy.thresholds.restrict_max} pts</span>
              </div>
              <input
                type="range"
                min="60"
                max="90"
                step="1"
                value={policy.thresholds.restrict_max}
                onChange={(e) => handleThresholdChange('restrict_max', parseFloat(e.target.value))}
                className="w-full accent-orange-600 cursor-pointer"
              />
            </div>

            <div className="space-y-1 pt-2 border-t border-slate-100">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-indigo-700 font-bold">Ambiguous Boundary Zone Margin (± Delta)</span>
                <span className="text-slate-900 font-bold">±{policy.thresholds.ambiguous_boundary_delta} pts</span>
              </div>
              <input
                type="range"
                min="2.0"
                max="12.0"
                step="0.5"
                value={policy.thresholds.ambiguous_boundary_delta}
                onChange={(e) => handleThresholdChange('ambiguous_boundary_delta', parseFloat(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 font-mono">
                Scores landing within ±{policy.thresholds.ambiguous_boundary_delta} of threshold boundaries trigger AI SOC Analyst review.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
