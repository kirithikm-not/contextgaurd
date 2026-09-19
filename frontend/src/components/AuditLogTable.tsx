'use client';

import React, { useState, useEffect } from 'react';
import { DecisionBadge } from '@/components/DecisionBadge';
import { FileSpreadsheet, Search, Filter, RefreshCw, Eye, X, Shield, Sparkles } from 'lucide-react';
import { API_BASE_URL } from '@/config/api';

export const AuditLogTable: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [userFilter, setUserFilter] = useState<string>('');
  const [decisionFilter, setDecisionFilter] = useState<string>('');
  const [agentFilter, setAgentFilter] = useState<string>('');
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let url = `${API_BASE_URL}/api/audit-log?limit=50`;
      if (userFilter) url += `&user_id=${encodeURIComponent(userFilter)}`;
      if (decisionFilter) url += `&decision=${encodeURIComponent(decisionFilter)}`;
      if (agentFilter === 'true') url += `&agent_invoked=true`;
      if (agentFilter === 'false') url += `&agent_invoked=false`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.items || []);
        setTotal(data.total || 0);
      }
    } catch (e) {
      console.error('Failed to load audit logs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [decisionFilter, agentFilter]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
            Zero-Trust Access Audit Trail ({total} Events Recorded)
          </h3>
          <p className="text-xs text-slate-500">
            Immutable SQLite audit persistence recording raw context snapshots, deterministic sub-scores, rules triggered, and AI agent narratives.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          disabled={loading}
          className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-mono text-slate-700 transition-all flex items-center gap-1.5 shadow-xs disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Logs
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by User ID (e.g. usr_sarah_chen)..."
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchLogs()}
            className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-400 font-mono shadow-xs"
          />
        </div>

        <select
          value={decisionFilter}
          onChange={(e) => setDecisionFilter(e.target.value)}
          className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-400 font-mono shadow-xs"
        >
          <option value="">All Decisions</option>
          <option value="Allow">Allow Only</option>
          <option value="Challenge">Challenge Only</option>
          <option value="Restrict">Restrict Only</option>
          <option value="Deny">Deny Only</option>
        </select>

        <select
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-400 font-mono shadow-xs"
        >
          <option value="">All Evaluations</option>
          <option value="true">AI Agent Escalations Only</option>
          <option value="false">Deterministic Only</option>
        </select>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] border-b border-slate-200 font-bold">
            <tr>
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">User &amp; Device</th>
              <th className="px-4 py-3">Resource &amp; Action</th>
              <th className="px-4 py-3">Risk Score</th>
              <th className="px-4 py-3">Decision</th>
              <th className="px-4 py-3">AI Agent</th>
              <th className="px-4 py-3 text-right">Inspect</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.length > 0 ? (
              logs.map((row) => (
                <tr key={row.evaluation_id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                    {new Date(row.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-slate-900 font-bold">{row.user_id}</div>
                    <div className="text-[10px] text-slate-500">{row.device_id}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-slate-700 truncate max-w-[160px]">{row.resource_id}</div>
                    <div className="text-[10px] uppercase text-amber-800 font-bold">{row.resource_tier} ({row.action})</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-slate-900">{row.final_score.toFixed(1)}</span>
                    <span className="text-slate-400 text-[10px]">/100</span>
                  </td>
                  <td className="px-4 py-3">
                    <DecisionBadge decision={row.final_decision} size="sm" isOverride={Boolean(row.overrode_baseline)} />
                  </td>
                  <td className="px-4 py-3">
                    {row.agent_invoked ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-indigo-700 font-bold px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200">
                        <Sparkles className="w-2.5 h-2.5 text-indigo-600" />
                        {row.overrode_baseline ? 'Overrode' : 'Confirmed'}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400">Bypassed</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setSelectedLog(row)}
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all shadow-xs"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  {loading ? 'Loading audit records...' : 'No audit records match the selected filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Raw Log JSON Modal / Drawer */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-indigo-600" />
                <span className="text-sm font-bold font-mono text-slate-900">
                  Audit Telemetry: {selectedLog.evaluation_id}
                </span>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs font-mono">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-slate-500 font-bold uppercase text-[10px]">Decision Rationale:</span>
                <p className="text-slate-800 font-sans leading-relaxed">{selectedLog.decision_rationale}</p>
              </div>

              <div className="space-y-1">
                <span className="text-slate-500 font-bold uppercase text-[10px]">Full Evaluation Payload:</span>
                <pre className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-800 overflow-x-auto">
                  {JSON.stringify(selectedLog.result, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
