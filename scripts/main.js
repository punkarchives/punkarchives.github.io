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
          entry.innerHTML = `<u><a href="user.html?user=${encodeURIComponent(user.username)}" style="color: #fff; text-decoration: none;">${user.username}: ${user.points}</a></u>`;
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
  const originalUsername = document.getElementById("signup-username").value.trim();
  const password = document.getElementById("signup-password").value;
  const username = originalUsername.toLowerCase(); // Normalize to lowercase for storage

  if (!originalUsername || !password) {
    alert("Username and password are required!");
    return;
  }

  if (originalUsername.length > 15) {
    alert("Username cannot be longer than 15 characters!");
    return;
  }

  const fakeEmail = `${username}@punkarchives.com`;

  // Disable the signup button to prevent multiple submissions
  const signupButton = document.querySelector('button[onclick="signUp()"]');
  if (signupButton) {
    signupButton.disabled = true;
    signupButton.textContent = "Creating Account...";
  }

  // Use a transaction to atomically check and create the user
  const userRef = ref(db, "users/" + username);
  
  // First, try to create the Firebase account
  createUserWithEmailAndPassword(auth, fakeEmail, password)
    .then((userCredential) => {
      const userId = userCredential.user.uid;
      
      // Store user data with proper capitalization in database
      return set(ref(db, "users/" + originalUsername), { 
        userId: userId,
        points: 0,
        creationDate: new Date().toISOString()
      });
    })
    .then(() => {
      alert("Sign-up successful! You can now log in.");
      // Clear the form
      document.getElementById("signup-username").value = "";
      document.getElementById("signup-password").value = "";
    })
    .catch((error) => {
      console.error("Sign-up error:", error);
      
      // Handle specific Firebase errors
      if (error.code === 'auth/email-already-in-use') {
        alert("Username already taken! Please choose a different username.");
      } else if (error.code === 'auth/weak-password') {
        alert("Password is too weak. Please choose a stronger password.");
      } else {
        alert("Sign-up error: " + error.message);
      }
    })
    .finally(() => {
      // Re-enable the signup button
      if (signupButton) {
        signupButton.disabled = false;
        signupButton.textContent = "Sign Up";
      }
    });
};

// Function to display logged-in username
window.displayUsername = function () {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      const email = user.email;
      const username = email.replace("@punkarchives.com", ""); // Extract username from email (lowercase)
      
      // Find the user in the database to get the proper capitalization
      const usersRef = ref(db, "users");
      get(usersRef).then((snapshot) => {
        if (snapshot.exists()) {
          const users = snapshot.val();
          // Find the user by matching the userId
          const userEntry = Object.entries(users).find(([key, data]) => data.userId === user.uid);
          if (userEntry) {
            const displayUsername = userEntry[0]; // This is the properly capitalized username
            document.getElementById("logged-in-user").innerHTML = `<u><a href="user.html?user=${encodeURIComponent(displayUsername)}" style="color: #fff; text-decoration: none;">${displayUsername}</a></u>`;
          } else {
            // Fallback to lowercase username if no match found
            document.getElementById("logged-in-user").innerHTML = `<u><a href="user.html?user=${encodeURIComponent(username)}" style="color: #fff; text-decoration: none;">${username}</a></u>`;
          }
        } else {
          // Fallback to lowercase username if no users found
          document.getElementById("logged-in-user").innerHTML = `<u><a href="user.html?user=${encodeURIComponent(username)}" style="color: #fff; text-decoration: none;">${username}</a></u>`;
        }
      }).catch((error) => {
        // Fallback to lowercase username on error
        document.getElementById("logged-in-user").innerHTML = `<u><a href="user.html?user=${encodeURIComponent(username)}" style="color: #fff; text-decoration: none;">${username}</a></u>`;
      });
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
  const originalUsername = document.getElementById("login-username").value;
  const password = document.getElementById("login-password").value;
  const username = originalUsername.toLowerCase(); // Normalize to lowercase for Firebase Auth

  if (!originalUsername || !password) {
    alert("Username and password are required!");
    return;
  }

  // Try to find the user by checking both lowercase and original capitalization
  const userRefLower = ref(db, "users/" + username);
  const userRefOriginal = ref(db, "users/" + originalUsername);
  
  // First try lowercase lookup
  get(userRefLower).then((snapshot) => {
    if (snapshot.exists()) {
      const fakeEmail = `${username}@punkarchives.com`;
      signInWithEmailAndPassword(auth, fakeEmail, password)
        .then((userCredential) => {
          ;
        })
        .catch((error) => {
          alert("Login error: " + error.message);
        });
    } else {
      // If not found with lowercase, try original capitalization
      get(userRefOriginal).then((snapshot) => {
        if (snapshot.exists()) {
          const fakeEmail = `${username}@punkarchives.com`;
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