import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  Auth,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyDemoPlaceholderKeyForOfflineFirst',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'cinefuel-app.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'cinefuel-app',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'cinefuel-app.appspot.com',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '1234567890',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:1234567890:web:abcdef',
};

// Safe client-only initialization (prevents SSR / Cloudflare Workers eval errors)
let app: FirebaseApp | undefined;
let authInstance: Auth | undefined;
let googleProviderInstance: GoogleAuthProvider | undefined;

function getClientAuth(): Auth | undefined {
  if (typeof window === 'undefined') return undefined;
  if (!authInstance) {
    try {
      app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      authInstance = getAuth(app);
    } catch (e) {
      console.warn('Firebase client auth initialization error:', e);
    }
  }
  return authInstance;
}

function getClientGoogleProvider(): GoogleAuthProvider {
  if (!googleProviderInstance) {
    googleProviderInstance = new GoogleAuthProvider();
  }
  return googleProviderInstance;
}

if (typeof window !== 'undefined') {
  getClientAuth();
}

// Proxies ensure code importing `auth` and `googleProvider` continues to work seamlessly
const auth = new Proxy({} as Auth, {
  get(_target, prop) {
    const inst = getClientAuth();
    if (!inst) return undefined;
    const val = (inst as any)[prop];
    return typeof val === 'function' ? val.bind(inst) : val;
  },
});

const googleProvider = new Proxy({} as GoogleAuthProvider, {
  get(_target, prop) {
    const inst = getClientGoogleProvider();
    const val = (inst as any)[prop];
    return typeof val === 'function' ? val.bind(inst) : val;
  },
});

// Stubs for compatibility in case any component touches them
const db = {} as any;
const doc = (..._args: any[]) => ({} as any);
const setDoc = async (..._args: any[]) => {};
const getDoc = async (..._args: any[]) => ({ exists: () => false, data: () => null } as any);
const collection = (..._args: any[]) => ({} as any);
const getDocs = async (..._args: any[]) => ({ docs: [], empty: true } as any);
const deleteDoc = async (..._args: any[]) => {};

export {
  app,
  auth,
  db,
  googleProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  deleteDoc,
};
