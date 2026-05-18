const { initializeApp } = require("firebase/app");
const { getFirestore } = require("firebase/firestore");

const firebaseConfig = {
    apiKey: "AIzaSyDUQiqPRIysGv-BOsNcS6Q2YCjd58oo6j8",
    authDomain: "discord-bot-9224a.firebaseapp.com",
    projectId: "discord-bot-9224a",
    storageBucket: "discord-bot-9224a.firebasestorage.app",
    messagingSenderId: "614714101044",
    appId: "1:614714101044:web:897f465d394e496cb5e961"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

module.exports = db;
