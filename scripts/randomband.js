
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

      const randomBand = bandsArray[Math.floor(Math.random() * bandsArray.length)];
      const bandName = encodeURIComponent(randomBand.band_name || "Unknown");
      window.location.href = `band.html?band=${bandName}`;
    } catch (error) {
      console.error("Error fetching bands from Firebase:", error);
    }
  });
