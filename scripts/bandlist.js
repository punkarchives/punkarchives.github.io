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

// Helper function to check if user is very trusted (moderator)
async function isUserVeryTrusted() {
  const user = auth.currentUser;
  if (!user) return false;
  
  try {
    const lowercaseUsername = user.email.replace("@punkarchives.com", "").toLowerCase();
    
    // Find the proper capitalized username from database
    const usersRef = ref(db, "users");
    const usersSnapshot = await get(usersRef);
    let properUsername = lowercaseUsername; // fallback
    
    if (usersSnapshot.exists()) {
      const users = usersSnapshot.val();
      const userEntry = Object.entries(users).find(([key, data]) => data.userId === user.uid);
      if (userEntry) {
        properUsername = userEntry[0]; // This is the properly capitalized username
      }
    }
    
    const possiblePaths = [
      `users/${user.uid}`,
      `users/${properUsername}`,
      `users/${lowercaseUsername}`,
      `users/nxdx`
    ];
    
    for (const path of possiblePaths) {
      const userRef = ref(db, path);
      const userSnapshot = await get(userRef);
      if (userSnapshot.exists()) {
        const userData = userSnapshot.val();
        return userData.verytrusted === "true";
      }
    }
    return false;
  } catch (error) {
    console.error("Error checking verytrusted status:", error);
    return false;
  }
}

// Function to load bookmarked bands
async function loadBookmarkedBands() {
  const currentUser = auth.currentUser;
  console.log("Loading bookmarked bands, current user:", currentUser);
  
  if (!currentUser) {
    console.log("No current user, returning empty array");
    return [];
  }

  try {
    const username = currentUser.email.replace("@punkarchives.com", "").toLowerCase();
    console.log("Username from email:", username);
    
    // Find the proper capitalized username from database
    const usersRef = ref(db, "users");
    const usersSnapshot = await get(usersRef);
    let properUsername = username; // fallback
    
    if (usersSnapshot.exists()) {
      const users = usersSnapshot.val();
      const userEntry = Object.entries(users).find(([key, data]) => data.userId === currentUser.uid);
      if (userEntry) {
        properUsername = userEntry[0]; // This is the properly capitalized username
        console.log("Found proper username:", properUsername);
      }
    }
    
    const bookmarksRef = ref(db, `users/${properUsername}/bookmarks`);
    const bookmarksSnapshot = await get(bookmarksRef);
    
    if (!bookmarksSnapshot.exists()) {
      console.log("No bookmarks found for user:", properUsername);
      return [];
    }
    
    const bookmarks = bookmarksSnapshot.val();
    console.log("Bookmarks found:", bookmarks);
    const bookmarkedBands = Object.values(bookmarks).map(bookmark => bookmark.band);
    console.log("Bookmarked band names:", bookmarkedBands);
    
    // Get band data for bookmarked bands
    const bandsRef = ref(db, 'bands');
    const bandsSnapshot = await get(bandsRef);
    
    if (!bandsSnapshot.exists()) {
      console.log("No bands found in database");
      return [];
    }
    
    const bandsObject = bandsSnapshot.val();
    const allBands = Object.values(bandsObject);
    
    const filteredBands = allBands.filter(band => bookmarkedBands.includes(band.band_name));
    console.log("Filtered bookmarked bands:", filteredBands);
    
    return filteredBands;
  } catch (error) {
    console.error("Error loading bookmarked bands:", error);
    return [];
  }
}

// Function to check if flagged bands should be shown
function shouldShowFlaggedBands() {
  const toggle = document.getElementById("show-flagged-toggle");
  return toggle ? toggle.checked : true; // Default to true if toggle not found
}

// Function to check if moderator requests should be shown
function shouldShowModeratorRequests() {
  const toggle = document.getElementById("show-moderator-toggle");
  return toggle ? toggle.checked : true; // Default to true if toggle not found
}

// Function to filter bands based on toggles
function filterBands(bands) {
  const showFlagged = shouldShowFlaggedBands();
  const showModerator = shouldShowModeratorRequests();
  
  return bands.filter(band => {
    const isFlagged = band.flag === "Incomplete";
    const hasModeratorRequest = band.moderatorRequest === "true";
    
    // Show band if:
    // 1. Neither flag is set, OR
    // 2. Flagged and show flagged is true, OR
    // 3. Moderator request and show moderator is true
    return (!isFlagged && !hasModeratorRequest) ||
           (isFlagged && showFlagged) ||
           (hasModeratorRequest && showModerator);
  });
}

