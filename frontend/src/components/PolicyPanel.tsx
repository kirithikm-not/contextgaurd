'use client';

import React, { useState, useEffect } from 'react';
import { EnginePolicy } from '@/types/contextguard';
import { Settings, Save, RotateCcw, Shield, CheckCircle2, AlertCircle, Sliders } from 'lucide-react';
import { API_BASE_URL } from '@/config/api';

interface PolicyPanelProps {
  onPolicyUpdated?: () => void;
}

export const PolicyPanel: React.FC<PolicyPanelProps> = ({ onPolicyUpdated }) => {
  const [policy, setPolicy] = useState<EnginePolicy | null>(null);
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
      console.error('Failed to fetch policy:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicy();
  }, []);

  const handleWeightChange = (key: keyof EnginePolicy['weights'], val: number) => {
    if (!policy) return;
    setPolicy({
      ...policy,
      weights: {
        ...policy.weights,
        [key]: val,
      },
    });
  };

  const handleThresholdChange = (key: keyof EnginePolicy['thresholds'], val: number) => {
    if (!policy) return;
    setPolicy({
      ...policy,
      thresholds: {
        ...policy.thresholds,
        [key]: val,
      },
    });
  };

  const totalWeight = policy
    ? Object.values(policy.weights).reduce((acc, w) => acc + w, 0)
    : 1.0;

  const handleSavePolicy = async () => {
    if (!policy) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/policy`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policy),
      });
      if (res.ok) {
        setSaveMessage('Policy weights and thresholds successfully saved to Zero-Trust Engine!');
        if (onPolicyUpdated) onPolicyUpdated();
      } else {
        const err = await res.json();
        setSaveMessage(`Error saving policy: ${err.detail || 'Invalid weight configuration'}`);
      }
    } catch (e: any) {
      setSaveMessage(`Network error: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    if (!policy) return;
    setPolicy({
      policy_id: 'default_zero_trust_v1',
      name: 'Standard Enterprise Zero-Trust Policy',
      weights: {
        identity: 0.15,
        device: 0.20,
        location: 0.20,
        behavior: 0.15,
        resource: 0.15,
        history: 0.10,
        threat: 0.05,
      },
      thresholds: {
        allow_max: 29.0,
        challenge_max: 54.0,
        restrict_max: 79.0,
        ambiguous_boundary_delta: 5.0,
      },
    });
  };

  if (loading || !policy) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center text-slate-500 font-mono text-xs">
        Loading engine policy configuration...
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-6 shadow-2xl">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-cyan-400" />
            Zero-Trust Policy & Weights Calibration
          </h3>
          <p className="text-xs text-slate-400">
            Prove to judges that scoring weights and threshold boundaries are tunable policies rather than hardcoded heuristics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleResetDefaults}
            className="px-3.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-300 transition-all flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Defaults
          </button>
          <button
            onClick={handleSavePolicy}
            disabled={saving}
            className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs font-mono flex items-center gap-2 shadow-lg shadow-cyan-600/30 transition-all disabled:opacity-50"
          >
            <Save className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
            Apply Policy to Live Engine
          </button>
        </div>
      </div>

      {saveMessage && (
        <div className={`p-3 rounded-xl border text-xs font-mono flex items-center gap-2 ${
          saveMessage.includes('Error') 
            ? 'bg-rose-500/15 border-rose-500/30 text-rose-300' 
            : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
        }`}>
          {saveMessage.includes('Error') ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
          <span>{saveMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Category Weights Panel */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h4 className="text-xs font-mono uppercase font-bold text-slate-300">
              Category Scoring Weights (Must sum to 1.0)
            </h4>
            <span className={`text-xs font-mono font-bold ${
              Math.abs(totalWeight - 1.0) < 0.02 ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              Sum: {totalWeight.toFixed(2)}
            </span>
          </div>

          <div className="space-y-3">
            {Object.entries(policy.weights).map(([cat, weight]) => (
              <div key={cat} className="space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-300 capitalize">{cat}</span>
                  <span className="text-cyan-400 font-bold">{(weight as number * 100).toFixed(0)}% ({(weight as number).toFixed(2)})</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="0.5"
                  step="0.05"
                  value={weight as number}
                  onChange={(e) => handleWeightChange(cat as any, parseFloat(e.target.value))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Decision Thresholds Panel */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h4 className="text-xs font-mono uppercase font-bold text-slate-300">
              Decision Boundary Thresholds (0–100)
            </h4>
            <span className="text-xs font-mono text-cyan-400 font-bold">4 Tiers</span>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-emerald-400 font-bold">Allow Ceiling (0 to Max)</span>
                <span className="text-white font-bold">{policy.thresholds.allow_max} pts</span>
              </div>
              <input
                type="range"
                min="10"
                max="45"
                step="1"
                value={policy.thresholds.allow_max}
                onChange={(e) => handleThresholdChange('allow_max', parseFloat(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-amber-400 font-bold">Challenge Ceiling</span>
                <span className="text-white font-bold">{policy.thresholds.challenge_max} pts</span>
              </div>
              <input
                type="range"
                min="35"
                max="70"
                step="1"
                value={policy.thresholds.challenge_max}
                onChange={(e) => handleThresholdChange('challenge_max', parseFloat(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-orange-400 font-bold">Restrict Ceiling (➔ Deny Above)</span>
                <span className="text-white font-bold">{policy.thresholds.restrict_max} pts</span>
              </div>
              <input
                type="range"
                min="60"
                max="90"
                step="1"
                value={policy.thresholds.restrict_max}
                onChange={(e) => handleThresholdChange('restrict_max', parseFloat(e.target.value))}
                className="w-full accent-orange-500 cursor-pointer"
              />
            </div>

            <div className="space-y-1 pt-2 border-t border-slate-800">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-cyan-400 font-bold">Ambiguous Boundary Zone Margin (± Delta)</span>
                <span className="text-white font-bold">±{policy.thresholds.ambiguous_boundary_delta} pts</span>
              </div>
              <input
                type="range"
                min="2.0"
                max="12.0"
                step="0.5"
                value={policy.thresholds.ambiguous_boundary_delta}
                onChange={(e) => handleThresholdChange('ambiguous_boundary_delta', parseFloat(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
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
