import { initializeApp } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";
import { initializeFirestore, persistentLocalCache } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-storage.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCV4aiSRFwAr8qF4Io-A4jjasvnrn9enzs",
  authDomain: "pca-auto.firebaseapp.com",
  projectId: "pca-auto",
  storageBucket: "pca-auto.firebasestorage.app",
  messagingSenderId: "929506230020",
  appId: "1:929506230020:web:1ea3d1026d085f9b6d5a51",
};

const fbApp = initializeApp(firebaseConfig);
export const firestore = initializeFirestore(fbApp, { localCache: persistentLocalCache() });
export const storage = getStorage(fbApp);
export const auth = getAuth(fbApp);

// Sign in anonymously so Firestore security rules can reference request.auth.
export const authReady = signInAnonymously(auth).then(c => c.user);
