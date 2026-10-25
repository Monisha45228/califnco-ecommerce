import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { connectAuthEmulator } from 'firebase/auth';
import { connectFirestoreEmulator } from 'firebase/firestore';

export const isUsingFirebaseEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true';
const useEmulators = isUsingFirebaseEmulators;
const firebaseConfig = useEmulators ? {
  apiKey: 'demo-api-key',
  authDomain: 'localhost',
  projectId: 'demo-califnco',
  messagingSenderId: '1234567890',
  appId: '1:1234567890:web:demo'
} : {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export const isFirebaseConfigured = Object.values(firebaseConfig).every(
  value => typeof value === 'string' && value.trim().length > 0 && !value.startsWith('your-')
);
export const app = isFirebaseConfigured
  ? getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
  : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;

if (useEmulators && auth && db) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
