const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');

const authEmulator = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const firestoreEmulator = process.env.FIRESTORE_EMULATOR_HOST;
if (!authEmulator || !firestoreEmulator) {
  throw new Error('Refusing to seed: FIREBASE_AUTH_EMULATOR_HOST and FIRESTORE_EMULATOR_HOST must point to local emulators.');
}
if (!['127.0.0.1', 'localhost'].includes(authEmulator.split(':')[0])
  || !['127.0.0.1', 'localhost'].includes(firestoreEmulator.split(':')[0])) {
  throw new Error('Refusing to seed a non-local Firebase host.');
}

const email = process.env.ADMIN_EMAIL?.trim();
const password = process.env.ADMIN_PASSWORD;
if (!email || !password || password.length < 6) {
  throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (minimum 6 characters) in your shell before running this emulator-only seed.');
}

const projectId = process.env.GCLOUD_PROJECT || 'demo-califnco';
initializeApp({ projectId });

async function seedAdmin() {
  const database = getFirestore();
  const admins = await database.collection('users').where('role', '==', 'admin').get();
  const existingAdmin = admins.docs[0];
  if (existingAdmin && existingAdmin.data().email !== email) {
    throw new Error(`An admin profile already exists at users/${existingAdmin.id}; refusing to create a second emulator admin.`);
  }

  let authUser;
  if (existingAdmin) {
    authUser = await getAuth().getUser(existingAdmin.id);
    await getAuth().updateUser(authUser.uid, { password, emailVerified: true, disabled: false });
  } else {
    try {
      authUser = await getAuth().getUserByEmail(email);
      await getAuth().updateUser(authUser.uid, { password, emailVerified: true, disabled: false });
    } catch (error) {
      if (error.code !== 'auth/user-not-found') throw error;
      authUser = await getAuth().createUser({ email, password, emailVerified: true });
    }
  }

  await database.collection('users').doc(authUser.uid).set({
    name: 'Local Emulator Admin',
    email,
    phone: '',
    role: 'admin',
    address: { street: '', city: '', state: '', postalCode: '' },
    createdAt: FieldValue.serverTimestamp(),
    fcmToken: null
  }, { merge: true });
  console.log(`Local emulator admin ready: ${email}`);
}

seedAdmin().catch(error => {
  console.error('Could not seed the local emulator admin:', error);
  process.exitCode = 1;
});
