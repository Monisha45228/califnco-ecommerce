import {
  createUserWithEmailAndPassword,
  deleteUser,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured, isUsingFirebaseEmulators } from './firebase';
import { UserRole } from '../types';
import { Auth } from 'firebase/auth';
import { Firestore } from 'firebase/firestore';

function getFirebaseServices(): { auth: Auth; db: Firestore } {
  if (!auth || !db) throw new Error('Firebase is not configured. Set the VITE_FIREBASE_* values in mobile-app/.env.local.');
  return { auth, db };
}

export function getAuthErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code;
  switch (code) {
    case 'auth/email-already-in-use': return 'An account already exists for this email. Log in instead.';
    case 'auth/invalid-email': return 'Enter a valid email address.';
    case 'auth/weak-password': return 'Use a password with at least 6 characters.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found': return 'The email or password is incorrect.';
    case 'auth/too-many-requests': return 'Too many attempts. Wait a moment and try again.';
    case 'auth/network-request-failed':
      return isUsingFirebaseEmulators
        ? 'Cannot reach the local Firebase Auth emulator at 127.0.0.1:9099. Start Firebase and the apps with "npm run dev" from the project root.'
        : 'Network error connecting to Firebase. Check your internet connection and Firebase project configuration, then try again.';
    case 'auth/user-disabled': return 'This account has been disabled. Contact support.';
    case 'auth/operation-not-allowed': return 'Email and password sign-in is not enabled for this Firebase project.';
    case 'auth/invalid-api-key': return 'Firebase configuration is invalid. Check the VITE_FIREBASE_* settings.';
    default: return error instanceof Error ? error.message : 'Authentication failed. Please try again.';
  }
}

export async function signUp(
  name: string,
  email: string,
  phone: string,
  password: string,
  role: Extract<UserRole, 'customer' | 'dealer'>,
  street: string
) {
  if (!isFirebaseConfigured) throw new Error('Firebase is not configured. Set the VITE_FIREBASE_* values in mobile-app/.env.local.');
  if (!/^\d{10}$/.test(phone)) throw new Error('Enter a phone number with exactly 10 digits.');
  const services = getFirebaseServices();
  const credential = await createUserWithEmailAndPassword(services.auth, email, password);
  try {
    await updateProfile(credential.user, { displayName: name });
    await setDoc(doc(services.db, 'users', credential.user.uid), {
      name,
      email: credential.user.email,
      phone,
      role,
      address: { street, city: '', state: '', postalCode: '' },
      createdAt: serverTimestamp(),
      fcmToken: null
    });
  } catch (error) {
    try {
      await deleteUser(credential.user);
    } catch (cleanupError) {
      throw new Error(`Your account was created but its profile could not be saved, and automatic cleanup failed. Sign out and contact support. Profile error: ${getAuthErrorMessage(error)} Cleanup error: ${getAuthErrorMessage(cleanupError)}`);
    }
    throw error;
  }
}

export async function logIn(email: string, password: string) {
  const services = getFirebaseServices();
  await signInWithEmailAndPassword(services.auth, email, password);
}

export async function requestPasswordReset(email: string) {
  const services = getFirebaseServices();
  await sendPasswordResetEmail(services.auth, email);
}
