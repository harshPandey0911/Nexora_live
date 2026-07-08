/**
 * Firebase Configuration
 * Initialize Firebase for push notifications
 */

import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { getDatabase } from 'firebase/database';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  ...(import.meta.env.VITE_FIREBASE_DATABASE_URL ? { databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL } : {})
};

// Initialize Firebase
let app;
let messaging;
let db;

// Only initialize if projectId is configured (prevents crash when env vars are empty)
const isFirebaseConfigured = !!firebaseConfig.projectId && !!firebaseConfig.apiKey;

if (isFirebaseConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    messaging = getMessaging(app);
    db = getDatabase(app);
    console.log('✅ Firebase initialized successfully');
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error);
  }
} else {
  console.warn('⚠️ Firebase config missing (VITE_FIREBASE_PROJECT_ID not set). Push notifications will be disabled.');
}

export { app, messaging, db, getToken, onMessage };
