'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Shield, KeyRound, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft, Copy, Check } from 'lucide-react';
import { API_BASE_URL } from '@/config/api';

export default function MfaSetupPage() {
  const router = useRouter();
  const [user, setUser] = useState<any | null>(null);
  const [setupData, setSetupData] = useState<{
    secret: string;
    qr_code_base64: string;
    provisioning_uri: string;
  } | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

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
      // Fallback demo user for immediate mobile QR testing
      currentUser = {
        id: 'usr_totp_test',
        email: 'analyst@contextguard.local',
        mfa_enabled: false,
      };
      localStorage.setItem('contextguard_user', JSON.stringify(currentUser));
    }

    setUser(currentUser);

    // Call /api/auth/mfa/setup
    const fetchMfaSetup = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/mfa/setup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: currentUser.id }),
        });
        const data = await res.json();
        if (res.ok) {
          setSetupData({
            secret: data.totp_secret,
            qr_code_base64: data.qr_code_base64,
            provisioning_uri: data.provisioning_uri,
          });
        } else {
          setError(data.detail || 'Failed to initialize MFA setup');
        }
      } catch (err: any) {
        setError('Network error connecting to security backend');
      }
    };

    fetchMfaSetup();
  }, [router]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !totpCode) return;
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/mfa/enable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          totp_code: totpCode.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Invalid TOTP code');
      }

      setSuccess(true);
      // Update local storage user state
      const updatedUser = { ...user, mfa_enabled: true };
      localStorage.setItem('contextguard_user', JSON.stringify(updatedUser));

      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCopySecret = () => {
    if (setupData?.secret) {
      navigator.clipboard.writeText(setupData.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex-1 bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 py-10 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-cyan-500/10 blur-[130px] rounded-full pointer-events-none" />

      {/* Top navigation */}
      <div className="w-full max-w-lg mb-6 flex justify-between items-center z-10">
        <Link
          href="/"
          className="text-xs font-mono text-slate-400 hover:text-cyan-300 flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Scenario Demo Mode
        </Link>
        <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 bg-amber-950/80 border border-amber-800/60 px-2 py-0.5 rounded-full flex items-center gap-1">
          Step-Up Enrollment
        </span>
      </div>

      <div className="w-full max-w-lg bg-slate-900/70 border border-slate-800 backdrop-blur-xl rounded-2xl p-8 shadow-2xl shadow-cyan-950/30 relative z-10">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex p-3 rounded-2xl bg-cyan-950/80 border border-cyan-700/50 mb-3 shadow-inner">
            <KeyRound className="w-8 h-8 text-cyan-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">Set Up Authenticator App</h1>
          <p className="text-xs text-slate-400 mt-1">
            Required for ContextGuard Step-Up Challenge Verification
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>MFA enabled successfully! Redirecting to dashboard...</span>
          </div>
        )}

        {/* Setup Card Body */}
        {setupData ? (
          <div className="space-y-6">
            {/* Step 1: Scan QR Code */}
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 flex flex-col items-center">
              <span className="text-[11px] font-mono font-semibold text-cyan-400 uppercase tracking-wider mb-3">
                1. Scan QR Code in Authenticator App
              </span>
              <div className="p-3 bg-white rounded-xl shadow-lg shadow-black/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={setupData.qr_code_base64}
                  alt="MFA QR Code"
                  className="w-44 h-44 object-contain rounded-lg"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-2 text-center">
                Supports Google Authenticator, Microsoft Authenticator, 1Password, etc.
              </p>
            </div>

            {/* Step 2: Manual Key Fallback */}
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[11px] font-mono text-slate-400">Manual Entry Key:</span>
                <button
                  type="button"
                  onClick={handleCopySecret}
                  className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="font-mono text-xs text-slate-200 bg-slate-900 px-3 py-2 rounded-lg border border-slate-800 select-all break-all text-center">
                {setupData.secret}
              </div>
            </div>

            {/* Step 3: Enter 6-digit Code to Confirm */}
            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
                  2. Enter 6-Digit Code from App
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-center text-xl tracking-[0.5em] font-mono font-bold text-cyan-300 placeholder-slate-700 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loading || totpCode.length !== 6}
                className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-mono font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/50 transition-all disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    Confirm & Activate MFA <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
            <span className="inline-block w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-mono">Generating secure cryptographic TOTP seed...</span>
          </div>
        )}
      </div>
    </div>
  );
}
