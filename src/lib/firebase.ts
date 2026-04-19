import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// These keys are safe to be public — security is enforced by Firestore Rules
const firebaseConfig = {
  apiKey: "AIzaSyC_ZdQwxBp8suZWwvoZW62pftFTzhPLunU",
  authDomain: "bahi---digital-khata.firebaseapp.com",
  projectId: "bahi---digital-khata",
  storageBucket: "bahi---digital-khata.firebasestorage.app",
  messagingSenderId: "186107264085",
  appId: "1:186107264085:web:107879ea6cb3bae6f0e8dc",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const firestore = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
