import { initializeApp, getApp } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-app.js";
import { getDatabase, ref, set, get } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-database.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged} from "https://www.gstatic.com/firebasejs/11.3.0/firebase-auth.js";

let app;
try {
  app = getApp(); // Try to get an already initialized Firebase app
} catch (error) {
  app = initializeApp({
    apiKey: "AIzaSyAoKv4PLrk4xvZF_IeUhfViwOLBYBv0czQ",
    authDomain: "punkarchivesdata.firebaseapp.com",
    projectId: "punkarchivesdata",
    storageBucket: "punkarchivesdata.firebasestorage.app",
    messagingSenderId: "272312472875",
    appId: "1:272312472875:web:048288b995db157dc8216e",
    measurementId: "G-24V1CEFHYP"
  });
}

const db = getDatabase(app);
const auth = getAuth(app);



window.loadLeaderboard = function () {
  console.log("loadLeaderboard function is running!"); // Debugging message

  const usersRef = ref(db, "users");

  get(usersRef)
    .then((snapshot) => {
      console.log("Database response received"); // Debugging message

      if (snapshot.exists()) {
        const users = snapshot.val();
        console.log("Retrieved Users:", users); // Debugging Log

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

  // Fetch user's IP address
  fetch("https://api64.ipify.org?format=json")
    .then(response => response.json())
    .then(data => {
      const userIP = data.ip; // Store user's IP address

      // Check if IP is banned
      const bannedIPsRef = ref(db, "banned_ips/" + userIP);
      get(bannedIPsRef).then((snapshot) => {
        if (snapshot.exists()) {
          alert("Sign-up denied: This IP address has been banned.");
          return;
        }

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

                // Store the username, userId, initial points, and IP in the database
                set(ref(db, "users/" + username), { 
                  userId: userId,
                  points: 0, // Initial points set to 0
                  ip: userIP // Store IP address
                })
                .then(() => {
                  alert("Sign-up successful! You can now log in.");
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
      });
    })
    .catch(error => {
      console.error("IP fetch error:", error);
      alert("Error: Check your internet connection.");
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
          alert("Login successful!");
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
      alert("You have logged out.");
    })
    .catch((error) => {
      console.error("Logout error:", error);
    });
};


  // Function to show the form after entering the band name
  window.showForm = function() {
    document.getElementById("bandForm").style.display = "block";
  };

  // Function to save the band to Firebase
window.saveBand = function () {
  console.log("🟢 saveBand() called");

  const getValue = (id) => {
    const el = document.getElementById(id);
    if (!el) {
      console.warn(`⚠️ Element with ID '${id}' not found!`);
      return ""; // Default to empty string
    }
    console.log(`✅ ${id} =`, el.value); // Log what is being read
    return el.value.trim();
  };

  const user = auth.currentUser;
  if (!user) {
    alert("You must be logged in to submit a band!");
    return;
  }

  const username = user.email.replace("@punkarchives.com", "");
const bandName = getValue("bandband-name");


  if (!bandName.trim()) {
    alert("Band name is required!");
    return;
  }

  const bandData = {
    name: bandName,
    genres: getValue("bandband-genres"),
    location: getValue("bandband-location"),
    years_active: getValue("bandband-years"),
    description: getValue("bandband-description"),
    related_bands: getValue("bandrelated-bands"),
    official_links: getValue("bandofficial-links"),
    members: getValue("bandband-members"),
    releases: getValue("bandband-releases"),
    uploaded_by: username
  };

  console.log("📤 Uploading Band Data:", bandData); // Debugging

const randomnum = Math.floor(Math.random() * 100)
  // Upload to Firebase
const bandRef = ref(db, "bands/" + bandName + " " + username + randomnum);

  set(bandRef, bandData)
    .then(() => {
      alert("✅ Band successfully uploaded!");
    })
    .catch((error) => {
      console.error("❌ Error saving band:", error);
    });
};

window.saveBand2 = function () {
  console.log("🟢 saveBand() called");

  const getValue = (id) => {
    const el = document.getElementById(id);
    if (!el) {
      console.warn(`⚠️ Element with ID '${id}' not found!`);
      return ""; // Default to empty string
    }
    console.log(`✅ ${id} =`, el.value); // Log what is being read
    return el.value.trim();
  };

  const user = auth.currentUser;
  if (!user) {
    alert("You must be logged in to submit a band!");
    return;
  }

  const username = user.email.replace("@punkarchives.com", "");
const bandName = getValue("zinezine-name");


  if (!bandName.trim()) {
    alert("Zine name is required!");
    return;
  }

  const bandData = {
    name: bandName,
    authors: getValue("zinezine-authors"),
    location: getValue("zinezine-location"),
    years_active: getValue("zinezine-years"),
    issues: getValue("zinezine-issues"),
    uploaded_by: username
  };

  console.log("📤 Uploading Band Data:", bandData); // Debugging

const randomnum = Math.floor(Math.random() * 100)
  // Upload to Firebase
const bandRef = ref(db, "zines/" + bandName + " " + username + randomnum);

  set(bandRef, bandData)
    .then(() => {
      alert("✅ Zine successfully uploaded!");
    })
    .catch((error) => {
      console.error("❌ Error saving zine:", error);
    });
};

window.saveBand3 = function () {
  console.log("🟢 saveBand() called");

  const getValue = (id) => {
    const el = document.getElementById(id);
    if (!el) {
      console.warn(`⚠️ Element with ID '${id}' not found!`);
      return ""; // Default to empty string
    }
    console.log(`✅ ${id} =`, el.value); // Log what is being read
    return el.value.trim();
  };

  const user = auth.currentUser;
  if (!user) {
    alert("You must be logged in to submit a band!");
    return;
  }

  const username = user.email.replace("@punkarchives.com", "");
const bandName = getValue("complabel-name");


  if (!bandName.trim()) {
    alert("Compilation name is required!");
    return;
  }

  const bandData = {
    name: bandName,
    bands: getValue("compbands"),
    date: getValue("compdate"),
    tracklist: getValue("comptracklist"),
    title: getValue("comptitle"),
    albumcover: getValue("compalbumcover"),
    uploaded_by: username
  };

  console.log("📤 Uploading Band Data:", bandData); // Debugging

const randomnum = Math.floor(Math.random() * 100)
  // Upload to Firebase
const bandRef = ref(db, "comp/" + bandName + " " + username + randomnum);

  set(bandRef, bandData)
    .then(() => {
      alert("✅ Compilation successfully uploaded!");
    })
    .catch((error) => {
      console.error("❌ Error saving compilation:", error);
    });
};
  
window.saveBand4 = function () {
  console.log("🟢 saveBand() called");

  const getValue = (id) => {
    const el = document.getElementById(id);
    if (!el) {
      console.warn(`⚠️ Element with ID '${id}' not found!`);
      return ""; // Default to empty string
    }
    console.log(`✅ ${id} =`, el.value); // Log what is being read
    return el.value.trim();
  };

  const user = auth.currentUser;
  if (!user) {
    alert("You must be logged in to submit a band!");
    return;
  }

  const username = user.email.replace("@punkarchives.com", "");
const bandName = getValue("labellabel-name");


  if (!bandName.trim()) {
    alert("Label name is required!");
    return;
  }

  const bandData = {
    name: bandName,
    bands: getValue("labelbands"),
    date: getValue("labeldates"),
    logo: getValue("labellogo"),
    location: getValue("labellocation"),
    uploaded_by: username
  };

  console.log("📤 Uploading Band Data:", bandData); // Debugging

const randomnum = Math.floor(Math.random() * 100)
  // Upload to Firebase
const bandRef = ref(db, "label/" + bandName + " " + username + randomnum);

  set(bandRef, bandData)
    .then(() => {
      alert("✅ Label successfully uploaded!");
    })
    .catch((error) => {
      console.error("❌ Error saving label:", error);
    });
};
  
  
// Firebase config



// Run function when page loads
window.onload = function () {
  console.log("Window loaded, running loadLeaderboard()"); // Debugging message
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

  // Fetch user's IP address
  fetch("https://api64.ipify.org?format=json")
    .then(response => response.json())
    .then(data => {
      const userIP = data.ip; // Store user's IP address

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

                // Store the username, userId, initial points, and IP in the database
                set(ref(db, "users/" + username), { 
                  userId: userId,
                  points: 0, // Initial points set to 0
                  ip: userIP // Store IP address
                })
                .then(() => {
                  alert("Sign-up successful! You can now log in.");
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
    })
    .catch(error => {
      console.error("IP fetch error:", error);
      alert("Error: Check your internet connection.");
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
          alert("Login successful!");
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
      alert("You have logged out.");
    })
    .catch((error) => {
      console.error("Logout error:", error);
    });
};

{
loadLeaderboard()
};