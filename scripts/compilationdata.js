import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-auth.js";
import { getDatabase, ref, set, get, child, push, update } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-database.js";

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

async function isUserTrusted() {
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
        return userData.trusted === "true";
      }
    }
    return false;
  } catch (error) {
    console.error("Error checking trusted status:", error);
    return false;
  }
}

async function logChange(db, labelKey, field, oldValue, newValue) {
  const user = auth.currentUser;
  let username = "unknown";

  if (user && user.email) {
    username = user.email.replace("@punkarchives.com", "");
  }

  const logEntry = {
    labelKey,
    field,
    oldValue,
    newValue,
    username,
    timestamp: new Date().toISOString()
  };

  try {
    await push(ref(db, `logs/${labelKey}`), logEntry);
    console.log("Change logged:", logEntry);
  } catch (error) {
    console.error("Logging error:", error);
  }
}

async function getCompilationId(labelName, compilationTitle) {
  try {
    const labelsRef = ref(db, 'labels');
    const labelsSnapshot = await get(labelsRef);
    
    if (!labelsSnapshot.exists()) {
      return null;
    }
    
    const labels = Object.entries(labelsSnapshot.val()).map(([key, val]) => ({ key, ...val }));
    const label = labels.find(l => l.label_name === labelName);
    
    if (!label || !label.compilations) {
      return null;
    }
    
    const compilationIndex = label.compilations.findIndex(c => c.title === compilationTitle);
    return compilationIndex !== -1 ? compilationIndex : null;
  } catch (error) {
    console.error('Error getting compilation ID:', error);
    return null;
  }
}

async function isInCollection(username, labelName, compilationId) {
  try {
    const collectionRef = ref(db, `users/${username}/collection`);
    const collectionSnapshot = await get(collectionRef);
    
    if (!collectionSnapshot.exists()) {
      return false;
    }
    
    const collection = collectionSnapshot.val();
    return Object.values(collection).some(item => 
      item.label === labelName && item.compilationId === compilationId
    );
  } catch (error) {
    console.error('Error checking collection:', error);
    return false;
  }
}

async function addToCollection(username, labelName, compilationId, compilationTitle, compilationYear) {
  try {
    const collectionRef = ref(db, `users/${username}/collection`);
    const collectionSnapshot = await get(collectionRef);
    
    let collection = collectionSnapshot.exists() ? collectionSnapshot.val() : {};
    
    // Find the next available index by finding the maximum numeric key and adding 1
    // Convert all keys to numbers and filter out NaN values
    const keys = Object.keys(collection)
      .map(key => parseInt(key, 10))
      .filter(key => !isNaN(key));
    
    // Find the maximum key, or start at 0 if collection is empty
    const maxKey = keys.length > 0 ? Math.max(...keys) : -1;
    let collectionId = maxKey + 1;
    
    // Double-check that this ID doesn't already exist (safety check)
    while (collection[collectionId] !== undefined) {
      collectionId++;
    }
    
    // Use update() instead of set() to only update the specific path
    // This prevents overwriting the entire collection object
    const newItem = {
      label: labelName,
      compilationId: compilationId,
      compilationTitle: compilationTitle,
      compilationYear: compilationYear || "Unknown"
    };
    
    await update(collectionRef, { [collectionId]: newItem });
    return true;
  } catch (error) {
    console.error('Error adding to collection:', error);
    return false;
  }
}

