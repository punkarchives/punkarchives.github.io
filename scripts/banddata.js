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

document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const bandName = urlParams.get("band");
  const bandName2 = urlParams.get("band");




  if (!bandName) {
    document.getElementById("band-content").innerHTML = "<h1>No band selected.</h1>";
    return;
  }

  const dbRef = ref(db);
  try {
    const snapshot = await get(child(dbRef, 'bands'));
    if (!snapshot.exists()) {
      document.getElementById("band-content").innerHTML = "<h1>Error loading bands.</h1>";
      return;
    }

    const bandsRaw = snapshot.val();
    const bands = Object.entries(bandsRaw).map(([key, val]) => ({ key, ...val }));
    const band = bands.find(b => b.band_name === bandName);

    if (!band) {
      document.getElementById("band-content").innerHTML = "<h1>Band not found.</h1>";
      return;
    }

    function createEditableField(fieldKey, value, bandKey) {
      return `
        <p data-key="${fieldKey}" data-band="${bandKey}">
          <strong>${fieldKey.replace("_", " ")}:</strong>
          <span class="editable-value">${value}</span>
        </p>
      `;
    }

    let bandHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h1 style="display: flex; align-items: center; gap: 10px;">
  <span>${band.band_name}</span>
  <a href="bandedit.html?band=${encodeURIComponent(bandName2)}" style="font-size: 14px; font-family: Arial;">EDIT</a>
  <button id="flag-incomplete-btn" style="margin-left: auto; background-color: #aa0000; color: white; border: none; padding: 4px 8px; cursor: pointer;">
    ${band.flag === "Incomplete" ? "Remove Incomplete/Outdated Flag" : "Flag as Incomplete/Outdated"}
  </button>
</h1>



	  ${createEditableField("Genres", band.Genres, band.key)}
          ${createEditableField("Location", band.Location, band.key)}
          ${createEditableField("Years_Active", band.Years_Active, band.key)}
          ${createEditableField("Description", band.Description, band.key)}
	  ${createEditableField("Related_Bands", band.Related_Bands, band.key)}
          ${band.official_links ? `
            <p><strong>Links:</strong></p>
            <ul>
              ${Object.entries(band.official_links).map(([key, url]) => `<li><a href="${url}" target="_blank">${key}</a></li>`).join("")}
            </ul>
          ` : ""}
        </div>
        <div>
          ${band.bandpic ? `<img src="${band.bandpic}" alt="${band.band_name}" style="max-width: 200px; height: auto;" />` : ""}
          ${band.logo ? `<img src="${band.logo}" alt="${band.band_name} Logo" style="max-width: 200px; height: auto;" />` : ""}
        </div>
      </div>
    `;
if (band.notes) {
  const allowedStatuses = ["Firsthand", "Secondhand", "Rumor"];

  const validNotes = Object.values(band.notes).filter(note =>
    allowedStatuses.includes(note.status)
  );

  if (validNotes.length > 0) {
    bandHTML += `<hr><h2>Community Notes</h2><div id="community-notes">`;

    validNotes.forEach((note, idx) => {
      bandHTML += `
        <div class="note-item">
          <button class="note-toggle" data-index="${idx}">${note.title}</button>
          <div class="note-content" id="note-content-${idx}" style="display: none; border: 1px solid #ccc; padding: 5px; margin-top: 5px;">
            <p><strong>Submitted by:</strong> ${note.user || "Unknown"}</p>
            <p><strong>Status:</strong> ${note.status}</p>
            <p><strong>Note:</strong><br>${note.text}</p>
          </div>
        </div>`;
    });

    bandHTML += `</div>`;
  }
}
const membersArray = band.members ? Object.values(band.members) : [];

if (membersArray.length) {
  // Categorize members by status
  const categorizedMembers = {
    "Current": [],
    "Last Known Lineup": [],
    "Former": []
  };

  membersArray.forEach(member => {
    if (categorizedMembers[member.status]) {
      categorizedMembers[member.status].push(member);
    }
  });

  bandHTML += `<hr><h2>Band Members</h2>
    <table border="1" style="border-collapse: collapse; width: 100%; text-align: left; border: 2px #aa0000;">
      <tr>
        <th>Name</th><th>Real Name</th><th>Instrument</th><th>Time Active</th><th>Status</th>
      </tr>`;

  ["Current", "Last Known Lineup", "Former"].forEach(status => {
    categorizedMembers[status].forEach(member => {
const cleanStatus = member.status?.trim().normalize("NFKC");

if (categorizedMembers[cleanStatus]) {
  categorizedMembers[cleanStatus].push(member);
}

      // Use real_name for the link if available, otherwise use the display name
      const linkName = member.real_name && member.real_name !== "undefined" && member.real_name !== "N/A" 
        ? member.real_name 
        : member.name;
      
      bandHTML += `
        <tr>
          <td><a href="member.html?member=${encodeURIComponent(linkName)}" style="color: white; text-decoration: underline;">${member.name}</a></td>
          <td>${member.real_name || "N/A"}</td>
          <td>${member.instrument}</td>
          <td>${member.time_active || "N/A"}</td>
          <td>${member.status}</td>
        </tr>`;
    });
  });

  bandHTML += `</table>`;
}

if (band.releases?.length) {
  // Sort releases from oldest to newest by release.year
  const sortedReleases = [...band.releases].sort((a, b) => {
    const yearA = parseInt(a.year) || 0;
    const yearB = parseInt(b.year) || 0;
    return yearA - yearB;
  });

  bandHTML += `<hr><h2>Discography</h2><p>Note: Hover your mouse over an album title to see the album art.<br>Click on an album title for more details such as lyrics or extra images.</p>`;

  sortedReleases.forEach((release, index) => {
    // Determine status text based on flag
    let statusText = "";
    if (release.flag === "Delete") {
      statusText = ` <span style="color: red; font-weight: bold;">[Marked for Deletion]</span>`;
    } else if (release.flag === "Restore") {
      statusText = ` <span style="color: green; font-weight: bold;">[Marked for Restore]</span>`;
    }

    bandHTML += `
      <div style="margin-bottom: 10px;">
        <u>
          <h3 class="release-title" data-image="${release.cover_image}" style="margin-bottom: 5px; cursor: pointer; display: inline-block;">
            <a href="release.html?band=${encodeURIComponent(bandName)}&release=${encodeURIComponent(release.title)}" style="color: inherit; text-decoration: inherit;">
              ${release.title}${statusText}
            </a>
          </h3>
        </u>
        <button class="collection-btn" data-band="${bandName}" data-release="${release.title}" data-year="${release.year}" style="margin-left: 10px; background-color: #aa0000; color: white; border: none; padding: 4px 8px; cursor: pointer;">Loading...</button>
        ${release.listen ? `<button class="listen" style="margin-left: 10px;" onclick="window.open('${release.listen}', '_blank')">Listen</button>` : ""}
        <table class="release-details" style="border-collapse: collapse; border: 2px solid #aa0000;">
          <tr><td style="border: 1px solid #aa0000;"><strong>Label:</strong></td><td style="border: 1px solid #aa0000;">${release.label ? `<a href="label.html?label=${encodeURIComponent(release.label)}">${release.label}</a>` : "N/A"}</td></tr>
          <tr><td style="border: 1px solid #aa0000;"><strong>Release Date:</strong></td><td style="border: 1px solid #aa0000;">${release.year || "Unknown"}</td></tr>
          <tr><td style="border: 1px solid #aa0000;"><strong>Type:</strong></td><td style="border: 1px solid #aa0000;">${release.release_type || "N/A"}</td></tr>
          <tr><td style="border: 1px solid #aa0000;"><strong>Format:</strong></td><td style="border: 1px solid #aa0000;">${release.physical_format || "N/A"}</td></tr>
          <tr><td style="border: 1px solid #aa0000;"><strong>Limitation:</strong></td><td style="border: 1px solid #aa0000;">${release.limitation || "N/A"}</td></tr>
          <tr><td style="border: 1px solid #aa0000;"><strong>Extra Info:</strong></td><td style="border: 1px solid #aa0000;">${release.extra_info || "N/A"}</td></tr>
        </table>
        <button class="toggle-tracks" data-index="${index}" style="display: block; margin-top: 5px; background: black; color: white; border: 1px solid red; padding: 5px;">Show Tracklist</button>
        <ol class="tracklist" id="tracklist-${index}" style="display: none; margin-top: 5px; padding-left: 20px;">
          ${release.tracks?.map(track => {
            // Handle both string and object track data
            let trackName;
            if (typeof track === 'object' && track !== null) {
              trackName = track.name || 'Unknown Track';
            } else {
              trackName = track || 'Unknown Track';
            }
            return `<li>${trackName}</li>`;
          }).join("")}
        </ol>
      </div>`;
  });
}

if (band.stories?.length) {
  const allowedStatuses = ["Firsthand", "Secondhand", "Rumor"];
  
  const validStories = band.stories.filter(story =>
    allowedStatuses.includes(story.status)
  );
  
  if (validStories.length > 0) {
    bandHTML += `<hr><br><br><br><h2>Stories</h2>`;
    
    // Get unique authors to fetch profile pictures
    const uniqueAuthors = [...new Set(validStories.map(story => story.author).filter(author => author && author !== "Unknown"))];
    const authorProfilePictures = {};
    
    // Fetch profile pictures for all story authors
    for (const author of uniqueAuthors) {
      try {
        const userRef = ref(db, `users/${author}`);
        const userSnapshot = await get(userRef);
        if (userSnapshot.exists()) {
          const userData = userSnapshot.val();
          authorProfilePictures[author] = userData.profilePicture || null;
        }
      } catch (error) {
        console.error(`Error fetching profile picture for ${author}:`, error);
        authorProfilePictures[author] = null;
      }
    }
    
    validStories.forEach((story, idx) => {
      const author = story.author || "Unknown";
      const profilePicture = authorProfilePictures[author];
      
      // Create profile picture HTML
      const profilePictureHTML = profilePicture 
        ? `<img src="${profilePicture}" alt="${author}'s profile picture" style="width: 30px; height: 30px; border-radius: 50%; border: 1px solid #aa0000; margin-right: 8px; object-fit: cover;" />`
        : `<div style="width: 30px; height: 30px; border-radius: 50%; border: 1px solid #aa0000; margin-right: 8px; background-color: #333; display: flex; align-items: center; justify-content: center; color: #666; font-size: 12px;">N/A</div>`;
      
      // Create clickable username HTML
      const authorHTML = author !== "Unknown" 
        ? `<a href="user.html?user=${encodeURIComponent(author)}" style="color: #aa0000; text-decoration: none;">${author}</a>`
        : "Unknown";
      
      bandHTML += `
        <div style="border: 1px solid #ccc; margin-bottom: 15px; padding: 10px;">
          <div style="display: flex; align-items: center; margin-bottom: 10px;">
            ${profilePictureHTML}
            <div>${authorHTML}</div>
          </div>
          <h3 style="margin: 10px 0;">${story.title}</h3>
          <p><strong>Status:</strong> ${story.status}</p>
          <p><strong>Story:</strong></p>
          <div style="margin-left: 20px; white-space: pre-wrap;">${story.story}</div>
        </div>
      `;
    });
  }
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

    document.getElementById("band-content").innerHTML = bandHTML;
const flagBtn = document.getElementById("flag-incomplete-btn");
const flagStatus = document.getElementById("flag-status");

document.querySelectorAll(".note-toggle").forEach(button => {
  button.addEventListener("click", () => {
    const index = button.getAttribute("data-index");
    const contentDiv = document.getElementById(`note-content-${index}`);
    const isVisible = contentDiv.style.display === "block";
    contentDiv.style.display = isVisible ? "none" : "block";
  });
});


flagBtn.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) {
    alert("You must be signed in to change the flag status.");
    return;
  }

  const isFlagged = band.flag === "Incomplete";

  try {
    const newFlagValue = isFlagged ? null : "Incomplete";
    await set(ref(db, `bands/${band.key}/flag`), newFlagValue);

    band.flag = newFlagValue;

    flagBtn.textContent = newFlagValue === "Incomplete"
      ? "Remove Incomplete/Outdated Flag"
      : "Flag as Incomplete/Outdated";

  } catch (error) {
    console.error("Error updating flag:", error);
    alert("Failed to update flag: " + error.message);
  }
});



    const albumCover = document.createElement("img");
    albumCover.id = "album-cover";
    Object.assign(albumCover.style, {
      position: "absolute",
      width: "200px",
      border: "2px solid white",
      display: "none",
      background: "black",
      padding: "5px",
      zIndex: "1000",
      pointerEvents: "none"
    });
    document.body.appendChild(albumCover);

    document.querySelectorAll(".release-title").forEach(title => {
      title.addEventListener("mouseover", function () {
        const imageUrl = this.getAttribute("data-image");
        if (imageUrl) {
          albumCover.src = imageUrl;
          albumCover.style.display = "block";
        }
      });
      title.addEventListener("mousemove", function (e) {
        albumCover.style.top = `${e.pageY + 10}px`;
        albumCover.style.left = `${e.pageX + 10}px`;
      });
      title.addEventListener("mouseleave", () => {
        albumCover.style.display = "none";
      });
    });

    // Setup collection buttons for band page
    const currentUser = auth.currentUser;
    if (currentUser) {
      const username = currentUser.email.replace("@punkarchives.com", "");
      
      document.querySelectorAll(".collection-btn").forEach(async (button) => {
        const bandName = button.getAttribute("data-band");
        const releaseTitle = button.getAttribute("data-release");
        const releaseYear = button.getAttribute("data-year");
        
        const releaseId = await getReleaseId(bandName, releaseTitle);
        
        if (releaseId !== null) {
          const inCollection = await isInCollection(username, bandName, releaseId);
          
          if (inCollection) {
            button.textContent = 'Remove from Collection';
            button.style.backgroundColor = '#cc0000';
          } else {
            button.textContent = 'Add to Collection';
            button.style.backgroundColor = '#aa0000';
          }
          
          button.addEventListener('click', async () => {
            const currentInCollection = await isInCollection(username, bandName, releaseId);
            
            if (currentInCollection) {
              const success = await removeFromCollection(username, bandName, releaseId);
              if (success) {
                button.textContent = 'Add to Collection';
                button.style.backgroundColor = '#aa0000';
              }
            } else {
              const success = await addToCollection(username, bandName, releaseId, releaseTitle, releaseYear);
              if (success) {
                button.textContent = 'Remove from Collection';
                button.style.backgroundColor = '#cc0000';
              }
            }
          });
        } else {
          button.textContent = 'Collection Unavailable';
          button.disabled = true;
          button.style.backgroundColor = '#666';
        }
      });
    } else {
      document.querySelectorAll(".collection-btn").forEach(button => {
        button.textContent = 'Login to Use Collection';
        button.disabled = true;
        button.style.backgroundColor = '#666';
      });
    }

    document.querySelectorAll(".toggle-tracks").forEach(button => {
      button.addEventListener("click", function () {
        const index = this.getAttribute("data-index");
        const tracklist = document.getElementById(`tracklist-${index}`);
        tracklist.style.display = tracklist.style.display === "none" ? "block" : "none";
        this.textContent = tracklist.style.display === "none" ? "Show Tracklist" : "Hide Tracklist";
      });
    });

    document.querySelectorAll(".edit-button").forEach(button => {
      button.addEventListener("click", function handleEditClick() {
        const user = auth.currentUser;
        if (!user) {
          alert("You must be signed in to edit band information.");
          return;
        }

        const container = this.parentElement;
        const field = container.getAttribute("data-key");
        const bandKey = container.getAttribute("data-band");
        const currentValue = container.querySelector(".editable-value").textContent;

        container.innerHTML = `
          <strong>${field.replace("_", " ")}:</strong>
          <input type="text" class="edit-input" value="${currentValue}" />
          <button class="save-button">✅</button>
          <button class="cancel-button">❌</button>
        `;

        container.querySelector(".save-button").addEventListener("click", async () => {
          const newValue = container.querySelector(".edit-input").value;
          try {
            await set(ref(db, `bands/${bandKey}/${field}`), newValue);
            await logChange(db, bandKey, field, currentValue, newValue);

            container.innerHTML = `
              <strong>${field.replace("_", " ")}:</strong>
              <span class="editable-value">${newValue}</span>
              <button class="edit-button">✏️</button>
            `;
            container.querySelector(".edit-button").addEventListener("click", handleEditClick);
          } catch (error) {
            alert("Update failed: " + error.message);
          }
        });

        container.querySelector(".cancel-button").addEventListener("click", () => {
          container.innerHTML = `
            <strong>${field.replace("_", " ")}:</strong>
            <span class="editable-value">${currentValue}</span>
            <button class="edit-button">✏️</button>
          `;
          container.querySelector(".edit-button").addEventListener("click", handleEditClick);
        });
      });
    });

  } catch (err) {
    console.error("Firebase error:", err);
    document.getElementById("band-content").innerHTML = "<h1>Error loading band data.</h1>";
  }
});
