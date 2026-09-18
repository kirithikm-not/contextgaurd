'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  AccessEvaluationResult, 
  DemoScenario 
} from '@/types/contextguard';
import { LiveConsole } from '@/components/LiveConsole';
import { ExplainabilityPanel } from '@/components/ExplainabilityPanel';
import { KnobTuner } from '@/components/KnobTuner';
import { SessionTimeline } from '@/components/SessionTimeline';
import { AuditLogTable } from '@/components/AuditLogTable';
import { PolicyPanel } from '@/components/PolicyPanel';
import { API_BASE_URL, WS_URL } from '@/config/api';
import { 
  Shield, 
  Terminal, 
  Sliders, 
  Clock, 
  FileSpreadsheet, 
  Settings, 
  Radio, 
  CheckCircle2, 
  AlertCircle,
  Sparkles,
  Bot
} from 'lucide-react';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'console' | 'tuner' | 'drift' | 'audit' | 'policy'>('console');
  const [scenarios, setScenarios] = useState<DemoScenario[]>([]);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [currentEvaluation, setCurrentEvaluation] = useState<AccessEvaluationResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [backendHealth, setBackendHealth] = useState<any | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  // 1. Initial Load: Fetch Health & Scenarios
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Ping Health
        const healthRes = await fetch(`${API_BASE_URL}/api/health`);
        if (healthRes.ok) {
          const healthData = await healthRes.json();
          setBackendHealth(healthData);
        }

        // Fetch Canonical Scenarios
        const scensRes = await fetch(`${API_BASE_URL}/api/scenarios`);
        if (scensRes.ok) {
          const scensData = await scensRes.json();
          setScenarios(scensData);
          // Auto-select and replay scenario 1 on initial load
          if (scensData.length > 0) {
            handleSelectScenario(scensData[0].id);
          }
        }
      } catch (err) {
        console.error('Initial data fetch error:', err);
      }
    };

    fetchInitialData();
  }, []);

  // 2. WebSocket Real-Time Connection
  useEffect(() => {
    const connectWs = () => {
      try {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          setWsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'EVALUATION_COMPLETED' && message.data) {
              setCurrentEvaluation(message.data);
            }
          } catch (e) {
            console.error('Error parsing WS message:', e);
          }
        };

        ws.onclose = () => {
          setWsConnected(false);
          // Auto-reconnect after 3 seconds
          setTimeout(connectWs, 3000);
        };

        ws.onerror = () => {
          setWsConnected(false);
        };
      } catch (err) {
        console.error('WebSocket connection error:', err);
      }
    };

    connectWs();

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // 3. Replay Canonical Scenario
  const handleSelectScenario = async (scenarioId: string) => {
    setActiveScenarioId(scenarioId);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/scenarios/${scenarioId}/replay`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentEvaluation(data);
      }
    } catch (e) {
      console.error('Failed to replay scenario:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleReplayActive = () => {
    if (activeScenarioId) {
      handleSelectScenario(activeScenarioId);
    }
  };

  // 4. Handle Knob Mutations
  const handleMutate = async (mutations: any) => {
    setLoading(true);
    try {
      const payload: any = {
        mutations,
      };
      if (activeScenarioId) {
        payload.base_scenario_id = activeScenarioId;
      } else if (currentEvaluation) {
        payload.context_bundle = currentEvaluation.context;
      } else {
        payload.base_scenario_id = 'scenario_1_trusted_baseline';
      }

      const res = await fetch(`${API_BASE_URL}/api/simulator/mutate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        setCurrentEvaluation(data);
      }
    } catch (e) {
      console.error('Failed to mutate signals:', e);
    } finally {
      setLoading(false);
    }
  };

  // 5. Handle Run Session Drift
  const handleRunDrift = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/simulator/drift-session`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        return data.timeline || [];
      }
      return [];
    } catch (e) {
      console.error('Failed to run session drift:', e);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'console', label: 'Decision Console', icon: Terminal },
    { id: 'tuner', label: 'Signal Knob-Tuner', icon: Sliders },
    { id: 'drift', label: 'Continuous Session Drift', icon: Clock },
    { id: 'audit', label: 'Audit Trail', icon: FileSpreadsheet },
    { id: 'policy', label: 'Policy & Weights', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-cyan-500 selection:text-black">
      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/20">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                ContextGuard
              </h1>
              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/60">
                Zero-Trust Access Intelligence
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Context Beats Role • Deterministic Core, Agentic Edge</p>
          </div>
        </div>

        {/* Live Status Indicators */}
        <div className="flex items-center gap-3 text-xs font-mono">
          {/* WebSocket Status */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-slate-800 bg-slate-900/80">
            <Radio className={`w-3.5 h-3.5 ${wsConnected ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
            <span className="text-slate-400">Stream:</span>
            <span className={wsConnected ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
              {wsConnected ? 'LIVE' : 'DISCONNECTED'}
            </span>
          </div>

          {/* Backend Status */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-slate-800 bg-slate-900/80">
            {backendHealth ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> API :8000
              </span>
            ) : (
              <span className="text-rose-400 font-bold flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> Offline
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-800 bg-slate-900/30 px-6 backdrop-blur">
        <div className="max-w-7xl mx-auto flex overflow-x-auto gap-2 py-2.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-2 whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-md shadow-cyan-950/50'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Tab 1: Live Decision Console */}
        {activeTab === 'console' && (
          <div className="space-y-8">
            <LiveConsole
              scenarios={scenarios}
              activeScenarioId={activeScenarioId}
              evaluation={currentEvaluation}
              loading={loading}
              onSelectScenario={handleSelectScenario}
              onReplay={handleReplayActive}
            />
            <ExplainabilityPanel evaluation={currentEvaluation} />
          </div>
        )}

        {/* Tab 2: Signal Mutation Knob-Tuner */}
        {activeTab === 'tuner' && (
          <div className="space-y-8">
            <KnobTuner
              currentEvaluation={currentEvaluation}
              onMutate={handleMutate}
              loading={loading}
            />
            <ExplainabilityPanel evaluation={currentEvaluation} />
          </div>
        )}

        {/* Tab 3: Continuous Session Risk Drift */}
        {activeTab === 'drift' && (
          <div className="space-y-8">
            <SessionTimeline
              onRunDrift={handleRunDrift}
              loading={loading}
            />
          </div>
        )}

        {/* Tab 4: Audit Trail */}
        {activeTab === 'audit' && (
          <div className="space-y-8">
            <AuditLogTable />
          </div>
        )}

        {/* Tab 5: Policy & Weights Panel */}
        {activeTab === 'policy' && (
          <div className="space-y-8">
            <PolicyPanel onPolicyUpdated={handleReplayActive} />
          </div>
        )}
      </main>
    </div>
  );
}
