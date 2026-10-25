import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { doc, updateDoc } from 'firebase/firestore';
import { app, db, firebaseConfig } from './firebase';

export async function enablePushNotifications(userId: string) {
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!app || !db) throw new Error('Firebase is not configured.');
  if (!vapidKey) throw new Error('Set VITE_FIREBASE_VAPID_KEY using the Web Push certificate from Firebase Console.');
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !(await isSupported())) {
    throw new Error('This browser does not support web push notifications.');
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission was not granted.');

  const workerUrl = new URL('/firebase-messaging-sw.js', window.location.origin);
  Object.entries(firebaseConfig).forEach(([key, value]) => workerUrl.searchParams.set(key, value));
  const serviceWorkerRegistration = await navigator.serviceWorker.register(workerUrl);
  const token = await getToken(getMessaging(app), { vapidKey, serviceWorkerRegistration });
  if (!token) throw new Error('Firebase did not return a push token. Try again or check browser notification settings.');
  await updateDoc(doc(db, 'users', userId), { fcmToken: token });
  return token;
}
