import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getDatabase,
  ref,
  set,
  get,
  update,
  onValue,
  off,
  Database,
} from 'firebase/database';
import { getAuth, signInAnonymously, Auth, User as FirebaseUser } from 'firebase/auth';

export const firebaseConfig = {
  apiKey: "AIzaSyBDfusscFX3DbP0-iedTfgfGgQRGfLT34Y",
  authDomain: "telebot-26c11.firebaseapp.com",
  databaseURL: "https://telebot-26c11-default-rtdb.firebaseio.com",
  projectId: "telebot-26c11",
  storageBucket: "telebot-26c11.firebasestorage.app",
  messagingSenderId: "344030966189",
  appId: "1:344030966189:web:e80b33ff40c87b4ebdb124"
};

// Initialize Firebase App
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export let rtdb: Database | null = null;
export let auth: Auth | null = null;

try {
  rtdb = getDatabase(app);
} catch (e) {
  console.warn('Firebase Realtime Database init warning:', e);
}

try {
  auth = getAuth(app);
} catch (e) {
  console.warn('Firebase Auth init warning:', e);
}

let isAuthInitialized = false;

// Automatic silent authentication
export async function initFirebaseAuth(): Promise<FirebaseUser | null> {
  if (isAuthInitialized && auth?.currentUser) {
    return auth.currentUser;
  }
  if (!auth) return null;

  try {
    const cred = await signInAnonymously(auth);
    isAuthInitialized = true;
    return cred.user;
  } catch (err) {
    console.warn('Silent Firebase Auth notice (Database public access or anonymous auth):', err);
    return null;
  }
}

export { ref, set, get, update, onValue, off };
