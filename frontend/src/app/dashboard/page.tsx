'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Shield, 
  ArrowLeft, 
  Radio, 
  KeyRound, 
  Lock, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  RefreshCw, 
  Smartphone,
  Sparkles,
  Database,
  Sliders,
  AlertTriangle,
  UserCheck,
  MapPin,
  Globe,
  Wifi,
  Gauge,
  Clock
} from 'lucide-react';
import { API_BASE_URL } from '@/config/api';

interface LocationSignals {
  country: string;
  city: string;
  is_known_location: boolean;
  impossible_travel_flag: boolean;
  vpn_tor_detected: boolean;
}

interface EvaluationResponse {
  decision: string;
  final_decision?: string;
  final_score: number;
  evaluation_id: string;
  mfa_required: boolean;
  challenge_id: string | null;
  location_signals?: LocationSignals;
  login_history?: any;
  evaluation?: any;
}

interface LoginHistoryRecord {
  id: string;
  ip_address: string;
  geo_country: string;
  geo_city: string;
  latitude: number | null;
  longitude: number | null;
  is_vpn_or_proxy: boolean;
  created_at: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Evaluation & Challenge State
  const [activeResource, setActiveResource] = useState('doc_confidential_q3');
  const [simulateAnomaly, setSimulateAnomaly] = useState<'none' | 'step_up_challenge' | 'impossible_travel'>('none');
  const [currentEval, setCurrentEval] = useState<EvaluationResponse | null>(null);
  
  // Location Intelligence & History State (Phase 4)
  const [locationSignals, setLocationSignals] = useState<LocationSignals | null>(null);
  const [latestLogin, setLatestLogin] = useState<LoginHistoryRecord | null>(null);
  const [loginHistoryList, setLoginHistoryList] = useState<LoginHistoryRecord[]>([]);

  // Modal State for Step-Up Challenge (Phase 3)
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [verifyingChallenge, setVerifyingChallenge] = useState(false);
  const [challengeError, setChallengeError] = useState<string | null>(null);

  // Before -> After Transition State (Phase 3)
  const [verificationResult, setVerificationResult] = useState<{
    beforeDecision: string;
    beforeScore: number;
    afterDecision: string;
    afterScore: number;
    challengeId: string;
    rationale: string;
  } | null>(null);

