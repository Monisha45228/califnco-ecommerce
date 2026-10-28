import React, { FormEvent, useState } from 'react';
import { Droplets, Loader2 } from 'lucide-react';
import { getAuthErrorMessage, logIn, requestPasswordReset, signUp } from '../services/auth';
import { isFirebaseConfigured } from '../services/firebase';
import { UserRole } from '../types';

export const AuthScreen: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Extract<UserRole, 'customer' | 'dealer'>>('customer');
  const [street, setStreet] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    if (mode === 'signup') {
      if (!name.trim()) return setError('Enter your name.');
      const digits = phone.replace(/\D/g, '');
      if (!/^\d{10}$/.test(digits)) return setError('Enter a phone number with exactly 10 digits.');
      if (password.length < 6) return setError('Password must be at least 6 characters.');
    }
    if (mode === 'login' && !password) return setError('Enter your password.');

    setBusy(true);
    try {
      if (mode === 'signup') {
        await signUp(name.trim(), email.trim(), phone.replace(/\D/g, ''), password, role, street.trim());
      } else if (mode === 'login') {
        await logIn(email.trim(), password);
      } else {
        await requestPasswordReset(email.trim());
        setMessage('Password reset email sent. Check your inbox.');
      }
    } catch (submitError) {
      setError(getAuthErrorMessage(submitError));
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (nextMode: 'login' | 'signup' | 'forgot') => {
    setMode(nextMode);
    setError('');
    setMessage('');
  };

  return (
    <main className="min-h-screen bg-slate-100 dark:bg-slate-950 px-4 py-10 flex items-center justify-center">
      <section className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-7 shadow-xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3 mb-6">
          <span className="w-11 h-11 rounded-2xl bg-sky-600 text-white flex items-center justify-center"><Droplets /></span>
          <div><h1 className="text-xl font-extrabold text-slate-900 dark:text-white">Califnco</h1><p className="text-sm text-slate-500">Pure Water Solutions</p></div>
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          {mode === 'signup' ? 'Create your account' : mode === 'forgot' ? 'Reset your password' : 'Welcome back'}
        </h2>
        <p className="text-sm text-slate-500 mt-1 mb-5">
          {mode === 'signup' ? 'Register as a customer or dealer.' : mode === 'forgot' ? 'We will email you a secure reset link.' : 'Log in to continue to your Califnco account.'}
        </p>
        {!isFirebaseConfigured && (
          <p role="alert" className="mb-4 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 p-3 text-sm">
            Firebase is not configured. Add the project values from the setup instructions to mobile-app/.env.local.
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'signup' && <>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Full name<input required autoComplete="name" value={name} onChange={e => setName(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2.5 font-normal" /></label>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Phone<input required type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10} title="Enter exactly 10 digits." value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2.5 font-normal" /><span className="text-xs text-slate-400 font-normal">Enter a 10-digit mobile number.</span></label>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Account type<select value={role} onChange={e => setRole(e.target.value as typeof role)} className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 font-normal"><option value="customer">Customer</option><option value="dealer">Dealer</option></select></label>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Street address <span className="font-normal text-slate-400">(optional)</span><input autoComplete="street-address" value={street} onChange={e => setStreet(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2.5 font-normal" /></label>
          </>}
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Email<input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2.5 font-normal" /></label>
          {mode !== 'forgot' && <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Password<input required minLength={mode === 'signup' ? 6 : undefined} type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2.5 font-normal" />{mode === 'signup' && <span className="text-xs text-slate-400 font-normal">At least 6 characters.</span>}</label>}
          {error && <p role="alert" className="rounded-xl bg-rose-50 text-rose-700 border border-rose-100 p-3 text-sm">{error}</p>}
          {message && <p role="status" className="rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 p-3 text-sm">{message}</p>}
          <button disabled={busy || !isFirebaseConfigured} className="w-full mt-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold py-3 flex justify-center items-center gap-2">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Log in'}
          </button>
        </form>
        <div className="mt-5 text-sm text-center space-y-2">
          {mode === 'login' && <button onClick={() => switchMode('forgot')} className="block mx-auto text-sky-700 dark:text-sky-400 font-semibold">Forgot password?</button>}
          {mode !== 'forgot' ? <p className="text-slate-500">{mode === 'signup' ? 'Already registered?' : 'New to Califnco?'} <button onClick={() => switchMode(mode === 'signup' ? 'login' : 'signup')} className="text-sky-700 dark:text-sky-400 font-bold">{mode === 'signup' ? 'Log in' : 'Sign up'}</button></p> : <button onClick={() => switchMode('login')} className="text-sky-700 dark:text-sky-400 font-semibold">Back to log in</button>}
        </div>
      </section>
    </main>
  );
};
