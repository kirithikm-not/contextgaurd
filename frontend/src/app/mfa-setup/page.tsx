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
        setError(err.message || 'Error connecting to security backend');
      }
    };

    fetchMfaSetup();
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !totpCode || totpCode.length !== 6) {
      setError('Please enter a valid 6-digit TOTP code');
      return;
    }

    setLoading(true);
    setError(null);

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
        throw new Error(data.detail || 'Invalid TOTP code. Please check your authenticator clock or code.');
      }

      setSuccess(true);

      // Update stored user object
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
    <div className="flex-1 bg-slate-50 text-slate-900 flex flex-col justify-center items-center px-4 py-10 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-indigo-100/60 blur-[130px] rounded-full pointer-events-none" />

      {/* Top navigation */}
      <div className="w-full max-w-lg mb-6 flex justify-between items-center z-10">
        <Link
          href="/"
          className="text-xs font-mono text-slate-500 hover:text-indigo-600 flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Scenario Demo Mode
        </Link>
        <span className="text-[10px] font-mono uppercase tracking-widest text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full flex items-center gap-1 font-bold">
          Step-Up Enrollment
        </span>
      </div>

      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl p-8 shadow-sm relative z-10">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex p-3 rounded-2xl bg-indigo-50 border border-indigo-200 mb-3 shadow-xs">
            <KeyRound className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Set Up Authenticator App</h1>
          <p className="text-xs text-slate-500 mt-1">
            Required for ContextGuard Step-Up Challenge Verification
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>MFA enabled successfully! Redirecting to dashboard...</span>
          </div>
        )}

        {/* Setup Card Body */}
        {setupData ? (
          <div className="space-y-6">
            {/* Step 1: Scan QR Code */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col items-center shadow-xs">
              <span className="text-[11px] font-mono font-bold text-indigo-700 uppercase tracking-wider mb-3">
                1. Scan QR Code in Authenticator App
              </span>
              <div className="p-3 bg-white rounded-xl shadow-xs border border-slate-200">
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
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 shadow-xs">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[11px] font-mono text-slate-600">Manual Entry Key:</span>
                <button
                  type="button"
                  onClick={handleCopySecret}
                  className="text-[11px] font-mono text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer font-bold"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="font-mono text-xs text-slate-800 bg-white px-3 py-2 rounded-lg border border-slate-200 select-all break-all text-center shadow-xs">
                {setupData.secret}
              </div>
            </div>

            {/* Step 3: Enter 6-digit Code to Confirm */}
            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className="block text-xs font-mono font-medium text-slate-700 mb-1.5">
                  2. Enter 6-Digit Code from App
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-center text-xl tracking-[0.5em] font-mono font-bold text-indigo-900 placeholder-slate-300 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all shadow-xs"
                />
              </div>

              <button
                type="submit"
                disabled={loading || totpCode.length !== 6}
                className="w-full bg-gradient-to-r from-indigo-500 to-sky-500 hover:from-indigo-600 hover:to-sky-600 text-white text-xs font-mono font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-sm shadow-indigo-200 transition-all disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    Confirm &amp; Activate MFA <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-500">
            <span className="inline-block w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-mono">Generating secure cryptographic TOTP seed...</span>
          </div>
        )}
      </div>
    </div>
  );
}
