// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCYgLkfEEfFzLzJBtB7lE0w0Knc4o0ws-o",
  authDomain: "apna-meme-store-fdc5b.firebaseapp.com",
  databaseURL: "https://apna-meme-store-fdc5b-default-rtdb.firebaseio.com",
  projectId: "apna-meme-store-fdc5b",
  storageBucket: "apna-meme-store-fdc5b.firebasestorage.app",
  messagingSenderId: "703244299489",
  appId: "1:703244299489:web:0e5482afa8b8f4c9f19ba0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Export for use in other scripts
export { db, auth };
