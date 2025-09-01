// yes firebase api keys are meant to be public
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged} from "https://www.gstatic.com/firebasejs/11.3.0/firebase-auth.js";
import { getDatabase, ref, set, get, child } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-database.js";

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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const dbRef = ref(db);

get(child(dbRef, 'users')) // 'users' is the root node in your Firebase for user data
  .then((snapshot) => {
    if (snapshot.exists()) {
      const usersObject = snapshot.val();
      const users = Object.entries(usersObject).map(([username, data]) => ({
        username: username,
        points: data.points || 0,
        profilePicture: data.profilePicture || null,
        trusted: data.trusted || null,
        verytrusted: data.verytrusted || null
      }));

      const userList = document.getElementById("userList");

      // Get top 3 users by points
      const top3Users = [...users]
        .sort((a, b) => b.points - a.points)
        .slice(0, 3)
        .map(user => user.username);

      // Sort users alphabetically by username
      users.sort((a, b) => a.username.localeCompare(b.username));

      let currentLetter = "";

      users.forEach(user => {
        let firstLetter = user.username.charAt(0).toUpperCase();

        if (firstLetter !== currentLetter) {
          currentLetter = firstLetter;
          let letterHeader = document.createElement("h2");
          letterHeader.id = `letter-${currentLetter}`;
          letterHeader.textContent = currentLetter;
          userList.appendChild(letterHeader);
        }

                         let li = document.createElement("li");
        let a = document.createElement("a");
        
        // Check if user is in top 3
        const isTop3 = top3Users.includes(user.username);
        
        if (isTop3) {
          a.innerHTML = `👑 ${user.username}`;
          a.style.color = "#FFD700"; // Golden color
        } else {
          a.textContent = user.username;
        }
        
        a.href = `user.html?user=${encodeURIComponent(user.username)}`;
        li.appendChild(a);
        userList.appendChild(li);
      });
    } else {
      console.error("No user data found in Firebase.");
      document.getElementById("userList").innerHTML = "<li>No users found.</li>";
    }
  })
  .catch((error) => {
    console.error("Error fetching user data:", error);
    document.getElementById("userList").innerHTML = "<li>Error loading users.</li>";
  });

// Scroll to letter function - make it globally available
window.scrollToLetter = function(letter) {
  let section = document.getElementById(`letter-${letter}`);
  if (section) {
    section.scrollIntoView({ behavior: "smooth" });
  }
};
