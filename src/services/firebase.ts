import { getApps, getApp } from "firebase/app";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { setLogLevel } from "firebase/firestore";
setLogLevel("silent");
const firebaseConfig = {
  projectId: (import.meta as any).env.VITE_FIREBASE_PROJECT_ID,
  appId: (import.meta as any).env.VITE_FIREBASE_APP_ID,
  apiKey: (import.meta as any).env.VITE_FIREBASE_API_KEY,
  authDomain: (import.meta as any).env.VITE_FIREBASE_AUTH_DOMAIN,
  firestoreDatabaseId: (import.meta as any).env.VITE_FIREBASE_DATABASE_ID,
  storageBucket: (import.meta as any).env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: (import.meta as any).env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  measurementId: (import.meta as any).env.VITE_FIREBASE_MEASUREMENT_ID,
};

console.log("Firebase Init Database ID:", firebaseConfig.firestoreDatabaseId);
export const app = (getApps && getApps().length > 0) ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

let dbInstance;
try {
  dbInstance = initializeFirestore(
    app,
    { experimentalForceLongPolling: true },
    firebaseConfig.firestoreDatabaseId
  );
} catch (e) {
  dbInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}
export const db = dbInstance;


export const loginWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error) {
    console.error("Error signing in with Google", error);
    throw error;
  }
};

import { getStorage, ref as storageRef, uploadString, getDownloadURL } from "firebase/storage";

export const storage = getStorage(app);

export const uploadMemberPhoto = async (memberId: string, dataUrl: string): Promise<string> => {
  // 1. Try Firebase Cloud Storage first with strict timeout (preventing infinite retry loops when bucket is not provisioned)
  if (firebaseConfig.storageBucket) {
    try {
      const fileRef = storageRef(storage, `members/photos/${memberId}.webp`);
      const contentType = dataUrl.startsWith("data:image/png") ? "image/png" : "image/webp";

      const uploadPromise = (async () => {
        await uploadString(fileRef, dataUrl, "data_url", { contentType });
        return await getDownloadURL(fileRef);
      })();

      const timeoutPromise = new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error("Storage upload timed out")), 2500)
      );

      const downloadUrl = await Promise.race([uploadPromise, timeoutPromise]);
      return downloadUrl;
    } catch (storageError) {
      console.warn("Firebase Storage upload failed or timed out, attempting Firestore fallback collection:", storageError);
    }
  }

  // 2. Resilient Fallback: Store in dedicated 'memberPhotos' Firestore collection with strict timeout
  // (isolated from appData/main, ensuring zero size bloat on main app state)
  try {
    const photoDocRef = doc(db, "memberPhotos", memberId);
    const firestorePromise = setDoc(photoDocRef, {
      memberId,
      photoDataUrl: dataUrl,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    await Promise.race([
      firestorePromise,
      new Promise<void>((resolve) => setTimeout(resolve, 2000)),
    ]);
    return dataUrl;
  } catch (firestoreError) {
    console.error("Failed to store member photo in fallback collection:", firestoreError);
    return dataUrl;
  }
};

export const logoutGoogle = async () => {
  return signOut(auth);
};
