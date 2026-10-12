#!/usr/bin/env node
// Setup script to create admin user in Firebase Auth emulator

import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, connectAuthEmulator } from 'firebase/auth';
import { initializeApp as initializeAdminApp, cert } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';

// Firebase config for emulator
const firebaseConfig = {
  apiKey: 'demo-api-key',
  authDomain: 'demo-project.firebaseapp.com',
  projectId: 'proactive-fashion-demo',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
connectAuthEmulator(auth, 'http://127.0.0.1:9099');

// Admin SDK for setting custom claims (connects to Auth emulator)
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
const adminApp = initializeAdminApp({
  projectId: 'proactive-fashion-demo',
}, 'admin-sdk');

const adminAuth = getAdminAuth(adminApp);

async function setup() {
  const email = 'admin@proactive.test';
  const password = 'admin123';

  try {
    // Create user in Auth emulator
    console.log(`Creating user ${email}...`);
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    console.log(`User created: ${userCredential.user.uid}`);

    // Set admin custom claim
    console.log('Setting admin claim...');
    await adminAuth.setCustomUserClaims(userCredential.user.uid, { admin: true });
    console.log('Admin claim set');

    // Sign in to verify
    await signInWithEmailAndPassword(auth, email, password);
    console.log('Sign in successful');

    console.log('✅ Auth emulator setup complete!');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      console.log('User already exists, signing in...');
      await signInWithEmailAndPassword(auth, email, password);
      const user = auth.currentUser;
      await adminAuth.setCustomUserClaims(user.uid, { admin: true });
      console.log('Admin claim refreshed');
      console.log('✅ Auth emulator setup complete!');
    } else {
      console.error('❌ Setup failed:', error);
      process.exit(1);
    }
  }
}

setup().catch(err => {
  console.error('❌ Setup failed:', err);
  process.exit(1);
});