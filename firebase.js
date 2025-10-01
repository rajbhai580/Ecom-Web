// firebase.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";

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
let app, db, auth;
try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    console.log("Firebase Initialized Successfully.");
} catch (error) {
    console.error("Error initializing Firebase:", error);
    // Display an error to the user on the page
    document.body.innerHTML = `<div style="color: red; padding: 20px;">Error initializing Firebase. Please check your firebaseConfig details in firebase.js and ensure your Firebase project is set up correctly.</div>`;
}

// Export the initialized services
export { db, auth };
