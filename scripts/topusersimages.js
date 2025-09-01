import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-auth.js";
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

let topUsers = [];
let currentUser = null;

// Load top users and their images
async function loadTopUsersImages() {
  try {
    const usersRef = ref(db, "users");
    const usersSnapshot = await get(usersRef);
    
    if (usersSnapshot.exists()) {
      const users = usersSnapshot.val();
      
      // Get top 3 users by points
      topUsers = Object.entries(users)
        .map(([username, data]) => ({
          username: username,
          points: data.points || 0,
        }))
        .sort((a, b) => b.points - a.points)
        .slice(0, 3);
      
      // Load images for each slot
      for (let i = 0; i < 3; i++) {
        await loadImageForSlot(i + 1, topUsers[i]);
      }
      
      // Check if current user is in top 3 and show edit buttons
      checkCurrentUserPermissions();
    }
  } catch (error) {
    console.error("Error loading top users images:", error);
  }
}

// Load image for a specific slot
async function loadImageForSlot(slotNumber, user) {
  try {
    const imageRef = ref(db, `topUsersImages/slot${slotNumber}`);
    const imageSnapshot = await get(imageRef);
    
    const imageElement = document.getElementById(`user-image-${slotNumber}`);
    const infoElement = document.getElementById(`image-info-${slotNumber}`);
    
    if (imageSnapshot.exists()) {
      const imageData = imageSnapshot.val();
      imageElement.src = imageData.imageUrl || `assets/logo.png`;
      infoElement.innerHTML = `<p class="username">${user.username}</p><p class="description">${imageData.description || 'No description'}</p>`;
    } else {
      // Set default image and info
      imageElement.src = `assets/logo.png`;
      infoElement.innerHTML = `<p class="username">${user.username}</p><p class="description">No image set</p>`;
    }
  } catch (error) {
    console.error(`Error loading image for slot ${slotNumber}:`, error);
  }
}

// Check if current user has permission to edit images
function checkCurrentUserPermissions() {
  if (!currentUser) return;
  
  const userIndex = topUsers.findIndex(user => user.username === currentUser);
  
  if (userIndex !== -1) {
    const slotNumber = userIndex + 1;
    const editButton = document.getElementById(`edit-image-${slotNumber}`);
    if (editButton) {
      editButton.style.display = 'inline-block';
      editButton.onclick = () => editImage(slotNumber);
    }
  }
}

// Edit image for a specific slot
async function editImage(slotNumber) {
  if (!currentUser) {
    alert('You must be logged in to edit images.');
    return;
  }
  
  const userIndex = slotNumber - 1;
  if (userIndex < 0 || userIndex >= topUsers.length || topUsers[userIndex].username !== currentUser) {
    alert('You can only edit your own image slot.');
    return;
  }
  
  const imageUrl = prompt('Enter the URL for your image:');
  if (!imageUrl) return;
  
  const description = prompt('Enter a description for your image (optional):');
  
  try {
    const imageData = {
      imageUrl: imageUrl,
      description: description || '',
      username: currentUser,
      lastUpdated: new Date().toISOString()
    };
    
    await set(ref(db, `topUsersImages/slot${slotNumber}`), imageData);
    
         // Update the display
     const imageElement = document.getElementById(`user-image-${slotNumber}`);
     const infoElement = document.getElementById(`image-info-${slotNumber}`);
     
     imageElement.src = imageUrl;
     infoElement.innerHTML = `<p class="username">${currentUser}</p><p class="description">${description || 'No description'}</p>`;
    
    alert('Image updated successfully!');
  } catch (error) {
    console.error('Error updating image:', error);
    alert('Failed to update image: ' + error.message);
  }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
  // Listen for auth state changes
  onAuthStateChanged(auth, (user) => {
    if (user) {
      const email = user.email;
      currentUser = email.replace("@punkarchives.com", "");
    } else {
      currentUser = null;
    }
    
    // Load images after auth state is determined
    loadTopUsersImages();
  });
});