// Load and display bands
async function loadBands() {
  try {
    console.log("Starting loadBands function");
    const artistList = document.getElementById("artistList");
    artistList.innerHTML = "";

    const currentUser = auth.currentUser;
    const isModerator = await isUserVeryTrusted(); // ✅ check moderator status

    // Load bookmarked bands
    const bookmarkedBands = await loadBookmarkedBands();
    console.log("Bookmarked bands count:", bookmarkedBands.length);

    if (bookmarkedBands.length > 0) {
      let bookmarksHeader = document.createElement("h2");
      bookmarksHeader.id = "letter-Bookmarks";
      bookmarksHeader.textContent = "Bookmarks";
      bookmarksHeader.style.color = "#aa0000";
      artistList.appendChild(bookmarksHeader);

      bookmarkedBands.forEach(band => {
        let li = document.createElement("li");
        let a = document.createElement("a");
        let flags = "";
        if (band.flag === "Incomplete") flags += " 🚩";
        if (isModerator && band.moderatorRequest === "true") flags += " 🟣"; // ✅ only for VeryTrusted
        a.textContent = "🔖 " + band.band_name + flags;
        a.href = `band.html?band=${encodeURIComponent(band.band_name)}`;
        li.appendChild(a);
        artistList.appendChild(li);
      });
    }

    // Load all bands
    const bandsSnapshot = await get(child(dbRef, 'bands'));
    if (bandsSnapshot.exists()) {
      const bandsObject = bandsSnapshot.val();
      const bands = Object.values(bandsObject);

      const filteredBands = filterBands(bands);
      filteredBands.sort((a, b) => a.band_name.localeCompare(b.band_name));

      let currentLetter = "";

      filteredBands.forEach(band => {
        let firstLetter = band.band_name.charAt(0).toUpperCase();

        if (firstLetter !== currentLetter) {
          currentLetter = firstLetter;
          let letterHeader = document.createElement("h2");
          letterHeader.id = `letter-${currentLetter}`;
          letterHeader.textContent = currentLetter;
          artistList.appendChild(letterHeader);
        }

        let li = document.createElement("li");
        let a = document.createElement("a");
        let flags = "";
        if (band.flag === "Incomplete") flags += " 🚩";
        if (isModerator && band.moderatorRequest === "true") flags += " 🟣";
        a.textContent = band.band_name + flags;
        a.href = `band.html?band=${encodeURIComponent(band.band_name)}`;
        li.appendChild(a);
        artistList.appendChild(li);
      });
    } else {
      console.error("No band data found in Firebase.");
    }
  } catch (error) {
    console.error("Error fetching band data:", error);
  }
}


// Function to save toggle states to localStorage
function saveToggleStates() {
  const flaggedToggle = document.getElementById("show-flagged-toggle");
  const moderatorToggle = document.getElementById("show-moderator-toggle");
  
  if (flaggedToggle) {
    localStorage.setItem("showFlaggedBands", flaggedToggle.checked);
  }
  if (moderatorToggle) {
    localStorage.setItem("showModeratorRequests", moderatorToggle.checked);
  }
}

// Function to load toggle states from localStorage
function loadToggleStates() {
  const flaggedToggle = document.getElementById("show-flagged-toggle");
  const moderatorToggle = document.getElementById("show-moderator-toggle");
  
  if (flaggedToggle) {
    const savedState = localStorage.getItem("showFlaggedBands");
    if (savedState !== null) {
      flaggedToggle.checked = savedState === "true";
    }
  }
  if (moderatorToggle) {
    const savedState = localStorage.getItem("showModeratorRequests");
    if (savedState !== null) {
      moderatorToggle.checked = savedState === "true";
    }
  }
}

// Wait for authentication state before loading bands
onAuthStateChanged(auth, (user) => {
  // Load saved toggle states
  loadToggleStates();
  
  // Load bands
  loadBands();
  
  // Add event listeners for toggles
  const flaggedToggle = document.getElementById("show-flagged-toggle");
  const moderatorToggle = document.getElementById("show-moderator-toggle");
  
  if (flaggedToggle) {
    flaggedToggle.addEventListener("change", () => {
      saveToggleStates();
      loadBands(); // Reload bands when toggle changes
    });
  }
  
  if (moderatorToggle) {
    moderatorToggle.addEventListener("change", () => {
      saveToggleStates();
      loadBands(); // Reload bands when toggle changes
    });
  }
});

// Scroll to letter function - make it globally available
window.scrollToLetter = function(letter) {
  let section = document.getElementById(`letter-${letter}`);
  if (section) {
    section.scrollIntoView({ behavior: "smooth" });
  }
};
