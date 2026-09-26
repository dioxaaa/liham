import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { collection, getFirestore, addDoc, getDocs, limit, orderBy, query, serverTimestamp, Timestamp, where } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAA0uI71ZBVf1BLVp8aFYp4YM4hyLAEVJE",
  authDomain: "liham-9acd7.firebaseapp.com",
  projectId: "liham-9acd7",
  storageBucket: "liham-9acd7.firebasestorage.app",
  messagingSenderId: "938022461087",
  appId: "1:938022461087:web:8a444e92f10e9fdf628caa",
  measurementId: "G-E6NQMRNE8Q"
};

if (Object.values(firebaseConfig).some((value) => value.startsWith("YOUR_"))) {
  throw new Error("Add the Firebase web app config to public/firebase.js before loading Liham.");
}

const db = getFirestore(initializeApp(firebaseConfig));
export { addDoc, collection, db, getDocs, limit, orderBy, query, serverTimestamp, Timestamp, where };
