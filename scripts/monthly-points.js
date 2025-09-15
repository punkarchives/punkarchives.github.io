// Monthly Points Management for Punk Archives
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-auth.js";
import { getDatabase, ref, get, set } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAoKv4PLrk4xvZF_IeUhfViwOLBYBv0czQ",
  authDomain: "punkarchivesdata.firebaseapp.com",
  projectId: "punkarchivesdata",
  storageBucket: "punkarchivesdata.firebasestorage.app",
  messagingSenderId: "272312472875",
  appId: "1:272312472875:web:048288b995db157dc8216e",
  measurementId: "G-24V1CEFHYP",
  databaseURL: "https://punkarchivesdata-default-rtdb.firebaseio.com/"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// Make sure the functions are available immediately
window.monthlyPoints = window.monthlyPoints || {};

// Get current month in YYYY-MM format
function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Check if monthly points need to be reset and award points
async function awardMonthlyPoints(pointType) {
  console.log(`📊 Starting monthly ${pointType} points process...`);
  const user = auth.currentUser;
  if (!user) {
    console.log('❌ No authenticated user found');
    return;
  }
  console.log('✅ User authenticated:', user.email);

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

    const currentMonth = getCurrentMonth();
    const monthlyPointsRef = ref(db, `users/${properUsername}/monthly_${pointType}_points`);
    const monthlyDateRef = ref(db, `users/${properUsername}/monthly_${pointType}_date`);
    
    // Get current monthly points and date
    const [monthlyPointsSnapshot, monthlyDateSnapshot] = await Promise.all([
      get(monthlyPointsRef),
      get(monthlyDateRef)
    ]);
    
    let currentMonthlyPoints = 0;
    let lastMonth = null;
    
    if (monthlyPointsSnapshot.exists()) {
      currentMonthlyPoints = monthlyPointsSnapshot.val();
    }
    
    if (monthlyDateSnapshot.exists()) {
      lastMonth = monthlyDateSnapshot.val();
    }
    
    // Reset monthly points if it's a new month
    if (lastMonth !== currentMonth) {
      currentMonthlyPoints = 0;
    }
    
    // Award the point
    const newMonthlyPoints = currentMonthlyPoints + 1;
    
    // Update both monthly points and date
    await Promise.all([
      set(monthlyPointsRef, newMonthlyPoints),
      set(monthlyDateRef, currentMonth)
    ]);
    
    console.log(`Awarded monthly ${pointType} point. New total: ${newMonthlyPoints} for ${currentMonth}`);
    
  } catch (error) {
    console.error(`Error awarding monthly ${pointType} points:`, error);
  }
}

// Award monthly band points
async function awardMonthlyBandPoints() {
  console.log('🎸 Awarding monthly band points...');
  await awardMonthlyPoints('bands');
}

// Award monthly release points
async function awardMonthlyReleasePoints() {
  console.log('💿 Awarding monthly release points...');
  await awardMonthlyPoints('releases');
}

// Export functions for use in other scripts
window.monthlyPoints.awardMonthlyBandPoints = awardMonthlyBandPoints;
window.monthlyPoints.awardMonthlyReleasePoints = awardMonthlyReleasePoints;
window.monthlyPoints.getCurrentMonth = getCurrentMonth;
