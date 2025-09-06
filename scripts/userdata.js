// yes firebase api keys are meant to be public
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-auth.js";
import { getDatabase, ref, set, get, child } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-database.js";

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

async function getUserJoinDate(username) {
  try {
    // Get the creation date from the user's database record
    const userRef = ref(db, `users/${username}`);
    const userSnapshot = await get(userRef);
    
    if (userSnapshot.exists()) {
      const userData = userSnapshot.val();
      return userData.creationDate || null;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting user join date:', error);
    return null;
  }
}

async function loadUserCollection(username) {
  try {
    const collectionRef = ref(db, `users/${username}/collection`);
    const collectionSnapshot = await get(collectionRef);
    
    const container = document.getElementById('user-content-container');
    
    if (!collectionSnapshot.exists()) {
      container.innerHTML = '<p>No items in collection yet.</p>';
      return;
    }
    
    const collection = collectionSnapshot.val();
    const collectionItems = Object.values(collection);
    
    if (collectionItems.length === 0) {
      container.innerHTML = '<p>No items in collection yet.</p>';
      return;
    }
    
    // Sort collection by release year (newest first)
    collectionItems.sort((a, b) => {
      const yearA = parseInt(a.releaseYear) || 0;
      const yearB = parseInt(b.releaseYear) || 0;
      return yearB - yearA;
    });
    
    let collectionHTML = '';
    collectionItems.forEach((item, index) => {
      collectionHTML += `
        <div style="border: 1px solid #ccc; margin-bottom: 10px; padding: 10px; background-color: rgba(0,0,0,0.2);">
          <a href="release.html?band=${encodeURIComponent(item.band)}&release=${encodeURIComponent(item.releaseTitle)}" style="color: #aa0000; text-decoration: none;">
            <strong>${item.releaseTitle}</strong> - ${item.band} - ${item.releaseYear}
          </a>
        </div>
      `;
    });
    
    container.innerHTML = collectionHTML;
  } catch (error) {
    console.error('Error loading user collection:', error);
    document.getElementById('user-content-container').innerHTML = '<p>Error loading collection.</p>';
  }
}

async function generateAchievementsHTML(username, userData) {
  const achievements = [];
  
  // Check "Add 1 Band" achievement
  if (userData.points >= 1) {
    achievements.push({
      emoji: "🎸",
      text: "Newbie - Added your first band to the archive"
    });
  }
  
  // Check "Add 5 Bands" achievement
  if (userData.points >= 5) {
    achievements.push({
      emoji: "🏆",
      text: "Pro Archivist - Added 5 bands to the archive"
    });
  }
  
  // Check "OG Archiver" achievement (joined in 2025)
  if (userData.creationDate) {
    const joinYear = new Date(userData.creationDate).getFullYear();
    if (joinYear === 2025) {
      achievements.push({
        emoji: "👑",
        text: "OG Archivist - Joined Punk Archives in 2025"
      });
    }
  }
  
  // Check "Add A Review" achievement
  try {
    const reviewsRef = ref(db, 'reviews');
    const reviewsSnapshot = await get(reviewsRef);
    if (reviewsSnapshot.exists()) {
      const allReviews = reviewsSnapshot.val();
      const userReviews = Object.values(allReviews).filter(review => 
        review.user === username
      );
      if (userReviews.length > 0) {
        achievements.push({
          emoji: "✍️",
          text: "Journalist - Wrote your first review"
        });
      }
    }
  } catch (error) {
    console.error('Error checking review achievement:', error);
  }
  
  if (achievements.length === 0) {
    return '<span style="color: #666;">No achievements yet</span>';
  }
  
  return achievements.map(achievement => 
    `<span class="achievement" data-text="${achievement.text}" style="cursor: pointer; font-size: 20px;">${achievement.emoji}</span>`
  ).join('');
}

async function loadUserReviews(username) {
  try {
    const reviewsRef = ref(db, 'reviews');
    const reviewsSnapshot = await get(reviewsRef);
    
    const reviewsContainer = document.getElementById('user-content-container');
    
    if (!reviewsSnapshot.exists()) {
      reviewsContainer.innerHTML = '<p>No reviews yet.</p>';
      return;
    }
    
    const allReviews = reviewsSnapshot.val();
    const userReviews = Object.values(allReviews).filter(review => 
      review.user === username
    );
    
    if (userReviews.length === 0) {
      reviewsContainer.innerHTML = '<p>No reviews yet.</p>';
      return;
    }
    
    // Sort reviews by timestamp (newest first)
    userReviews.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    let reviewsHTML = '';
    userReviews.forEach((review, index) => {
      const date = new Date(review.timestamp).toLocaleDateString();
      reviewsHTML += `
        <div style="border: 1px solid #ccc; margin-bottom: 15px; padding: 10px; background-color: rgba(0,0,0,0.2); text-align: left;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <div>
              <strong><a href="band.html?band=${encodeURIComponent(review.band)}" style="color: #aa0000;">${review.band}</a> - <a href="release.html?band=${encodeURIComponent(review.band)}&release=${encodeURIComponent(review.release)}" style="color: #aa0000;">${review.release}</a></strong> - ${review.rating}/10
              <div style="color: #666; font-size: 12px;">
              ${date}
            </div>
              </div>

          </div>
          <div style="white-space: pre-wrap;">${review.review}</div>
        </div>
      `;
    });
    
    reviewsContainer.innerHTML = reviewsHTML;
  } catch (error) {
    console.error('Error loading user reviews:', error);
    document.getElementById('user-content-container').innerHTML = '<p>Error loading reviews.</p>';
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const username = urlParams.get("user");

  if (!username) {
    document.getElementById("user-content").innerHTML = "<h1>No user selected.</h1>";
    return;
  }

  const dbRef = ref(db);
  try {
    const snapshot = await get(child(dbRef, `users/${username}`));
    if (!snapshot.exists()) {
      document.getElementById("user-content").innerHTML = "<h1>User not found.</h1>";
      return;
    }

    const userData = snapshot.val();
    const currentUser = auth.currentUser;
    let currentUsername = null;

    // Get current logged-in username with proper capitalization
    if (currentUser && currentUser.email) {
      const lowercaseUsername = currentUser.email.replace("@punkarchives.com", "").toLowerCase();
      
      // Find the proper capitalized username from database
      const usersRef = ref(db, "users");
      const usersSnapshot = await get(usersRef);
      
      if (usersSnapshot.exists()) {
        const users = usersSnapshot.val();
        const userEntry = Object.entries(users).find(([key, data]) => data.userId === currentUser.uid);
        if (userEntry) {
          currentUsername = userEntry[0]; // This is the properly capitalized username
        } else {
          currentUsername = lowercaseUsername; // fallback
        }
      } else {
        currentUsername = lowercaseUsername; // fallback
      }
    }

    const isOwnProfile = currentUsername === username;

    // Check if user is in top 3 by points
    const allUsersSnapshot = await get(child(dbRef, 'users'));
    let isTop3 = false;
    if (allUsersSnapshot.exists()) {
      const allUsers = Object.entries(allUsersSnapshot.val()).map(([username, data]) => ({
        username: username,
        points: data.points || 0
      }));
      
      const top3Users = allUsers
        .sort((a, b) => b.points - a.points)
        .slice(0, 3)
        .map(user => user.username);
      
      isTop3 = top3Users.includes(username);
    }

         // Build status indicators
         let statusIndicators = '';
         if (isTop3) {
           statusIndicators += '<p style="color: #FFD700; margin: 5px 0;">👑 Top 3 Contributor</p>';
         }
         if (userData.trusted === "true") {
           statusIndicators += '<p style="color: #FF8C00; margin: 5px 0;">✅ Trusted User</p>';
         }
         if (userData.verytrusted === "true") {
           statusIndicators += '<p style="color: #FF0000; margin: 5px 0;">🛡️ Moderator</p>';
         }

         // Get join date
         const joinDate = await getUserJoinDate(username);
         const formattedJoinDate = joinDate ? new Date(joinDate).toLocaleDateString() : 'Unknown';

         let userHTML = `
       <div style="display: flex; flex-direction: column; align-items: center; gap: 20px;">
         <div style="text-align: center;">
           <h1>${username}</h1>
           ${statusIndicators}
           <p><strong>Bands Added:</strong> ${userData.points || 0}</p>
           <p><strong>Joined:</strong> ${formattedJoinDate}</p>
         </div>
         
         <div style="text-align: center;">
           <div id="profile-picture-container">
             ${userData.profilePicture ? 
               `<img src="${userData.profilePicture}" alt="${username}'s profile picture" style="max-width: 200px; height: auto; border: 2px solid #aa0000;" />` : 
               `<div style="width: 200px; height: 200px; border: 2px solid #aa0000; display: flex; align-items: center; justify-content: center; background-color: #333;">
                 <p>N/A</p>
               </div>`
             }
           </div>
           ${isOwnProfile ? `
             <button id="edit-profile-picture-btn" style="margin-top: 10px; background-color: #aa0000; color: white; border: none; padding: 8px 16px; cursor: pointer;">
               Edit Profile Picture
             </button>
           ` : ""}
           
           <div style="margin-top: 15px;">
             <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
               <strong>Discord:</strong>
               <span id="discord-display">${userData.discord || 'Not set'}</span>
               ${isOwnProfile ? `
                 <button id="edit-discord-btn" style="background-color: #aa0000; color: white; border: none; padding: 4px 8px; cursor: pointer; font-size: 12px;">
                   Edit
                 </button>
               ` : ""}
             </div>
           </div>
           
           <div style="margin-top: 15px;">
             <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
               <div id="achievements-container" style="display: flex; gap: 5px;">
                 ${await generateAchievementsHTML(username, userData)}
               </div>
             </div>
           </div>
         </div>
         
         <div style="text-align: center; margin-top: 20px;">
           <h3>Favorites</h3>
           <div style="display: flex; flex-direction: column; gap: 10px; align-items: center;">
             <div>
               <strong>Favorite Band:</strong> 
               ${userData.favoriteBand ? 
                 `<a href="band.html?band=${encodeURIComponent(userData.favoriteBand)}" style="color: #aa0000;">${userData.favoriteBand}</a>` : 
                 '<span style="color: #666;">N/A</span>'
               }
               ${isOwnProfile ? `<button class="edit-favorite-btn" data-field="favoriteBand" style="margin-left: 10px; background-color: #aa0000; color: white; border: none; padding: 4px 8px; cursor: pointer; font-size: 12px;">Edit</button>` : ""}
             </div>
             <div>
               <strong>Favorite Label:</strong> 
               ${userData.favoriteLabel ? 
                 `<a href="label.html?label=${encodeURIComponent(userData.favoriteLabel)}" style="color: #aa0000;">${userData.favoriteLabel}</a>` : 
                 '<span style="color: #666;">N/A</span>'
               }
               ${isOwnProfile ? `<button class="edit-favorite-btn" data-field="favoriteLabel" style="margin-left: 10px; background-color: #aa0000; color: white; border: none; padding: 4px 8px; cursor: pointer; font-size: 12px;">Edit</button>` : ""}
             </div>
             <div>
               <strong>Favorite Zine:</strong> 
               ${userData.favoriteZine ? 
                 `<a href="zine.html?zine=${encodeURIComponent(userData.favoriteZine)}" style="color: #aa0000;">${userData.favoriteZine}</a>` : 
                 '<span style="color: #666;">N/A</span>'
               }
               ${isOwnProfile ? `<button class="edit-favorite-btn" data-field="favoriteZine" style="margin-left: 10px; background-color: #aa0000; color: white; border: none; padding: 4px 8px; cursor: pointer; font-size: 12px;">Edit</button>` : ""}
             </div>
           </div>
         </div>
         
           <div style="display: flex; width: 100%;">
             <button id="reviews-btn" style="flex: 1; background-color: #aa0000; color: white; border: none; padding: 12px 20%; cursor: pointer; font-size: 16px;">
               Reviews
             </button><p><font color="#111">-</font></p>
             <button id="collection-btn" style="flex: 1; background-color: #aa0000; color: white; border: none; padding: 12px 20%; cursor: pointer; font-size: 16px;">
               Collection
             </button>
           </div>
           <div id="user-content-container" style="margin-top: 20px;"></div>
         </div>
     `;

    document.getElementById("user-content").innerHTML = userHTML;

    // Add event listener for edit profile picture button
    if (isOwnProfile) {
      const editBtn = document.getElementById("edit-profile-picture-btn");
      editBtn.addEventListener("click", () => {
        const currentPictureUrl = userData.profilePicture || "";
        const newUrl = prompt("Enter the URL for your profile picture:", currentPictureUrl);
        
        if (newUrl !== null) { // User didn't cancel
          // Update the profile picture in Firebase using proper capitalization
          set(ref(db, `users/${username}/profilePicture`), newUrl)
            .then(() => {
              // Update the display
              const container = document.getElementById("profile-picture-container");
                             if (newUrl.trim() === "") {
                 // If empty URL, show placeholder
                 container.innerHTML = `
                   <div style="width: 200px; height: 200px; border: 2px solid #aa0000; display: flex; align-items: center; justify-content: center; background-color: #333;">
                     <p>N/A</p>
                   </div>
                 `;
              } else {
                // Show the new image
                container.innerHTML = `<img src="${newUrl}" alt="${username}'s profile picture" style="max-width: 200px; height: auto; border: 2px solid #aa0000;" />`;
              }
              
              // Update userData for future reference
              userData.profilePicture = newUrl;
            })
            .catch((error) => {
              console.error("Error updating profile picture:", error);
              alert("Failed to update profile picture: " + error.message);
            });
                 }
       });
     }

     // Add event listeners for favorite edit buttons
     if (isOwnProfile) {
       document.querySelectorAll('.edit-favorite-btn').forEach(button => {
         button.addEventListener('click', () => {
           const field = button.getAttribute('data-field');
           const currentValue = userData[field] || '';
           const newValue = prompt(`Enter your favorite ${field.replace('favorite', '')}:`, currentValue);
           
           if (newValue !== null) { // User didn't cancel
             set(ref(db, `users/${username}/${field}`), newValue)
               .then(() => {
                 // Update userData for future reference
                 userData[field] = newValue;
                 
                 // Reload the page to show updated favorites
                 location.reload();
               })
               .catch((error) => {
                 console.error(`Error updating ${field}:`, error);
                 alert(`Failed to update ${field}: ` + error.message);
               });
           }
         });
       });
     }

     // Add event listener for Discord edit button
     if (isOwnProfile) {
       const editDiscordBtn = document.getElementById('edit-discord-btn');
       if (editDiscordBtn) {
         editDiscordBtn.addEventListener('click', () => {
           const currentDiscord = userData.discord || '';
           const newDiscord = prompt('Enter your Discord username:', currentDiscord);
           
           if (newDiscord !== null) { // User didn't cancel
             set(ref(db, `users/${username}/discord`), newDiscord)
               .then(() => {
                 // Update the display
                 const discordDisplay = document.getElementById('discord-display');
                 discordDisplay.textContent = newDiscord || 'Not set';
                 
                 // Update userData for future reference
                 userData.discord = newDiscord;
               })
               .catch((error) => {
                 console.error('Error updating Discord username:', error);
                 alert('Failed to update Discord username: ' + error.message);
               });
           }
         });
       }
     }

     // Add event listeners for Reviews and Collection buttons
     const reviewsBtn = document.getElementById('reviews-btn');
     const collectionBtn = document.getElementById('collection-btn');
     
     if (reviewsBtn) {
       reviewsBtn.addEventListener('click', async () => {
         // Set active button styling
         reviewsBtn.style.backgroundColor = '#cc0000';
         collectionBtn.style.backgroundColor = '#aa0000';
         
         // Load reviews
         await loadUserReviews(username);
       });
     }
     
     if (collectionBtn) {
       collectionBtn.addEventListener('click', async () => {
         // Set active button styling
         collectionBtn.style.backgroundColor = '#cc0000';
         reviewsBtn.style.backgroundColor = '#aa0000';
         
         // Load collection
         await loadUserCollection(username);
       });
     }
     
     // Load reviews by default
     await loadUserReviews(username);

     // Add achievement hover functionality
     const achievementElements = document.querySelectorAll('.achievement');
     achievementElements.forEach(element => {
       element.addEventListener('mouseenter', (e) => {
         const text = e.target.getAttribute('data-text');
         const tooltip = document.createElement('div');
         tooltip.id = 'achievement-tooltip';
         tooltip.textContent = text;
         tooltip.style.cssText = `
           position: absolute;
           background: #111;
           color: white;
           padding: 8px 12px;
           border: 2px solid #aa0000;
           border-radius: 4px;
           font-size: 14px;
           z-index: 1000;
           pointer-events: none;
           max-width: 200px;
           word-wrap: break-word;
         `;
         document.body.appendChild(tooltip);
         
         // Position tooltip near mouse
         const rect = e.target.getBoundingClientRect();
         tooltip.style.left = rect.right + 10 + 'px';
         tooltip.style.top = rect.top + 'px';
       });
       
       element.addEventListener('mouseleave', () => {
         const tooltip = document.getElementById('achievement-tooltip');
         if (tooltip) {
           document.body.removeChild(tooltip);
         }
       });
     });

   } catch (err) {
    console.error("Firebase error:", err);
    document.getElementById("user-content").innerHTML = "<h1>Error loading user data.</h1>";
  }
});
