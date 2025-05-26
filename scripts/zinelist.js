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

get(child(dbRef, 'zines')) // 'zines' is the root node in your Firebase for zine data
  .then((snapshot) => {
    if (snapshot.exists()) {
      const zinesObject = snapshot.val();
      const zines = Object.values(zinesObject); // Firebase stores data as objects, not arrays

      const artistList = document.getElementById("artistList");

      // Sort zines alphabetically by name
      zines.sort((a, b) => a.zine_name.localeCompare(b.zine_name));

      let currentLetter = "";

      zines.forEach(zine => {
        let firstLetter = zine.zine_name.charAt(0).toUpperCase();

        if (firstLetter !== currentLetter) {
          currentLetter = firstLetter;
          let letterHeader = document.createElement("h2");
          letterHeader.id = `letter-${currentLetter}`;
          letterHeader.textContent = currentLetter;
          artistList.appendChild(letterHeader);
        }

        let li = document.createElement("li");
        let a = document.createElement("a");
        a.textContent = zine.zine_name;
        a.href = `zine.html?zine=${encodeURIComponent(zine.zine_name)}`;
        li.appendChild(a);
        artistList.appendChild(li);
      });
    } else {
      console.error("No zine data found in Firebase.");
    }
  })
  .catch((error) => {
    console.error("Error fetching zine data:", error);
  });

// Scroll to letter function stays the same
function scrollToLetter(letter) {
  let section = document.getElementById(`letter-${letter}`);
  if (section) {
    section.scrollIntoView({ behavior: "smooth" });
  }
}
