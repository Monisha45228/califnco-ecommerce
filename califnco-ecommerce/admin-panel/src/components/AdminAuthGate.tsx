import React, { FormEvent, useEffect, useState } from 'react';
import {
  browserLocalPersistence,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured, isUsingFirebaseEmulators } from '../services/firebase';

function authMessage(error: unknown) {
  const code = (error as { code?: string })?.code;
  if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') return 'The email or password is incorrect.';
  if (code === 'auth/invalid-email') return 'Enter a valid email address.';
  if (code === 'auth/too-many-requests') return 'Too many attempts. Wait a moment and try again.';
  if (code === 'auth/network-request-failed') {
    return isUsingFirebaseEmulators
      ? 'Cannot reach the local Firebase Auth emulator at 127.0.0.1:9099. Start Firebase and the apps with "npm run dev" from the project root.'
      : 'Network error connecting to Firebase. Check your internet connection and Firebase project configuration, then try again.';
  }
  if (code === 'auth/operation-not-allowed') return 'Email and password sign-in is not enabled for this Firebase project.';
  if (code === 'auth/invalid-api-key') return 'Firebase configuration is invalid. Check the VITE_FIREBASE_* settings.';
  return error instanceof Error ? error.message : 'Authentication failed. Please try again.';
}

export const AdminAuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [verificationAttempt, setVerificationAttempt] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [forgotPassword, setForgotPassword] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!auth || !db) {
      setLoading(false);
      return;
    }
    let active = true;
    let unsubscribe: (() => void) | undefined;
    void setPersistence(auth, browserLocalPersistence).then(() => {
      if (!active) return;
      unsubscribe = onAuthStateChanged(auth, async user => {
        if (!user) {
          setIsAdmin(false);
          setLoading(false);
          return;
        }

        setLoading(true);
        setProfileError('');
        try {
          const profile = await getDoc(doc(db, 'users', user.uid));
          if (!active || auth.currentUser?.uid !== user.uid) return;
          if (profile.data()?.role === 'admin') {
            setIsAdmin(true);
            setLoading(false);
            return;
          }

          setIsAdmin(false);
          setError('This account does not have admin access.');
          setLoading(false);
          try {
            await signOut(auth);
          } catch (signOutError) {
            if (!active || auth.currentUser?.uid !== user.uid) return;
            setProfileError(`This account does not have admin access and could not be signed out: ${authMessage(signOutError)}`);
          }
        } catch (verificationError) {
          if (!active || auth.currentUser?.uid !== user.uid) return;
          setIsAdmin(false);
          setProfileError(
            `Could not verify this account's admin profile. Your session is still signed in. ${authMessage(verificationError)}`
          );
          setLoading(false);
        }
      });
    }).catch(persistenceError => {
      if (!active) return;
      setProfileError(`Could not initialize persistent admin sign-in: ${authMessage(persistenceError)}`);
      setLoading(false);
    });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [verificationAttempt]);

  const signOutCurrentUser = async () => {
    if (!auth) return;
    setBusy(true);
    setError('');
    try {
      await signOut(auth);
      setProfileError('');
    } catch (signOutError) {
      setError(`Unable to log out: ${authMessage(signOutError)}`);
    } finally {
      setBusy(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setProfileError('');
    setMessage('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    if (!forgotPassword && !password) {
      setError('Enter your password.');
      return;
    }
    setBusy(true);
    try {
      if (!auth) throw new Error('Firebase is not configured. Set the VITE_FIREBASE_* values in admin-panel/.env.local.');
      if (forgotPassword) {
        await sendPasswordResetEmail(auth, email.trim());
        setMessage('Password reset email sent. Check your inbox.');
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (submitError) {
      setError(authMessage(submitError));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="min-h-screen grid place-items-center text-slate-500">Checking admin access...</div>;
  if (isAdmin) return <>{children}</>;

  if (profileError && auth?.currentUser) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <section className="w-full max-w-md rounded-3xl bg-white border border-slate-200 p-7 shadow-xl">
          <h1 className="text-2xl font-extrabold text-slate-900">Califnco Admin</h1>
          <p role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{profileError}</p>
          {error && <p role="alert" className="mt-3 rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          <div className="mt-5 flex gap-3">
            <button disabled={busy} onClick={() => { setProfileError(''); setVerificationAttempt(attempt => attempt + 1); }} className="flex-1 rounded-xl bg-sky-600 py-3 font-bold text-white disabled:opacity-50">Retry verification</button>
            <button disabled={busy} onClick={() => void signOutCurrentUser()} className="rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-700 disabled:opacity-50">Log out</button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <section className="w-full max-w-md rounded-3xl bg-white border border-slate-200 p-7 shadow-xl">
        <h1 className="text-2xl font-extrabold text-slate-900">Califnco Admin</h1>
        <p className="mt-1 mb-6 text-sm text-slate-500">{forgotPassword ? 'Receive a secure password reset link.' : 'Sign in with an administrator account.'}</p>
        {!isFirebaseConfigured && <p role="alert" className="mb-4 p-3 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-sm">Firebase is not configured. Add the project values to admin-panel/.env.local.</p>}
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-semibold text-slate-700">Email<input required type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" /></label>
          {!forgotPassword && <label className="block text-sm font-semibold text-slate-700">Password<input required type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" /></label>}
          {error && <p role="alert" className="p-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-100 text-sm">{error}</p>}
          {message && <p role="status" className="p-3 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 text-sm">{message}</p>}
          <button disabled={busy || !isFirebaseConfigured} className="w-full rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold py-3">{busy ? 'Please wait...' : forgotPassword ? 'Send reset link' : 'Log in'}</button>
        </form>
        <button onClick={() => { setForgotPassword(!forgotPassword); setError(''); setMessage(''); }} className="mt-4 w-full text-center text-sm font-semibold text-sky-700">
          {forgotPassword ? 'Back to login' : 'Forgot password?'}
        </button>
        {auth?.currentUser && <button onClick={() => void signOutCurrentUser()} className="mt-2 w-full text-center text-sm font-semibold text-rose-700">Log out</button>}
      </section>
    </main>
  );
};
