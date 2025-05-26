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

get(child(dbRef, 'labels')) // 'labels' is the root node in your Firebase for label data
  .then((snapshot) => {
    if (snapshot.exists()) {
      const labelsObject = snapshot.val();
      const labels = Object.values(labelsObject); // Firebase stores data as objects, not arrays

      const artistList = document.getElementById("artistList");

      // Sort labels alphabetically by name
      labels.sort((a, b) => a.label_name.localeCompare(b.label_name));

      let currentLetter = "";

      labels.forEach(label => {
        let firstLetter = label.label_name.charAt(0).toUpperCase();

        if (firstLetter !== currentLetter) {
          currentLetter = firstLetter;
          let letterHeader = document.createElement("h2");
          letterHeader.id = `letter-${currentLetter}`;
          letterHeader.textContent = currentLetter;
          artistList.appendChild(letterHeader);
        }

        let li = document.createElement("li");
        let a = document.createElement("a");
        a.textContent = label.label_name;
        a.href = `label.html?label=${encodeURIComponent(label.label_name)}`;
        li.appendChild(a);
        artistList.appendChild(li);
      });
    } else {
      console.error("No label data found in Firebase.");
    }
  })
  .catch((error) => {
    console.error("Error fetching label data:", error);
  });

// Scroll to letter function stays the same
function scrollToLetter(letter) {
  let section = document.getElementById(`letter-${letter}`);
  if (section) {
    section.scrollIntoView({ behavior: "smooth" });
  }
}
