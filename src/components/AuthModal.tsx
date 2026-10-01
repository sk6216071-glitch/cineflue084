'use client';

import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Mail,
  Lock,
  User as UserIcon,
  CheckCircle2,
  ShieldCheck,
  LogIn,
  AlertCircle,
  Zap,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface AuthModalProps {
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose }) => {
  const { loginWithGoogle, loginWithEmail, signupWithEmail, fastLogin, isLoggedIn, userProfile, logout } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAccountNotFound, setIsAccountNotFound] = useState(false);
  const [useFastLogin, setUseFastLogin] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setIsAccountNotFound(false);

    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);

    if (useFastLogin) {
      const res = await fastLogin(email.trim(), displayName.trim());
      setLoading(false);
      if (res.success) {
        setSuccessMessage('Logged in successfully!');
        setTimeout(onClose, 600);
      } else {
        setError(res.error || 'Failed to sign in.');
      }
      return;
    }

    if (isSignUp) {
      if (!password || password.length < 4) {
        setError('Password must be at least 4 characters.');
        setLoading(false);
        return;
      }
      const res = await signupWithEmail(email.trim(), password, displayName.trim());
      setLoading(false);
      if (res.success) {
        setSuccessMessage('Account created and signed in successfully!');
        setTimeout(onClose, 600);
      } else {
        setError(res.error || 'Failed to sign up.');
      }
    } else {
      if (!password) {
        setError('Please enter your password.');
        setLoading(false);
        return;
      }
      const res = await loginWithEmail(email.trim(), password);
      setLoading(false);
      if (res.success) {
        setSuccessMessage('Signed in successfully!');
        setTimeout(onClose, 600);
      } else {
        if (res.notFound) {
          setIsAccountNotFound(true);
        }
        setError(res.error || 'Failed to sign in.');
      }
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setSuccessMessage('');
    setIsAccountNotFound(false);
    setLoading(true);
    const res = await loginWithGoogle();
    setLoading(false);
    if (res.success) {
      setSuccessMessage('Signed in with Google!');
      setTimeout(onClose, 500);
    } else {
      setError(
        res.error ||
          'Google Sign-In is unavailable or blocked in this browser (e.g. Brave Shields / Adblock). Please sign in with your email below.'
      );
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-[#0e1117] border border-zinc-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-white">
              {isLoggedIn
                ? 'Account Profile'
                : useFastLogin
                ? 'Instant 1-Click Sign-In'
                : isSignUp
                ? 'Create CineFuel Account'
                : 'Sign In to CineFuel'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-sm">
          {isLoggedIn ? (
            <div className="space-y-4 text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-black font-black text-2xl mx-auto shadow-lg shadow-amber-500/20">
                {userProfile.displayName ? userProfile.displayName[0].toUpperCase() : 'U'}
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{userProfile.displayName}</h3>
                <p className="text-xs text-zinc-400">{userProfile.email}</p>
              </div>

              <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Account Active & Synced (MongoDB Atlas)</span>
              </div>

              <div className="pt-2 flex justify-center">
                <button
                  onClick={() => {
                    logout();
                    onClose();
                  }}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold transition-colors"
                >
                  Sign Out of CineFuel
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Tab Selector: Sign In vs Create Account */}
              <div className="flex bg-zinc-900/90 p-1 rounded-xl border border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(false);
                    setUseFastLogin(false);
                    setError('');
                    setIsAccountNotFound(false);
                  }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    !isSignUp && !useFastLogin
                      ? 'bg-amber-500 text-black shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(true);
                    setUseFastLogin(false);
                    setError('');
                    setIsAccountNotFound(false);
                  }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    isSignUp && !useFastLogin
                      ? 'bg-amber-500 text-black shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Create Account
                </button>
              </div>

              {/* Success Notification */}
              {successMessage && (
                <div className="p-3 bg-emerald-950/50 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-medium flex items-center gap-2 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* Error Notification */}
              {error && (
                <div className="p-3 bg-rose-950/50 border border-rose-500/40 rounded-xl text-rose-300 text-xs font-medium space-y-2 animate-fadeIn">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">{error}</p>
                  </div>
                  {isAccountNotFound && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsSignUp(true);
                        setError('');
                        setIsAccountNotFound(false);
                      }}
                      className="text-amber-400 hover:underline font-bold text-xs flex items-center gap-1.5 pl-6"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      Create a new account with {email}
                    </button>
                  )}
                </div>
              )}

              {/* Google 1-Click Login */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl bg-white hover:bg-zinc-100 text-black font-bold text-xs transition-all shadow-md active:scale-98 disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"
                  />
                </svg>
                Continue with Google
              </button>

              <div className="flex items-center gap-3 my-1">
                <div className="flex-1 h-px bg-zinc-800" />
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
                  {useFastLogin ? 'Instant Email Access' : 'Or with Email & Password'}
                </span>
                <div className="flex-1 h-px bg-zinc-800" />
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-3">
                {(isSignUp || useFastLogin) && (
                  <div>
                    <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                      Display Name {useFastLogin && <span className="text-zinc-500">(Optional)</span>}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Your Name or Nickname"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-xl pl-9 pr-4 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
                      />
                      <UserIcon className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-[11px] font-semibold text-zinc-300 block mb-1">Email Address</label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl pl-9 pr-4 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
                    />
                    <Mail className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {!useFastLogin && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-zinc-300 block">Password</label>
                      {isSignUp && (
                        <span className="text-[10px] text-zinc-500">Min 4 characters</span>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-xl pl-9 pr-4 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
                      />
                      <Lock className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold text-xs transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : useFastLogin ? (
                    <>
                      <Zap className="w-3.5 h-3.5" />
                      <span>Instant Sign In</span>
                    </>
                  ) : isSignUp ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Create CineFuel Account</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Sign In</span>
                    </>
                  )}
                </button>
              </form>

              {/* Fast 1-Click Sign-In Alternate Switch */}
              <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setUseFastLogin(!useFastLogin);
                    setError('');
                  }}
                  className="text-zinc-400 hover:text-amber-400 text-[11px] font-medium flex items-center gap-1 transition-colors"
                >
                  <Zap className="w-3 h-3 text-amber-400" />
                  {useFastLogin ? 'Use password instead' : 'Quick sign-in without password'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setUseFastLogin(false);
                    setError('');
                    setIsAccountNotFound(false);
                  }}
                  className="text-amber-400 hover:underline font-semibold text-[11px]"
                >
                  {isSignUp ? 'Already registered? Sign In' : 'New user? Register'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
