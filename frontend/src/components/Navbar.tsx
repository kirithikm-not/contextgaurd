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
    <nav className="border-b border-slate-200/80 bg-white/90 backdrop-blur-md sticky top-0 z-50 px-4 sm:px-6 py-3 transition-all shadow-xs">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        
        {/* Left: Brand Identity */}
        <Link 
          href="/" 
          className="flex items-center gap-2.5 group transition-transform hover:scale-[1.01]"
        >
          <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-500 to-sky-400 text-white shadow-sm shadow-indigo-200 group-hover:shadow-indigo-300 transition-all">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors">
                ContextGuard
              </span>
              <span className="hidden sm:inline-flex text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                Zero-Trust Core
              </span>
            </div>
            <p className="hidden md:block text-[10px] text-slate-500 font-mono">
              Adaptive Access &amp; Step-Up MFA
            </p>
          </div>
        </Link>

        {/* Center: Primary Navigation Links */}
        <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-100/90 p-1 rounded-xl border border-slate-200 shadow-inner">
          <Link
            href="/"
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 transition-all ${
              isScenarioDemoActive
                ? 'bg-white text-indigo-700 border border-slate-200 font-bold shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 border border-transparent'
            }`}
          >
            <Sliders className={`w-3.5 h-3.5 ${isScenarioDemoActive ? 'text-indigo-600' : 'text-slate-400'}`} />
            <span>Scenario Demo</span>
          </Link>

          <Link
            href={user ? "/dashboard" : "/login"}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 transition-all ${
              isDashboardActive
                ? 'bg-white text-indigo-700 border border-slate-200 font-bold shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 border border-transparent'
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${isDashboardActive ? 'text-indigo-600 animate-pulse' : 'text-slate-400'}`} />
            <span>Live Mode</span>
          </Link>

          <Link
            href="/mfa-setup"
            className={`hidden sm:flex px-3 py-1.5 rounded-lg text-xs font-mono font-medium items-center gap-1.5 transition-all ${
              isMfaActive
                ? 'bg-white text-indigo-700 border border-slate-200 font-bold shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 border border-transparent'
            }`}
          >
            <KeyRound className={`w-3.5 h-3.5 ${isMfaActive ? 'text-indigo-600' : 'text-slate-400'}`} />
            <span>MFA Setup</span>
          </Link>
        </div>

        {/* Right: Auth & User Actions */}
        <div className="flex items-center gap-2 text-xs font-mono">
          {user ? (
            <div className="flex items-center gap-2">
              <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 shadow-xs">
                <User className="w-3.5 h-3.5 text-indigo-600" />
                <span className="max-w-[140px] truncate">{user.email || user.id}</span>
                {user.mfa_enabled && (
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" title="MFA Protected" />
                )}
              </div>

              {!isDashboardActive && (
                <Link
                  href="/dashboard"
                  className="px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 flex items-center gap-1.5 transition-all font-semibold"
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Dashboard</span>
                </Link>
              )}

              <button
                onClick={handleSignOut}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-rose-200 bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-700 flex items-center gap-1.5 transition-all shadow-xs"
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
                className={`px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 shadow-xs ${
                  isLoginActive
                    ? 'border-indigo-300 text-indigo-700 bg-indigo-50/70 font-semibold'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700 hover:text-indigo-600'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </Link>

              <Link
                href="/register"
                className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 shadow-sm shadow-indigo-100 ${
                  isRegisterActive
                    ? 'bg-indigo-700 text-white'
                    : 'bg-gradient-to-r from-indigo-500 to-sky-500 hover:from-indigo-600 hover:to-sky-600 text-white'
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
