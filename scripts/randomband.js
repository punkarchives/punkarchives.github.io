
  import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
  import { getDatabase, ref, get, child } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

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
  const db = getDatabase(app);

  document.getElementById("randomBandButton").addEventListener("click", async function () {
    try {
      const snapshot = await get(child(ref(db), 'bands'));
      if (!snapshot.exists()) {
        alert("No bands available.");
        return;
      }

      const bandsObj = snapshot.val();
      const bandsArray = Object.values(bandsObj);

      if (bandsArray.length === 0) {
        alert("No bands available.");
        return;
      }

      // Function to check if a band has valid genre information
      function hasValidGenre(band) {
        return band.genres && 
               typeof band.genres === 'string' &&
               band.genres.trim() !== '' && 
               band.genres !== 'undefined' && 
               band.genres !== 'N/A';
      }

      // Try to find a band with genre info by checking random bands one by one
      let attempts = 0;
      const maxAttempts = 50; // Prevent infinite loops
      let randomBand = null;

      while (attempts < maxAttempts) {
        const randomIndex = Math.floor(Math.random() * bandsArray.length);
        const candidateBand = bandsArray[randomIndex];
        
        if (hasValidGenre(candidateBand)) {
          randomBand = candidateBand;
          break;
        }
        attempts++;
      }

      // If we found a band with genre info, use it
      if (randomBand) {
        const bandName = encodeURIComponent(randomBand.band_name || "Unknown");
        window.location.href = `band.html?band=${bandName}`;
        return;
      }

      // If no band with genre info found after max attempts, pick any random band
      const fallbackBand = bandsArray[Math.floor(Math.random() * bandsArray.length)];
      const bandName = encodeURIComponent(fallbackBand.band_name || "Unknown");
      window.location.href = `band.html?band=${bandName}`;
    } catch (error) {
      console.error("Error fetching bands from Firebase:", error);
    }
  });
