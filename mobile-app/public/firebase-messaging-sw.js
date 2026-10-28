importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js');

const config = new URL(self.location.href).searchParams;
const firebaseConfig = {
  apiKey: config.get('apiKey'),
  authDomain: config.get('authDomain'),
  projectId: config.get('projectId'),
  storageBucket: config.get('storageBucket'),
  messagingSenderId: config.get('messagingSenderId'),
  appId: config.get('appId')
};

firebase.initializeApp(firebaseConfig);
firebase.messaging();
