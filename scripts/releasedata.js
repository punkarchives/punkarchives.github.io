// yes firebase api keys are meant to be public
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-auth.js";
import { getDatabase, ref, set, get, child, push } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-database.js";

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

async function logChange(db, bandKey, field, oldValue, newValue) {
  const user = auth.currentUser;
  let username = "unknown";

  if (user && user.email) {
    username = user.email.replace("@punkarchives.com", "");
  }

  const logEntry = {
    bandKey,
    field,
    oldValue,
    newValue,
    username,
    timestamp: new Date().toISOString()
  };

  try {
    await push(ref(db, `logs/${bandKey}`), logEntry);
    console.log("Change logged:", logEntry);
  } catch (error) {
    console.error("Logging error:", error);
  }
}

async function getReleaseId(bandName, releaseTitle) {
  try {
    const bandsRef = ref(db, 'bands');
    const bandsSnapshot = await get(bandsRef);
    
    if (!bandsSnapshot.exists()) {
      return null;
    }
    
    const bands = Object.entries(bandsSnapshot.val()).map(([key, val]) => ({ key, ...val }));
    const band = bands.find(b => b.band_name === bandName);
    
    if (!band || !band.releases) {
      return null;
    }
    
    const releaseIndex = band.releases.findIndex(r => r.title === releaseTitle);
    return releaseIndex !== -1 ? releaseIndex : null;
  } catch (error) {
    console.error('Error getting release ID:', error);
    return null;
  }
}

async function isInCollection(username, bandName, releaseId) {
  try {
    const collectionRef = ref(db, `users/${username}/collection`);
    const collectionSnapshot = await get(collectionRef);
    
    if (!collectionSnapshot.exists()) {
      return false;
    }
    
    const collection = collectionSnapshot.val();
    return Object.values(collection).some(item => 
      item.band === bandName && item.releaseId === releaseId
    );
  } catch (error) {
    console.error('Error checking collection:', error);
    return false;
  }
}

async function addToCollection(username, bandName, releaseId, releaseTitle, releaseYear) {
  try {
    const collectionRef = ref(db, `users/${username}/collection`);
    const collectionSnapshot = await get(collectionRef);
    
    let collection = collectionSnapshot.exists() ? collectionSnapshot.val() : {};
    const collectionId = Object.keys(collection).length;
    
    collection[collectionId] = {
      band: bandName,
      releaseId: releaseId,
      releaseTitle: releaseTitle,
      releaseYear: releaseYear || "Unknown"
    };
    
    await set(collectionRef, collection);
    return true;
  } catch (error) {
    console.error('Error adding to collection:', error);
    return false;
  }
}