async function removeFromCollection(username, labelName, compilationId) {
  try {
    const collectionRef = ref(db, `users/${username}/collection`);
    const collectionSnapshot = await get(collectionRef);
    
    if (!collectionSnapshot.exists()) {
      return false;
    }
    
    const collection = collectionSnapshot.val();
    const entryToRemove = Object.entries(collection).find(([key, item]) => 
      item.label === labelName && item.compilationId === compilationId
    );
    
    if (entryToRemove) {
      delete collection[entryToRemove[0]];
      await set(collectionRef, collection);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error removing from collection:', error);
    return false;
  }
}

function formatMultipleLabels(labelString) {
  if (!labelString || labelString === "N/A") {
    return "N/A";
  }
  
  // Split by comma and create individual links
  const labels = labelString.split(',').map(label => label.trim()).filter(label => label);
  
  if (labels.length === 0) {
    return "N/A";
  }
  
  return labels.map(label => 
    `<a href="label.html?label=${encodeURIComponent(label)}" style="color: #aa0000;">${label}</a>`
  ).join(', ');
}

async function loadReviews(labelName, compilationTitle) {
  try {
    const reviewsRef = ref(db, 'reviews');
    const reviewsSnapshot = await get(reviewsRef);
    
    const reviewsContainer = document.getElementById('reviews-container');
    
    if (!reviewsSnapshot.exists()) {
      reviewsContainer.innerHTML = '<p>No reviews yet. Be the first to review this compilation!</p>';
      return;
    }
    
    const allReviews = reviewsSnapshot.val();
    const compilationReviews = Object.entries(allReviews).filter(([reviewId, review]) => 
      review.label === labelName && review.compilation === compilationTitle
    );
    
    if (compilationReviews.length === 0) {
      reviewsContainer.innerHTML = '<p>No reviews yet. Be the first to review this compilation!</p>';
      return;
    }
    
    // Sort reviews by timestamp (newest first)
    compilationReviews.sort(([,a], [,b]) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Get current user info
    const currentUser = auth.currentUser;
    let currentUsername = null;
    if (currentUser) {
      const username = currentUser.email.replace("@punkarchives.com", "").toLowerCase();
      
      // Find the proper capitalized username from database
      const usersRef = ref(db, "users");
      const usersSnapshot = await get(usersRef);
      let properUsername = username; // fallback
      
      if (usersSnapshot.exists()) {
        const users = usersSnapshot.val();
        const userEntry = Object.entries(users).find(([key, data]) => data.userId === currentUser.uid);
        if (userEntry) {
          properUsername = userEntry[0]; // This is the properly capitalized username
        }
      }
      currentUsername = properUsername;
    }
    
    // Get unique usernames to fetch profile pictures
    const uniqueUsers = [...new Set(compilationReviews.map(([,review]) => review.user))];
    const userProfilePictures = {};
    
    // Fetch profile pictures for all reviewers
    for (const username of uniqueUsers) {
      try {
        const userRef = ref(db, `users/${username}`);
        const userSnapshot = await get(userRef);
        if (userSnapshot.exists()) {
          const userData = userSnapshot.val();
          userProfilePictures[username] = userData.profilePicture || null;
        }
      } catch (error) {
        console.error(`Error fetching profile picture for ${username}:`, error);
        userProfilePictures[username] = null;
      }
    }
    
    let reviewsHTML = '';
    compilationReviews.forEach(([reviewId, review], index) => {
      const date = new Date(review.timestamp).toLocaleDateString();
      const profilePicture = userProfilePictures[review.user];
      const isOwnReview = currentUsername && review.user === currentUsername;
      
      // Create profile picture HTML
      const profilePictureHTML = profilePicture 
        ? `<img src="${profilePicture}" alt="${review.user}'s profile picture" style="width: 30px; height: 30px; border-radius: 50%; border: 1px solid #aa0000; margin-right: 8px; object-fit: cover;" />`
        : `<div style="width: 30px; height: 30px; border-radius: 50%; border: 1px solid #aa0000; margin-right: 8px; background-color: #333; display: flex; align-items: center; justify-content: center; color: #666; font-size: 12px;">N/A</div>`;
      
      // Get likes and dislikes counts
      const likes = review.likes || {};
      const dislikes = review.dislikes || {};
      const likesCount = Object.keys(likes).length;
      const dislikesCount = Object.keys(dislikes).length;
      
      // Check if current user has liked/disliked this review
      const hasLiked = currentUsername && likes[currentUsername];
      const hasDisliked = currentUsername && dislikes[currentUsername];

      reviewsHTML += `
        <div id="review-${reviewId}" style="border: 1px solid #ccc; margin-bottom: 15px; padding: 10px; background-color: rgba(0,0,0,0.2);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <div style="display: flex; align-items: center;">
              ${profilePictureHTML}
              <div>
                <strong><a href="user.html?user=${encodeURIComponent(review.user)}" style="color: #aa0000; text-decoration: none;">${review.user}</a></strong> - <span class="review-rating">${review.rating}</span>/10
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="color: #666; font-size: 12px;">
                ${date}
              </div>
              ${isOwnReview ? `
                <button class="edit-review-btn" data-review-id="${reviewId}" style="background-color: #aa0000; color: white; border: none; padding: 4px 8px; cursor: pointer; font-size: 12px;">Edit</button>
                <button class="delete-review-btn" data-review-id="${reviewId}" style="background-color: #cc0000; color: white; border: none; padding: 4px 8px; cursor: pointer; font-size: 12px;">Delete</button>
              ` : ''}
            </div>
          </div>
          <div class="review-content" style="white-space: pre-wrap;">${review.review}</div>
          <div style="display: flex; align-items: center; gap: 15px; margin-top: 10px; padding-top: 10px; border-top: 1px solid #333;">
            <button class="like-btn" data-review-id="${reviewId}" style="background: none; border: none; color: ${hasLiked ? '#00ff00' : '#666'}; cursor: pointer; display: flex; align-items: center; gap: 5px;">
              👍 ${likesCount}
            </button>
            <button class="dislike-btn" data-review-id="${reviewId}" style="background: none; border: none; color: ${hasDisliked ? '#ff0000' : '#666'}; cursor: pointer; display: flex; align-items: center; gap: 5px;">
              👎 ${dislikesCount}
            </button>
          </div>
        </div>
      `;
    });
    
    reviewsContainer.innerHTML = reviewsHTML;
    
    // Add event listeners for edit and delete buttons
    document.querySelectorAll('.edit-review-btn').forEach(button => {
      button.addEventListener('click', () => {
        const reviewId = button.getAttribute('data-review-id');
        editReview(reviewId, labelName, compilationTitle);
      });
    });
    
    document.querySelectorAll('.delete-review-btn').forEach(button => {
      button.addEventListener('click', () => {
        const reviewId = button.getAttribute('data-review-id');
        deleteReview(reviewId, labelName, compilationTitle);
      });
    });
    
    // Add event listeners for like and dislike buttons
    document.querySelectorAll('.like-btn').forEach(button => {
      button.addEventListener('click', () => {
        const reviewId = button.getAttribute('data-review-id');
        toggleLike(reviewId, labelName, compilationTitle);
      });
    });
    
    document.querySelectorAll('.dislike-btn').forEach(button => {
      button.addEventListener('click', () => {
        const reviewId = button.getAttribute('data-review-id');
        toggleDislike(reviewId, labelName, compilationTitle);
      });
    });
    
  } catch (error) {
    console.error('Error loading reviews:', error);
    document.getElementById('reviews-container').innerHTML = '<p>Error loading reviews.</p>';
  }
}

async function editReview(reviewId, labelName, compilationTitle) {
  try {
    // Get the current review data
    const reviewRef = ref(db, `reviews/${reviewId}`);
    const reviewSnapshot = await get(reviewRef);
    
    if (!reviewSnapshot.exists()) {
      alert('Review not found.');
      return;
    }
    
    const review = reviewSnapshot.val();
    
    // Create edit form
    const reviewElement = document.getElementById(`review-${reviewId}`);
    const currentContent = reviewElement.querySelector('.review-content');
    const currentRating = reviewElement.querySelector('.review-rating');
    
    // Store original content for cancel
    const originalContent = currentContent.innerHTML;
    const originalRating = currentRating.textContent;
    
    // Replace content with edit form
    currentContent.innerHTML = `
        <label>Rating (1-10):</label>
        <input type="number" id="edit-rating-${reviewId}" min="1" max="10" value="${review.rating}">
        <label>Review:</label>
        <textarea id="edit-text-${reviewId}" rows="4" cols="50">${review.review}</textarea>
        <button id="save-edit-${reviewId}">Save</button><br>
        <button id="cancel-edit-${reviewId}">Cancel</button>
    `;
    
    // Add event listeners for save and cancel
    document.getElementById(`save-edit-${reviewId}`).addEventListener('click', async () => {
      const newRating = parseInt(document.getElementById(`edit-rating-${reviewId}`).value);
      const newText = document.getElementById(`edit-text-${reviewId}`).value.trim();
      
      if (newRating < 1 || newRating > 10) {
        alert('Rating must be between 1 and 10.');
        return;
      }
      
      if (newText.length === 0) {
        alert('Please enter a review.');
        return;
      }
      
      try {
        // Update the review in Firebase
        const updatedReview = {
          ...review,
          rating: newRating,
          review: newText,
          edited: true,
          editTimestamp: new Date().toISOString()
        };
        
        await set(reviewRef, updatedReview);
        
        // Reload reviews to show updated content
        await loadReviews(labelName, compilationTitle);
        
      } catch (error) {
        console.error('Error updating review:', error);
        alert('Failed to update review: ' + error.message);
      }
    });
    
    document.getElementById(`cancel-edit-${reviewId}`).addEventListener('click', () => {
      // Restore original content
      currentContent.innerHTML = originalContent;
      currentRating.textContent = originalRating;
    });
    
  } catch (error) {
    console.error('Error editing review:', error);
    alert('Failed to edit review: ' + error.message);
  }
}

async function deleteReview(reviewId, labelName, compilationTitle) {
  if (!confirm('Are you sure you want to delete this review? This action cannot be undone.')) {
    return;
  }
  
  try {
    const reviewRef = ref(db, `reviews/${reviewId}`);
    await set(reviewRef, null); // Delete the review
    
    // Reload reviews to show updated content
    await loadReviews(labelName, compilationTitle);
    
  } catch (error) {
    console.error('Error deleting review:', error);
    alert('Failed to delete review: ' + error.message);
  }
}

async function toggleLike(reviewId, labelName, compilationTitle) {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    alert('You must be logged in to like reviews.');
    return;
  }

  try {
    const username = currentUser.email.replace("@punkarchives.com", "").toLowerCase();
    
    // Find the proper capitalized username from database
    const usersRef = ref(db, "users");
    const usersSnapshot = await get(usersRef);
    let properUsername = username; // fallback
    
    if (usersSnapshot.exists()) {
      const users = usersSnapshot.val();
      const userEntry = Object.entries(users).find(([key, data]) => data.userId === currentUser.uid);
      if (userEntry) {
        properUsername = userEntry[0]; // This is the properly capitalized username
      }
    }

    const reviewRef = ref(db, `reviews/${reviewId}`);
    const reviewSnapshot = await get(reviewRef);
    
    if (!reviewSnapshot.exists()) {
      alert('Review not found.');
      return;
    }
    
    const review = reviewSnapshot.val();
    const likes = review.likes || {};
    const dislikes = review.dislikes || {};
    
    // Remove from dislikes if present
    if (dislikes[properUsername]) {
      delete dislikes[properUsername];
    }
    
    // Toggle like
    if (likes[properUsername]) {
      delete likes[properUsername];
    } else {
      likes[properUsername] = true;
    }
    
    // Update the review
    await set(ref(db, `reviews/${reviewId}/likes`), likes);
    await set(ref(db, `reviews/${reviewId}/dislikes`), dislikes);
    
    // Reload reviews to update the display
    await loadReviews(labelName, compilationTitle);
    
  } catch (error) {
    console.error('Error toggling like:', error);
    alert('Failed to update like.');
  }
}

async function toggleDislike(reviewId, labelName, compilationTitle) {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    alert('You must be logged in to dislike reviews.');
    return;
  }

  try {
    const username = currentUser.email.replace("@punkarchives.com", "").toLowerCase();
    
    // Find the proper capitalized username from database
    const usersRef = ref(db, "users");
    const usersSnapshot = await get(usersRef);
    let properUsername = username; // fallback
    
    if (usersSnapshot.exists()) {
      const users = usersSnapshot.val();
      const userEntry = Object.entries(users).find(([key, data]) => data.userId === currentUser.uid);
      if (userEntry) {
        properUsername = userEntry[0]; // This is the properly capitalized username
      }
    }

    const reviewRef = ref(db, `reviews/${reviewId}`);
    const reviewSnapshot = await get(reviewRef);
    
    if (!reviewSnapshot.exists()) {
      alert('Review not found.');
      return;
    }
    
    const review = reviewSnapshot.val();
    const likes = review.likes || {};
    const dislikes = review.dislikes || {};
    
    // Remove from likes if present
    if (likes[properUsername]) {
      delete likes[properUsername];
    }
    
    // Toggle dislike
    if (dislikes[properUsername]) {
      delete dislikes[properUsername];
    } else {
      dislikes[properUsername] = true;
    }
    
    // Update the review
    await set(ref(db, `reviews/${reviewId}/likes`), likes);
    await set(ref(db, `reviews/${reviewId}/dislikes`), dislikes);
    
    // Reload reviews to update the display
    await loadReviews(labelName, compilationTitle);
    
  } catch (error) {
    console.error('Error toggling dislike:', error);
    alert('Failed to update dislike.');
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const labelName = urlParams.get("label");
  const compilationTitle = urlParams.get("compilation");

  if (!labelName || !compilationTitle) {
    document.getElementById("compilation-content").innerHTML = "<h1>No label or compilation selected.</h1>";
    return;
  }

  const dbRef = ref(db);
  try {
    const snapshot = await get(child(dbRef, 'labels'));
    if (!snapshot.exists()) {
      document.getElementById("compilation-content").innerHTML = "<h1>Error loading labels.</h1>";
      return;
    }

    const labelsRaw = snapshot.val();
    const labels = Object.entries(labelsRaw).map(([key, val]) => ({ key, ...val }));
    const label = labels.find(l => l.label_name === labelName);

    if (!label) {
      document.getElementById("compilation-content").innerHTML = "<h1>Label not found.</h1>";
      return;
    }

    // Find the specific compilation
    const compilation = label.compilations?.find(c => c.title === compilationTitle);
    
    if (!compilation) {
      document.getElementById("compilation-content").innerHTML = "<h1>Compilation not found.</h1>";
      return;
    }

    // Determine status text based on flag
    let statusText = "";
    if (compilation.flag === "Delete") {
      statusText = ` <span style="color: red; font-weight: bold;">[Marked for Deletion]</span>`;
    } else if (compilation.flag === "Restore") {
      statusText = ` <span style="color: green; font-weight: bold;">[Marked for Restore]</span>`;
    }

    let compilationHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h1 style="display: flex; align-items: center; gap: 10px;">
            <span>${compilation.title}${statusText}</span>
            <a href="label.html?label=${encodeURIComponent(labelName)}" style="font-size: 14px; font-family: Arial;">← Back to ${label.label_name}</a>
            <a href="compilationedit.html?label=${encodeURIComponent(labelName)}&compilation=${encodeURIComponent(compilationTitle)}" style="font-size: 14px; font-family: Arial;">EDIT</a>
          </h1>
        </div>
      </div>

      <hr>
      <h2>Compilation Information</h2>
      
      <div style="display: flex; gap: 20px; margin-bottom: 20px;">
        <div style="flex: 1;">
          <table class="compilation-details" style="border-collapse: collapse; border: 2px solid #aa0000; width: 100%;">
            <tr><td style="border: 1px solid #aa0000; padding: 8px;"><strong>Label:</strong></td><td style="border: 1px solid #aa0000; padding: 8px;"><a href="label.html?label=${encodeURIComponent(labelName)}">${label.label_name}</a></td></tr>
            <tr><td style="border: 1px solid #aa0000; padding: 8px;"><strong>Release Date:</strong></td><td style="border: 1px solid #aa0000; padding: 8px;">${compilation.year || "Unknown"}</td></tr>
            <tr><td style="border: 1px solid #aa0000; padding: 8px;"><strong>Type:</strong></td><td style="border: 1px solid #aa0000; padding: 8px;">${compilation.release_type || "N/A"}</td></tr>
            <tr><td style="border: 1px solid #aa0000; padding: 8px;"><strong>Format:</strong></td><td style="border: 1px solid #aa0000; padding: 8px;">${compilation.physical_format || "N/A"}</td></tr>
            <tr><td style="border: 1px solid #aa0000; padding: 8px;"><strong>Limitation:</strong></td><td style="border: 1px solid #aa0000; padding: 8px;">${compilation.limitation || "N/A"}</td></tr>
            <tr><td style="border: 1px solid #aa0000; padding: 8px;"><strong>Extra Info:</strong></td><td style="border: 1px solid #aa0000; padding: 8px;">${compilation.extra_info || "N/A"}</td></tr>
          </table>
        </div>
        
        <div style="flex: 1;">
          ${compilation.cover_image ? `
            <div style="text-align: center;">
              <img src="${compilation.cover_image}" alt="Compilation Cover" style="max-width: 300px; max-height: 300px; border: 2px solid #aa0000;">
              <br>
              <button class="download-image" data-image="${compilation.cover_image}" style="margin-top: 10px;">Download Image</button>
              <br>
              <button id="collection-btn" style="margin-top: 10px; background-color: #aa0000; color: white; border: none; padding: 8px 16px; cursor: pointer;">
                Loading...
              </button>
            </div>
          ` : `
            <div style="text-align: center;">
              <button id="collection-btn" style="background-color: #aa0000; color: white; border: none; padding: 8px 16px; cursor: pointer;">
                Loading...
              </button>
            </div>
          `}
        </div>
      </div>

      ${compilation.listen ? `
        <div style="margin-bottom: 20px;">
          <button class="listen" onclick="playInMiniPlayer('${compilation.listen}', '${compilation.title}', '${labelName}')" style="background: #aa0000; color: white; border: none; padding: 10px 20px; cursor: pointer; font-size: 16px;">🎵 Listen</button>
        </div>
      ` : ''}

    `;

    // Add tracklist if available
    if (compilation.tracks && Object.keys(compilation.tracks).length > 0) {
      compilationHTML += `<hr><h2>Tracklist</h2>`;
      
      const tracks = Object.entries(compilation.tracks);
      compilationHTML += `<ol style="padding-left: 20px;">`;
      
      tracks.forEach(([index, trackData]) => {
        const trackName = typeof trackData === 'object' ? trackData.name : trackData;
        const lyrics = typeof trackData === 'object' ? trackData.lyrics : '';
        const hasLyrics = lyrics && lyrics.trim() !== '';
        
        compilationHTML += `<li style="margin-bottom: 10px;">
          <strong>${trackName}</strong>`;
        
        if (hasLyrics) {
          compilationHTML += `
            <button class="toggle-lyrics-btn" data-track-index="${index}" style="color: white; border: none; padding: 4px 8px; cursor: pointer; margin-left: 10px;">Show Lyrics</button>
            <div class="lyrics-content" data-track-index="${index}" style="display: none; padding: 10px; border-left: 3px solid #4ecdc4; margin-top: 5px;">
              <strong>Lyrics:</strong>
              <div style="white-space: pre-wrap; margin-top: 5px;">${lyrics}</div>
            </div>`;
        }
        
        compilationHTML += `</li>`;
      });
      
      compilationHTML += `</ol>`;
     }

     // Add extra versions section if available
     if (compilation.extra_versions && Object.keys(compilation.extra_versions).length > 0) {
       compilationHTML += `<hr><h2>Other Versions</h2>`;
       compilationHTML += `<div style="margin-bottom: 20px;">`;
       
       // Sort versions by year (oldest first)
       const sortedVersions = Object.entries(compilation.extra_versions).sort(([,a], [,b]) => {
         const yearA = parseInt(a.year) || 0;
         const yearB = parseInt(b.year) || 0;
         return yearA - yearB;
       });
       
       sortedVersions.forEach(([versionKey, version]) => {
         const versionTitle = `${version.format || 'Unknown Format'} - ${version.year || 'Unknown Year'}`;
         compilationHTML += `
           <div style="border: 1px solid #aa0000; margin-bottom: 10px; background-color: rgba(0,0,0,0.1);">
             <div class="version-header" style="padding: 5px; cursor: pointer; background-color: rgba(170,0,0,0.1);" data-version-key="${versionKey}">
               <h3 style="color: #aa0000; margin: 0; display: flex; align-items: center; justify-content: space-between;">
                 <span>${versionTitle}</span>
                 <span class="version-toggle" style="font-size: 16px;">▼</span>
               </h3>
             </div>
             <div class="version-content" style="display: none; padding: 15px; border-top: 1px solid #aa0000;">
               <table style="width: 100%; border-collapse: collapse;">
                 <tr><td style="border: 1px solid #aa0000; padding: 5px;"><strong>Label:</strong></td><td style="border: 1px solid #aa0000; padding: 5px;">${formatMultipleLabels(version.label)}</td></tr>
                 <tr><td style="border: 1px solid #aa0000; padding: 5px;"><strong>Year:</strong></td><td style="border: 1px solid #aa0000; padding: 5px;">${version.year || "N/A"}</td></tr>
                 <tr><td style="border: 1px solid #aa0000; padding: 5px;"><strong>Limitation:</strong></td><td style="border: 1px solid #aa0000; padding: 5px;">${version.limitation || "N/A"}</td></tr>
                 <tr><td style="border: 1px solid #aa0000; padding: 5px;"><strong>Extra Info:</strong></td><td style="border: 1px solid #aa0000; padding: 5px;">${version.extra_info || "N/A"}</td></tr>
               </table>
               ${version.cover_image ? `<div style="text-align: center; margin-top: 10px;"><img src="${version.cover_image}" alt="${version.format} Cover" style="max-width: 150px; max-height: 150px; border: 1px solid #aa0000;" /></div>` : ''}
             </div>
           </div>
         `;
       });
       
       compilationHTML += `</div>`;
     }

     // Add extra images slideshow if available
     const isTrusted = await isUserTrusted();
     
     if (compilation.extra_images && Array.isArray(compilation.extra_images) && compilation.extra_images.length > 0) {
       compilationHTML += `<hr><h2>Extra Images</h2>`;
       
       compilationHTML += `<div style="text-align: center; margin-bottom: 20px;">
         <div style="position: relative; display: inline-block;">
           <img id="slideshow-image" src="${compilation.extra_images[0]}" alt="Extra Image 1" style="width: 500px; border-radius: 0px; display: block; margin: 0 auto;">
           <button id="prev-image" style="position: absolute; left: 0; top: 50%; transform: translateY(-50%); background: rgba(0, 0, 0, 0.5); color: white; border: none; padding: 10px; cursor: pointer; border-radius: 5px; display: ${compilation.extra_images.length > 1 ? 'block' : 'none'};">&#9665;</button>
           <button id="next-image" style="position: absolute; right: 0; top: 50%; transform: translateY(-50%); background: rgba(0, 0, 0, 0.5); color: white; border: none; padding: 10px; cursor: pointer; border-radius: 5px; display: ${compilation.extra_images.length > 1 ? 'block' : 'none'};">&#9655;</button>
         </div>
         <div style="margin-top: 10px;">
           <span id="image-counter">1 of ${compilation.extra_images.length}</span>
         </div>
         ${isTrusted ? `<button id="edit-extra-images" style="margin-top: 10px; background: #aa0000; color: white; border: none; padding: 8px 16px; cursor: pointer;">✏️ Edit Images</button>` : ''}
       </div>`;
     } else if (isTrusted) {
       compilationHTML += `<hr><h2>Extra Images</h2>
         <p>No extra images available.</p>
         <button id="add-extra-images" style="background: #aa0000; color: white; border: none; padding: 8px 16px; cursor: pointer;">➕ Add Images</button>`;
     }

     // Apply background image if available
    if (label.backgroundimg) {
      document.body.style.backgroundImage = `url(${label.backgroundimg})`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center';
      document.body.style.backgroundRepeat = 'repeat';
      
      // Check if image has 1:1 aspect ratio to avoid fixed attachment (PC only)
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      if (isMobile) {
        // Mobile users always get fixed attachment
        document.body.style.backgroundAttachment = 'fixed';
      } else {
        // PC users: check aspect ratio
        const img = new Image();
        img.onload = function() {
          const aspectRatio = this.width / this.height;
          // If aspect ratio is close to 1:1 (within 0.1 tolerance), don't set fixed attachment
          if (Math.abs(aspectRatio - 1) > 0.1) {
            document.body.style.backgroundAttachment = 'fixed';
          }
        };
        img.src = label.backgroundimg;
      }
         }

    // Add reviews section
    compilationHTML += `<hr><h2>User Reviews</h2>`;
    
    // Add review submission form for logged-in users
    const currentUser = auth.currentUser;
    if (currentUser) {
      compilationHTML += `
        <div style="border: 1px solid #aa0000; padding: 15px; margin-bottom: 20px; background-color: rgba(0,0,0,0.3);">
          <h3>Write a Review</h3>
          <form id="review-form">
            <div style="margin-bottom: 10px;">
              <label for="review-rating" style="display: block; margin-bottom: 5px;">Rating (1-10):</label>
              <input type="number" id="review-rating" min="1" max="10" required style="width: 80px; padding: 5px;">
            </div>
            <div style="margin-bottom: 10px;">
              <label for="review-text" style="display: block; margin-bottom: 5px;">Review:</label>
              <textarea id="review-text" rows="4" cols="50" required style="width: 100%; padding: 5px; resize: vertical;"></textarea>
            </div>
            <button type="submit" style="background-color: #aa0000; color: white; border: none; padding: 8px 16px; cursor: pointer;">Submit Review</button>
          </form>
        </div>
      `;
    }

    // Add reviews display area
    compilationHTML += `<div id="reviews-container"></div>`;

    document.getElementById("compilation-content").innerHTML = compilationHTML;

    // Add event listeners for download image buttons
    document.querySelectorAll(".download-image").forEach(button => {
      button.addEventListener("click", function () {
        const imageUrl = this.getAttribute("data-image");
        if (imageUrl) {
          const link = document.createElement("a");
          link.href = imageUrl;
          link.download = imageUrl.split("/").pop();
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      });
    });

         // Add event listeners for toggle lyrics buttons
     document.querySelectorAll(".toggle-lyrics-btn").forEach(button => {
       button.addEventListener("click", () => {
         const trackIndex = button.getAttribute("data-track-index");
         const lyricsContent = document.querySelector('.lyrics-content[data-track-index="' + trackIndex + '"]');
         const isVisible = lyricsContent.style.display !== 'none';
         
         if (isVisible) {
           lyricsContent.style.display = 'none';
           button.textContent = 'Show Lyrics';
         } else {
           lyricsContent.style.display = 'block';
           button.textContent = 'Hide Lyrics';
         }
       });
     });

     // Add slideshow functionality for extra images
     if (compilation.extra_images && Array.isArray(compilation.extra_images) && compilation.extra_images.length > 0) {
       let currentImageIndex = 0;
       const slideshowImage = document.getElementById('slideshow-image');
       const prevButton = document.getElementById('prev-image');
       const nextButton = document.getElementById('next-image');
       const imageCounter = document.getElementById('image-counter');

       function updateSlideshow() {
         slideshowImage.src = compilation.extra_images[currentImageIndex];
         slideshowImage.alt = `Extra Image ${currentImageIndex + 1}`;
         imageCounter.textContent = `${currentImageIndex + 1} of ${compilation.extra_images.length}`;
         
         prevButton.style.display = currentImageIndex > 0 ? 'block' : 'none';
         nextButton.style.display = currentImageIndex < compilation.extra_images.length - 1 ? 'block' : 'none';
       }

       if (prevButton) {
         prevButton.addEventListener('click', () => {
           if (currentImageIndex > 0) {
             currentImageIndex--;
             updateSlideshow();
           }
         });
       }

       if (nextButton) {
         nextButton.addEventListener('click', () => {
           if (currentImageIndex < compilation.extra_images.length - 1) {
             currentImageIndex++;
             updateSlideshow();
           }
         });
       }
     }

     // Add event listeners for trusted user editing
     if (isTrusted) {
       const editButton = document.getElementById('edit-extra-images');
       const addButton = document.getElementById('add-extra-images');
       
       if (editButton) {
         editButton.addEventListener('click', () => {
           const currentImages = compilation.extra_images || [];
           const imageUrls = prompt('Enter image URLs separated by commas:', currentImages.join(', '));
           
           if (imageUrls !== null) {
             const newImages = imageUrls.split(',').map(url => url.trim()).filter(url => url.length > 0);
             
             // Find the compilation index in the label's compilations array
             const compilationIndex = label.compilations.findIndex(c => c.title === compilationTitle);
             
             if (compilationIndex !== -1) {
               // Update the compilation with new images
               const updatedCompilation = { ...compilation, extra_images: newImages };
               const updatedCompilations = [...label.compilations];
               updatedCompilations[compilationIndex] = updatedCompilation;
               
               set(ref(db, `labels/${label.key}/compilations`), updatedCompilations)
                 .then(() => {
                   location.reload();
                 })
                 .catch(err => {
                   alert('Failed to update images: ' + err.message);
                 });
             }
           }
         });
       }
       
       if (addButton) {
         addButton.addEventListener('click', () => {
           const imageUrls = prompt('Enter image URLs separated by commas:');
           
           if (imageUrls !== null) {
             const newImages = imageUrls.split(',').map(url => url.trim()).filter(url => url.length > 0);
             
             // Find the compilation index in the label's compilations array
             const compilationIndex = label.compilations.findIndex(c => c.title === compilationTitle);
             
             if (compilationIndex !== -1) {
               // Update the compilation with new images
               const updatedCompilation = { ...compilation, extra_images: newImages };
               const updatedCompilations = [...label.compilations];
               updatedCompilations[compilationIndex] = updatedCompilation;
               
               set(ref(db, `labels/${label.key}/compilations`), updatedCompilations)
                 .then(() => {
                   location.reload();
                 })
                 .catch(err => {
                   alert('Failed to add images: ' + err.message);
                 });
             }
           }
         });
       }
     }

    // Add event listeners for version toggle functionality
    document.querySelectorAll(".version-header").forEach(header => {
      header.addEventListener("click", () => {
        const content = header.nextElementSibling;
        const toggle = header.querySelector(".version-toggle");
        const isVisible = content.style.display !== "none";
        
        if (isVisible) {
          content.style.display = "none";
          toggle.textContent = "▼";
        } else {
          content.style.display = "block";
          toggle.textContent = "▲";
        }
      });
    });

    // Load and display reviews
    await loadReviews(labelName, compilationTitle);

    // Setup collection button
    const collectionBtn = document.getElementById('collection-btn');
    if (collectionBtn && currentUser) {
      const username = currentUser.email.replace("@punkarchives.com", "").toLowerCase();
      
      // Find the proper capitalized username from database
      const usersRef = ref(db, "users");
      const usersSnapshot = await get(usersRef);
      let properUsername = username; // fallback
      
      if (usersSnapshot.exists()) {
        const users = usersSnapshot.val();
        const userEntry = Object.entries(users).find(([key, data]) => data.userId === currentUser.uid);
        if (userEntry) {
          properUsername = userEntry[0]; // This is the properly capitalized username
        }
      }
      
      const compilationId = await getCompilationId(labelName, compilationTitle);
      
      if (compilationId !== null) {
        const inCollection = await isInCollection(properUsername, labelName, compilationId);
        
        if (inCollection) {
          collectionBtn.textContent = 'Remove from Collection';
          collectionBtn.style.backgroundColor = '#cc0000';
        } else {
          collectionBtn.textContent = 'Add to Collection';
          collectionBtn.style.backgroundColor = '#aa0000';
        }
        
        collectionBtn.addEventListener('click', async () => {
          const currentInCollection = await isInCollection(properUsername, labelName, compilationId);
          
          if (currentInCollection) {
            const success = await removeFromCollection(properUsername, labelName, compilationId);
            if (success) {
              collectionBtn.textContent = 'Add to Collection';
              collectionBtn.style.backgroundColor = '#aa0000';
            }
          } else {
            const success = await addToCollection(properUsername, labelName, compilationId, compilationTitle, compilation.year);
            if (success) {
              collectionBtn.textContent = 'Remove from Collection';
              collectionBtn.style.backgroundColor = '#cc0000';
            }
          }
        });
      } else {
        collectionBtn.textContent = 'Collection Unavailable';
        collectionBtn.disabled = true;
        collectionBtn.style.backgroundColor = '#666';
      }
    } else if (collectionBtn) {
      collectionBtn.textContent = 'Login to Use Collection';
      collectionBtn.disabled = true;
      collectionBtn.style.backgroundColor = '#666';
    }

    // Add event listener for review form submission
    const reviewForm = document.getElementById('review-form');
    if (reviewForm) {
      reviewForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const rating = parseInt(document.getElementById('review-rating').value);
        const reviewText = document.getElementById('review-text').value.trim();
        
        if (!currentUser) {
          alert('You must be logged in to submit a review.');
          return;
        }
        
        if (rating < 1 || rating > 10) {
          alert('Rating must be between 1 and 10.');
          return;
        }
        
        if (reviewText.length === 0) {
          alert('Please enter a review.');
          return;
        }
        
        try {
          // Get current username
          const username = currentUser.email.replace("@punkarchives.com", "");
          
          // Get next review ID
          const reviewsRef = ref(db, 'reviews');
          const reviewsSnapshot = await get(reviewsRef);
          let nextId = 0;
          
          if (reviewsSnapshot.exists()) {
            const reviews = reviewsSnapshot.val();
            const existingIds = Object.keys(reviews).map(id => parseInt(id));
            nextId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 0;
          }
          
          // Create review object
          const review = {
            user: username,
            rating: rating,
            review: reviewText,
            label: labelName,
            compilation: compilationTitle,
            timestamp: new Date().toISOString()
          };
          
          // Save review to Firebase
          await set(ref(db, `reviews/${nextId}`), review);
          
          // Clear form
          document.getElementById('review-rating').value = '';
          document.getElementById('review-text').value = '';
          
          // Reload reviews
          await loadReviews(labelName, compilationTitle);
          
        } catch (error) {
          console.error('Error submitting review:', error);
          alert('Failed to submit review: ' + error.message);
        }
      });
    }

    // Add Discogs import functionality
    const discogsImportBtn = document.getElementById('discogs-import-btn');
    if (discogsImportBtn) {
      discogsImportBtn.addEventListener('click', async () => {
        try {
          // Check if user is trusted
          const isTrusted = true
          if (!isTrusted) {
            alert('You must be a trusted user to import data from Discogs.');
            return;
          }

          // Prompt for Discogs URL
          const discogsUrl = prompt('Enter Discogs release URL or ID:');
          if (!discogsUrl) return;

          const statusSpan = document.getElementById('discogs-import-status');
          statusSpan.textContent = 'Importing...';
          discogsImportBtn.disabled = true;

          try {
            // Import data from Discogs
            const importedData = await window.discogsImport.importFromDiscogs(discogsUrl);
            
            // Update the compilation in Firebase
            if (window.discogsImport.updateCompilationInFirebase) {
              await window.discogsImport.updateCompilationInFirebase(labelName, compilationTitle, importedData);
            } else if (window.discogsImport.updateReleaseInFirebase) {
              // fallback if older naming used in your import library
              await window.discogsImport.updateReleaseInFirebase(labelName, compilationTitle, importedData);
            }
            
            statusSpan.textContent = 'Import successful! Refreshing page...';
            statusSpan.style.color = '#4ecdc4';
            
            // Refresh the page to show updated data
            setTimeout(() => {
              window.location.reload();
            }, 1500);
            
          } catch (error) {
            statusSpan.textContent = `Import failed: ${error.message}`;
            statusSpan.style.color = '#ff6b6b';
            discogsImportBtn.disabled = false;
          }
        } catch (error) {
          console.error('Discogs import error:', error);
          alert('Error setting up Discogs import: ' + error.message);
        }
      });
    }

  } catch (err) {
    console.error("Firebase error:", err);
    document.getElementById("compilation-content").innerHTML = "<h1>Error loading compilation data.</h1>";
  }
});
