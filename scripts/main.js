import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged} from "https://www.gstatic.com/firebasejs/11.3.0/firebase-auth.js";
import { getDatabase, ref, set, get, child } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-database.js";


// yes firebase api keys are meant to be public
const firebaseConfig = {
  apiKey: "AIzaSyAoKv4PLrk4xvZF_IeUhfViwOLBYBv0czQ",
  authDomain: "punkarchivesdata.firebaseapp.com",
  projectId: "punkarchivesdata",
  storageBucket: "punkarchivesdata.firebasestorage.app",
  messagingSenderId: "272312472875",
  appId: "1:272312472875:web:048288b995db157dc8216e",
  measurementId: "G-24V1CEFHYP",
  databaseURL: "https://punkarchivesdata-default-rtdb.firebaseio.com/" // Make sure Firebase Realtime Database is enabled
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

window.loadLeaderboard = function () {
  console.log("loadLeaderboard function is running!"); // Debugging message

  const usersRef = ref(db, "users");

  get(usersRef)
    .then((snapshot) => {
      console.log("Database response received"); // Debugging message

      if (snapshot.exists()) {
        const users = snapshot.val();

        const sortedUsers = Object.entries(users)
          .map(([username, data]) => ({
            username: username,
            points: data.points || 0, // Default to 0 if missing
          }))
          .sort((a, b) => b.points - a.points) // Sort by points
          .slice(0, 3); // Get top 5

        const leaderboardDiv = document.getElementById("leaderboard");

        sortedUsers.forEach((user, index) => {
          const entry = document.createElement("p");
          entry.textContent = `${user.username}: ${user.points}`;
          leaderboardDiv.appendChild(entry);
        });
      } else {
        console.warn("No users found in the database."); // Debugging Log
        document.getElementById("leaderboard").innerText = "No leaderboard data available.";
      }
    })
    .catch((error) => {
      console.error("Error loading leaderboard:", error);
    });
};

// Run function when page loads
window.onload = function () {
  console.log("Window loaded, running loadLeaderboard()"); // Debugging message
  loadLeaderboard();
};

// Global functions so they can be used in HTML
window.signUp = function () {
  const username = document.getElementById("signup-username").value.trim();
  const password = document.getElementById("signup-password").value;

  if (!username || !password) {
    alert("Username and password are required!");
    return;
  }

  if (username.length > 15) {
    alert("Username cannot be longer than 15 characters!");
    return;
  }

  const fakeEmail = `${username}@punkarchives.com`;

        // Check if username already exists
        const userRef = ref(db, "users/" + username);
        get(userRef).then((snapshot) => {
          if (snapshot.exists()) {
            alert("Username already taken!");
          } else {
            // Create account with Firebase
            createUserWithEmailAndPassword(auth, fakeEmail, password)
              .then((userCredential) => {
                const userId = userCredential.user.uid;


                set(ref(db, "users/" + username), { 
                  userId: userId,
                  points: 0, // Initial points set to 0
                })
                .then(() => {
                })
                .catch((error) => {
                  console.error("Database error:", error);
                });
              })
              .catch((error) => {
                alert("Sign-up error: " + error.message);
              });
          }
      });
    
};

// Function to display logged-in username
window.displayUsername = function () {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      const email = user.email;
      const username = email.replace("@punkarchives.com", ""); // Extract username from email
      document.getElementById("logged-in-user").innerText = username;
    } else {
      document.getElementById("logged-in-user").innerText = "Not logged in.";
    }
  });
};

// Call displayUsername() on page load
window.onload = function () {
  displayUsername();
};

window.login = function () {
  const username = document.getElementById("login-username").value;
  const password = document.getElementById("login-password").value;

  if (!username || !password) {
    alert("Username and password are required!");
    return;
  }

  // Look up the username in the database to find the fake email
  const userRef = ref(db, "users/" + username);
  get(userRef).then((snapshot) => {
    if (snapshot.exists()) {
      const fakeEmail = `${username}@punkarchives.com`;

      // Log in using the fake email
      signInWithEmailAndPassword(auth, fakeEmail, password)
        .then((userCredential) => {
          ;
        })
        .catch((error) => {
          alert("Login error: " + error.message);
        });
    } else {
      alert("Username not found.");
    }
  });
};

window.logout = function () {
  signOut(auth)
    .then(() => {
    })
    .catch((error) => {
      console.error("Logout error:", error);
    });
};

{
loadLeaderboard()
};