async function removeFromCollection(username, bandName, releaseId) {
  try {
    const collectionRef = ref(db, `users/${username}/collection`);
    const collectionSnapshot = await get(collectionRef);
    
    if (!collectionSnapshot.exists()) {
      return false;
    }
    
    const collection = collectionSnapshot.val();
    const entryToRemove = Object.entries(collection).find(([key, item]) => 
      item.band === bandName && item.releaseId === releaseId
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

async function loadReviews(bandName, releaseTitle) {
  try {
    const reviewsRef = ref(db, 'reviews');
    const reviewsSnapshot = await get(reviewsRef);
    
    const reviewsContainer = document.getElementById('reviews-container');
    
    if (!reviewsSnapshot.exists()) {
      reviewsContainer.innerHTML = '<p>No reviews yet. Be the first to review this release!</p>';
      return;
    }
    
    const allReviews = reviewsSnapshot.val();
    const releaseReviews = Object.values(allReviews).filter(review => 
      review.band === bandName && review.release === releaseTitle
    );
    
    if (releaseReviews.length === 0) {
      reviewsContainer.innerHTML = '<p>No reviews yet. Be the first to review this release!</p>';
      return;
    }
    
    // Sort reviews by timestamp (newest first)
    releaseReviews.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Get unique usernames to fetch profile pictures
    const uniqueUsers = [...new Set(releaseReviews.map(review => review.user))];
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
    releaseReviews.forEach((review, index) => {
      const date = new Date(review.timestamp).toLocaleDateString();
      const profilePicture = userProfilePictures[review.user];
      
      // Create profile picture HTML
      const profilePictureHTML = profilePicture 
        ? `<img src="${profilePicture}" alt="${review.user}'s profile picture" style="width: 30px; height: 30px; border-radius: 50%; border: 1px solid #aa0000; margin-right: 8px; object-fit: cover;" />`
        : `<div style="width: 30px; height: 30px; border-radius: 50%; border: 1px solid #aa0000; margin-right: 8px; background-color: #333; display: flex; align-items: center; justify-content: center; color: #666; font-size: 12px;">N/A</div>`;
      
      reviewsHTML += `
        <div style="border: 1px solid #ccc; margin-bottom: 15px; padding: 10px; background-color: rgba(0,0,0,0.2);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <div style="display: flex; align-items: center;">
              ${profilePictureHTML}
              <div>
                <strong><a href="user.html?user=${encodeURIComponent(review.user)}" style="color: #aa0000; text-decoration: none;">${review.user}</a></strong> - ${review.rating}/10
              </div>
            </div>
            <div style="color: #666; font-size: 12px;">
              ${date}
            </div>
          </div>
          <div style="white-space: pre-wrap;">${review.review}</div>
        </div>
      `;
    });
    
    reviewsContainer.innerHTML = reviewsHTML;
  } catch (error) {
    console.error('Error loading reviews:', error);
    document.getElementById('reviews-container').innerHTML = '<p>Error loading reviews.</p>';
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const bandName = urlParams.get("band");
  const releaseTitle = urlParams.get("release");

  if (!bandName || !releaseTitle) {
    document.getElementById("release-content").innerHTML = "<h1>No band or release selected.</h1>";
    return;
  }

  const dbRef = ref(db);
  try {
    const snapshot = await get(child(dbRef, 'bands'));
    if (!snapshot.exists()) {
      document.getElementById("release-content").innerHTML = "<h1>Error loading bands.</h1>";
      return;
    }

    const bandsRaw = snapshot.val();
    const bands = Object.entries(bandsRaw).map(([key, val]) => ({ key, ...val }));
    const band = bands.find(b => b.band_name === bandName);

    if (!band) {
      document.getElementById("release-content").innerHTML = "<h1>Band not found.</h1>";
      return;
    }

    // Find the specific release
    const release = band.releases?.find(r => r.title === releaseTitle);
    
    if (!release) {
      document.getElementById("release-content").innerHTML = "<h1>Release not found.</h1>";
      return;
    }

    // Determine status text based on flag
    let statusText = "";
    if (release.flag === "Delete") {
      statusText = ` <span style="color: red; font-weight: bold;">[Marked for Deletion]</span>`;
    } else if (release.flag === "Restore") {
      statusText = ` <span style="color: green; font-weight: bold;">[Marked for Restore]</span>`;
    }

    let releaseHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h1 style="display: flex; align-items: center; gap: 10px;">
            <span>${release.title}${statusText}</span>
            <a href="band.html?band=${encodeURIComponent(bandName)}" style="font-size: 14px; font-family: Arial;">← Back to ${band.band_name}</a>
          </h1>
        </div>
      </div>

      <hr>
      <h2>Release Information</h2>
      
      <div style="display: flex; gap: 20px; margin-bottom: 20px;">
        <div style="flex: 1;">
          <table class="release-details" style="border-collapse: collapse; border: 2px solid #aa0000; width: 100%;">
            <tr><td style="border: 1px solid #aa0000; padding: 8px;"><strong>Band:</strong></td><td style="border: 1px solid #aa0000; padding: 8px;"><a href="band.html?band=${encodeURIComponent(bandName)}">${band.band_name}</a></td></tr>
            <tr><td style="border: 1px solid #aa0000; padding: 8px;"><strong>Label:</strong></td><td style="border: 1px solid #aa0000; padding: 8px;">${release.label ? `<a href="label.html?label=${encodeURIComponent(release.label)}">${release.label}</a>` : "N/A"}</td></tr>
            <tr><td style="border: 1px solid #aa0000; padding: 8px;"><strong>Release Date:</strong></td><td style="border: 1px solid #aa0000; padding: 8px;">${release.year || "Unknown"}</td></tr>
            <tr><td style="border: 1px solid #aa0000; padding: 8px;"><strong>Type:</strong></td><td style="border: 1px solid #aa0000; padding: 8px;">${release.release_type || "N/A"}</td></tr>
            <tr><td style="border: 1px solid #aa0000; padding: 8px;"><strong>Format:</strong></td><td style="border: 1px solid #aa0000; padding: 8px;">${release.physical_format || "N/A"}</td></tr>
            <tr><td style="border: 1px solid #aa0000; padding: 8px;"><strong>Limitation:</strong></td><td style="border: 1px solid #aa0000; padding: 8px;">${release.limitation || "N/A"}</td></tr>
            <tr><td style="border: 1px solid #aa0000; padding: 8px;"><strong>Extra Info:</strong></td><td style="border: 1px solid #aa0000; padding: 8px;">${release.extra_info || "N/A"}</td></tr>
          </table>
        </div>
        
        <div style="flex: 1;">
          ${release.cover_image ? `
            <div style="text-align: center;">
              <img src="${release.cover_image}" alt="Album Cover" style="max-width: 300px; max-height: 300px; border: 2px solid #aa0000;">
              <br>
              <button class="download-image" data-image="${release.cover_image}" style="margin-top: 10px;">Download Image</button>
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

      ${release.listen ? `
        <div style="margin-bottom: 20px;">
          <button class="listen" onclick="window.open('${release.listen}', '_blank')" style="background: #aa0000; color: white; border: none; padding: 10px 20px; cursor: pointer; font-size: 16px;">🎵 Listen</button>
        </div>
      ` : ''}

 
    `;

    // Add tracklist if available
    if (release.tracks && Object.keys(release.tracks).length > 0) {
      releaseHTML += `<hr><h2>Tracklist</h2>`;
      
      const tracks = Object.entries(release.tracks);
      releaseHTML += `<ol style="padding-left: 20px;">`;
      
      tracks.forEach(([index, trackData]) => {
        const trackName = typeof trackData === 'object' ? trackData.name : trackData;
        const lyrics = typeof trackData === 'object' ? trackData.lyrics : '';
        const hasLyrics = lyrics && lyrics.trim() !== '';
        
        releaseHTML += `<li style="margin-bottom: 10px;">
          <strong>${trackName}</strong>`;
        
        if (hasLyrics) {
          releaseHTML += `
            <button class="toggle-lyrics-btn" data-track-index="${index}" style="color: white; border: none; padding: 4px 8px; cursor: pointer; margin-left: 10px;">Show Lyrics</button>
            <div class="lyrics-content" data-track-index="${index}" style="display: none; padding: 10px; border-left: 3px solid #4ecdc4; margin-top: 5px;">
              <strong>Lyrics:</strong>
              <div style="white-space: pre-wrap; margin-top: 5px;">${lyrics}</div>
            </div>`;
        }
        
        releaseHTML += `</li>`;
      });
      
             releaseHTML += `</ol>`;
     }

     // Add extra images slideshow if available
     const isTrusted = await isUserTrusted();
     
     if (release.extra_images && Array.isArray(release.extra_images) && release.extra_images.length > 0) {
       releaseHTML += `<hr><h2>Extra Images</h2>`;
       
       releaseHTML += `<div style="text-align: center; margin-bottom: 20px;">
         <div style="position: relative; display: inline-block;">
           <img id="slideshow-image" src="${release.extra_images[0]}" alt="Extra Image 1" style="width: 500px; border-radius: 0px; display: block; margin: 0 auto;">
           <button id="prev-image" style="position: absolute; left: 0; top: 50%; transform: translateY(-50%); background: rgba(0, 0, 0, 0.5); color: white; border: none; padding: 10px; cursor: pointer; border-radius: 5px; display: ${release.extra_images.length > 1 ? 'block' : 'none'};">&#9665;</button>
           <button id="next-image" style="position: absolute; right: 0; top: 50%; transform: translateY(-50%); background: rgba(0, 0, 0, 0.5); color: white; border: none; padding: 10px; cursor: pointer; border-radius: 5px; display: ${release.extra_images.length > 1 ? 'block' : 'none'};">&#9655;</button>
         </div>
         <div style="margin-top: 10px;">
           <span id="image-counter">1 of ${release.extra_images.length}</span>
         </div>
         ${isTrusted ? `<button id="edit-extra-images" style="margin-top: 10px; background: #aa0000; color: white; border: none; padding: 8px 16px; cursor: pointer;">✏️ Edit Images</button>` : ''}
       </div>`;
     } else if (isTrusted) {
       releaseHTML += `<hr><h2>Extra Images</h2>
         <p>No extra images available.</p>
         <button id="add-extra-images" style="background: #aa0000; color: white; border: none; padding: 8px 16px; cursor: pointer;">➕ Add Images</button>`;
     }

     // Apply background image if available
    if (band.backgroundimg) {
      document.body.style.backgroundImage = `url(${band.backgroundimg})`;
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
        img.src = band.backgroundimg;
      }
         }

    // Add reviews section
    releaseHTML += `<hr><h2>User Reviews</h2>`;
    
    // Add review submission form for logged-in users
    const currentUser = auth.currentUser;
    if (currentUser) {
      releaseHTML += `
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
    releaseHTML += `<div id="reviews-container"></div>`;

    document.getElementById("release-content").innerHTML = releaseHTML;

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
     if (release.extra_images && Array.isArray(release.extra_images) && release.extra_images.length > 0) {
       let currentImageIndex = 0;
       const slideshowImage = document.getElementById('slideshow-image');
       const prevButton = document.getElementById('prev-image');
       const nextButton = document.getElementById('next-image');
       const imageCounter = document.getElementById('image-counter');

       function updateSlideshow() {
         slideshowImage.src = release.extra_images[currentImageIndex];
         slideshowImage.alt = `Extra Image ${currentImageIndex + 1}`;
         imageCounter.textContent = `${currentImageIndex + 1} of ${release.extra_images.length}`;
         
         prevButton.style.display = currentImageIndex > 0 ? 'block' : 'none';
         nextButton.style.display = currentImageIndex < release.extra_images.length - 1 ? 'block' : 'none';
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
           if (currentImageIndex < release.extra_images.length - 1) {
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
           const currentImages = release.extra_images || [];
           const imageUrls = prompt('Enter image URLs separated by commas:', currentImages.join(', '));
           
           if (imageUrls !== null) {
             const newImages = imageUrls.split(',').map(url => url.trim()).filter(url => url.length > 0);
             
             // Find the release index in the band's releases array
             const releaseIndex = band.releases.findIndex(r => r.title === releaseTitle);
             
             if (releaseIndex !== -1) {
               // Update the release with new images
               const updatedRelease = { ...release, extra_images: newImages };
               const updatedReleases = [...band.releases];
               updatedReleases[releaseIndex] = updatedRelease;
               
               set(ref(db, `bands/${band.key}/releases`), updatedReleases)
                 .then(() => {
                   alert('Extra images updated successfully!');
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
             
             // Find the release index in the band's releases array
             const releaseIndex = band.releases.findIndex(r => r.title === releaseTitle);
             
             if (releaseIndex !== -1) {
               // Update the release with new images
               const updatedRelease = { ...release, extra_images: newImages };
               const updatedReleases = [...band.releases];
               updatedReleases[releaseIndex] = updatedRelease;
               
               set(ref(db, `bands/${band.key}/releases`), updatedReleases)
                 .then(() => {
                   alert('Extra images added successfully!');
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

    // Load and display reviews
    await loadReviews(bandName, releaseTitle);

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
      
      const releaseId = await getReleaseId(bandName, releaseTitle);
      
      if (releaseId !== null) {
        const inCollection = await isInCollection(properUsername, bandName, releaseId);
        
        if (inCollection) {
          collectionBtn.textContent = 'Remove from Collection';
          collectionBtn.style.backgroundColor = '#cc0000';
        } else {
          collectionBtn.textContent = 'Add to Collection';
          collectionBtn.style.backgroundColor = '#aa0000';
        }
        
        collectionBtn.addEventListener('click', async () => {
          const currentInCollection = await isInCollection(properUsername, bandName, releaseId);
          
          if (currentInCollection) {
            const success = await removeFromCollection(properUsername, bandName, releaseId);
            if (success) {
              collectionBtn.textContent = 'Add to Collection';
              collectionBtn.style.backgroundColor = '#aa0000';
            }
          } else {
            const success = await addToCollection(properUsername, bandName, releaseId, releaseTitle, release.year);
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
            band: bandName,
            release: releaseTitle,
            timestamp: new Date().toISOString()
          };
          
          // Save review to Firebase
          await set(ref(db, `reviews/${nextId}`), review);
          
          // Clear form
          document.getElementById('review-rating').value = '';
          document.getElementById('review-text').value = '';
          
          // Reload reviews
          await loadReviews(bandName, releaseTitle);
          
          alert('Review submitted successfully!');
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
          const isTrusted = await isUserTrusted();
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
            
            // Update the release in Firebase
            await window.discogsImport.updateReleaseInFirebase(bandName, releaseTitle, importedData);
            
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
    document.getElementById("release-content").innerHTML = "<h1>Error loading release data.</h1>";
  }
}); 