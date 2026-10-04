import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics';

export const firebaseConfig = {
  apiKey: "AIzaSyAbzCNVDiLxLL5RqCTwdOJksxS2A92Dx3M",
  authDomain: "chatlaxy-49038.firebaseapp.com",
  projectId: "chatlaxy-49038",
  storageBucket: "chatlaxy-49038.firebasestorage.app",
  messagingSenderId: "638199109209",
  appId: "1:638199109209:web:583466edded1e0263e4348",
  measurementId: "G-H3CB1EGKGL"
};

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);

// Initialize Authentication
export const auth = getAuth(app);

// Initialize Cloud Firestore
export const db = getFirestore(app);

// Initialize Analytics (optional/browser-supported check)
export let analytics: any = null;
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      try {
        analytics = getAnalytics(app);
      } catch (err) {
        // Analytics non-critical in dev/restricted environments
      }
    }
  });
}
