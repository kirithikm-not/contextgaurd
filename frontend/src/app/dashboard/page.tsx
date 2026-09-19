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
            if (!locationSignals) {
              setLocationSignals({
                country: data.history[0].geo_country,
                city: data.history[0].geo_city,
                is_known_location: true,
                impossible_travel_flag: false,
                vpn_tor_detected: data.history[0].is_vpn_or_proxy,
              });
            }
          }
        }
      } catch (e) {
        console.error('Failed to fetch user login history:', e);
      }
    };

    fetchHistory();
  }, []);

  // Trigger Live Access Request with Optional Simulated Context
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
        return 'text-emerald-800 bg-emerald-50 border-emerald-300 font-bold';
      case 'challenge':
        return 'text-amber-900 bg-amber-50 border-amber-300 font-bold';
      case 'restrict':
        return 'text-orange-900 bg-orange-50 border-orange-300 font-bold';
      case 'deny':
        return 'text-rose-900 bg-rose-50 border-rose-300 font-bold';
      default:
        return 'text-slate-700 bg-slate-100 border-slate-300 font-bold';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
      {/* Dashboard Sub-Header */}
      <div className="border-b border-slate-200/80 bg-white/80 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 rounded-xl bg-gradient-to-tr from-indigo-500 to-sky-400 text-white shadow-sm shadow-indigo-200 hover:opacity-90 transition-opacity">
            <Shield className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-slate-900">
                ContextGuard Live Portal
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1 font-bold">
                <Radio className="w-2.5 h-2.5 animate-pulse text-indigo-600" /> Live Mode
              </span>
            </div>
            <p className="text-[11px] text-slate-500">Continuous Adaptive Zero-Trust Verification</p>
          </div>
        </div>

        {/* Switcher & User Profile */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-xs font-mono text-slate-600 hover:text-indigo-600 border border-slate-200 hover:border-indigo-200 bg-white px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Scenario Demo Mode
          </Link>

          {user && (
            <div className="flex items-center gap-2 border border-slate-200 bg-white px-3 py-1.5 rounded-xl shadow-xs">
              <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-xs font-mono text-slate-700">{user.email}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                MFA Active
              </span>
            </div>
          )}

          <Link
            href="/mfa-setup"
            className="text-xs font-mono text-slate-600 hover:text-amber-800 border border-slate-200 bg-white px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all shadow-xs"
            title="Manage or re-scan Authenticator"
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-600" /> Re-enroll MFA
          </Link>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        
        {/* PHASE 4 HIGHLIGHT: CRITICAL IMPOSSIBLE TRAVEL WARNING BANNER */}
        {locationSignals?.impossible_travel_flag && (
          <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-3 duration-300">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-rose-100 border border-rose-200 text-rose-600 shrink-0 mt-0.5 animate-pulse">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-rose-800 bg-rose-100 px-2 py-0.5 rounded border border-rose-200">
                    CRITICAL SECURITY ANOMALY
                  </span>
                  <span className="text-xs font-mono text-rose-900 font-bold">
                    Impossible Travel Velocity Detected
                  </span>
                </div>
                <p className="text-xs text-rose-800 mt-1.5 leading-relaxed max-w-3xl">
                  Calculated relocation velocity exceeded the <strong>900 km/h physical human travel threshold</strong> between consecutive sessions ({locationSignals.city}, {locationSignals.country}). High probability of stolen session credentials or distributed proxy routing. Immediate Step-Up MFA Challenge enforced.
                </p>
              </div>
            </div>

            <span className="text-[11px] font-mono font-bold text-rose-800 bg-rose-100 border border-rose-300 px-3 py-1.5 rounded-xl whitespace-nowrap self-end md:self-center shadow-xs">
              Speed: &gt;900 km/h [FLAGGED]
            </span>
          </div>
        )}

        {/* PHASE 4: LIVE LOCATION & NETWORK SIGNALS CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Detected City & Country */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2 shadow-xs">
            <div className="flex justify-between items-center text-xs font-mono text-slate-500">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-indigo-600" /> Detected Geolocation
              </span>
              <span className="text-[10px] text-slate-400">Live IP-API</span>
            </div>
            <div className="text-lg font-bold text-slate-900">
              {locationSignals ? `${locationSignals.city}, ${locationSignals.country}` : 'Localhost, Local Network'}
            </div>
            <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1.5">
              <span>IP:</span>
              <span className="text-indigo-700 select-all font-bold">
                {latestLogin?.ip_address || '127.0.0.1'}
              </span>
            </div>
          </div>

          {/* VPN / Proxy Detection Signal */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2 shadow-xs">
            <div className="flex justify-between items-center text-xs font-mono text-slate-500">
              <span className="flex items-center gap-1.5">
                <Wifi className="w-3.5 h-3.5 text-sky-600" /> Network Posture
              </span>
              <span className="text-[10px] text-slate-400">Telemetry</span>
            </div>
            <div className="text-base font-bold">
              {locationSignals?.vpn_tor_detected ? (
                <span className="text-rose-700 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" /> VPN / Proxy Active
                </span>
              ) : (
                <span className="text-emerald-700 flex items-center gap-1.5">
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
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2 shadow-xs">
            <div className="flex justify-between items-center text-xs font-mono text-slate-500">
              <span className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-indigo-600" /> Baseline Location
              </span>
              <span className="text-[10px] text-slate-400">History</span>
            </div>
            <div className="text-base font-bold">
              {locationSignals?.is_known_location ? (
                <span className="text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Verified Baseline
                </span>
              ) : (
                <span className="text-amber-800 flex items-center gap-1.5">
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
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2 shadow-xs">
            <div className="flex justify-between items-center text-xs font-mono text-slate-500">
              <span className="flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-amber-600" /> Travel Speed
              </span>
              <span className="text-[10px] text-slate-400">Haversine</span>
            </div>
            <div className="text-base font-bold">
              {locationSignals?.impossible_travel_flag ? (
                <span className="text-rose-700 font-mono">
                  &gt; 900 km/h (Anomaly)
                </span>
              ) : (
                <span className="text-emerald-700 font-mono">
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
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" /> Real-Time Access &amp; Risk Evaluation
              </h2>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                Trigger a live access request against ContextGuard's 7-category risk engine with real IP geolocation, baseline matching, and optional step-up challenge triggers.
              </p>
            </div>

            <button
              onClick={handleTriggerEvaluation}
              disabled={loading}
              className="bg-gradient-to-r from-indigo-500 to-sky-500 hover:from-indigo-600 hover:to-sky-600 text-white text-xs font-mono font-bold px-6 py-3 rounded-xl flex items-center gap-2 shadow-sm shadow-indigo-200 transition-all cursor-pointer whitespace-nowrap self-start md:self-auto disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {loading ? 'Evaluating Risk...' : 'Run Access Request'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
            {/* Target Resource Selector */}
            <div className="space-y-2">
              <label className="text-xs font-mono font-bold text-slate-700 flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-600" /> Target Resource
              </label>
              <select
                value={activeResource}
                onChange={(e) => setActiveResource(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-800 focus:outline-none focus:border-indigo-400 shadow-xs"
              >
                <option value="doc_confidential_q3">Q3 Confidential Financial Models (Confidential)</option>
                <option value="production_vault">Production Secrets Vault (Restricted)</option>
                <option value="customer_pii_db">Customer PII Database (Restricted)</option>
                <option value="code_repository">Engineering Core Repository (Internal)</option>
              </select>
            </div>

            {/* Context Simulation Trigger */}
            <div className="space-y-2">
              <label className="text-xs font-mono font-bold text-slate-700 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-600" /> Live Simulation Context
              </label>
              <select
                value={simulateAnomaly}
                onChange={(e) => setSimulateAnomaly(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-800 focus:outline-none focus:border-amber-400 shadow-xs"
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
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-6 shadow-xs animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center gap-2 text-emerald-800 text-xs font-mono font-bold uppercase tracking-wider mb-4">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Live Challenge Verification Complete — Decision Upgraded
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              {/* Before vs After Visual Diff */}
              <div className="flex items-center gap-4 bg-white border border-slate-200 p-5 rounded-xl shadow-xs">
                {/* Before */}
                <div className="flex-1 text-center">
                  <span className="text-[10px] font-mono text-slate-500 uppercase">Pre-Verification</span>
                  <div className="mt-1 px-3 py-1.5 rounded-lg font-mono font-bold text-sm bg-amber-50 text-amber-900 border border-amber-200">
                    {verificationResult.beforeDecision}
                  </div>
                  <span className="text-xs font-mono text-slate-500 mt-1 block">
                    Score: <span className="text-amber-800 font-bold">{verificationResult.beforeScore.toFixed(1)}</span>
                  </span>
                </div>

                <div className="p-2 rounded-full bg-slate-100 text-slate-500">
                  <ArrowRight className="w-5 h-5 text-emerald-600" />
                </div>

                {/* After */}
                <div className="flex-1 text-center">
                  <span className="text-[10px] font-mono text-slate-500 uppercase">Post-Verification</span>
                  <div className="mt-1 px-3 py-1.5 rounded-lg font-mono font-bold text-sm bg-emerald-50 text-emerald-900 border border-emerald-200 shadow-xs">
                    {verificationResult.afterDecision}
                  </div>
                  <span className="text-xs font-mono text-slate-500 mt-1 block">
                    Score: <span className="text-emerald-700 font-bold">{verificationResult.afterScore.toFixed(1)}</span>
                    <span className="text-[10px] text-emerald-700 ml-1">(-15.0 MFA Credit)</span>
                  </span>
                </div>
              </div>

              {/* Rationale & Audit Confirmation */}
              <div className="space-y-2 text-xs font-mono">
                <div className="text-slate-800 font-bold flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-indigo-600" /> Engine Decision Rationale:
                </div>
                <p className="text-slate-700 leading-relaxed bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                  {verificationResult.rationale}
                </p>
                <div className="text-[11px] text-slate-500">
                  Resolved Challenge ID: <span className="text-slate-700 select-all font-bold">{verificationResult.challengeId}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Current Evaluation Live Card */}
        {currentEval && !verificationResult && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-start flex-wrap gap-4">
              <div>
                <span className="text-[10px] font-mono text-slate-500">EVALUATION ID: {currentEval.evaluation_id}</span>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mt-1">
                  Access Decision Result:
                  <span className={`px-3 py-1 rounded-lg text-xs font-mono font-bold border ${getDecisionColor(currentEval.decision)}`}>
                    {currentEval.decision}
                  </span>
                </h3>
              </div>

              <div className="text-right font-mono">
                <span className="text-xs text-slate-500">Composite Risk Score:</span>
                <div className="text-2xl font-bold text-indigo-700">
                  {currentEval.final_score.toFixed(1)} <span className="text-xs text-slate-400 font-normal">/ 100</span>
                </div>
              </div>
            </div>

            {/* If Challenge triggered, show action banner */}
            {currentEval.mfa_required && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xs">
                <div className="flex items-center gap-3 text-amber-900 text-xs font-mono">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                  <div>
                    <span className="font-bold">Step-Up Verification Required:</span>
                    <p className="text-amber-800 text-[11px] mt-0.5">
                      Session risk triggered an automated TOTP Challenge. Enter code from your authenticator app to authorize access.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowChallengeModal(true)}
                  className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-mono font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm shadow-amber-200 cursor-pointer whitespace-nowrap"
                >
                  <KeyRound className="w-3.5 h-3.5" /> Enter 6-Digit Code
                </button>
              </div>
            )}
          </div>
        )}

        {/* Chronological Login History (Phase 4 Real Data) */}
        {loginHistoryList.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
            <h3 className="text-sm font-mono font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600" /> Real Login Geolocation Audit Trail (PostgreSQL)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono text-left">
                <thead className="text-slate-600 border-b border-slate-200 bg-slate-50 font-bold">
                  <tr>
                    <th className="py-2.5 px-3">Session Log ID</th>
                    <th className="py-2.5 px-3">IP Address</th>
                    <th className="py-2.5 px-3">Detected Location</th>
                    <th className="py-2.5 px-3">VPN / Proxy</th>
                    <th className="py-2.5 px-3">Timestamp (UTC)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {loginHistoryList.slice(0, 5).map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3 text-indigo-700 font-bold">{log.id}</td>
                      <td className="py-2.5 px-3 text-slate-900 font-bold">{log.ip_address}</td>
                      <td className="py-2.5 px-3">
                        {log.geo_city}, {log.geo_country}
                      </td>
                      <td className="py-2.5 px-3">
                        {log.is_vpn_or_proxy ? (
                          <span className="text-rose-700 font-semibold">Flagged</span>
                        ) : (
                          <span className="text-emerald-700 font-semibold">Direct</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white border border-amber-200 rounded-2xl p-6 shadow-2xl relative">
            <div className="text-center mb-6">
              <div className="inline-flex p-3 rounded-2xl bg-amber-50 border border-amber-200 mb-3 shadow-xs">
                <KeyRound className="w-7 h-7 text-amber-600" />
              </div>
              <h3 className="text-xl font-bold tracking-tight text-slate-900">
                Additional Verification Required
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                ContextGuard Step-Up Authentication Challenge
              </p>
            </div>

            {challengeError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{challengeError}</span>
              </div>
            )}

            <form onSubmit={handleVerifyChallenge} className="space-y-5">
              <div>
                <label className="block text-xs font-mono font-medium text-slate-700 mb-2 text-center">
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
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3.5 text-center text-2xl tracking-[0.5em] font-mono font-bold text-amber-900 placeholder-slate-300 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all shadow-xs"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowChallengeModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-mono font-bold py-3 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifyingChallenge || totpCode.length !== 6}
                  className="flex-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-mono font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-sm shadow-amber-200 transition-all disabled:opacity-50 cursor-pointer"
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
