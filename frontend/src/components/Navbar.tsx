'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Shield, 
  Sliders, 
  Radio, 
  KeyRound, 
  User, 
  LogOut, 
  LogIn, 
  UserPlus, 
  LayoutDashboard,
  CheckCircle2
} from 'lucide-react';

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any | null>(null);

  // Sync user state from localStorage
  useEffect(() => {
    const checkUser = () => {
      const rawUser = localStorage.getItem('contextguard_user');
      if (rawUser) {
        try {
          setUser(JSON.parse(rawUser));
        } catch (e) {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    };

    checkUser();

    // Listen for storage events across tabs or local updates
    window.addEventListener('storage', checkUser);
    return () => window.removeEventListener('storage', checkUser);
  }, [pathname]);

  const handleSignOut = () => {
    localStorage.removeItem('contextguard_user');
    localStorage.removeItem('contextguard_session');
    setUser(null);
    router.push('/login');
  };

  const isScenarioDemoActive = pathname === '/';
  const isDashboardActive = pathname === '/dashboard';
  const isMfaActive = pathname === '/mfa-setup';
  const isLoginActive = pathname === '/login';
  const isRegisterActive = pathname === '/register';

  return (
    <nav className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md sticky top-0 z-50 px-4 sm:px-6 py-3 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        
        {/* Left: Brand Identity */}
        <Link 
          href="/" 
          className="flex items-center gap-2.5 group transition-transform hover:scale-[1.01]"
        >
          <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/25 group-hover:shadow-cyan-500/40 transition-all">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-white group-hover:text-cyan-300 transition-colors">
                ContextGuard
              </span>
              <span className="hidden sm:inline-flex text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-400 border border-cyan-800/60">
                Zero-Trust Core
              </span>
            </div>
            <p className="hidden md:block text-[10px] text-slate-400 font-mono">
              Adaptive Access &amp; Step-Up MFA
            </p>
          </div>
        </Link>

        {/* Center: Primary Navigation Links */}
        <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-900/90 p-1 rounded-xl border border-slate-800/90 shadow-inner">
          <Link
            href="/"
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 transition-all ${
              isScenarioDemoActive
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
          >
            <Sliders className={`w-3.5 h-3.5 ${isScenarioDemoActive ? 'text-cyan-400' : 'text-slate-500'}`} />
            <span>Scenario Demo</span>
          </Link>

          <Link
            href={user ? "/dashboard" : "/login"}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 transition-all ${
              isDashboardActive
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${isDashboardActive ? 'text-cyan-400 animate-pulse' : 'text-slate-500'}`} />
            <span>Live Mode</span>
          </Link>

          <Link
            href="/mfa-setup"
            className={`hidden sm:flex px-3 py-1.5 rounded-lg text-xs font-mono font-medium items-center gap-1.5 transition-all ${
              isMfaActive
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
          >
            <KeyRound className={`w-3.5 h-3.5 ${isMfaActive ? 'text-cyan-400' : 'text-slate-500'}`} />
            <span>MFA Setup</span>
          </Link>
        </div>

        {/* Right: Auth & User Actions */}
        <div className="flex items-center gap-2 text-xs font-mono">
          {user ? (
            <div className="flex items-center gap-2">
              <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-800 bg-slate-900/80 text-slate-300">
                <User className="w-3.5 h-3.5 text-cyan-400" />
                <span className="max-w-[140px] truncate">{user.email || user.id}</span>
                {user.mfa_enabled && (
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" title="MFA Protected" />
                )}
              </div>

              {!isDashboardActive && (
                <Link
                  href="/dashboard"
                  className="px-2.5 py-1.5 rounded-lg bg-cyan-600/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-600/30 flex items-center gap-1.5 transition-all"
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Dashboard</span>
                </Link>
              )}

              <button
                onClick={handleSignOut}
                className="px-2.5 py-1.5 rounded-lg border border-slate-800 hover:border-rose-900/60 bg-slate-900/80 hover:bg-rose-950/30 text-slate-400 hover:text-rose-300 flex items-center gap-1.5 transition-all"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className={`px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                  isLoginActive
                    ? 'border-cyan-500 text-cyan-300 bg-cyan-950/40'
                    : 'border-slate-800 hover:border-slate-700 bg-slate-900/80 text-slate-300 hover:text-white'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </Link>

              <Link
                href="/register"
                className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 shadow-sm shadow-cyan-500/20 ${
                  isRegisterActive
                    ? 'bg-cyan-500 text-slate-950'
                    : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Register</span>
              </Link>
            </div>
          )}
        </div>

      </div>
    </nav>
  );
}