  // Initial Load: User Session & Real Location Intelligence
  useEffect(() => {
    let currentUser: any = null;
    const rawUser = localStorage.getItem('contextguard_user');
    if (rawUser) {
      try {
        currentUser = JSON.parse(rawUser);
      } catch (e) {
        currentUser = null;
      }
    }

    if (!currentUser) {
      currentUser = {
        id: 'usr_totp_test',
        email: 'analyst@contextguard.local',
        mfa_enabled: true,
      };
      localStorage.setItem('contextguard_user', JSON.stringify(currentUser));
    }

    setUser(currentUser);

    // Pull location signals from recent login session if stored
    const rawSession = localStorage.getItem('contextguard_session');
    if (rawSession) {
      try {
        const parsedSession = JSON.parse(rawSession);
        if (parsedSession.location_signals) {
          setLocationSignals(parsedSession.location_signals);
        }
        if (parsedSession.login_history) {
          setLatestLogin(parsedSession.login_history);
        }
      } catch (e) {
        console.error('Failed to parse stored session:', e);
      }
    }

    // Fetch live login history from PostgreSQL
    const fetchHistory = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/user/${currentUser.id}/history`);
        if (res.ok) {
          const data = await res.json();
          if (data.history && data.history.length > 0) {
            setLoginHistoryList(data.history);
            setLatestLogin(data.history[0]);
            // Default location signals from real history if not already set
            setLocationSignals((prev) => prev || {
              country: data.history[0].geo_country || 'Local Network',
              city: data.history[0].geo_city || 'Localhost',
              is_known_location: true,
              impossible_travel_flag: false,
              vpn_tor_detected: data.history[0].is_vpn_or_proxy,
            });
          }
        }
      } catch (err) {
        console.error('Error fetching login history:', err);
      }
    };

    fetchHistory();
  }, [router]);

  // Trigger Real Live Contextual Access Evaluation
  const handleTriggerEvaluation = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    setVerificationResult(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/evaluate-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          resource_id: activeResource,
          simulate_anomaly: simulateAnomaly === 'none' ? null : simulateAnomaly,
        }),
      });

      const data: EvaluationResponse = await res.json();
      if (!res.ok) {
        throw new Error((data as any).detail || 'Evaluation request failed');
      }

      setCurrentEval(data);

      // Phase 4: Update live location signals from evaluation context
      if (data.location_signals) {
        setLocationSignals(data.location_signals);
      }

      // Phase 3: If response has mfa_required: true, open Challenge Modal
      if (data.mfa_required && data.challenge_id) {
        setShowChallengeModal(true);
        setTotpCode('');
        setChallengeError(null);
      }
    } catch (err: any) {
      setError(err.message || 'Error executing access evaluation');
    } finally {
      setLoading(false);
    }
  };

  // Submit 6-Digit TOTP Challenge Code (Phase 3)
  const handleVerifyChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEval?.challenge_id || totpCode.length !== 6) return;

    setVerifyingChallenge(true);
    setChallengeError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/mfa/verify-challenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challenge_id: currentEval.challenge_id,
          totp_code: totpCode.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Invalid authentication code. Please check your authenticator app and try again.');
      }

      // Success: Save Before -> After comparison and close modal
      setVerificationResult({
        beforeDecision: currentEval.decision,
        beforeScore: currentEval.final_score,
        afterDecision: data.decision,
        afterScore: data.final_score,
        challengeId: currentEval.challenge_id,
        rationale: data.decision_rationale || 'MFA successfully verified for this session. Identity confidence restored.',
      });

      // Update current evaluation view to upgraded state
      setCurrentEval({
        ...currentEval,
        decision: data.decision,
        final_decision: data.final_decision,
        final_score: data.final_score,
        mfa_required: false,
        challenge_id: null,
      });

      setShowChallengeModal(false);
      setTotpCode('');
    } catch (err: any) {
      setChallengeError(err.message || 'Verification failed');
    } finally {
      setVerifyingChallenge(false);
    }
  };

  const getDecisionColor = (decision: string) => {
    switch (decision?.toLowerCase()) {
      case 'allow':
        return 'text-emerald-400 bg-emerald-950/70 border-emerald-800/80';
      case 'challenge':
        return 'text-amber-400 bg-amber-950/70 border-amber-800/80';
      case 'restrict':
        return 'text-orange-400 bg-orange-950/70 border-orange-800/80';
      case 'deny':
        return 'text-rose-400 bg-rose-950/70 border-rose-800/80';
      default:
        return 'text-slate-400 bg-slate-900 border-slate-800';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-cyan-500 selection:text-black">
      {/* Top Navigation Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/20 hover:opacity-90 transition-opacity">
            <Shield className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-slate-100">
                ContextGuard Live Portal
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/60 flex items-center gap-1">
                <Radio className="w-2.5 h-2.5 animate-pulse text-cyan-400" /> Live Mode
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Continuous Adaptive Zero-Trust Verification</p>
          </div>
        </div>

        {/* Switcher & User Profile */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-xs font-mono text-slate-400 hover:text-cyan-300 border border-slate-800 hover:border-cyan-800 bg-slate-900/80 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Scenario Demo Mode
          </Link>

          {user && (
            <div className="flex items-center gap-2 border border-slate-800 bg-slate-900/80 px-3 py-1.5 rounded-xl">
              <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-mono text-slate-200">{user.email}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                MFA Active
              </span>
            </div>
          )}

          <Link
            href="/mfa-setup"
            className="text-xs font-mono text-slate-400 hover:text-amber-300 border border-slate-800 bg-slate-900/80 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all"
            title="Manage or re-scan Authenticator"
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-400" /> Re-enroll MFA
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        
        {/* PHASE 4 HIGHLIGHT: CRITICAL IMPOSSIBLE TRAVEL WARNING BANNER */}
        {locationSignals?.impossible_travel_flag && (
          <div className="bg-rose-950/60 border-2 border-rose-600/80 rounded-2xl p-5 shadow-2xl shadow-rose-950/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-3 duration-300">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-rose-900/60 border border-rose-500/60 text-rose-400 shrink-0 mt-0.5 animate-pulse">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-rose-400 bg-rose-950 px-2 py-0.5 rounded border border-rose-800">
                    CRITICAL SECURITY ANOMALY
                  </span>
                  <span className="text-xs font-mono text-rose-300 font-semibold">
                    Impossible Travel Velocity Detected
                  </span>
                </div>
                <p className="text-xs text-rose-200/90 mt-1.5 leading-relaxed max-w-3xl">
                  Calculated relocation velocity exceeded the <strong>900 km/h physical human travel threshold</strong> between consecutive sessions ({locationSignals.city}, {locationSignals.country}). High probability of stolen session credentials or distributed proxy routing. Immediate Step-Up MFA Challenge enforced.
                </p>
              </div>
            </div>

            <span className="text-[11px] font-mono font-bold text-rose-300 bg-rose-900/80 border border-rose-700 px-3 py-1.5 rounded-xl whitespace-nowrap self-end md:self-center">
              Speed: &gt;900 km/h [FLAGGED]
            </span>
          </div>
        )}

        {/* PHASE 4: LIVE LOCATION & NETWORK SIGNALS CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Detected City & Country */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-2">
            <div className="flex justify-between items-center text-xs font-mono text-slate-400">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-cyan-400" /> Detected Geolocation
              </span>
              <span className="text-[10px] text-slate-500">Live IP-API</span>
            </div>
            <div className="text-lg font-bold text-slate-100">
              {locationSignals ? `${locationSignals.city}, ${locationSignals.country}` : 'Localhost, Local Network'}
            </div>
            <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
              <span>IP:</span>
              <span className="text-cyan-300 select-all font-bold">
                {latestLogin?.ip_address || '127.0.0.1'}
              </span>
            </div>
          </div>

          {/* VPN / Proxy Detection Signal */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-2">
            <div className="flex justify-between items-center text-xs font-mono text-slate-400">
              <span className="flex items-center gap-1.5">
                <Wifi className="w-3.5 h-3.5 text-blue-400" /> Network Posture
              </span>
              <span className="text-[10px] text-slate-500">Telemetry</span>
            </div>
            <div className="text-base font-bold">
              {locationSignals?.vpn_tor_detected ? (
                <span className="text-rose-400 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" /> VPN / Proxy Active
                </span>
              ) : (
                <span className="text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Direct Connection
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              {locationSignals?.vpn_tor_detected
                ? 'Traffic originates from anonymized proxy infrastructure'
                : 'No commercial VPN, hosting provider, or TOR node detected'}
            </p>
          </div>

          {/* Known Location Baseline */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-2">
            <div className="flex justify-between items-center text-xs font-mono text-slate-400">
              <span className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-indigo-400" /> Baseline Location
              </span>
              <span className="text-[10px] text-slate-500">History</span>
            </div>
            <div className="text-base font-bold">
              {locationSignals?.is_known_location ? (
                <span className="text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Verified Baseline
                </span>
              ) : (
                <span className="text-amber-400 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" /> New Region
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              {locationSignals?.is_known_location
                ? 'Coordinates match confirmed prior user access regions'
                : 'First observed access from this geographic zone'}
            </p>
          </div>

          {/* Travel Velocity / Status */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-2">
            <div className="flex justify-between items-center text-xs font-mono text-slate-400">
              <span className="flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-amber-400" /> Travel Speed
              </span>
              <span className="text-[10px] text-slate-500">Haversine</span>
            </div>
            <div className="text-base font-bold">
              {locationSignals?.impossible_travel_flag ? (
                <span className="text-rose-400 font-mono">
                  &gt; 900 km/h (Anomaly)
                </span>
              ) : (
                <span className="text-emerald-400 font-mono">
                  Nominal (&lt; 900 km/h)
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              {locationSignals?.impossible_travel_flag
                ? 'Exceeds great-circle physical aircraft velocity limits'
                : 'Complies with realistic terrestrial relocation physics'}
            </p>
          </div>
        </div>

        {/* Phase 3 & 4 Evaluation Controls */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" /> Real-Time Access & Risk Evaluation
              </h2>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                Trigger a live access request against ContextGuard's 7-category risk engine with real IP geolocation, baseline matching, and optional step-up challenge triggers.
              </p>
            </div>

            <button
              onClick={handleTriggerEvaluation}
              disabled={loading}
              className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-mono font-bold px-6 py-3 rounded-xl flex items-center gap-2 shadow-lg shadow-cyan-950/50 transition-all cursor-pointer whitespace-nowrap self-start md:self-auto disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {loading ? 'Evaluating Risk...' : 'Run Access Request'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-800">
            {/* Target Resource Selector */}
            <div className="space-y-2">
              <label className="text-xs font-mono font-bold text-slate-300 flex items-center gap-2">
                <Database className="w-4 h-4 text-cyan-400" /> Target Resource
              </label>
              <select
                value={activeResource}
                onChange={(e) => setActiveResource(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="doc_confidential_q3">Q3 Confidential Financial Models (Confidential)</option>
                <option value="production_vault">Production Secrets Vault (Restricted)</option>
                <option value="customer_pii_db">Customer PII Database (Restricted)</option>
                <option value="code_repository">Engineering Core Repository (Internal)</option>
              </select>
            </div>

            {/* Context Simulation Trigger */}
            <div className="space-y-2">
              <label className="text-xs font-mono font-bold text-slate-300 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-400" /> Live Simulation Context
              </label>
              <select
                value={simulateAnomaly}
                onChange={(e) => setSimulateAnomaly(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="none">✔ Baseline Real Environment (Local/Current IP)</option>
                <option value="step_up_challenge">⚡ Simulate BYOD &amp; Off-Hours (Triggers Challenge)</option>
                <option value="impossible_travel">🚨 Simulate Sydney Travel Anomaly (&gt;900 km/h Warning)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Phase 3 Highlight: Visible Before -> After Decision Upgrade Card */}
        {verificationResult && (
          <div className="bg-emerald-950/30 border border-emerald-800/80 rounded-2xl p-6 shadow-xl animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-mono font-bold uppercase tracking-wider mb-4">
              <CheckCircle2 className="w-4 h-4" /> Live Challenge Verification Complete — Decision Upgraded
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              {/* Before vs After Visual Diff */}
              <div className="flex items-center gap-4 bg-slate-950/90 border border-slate-800 p-5 rounded-xl">
                {/* Before */}
                <div className="flex-1 text-center">
                  <span className="text-[10px] font-mono text-slate-400 uppercase">Pre-Verification</span>
                  <div className="mt-1 px-3 py-1.5 rounded-lg font-mono font-bold text-sm bg-amber-950/80 text-amber-300 border border-amber-800/60">
                    {verificationResult.beforeDecision}
                  </div>
                  <span className="text-xs font-mono text-slate-400 mt-1 block">
                    Score: <span className="text-amber-400 font-bold">{verificationResult.beforeScore.toFixed(1)}</span>
                  </span>
                </div>

                <div className="p-2 rounded-full bg-slate-800 text-slate-400">
                  <ArrowRight className="w-5 h-5 text-emerald-400" />
                </div>

                {/* After */}
                <div className="flex-1 text-center">
                  <span className="text-[10px] font-mono text-slate-400 uppercase">Post-Verification</span>
                  <div className="mt-1 px-3 py-1.5 rounded-lg font-mono font-bold text-sm bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 shadow-lg shadow-emerald-950/50">
                    {verificationResult.afterDecision}
                  </div>
                  <span className="text-xs font-mono text-slate-400 mt-1 block">
                    Score: <span className="text-emerald-400 font-bold">{verificationResult.afterScore.toFixed(1)}</span>
                    <span className="text-[10px] text-emerald-400 ml-1">(-15.0 MFA Credit)</span>
                  </span>
                </div>
              </div>

              {/* Rationale & Audit Confirmation */}
              <div className="space-y-2 text-xs font-mono">
                <div className="text-slate-300 font-bold flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-cyan-400" /> Engine Decision Rationale:
                </div>
                <p className="text-slate-400 leading-relaxed bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                  {verificationResult.rationale}
                </p>
                <div className="text-[11px] text-slate-500">
                  Resolved Challenge ID: <span className="text-slate-400 select-all">{verificationResult.challengeId}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Current Evaluation Live Card */}
        {currentEval && !verificationResult && (
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-start flex-wrap gap-4">
              <div>
                <span className="text-[10px] font-mono text-slate-400">EVALUATION ID: {currentEval.evaluation_id}</span>
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2 mt-1">
                  Access Decision Result:
                  <span className={`px-3 py-1 rounded-lg text-xs font-mono font-bold border ${getDecisionColor(currentEval.decision)}`}>
                    {currentEval.decision}
                  </span>
                </h3>
              </div>

              <div className="text-right font-mono">
                <span className="text-xs text-slate-400">Composite Risk Score:</span>
                <div className="text-2xl font-bold text-cyan-300">
                  {currentEval.final_score.toFixed(1)} <span className="text-xs text-slate-500 font-normal">/ 100</span>
                </div>
              </div>
            </div>

            {/* If Challenge triggered, show action banner */}
            {currentEval.mfa_required && (
              <div className="bg-amber-950/40 border border-amber-800/80 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 text-amber-300 text-xs font-mono">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                  <div>
                    <span className="font-bold">Step-Up Verification Required:</span>
                    <p className="text-amber-400/80 text-[11px] mt-0.5">
                      Session risk triggered an automated TOTP Challenge. Enter code from your authenticator app to authorize access.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowChallengeModal(true)}
                  className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-mono font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-lg shadow-amber-950/50 cursor-pointer whitespace-nowrap"
                >
                  <KeyRound className="w-3.5 h-3.5" /> Enter 6-Digit Code
                </button>
              </div>
            )}
          </div>
        )}

        {/* Chronological Login History (Phase 4 Real Data) */}
        {loginHistoryList.length > 0 && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-mono font-bold text-slate-200 flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" /> Real Login Geolocation Audit Trail (PostgreSQL)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono text-left">
                <thead className="text-slate-400 border-b border-slate-800 bg-slate-950/50">
                  <tr>
                    <th className="py-2.5 px-3">Session Log ID</th>
                    <th className="py-2.5 px-3">IP Address</th>
                    <th className="py-2.5 px-3">Detected Location</th>
                    <th className="py-2.5 px-3">VPN / Proxy</th>
                    <th className="py-2.5 px-3">Timestamp (UTC)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {loginHistoryList.slice(0, 5).map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 px-3 text-cyan-400">{log.id}</td>
                      <td className="py-2.5 px-3 text-slate-200 font-bold">{log.ip_address}</td>
                      <td className="py-2.5 px-3">
                        {log.geo_city}, {log.geo_country}
                      </td>
                      <td className="py-2.5 px-3">
                        {log.is_vpn_or_proxy ? (
                          <span className="text-rose-400 font-semibold">Flagged</span>
                        ) : (
                          <span className="text-emerald-400">Direct</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* PHASE 3 STEP-UP CHALLENGE MODAL */}
      {showChallengeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-amber-800/80 rounded-2xl p-6 shadow-2xl shadow-amber-950/40 relative">
            <div className="text-center mb-6">
              <div className="inline-flex p-3 rounded-2xl bg-amber-950/80 border border-amber-700/60 mb-3 shadow-inner">
                <KeyRound className="w-7 h-7 text-amber-400" />
              </div>
              <h3 className="text-xl font-bold tracking-tight text-slate-100">
                Additional Verification Required
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                ContextGuard Step-Up Authentication Challenge
              </p>
            </div>

            {challengeError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-950/70 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{challengeError}</span>
              </div>
            )}

            <form onSubmit={handleVerifyChallenge} className="space-y-5">
              <div>
                <label className="block text-xs font-mono font-medium text-slate-300 mb-2 text-center">
                  Enter 6-Digit Code from your Authenticator App
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3.5 text-center text-2xl tracking-[0.5em] font-mono font-bold text-amber-300 placeholder-slate-700 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowChallengeModal(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-bold py-3 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifyingChallenge || totpCode.length !== 6}
                  className="flex-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-mono font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-950/50 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {verifyingChallenge ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Verify &amp; Upgrade <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
