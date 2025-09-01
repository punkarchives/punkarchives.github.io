import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-auth.js";
import { getDatabase, ref, get, set, child } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-database.js";

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

// Function to encode release keys for Firebase (replace invalid characters)
function encodeReleaseKey(bandIdentifier, releaseTitle) {
  const key = `${bandIdentifier}-${releaseTitle}`;
  return key.replace(/[.#$\/\[\]]/g, '_');
}

// Function to decode release keys back to original format
function decodeReleaseKey(encodedKey) {
  return encodedKey.replace(/_/g, (match, offset, string) => {
    // Check if this underscore was originally a special character
    // For now, we'll just return the underscore since we're not storing the original
    return '_';
  });
}

// Check if user is trusted
async function isUserTrusted() {
  const user = auth.currentUser;
  if (!user) {
    console.log("No user logged in");
    return false;
  }
  
  try {
    const possiblePaths = [
      `users/${user.uid}`,
      `users/${user.email.replace("@punkarchives.com", "")}`,
      `users/nxdx`
    ];
    
    console.log("Checking trusted status for user:", user.email);
    
    for (const path of possiblePaths) {
      const userRef = ref(db, path);
      const userSnapshot = await get(userRef);
      if (userSnapshot.exists()) {
        const userData = userSnapshot.val();
        console.log("Found user data at path:", path, "trusted value:", userData.trusted, "type:", typeof userData.trusted);
        return userData.trusted === "true" || userData.trusted === true;
      }
    }
    console.log("No user data found in any path");
    return false;
  } catch (error) {
    console.error("Error checking trusted status:", error);
    return false;
  }
}

// Wait for authentication to complete before checking trusted status
onAuthStateChanged(auth, async (user) => {
  const urlParams = new URLSearchParams(window.location.search);
  const memberName = urlParams.get("member");

  if (!memberName) {
    document.getElementById("member-edit-content").innerHTML = "<h1>No member selected.</h1>";
    return;
  }

  // Check if user is logged in and trusted
  const isTrusted = await isUserTrusted();
  if (!isTrusted) {
    document.getElementById("member-edit-content").innerHTML = "<h1>Access Denied</h1><p>You must be a trusted user to edit member information.</p>";
    return;
  }

  try {
    const dbRef = ref(db);
    const bandsSnapshot = await get(child(dbRef, `bands`));
    const bands = bandsSnapshot.exists() ? Object.values(bandsSnapshot.val()) : [];

    // Find all bands that have this member
    const memberBands = [];
    
    bands.forEach(band => {
      if (band.members && Array.isArray(band.members)) {
        band.members.forEach(member => {
          // Check if this member matches by real_name or name
          if ((member.real_name && member.real_name === memberName) || 
              (member.name && member.name === memberName)) {
            memberBands.push({
              band: band,
              member: member
            });
          }
        });
      }
    });

    if (memberBands.length === 0) {
      document.getElementById("member-edit-content").innerHTML = "<h1>Member not found.</h1>";
      return;
    }

    // Get the first occurrence to display basic info
    const firstOccurrence = memberBands[0];
    const displayName = firstOccurrence.member.real_name;

    // Collect all possible releases for this member
    const allPossibleReleases = [];
    memberBands.forEach(({ band }) => {
      if (band.releases && Array.isArray(band.releases)) {
        band.releases.forEach(release => {
          allPossibleReleases.push({
            ...release,
            bandName: band.band_name,
            bandKey: band.key
          });
        });
      }
    });

    // Get current member release participation from database
    const memberParticipationRef = ref(db, `memberParticipation/${memberName}`);
    const participationSnapshot = await get(memberParticipationRef);
    const currentParticipation = participationSnapshot.exists() ? participationSnapshot.val() : {};

    let editHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h1>${displayName} <a href="member.html?member=${encodeURIComponent(memberName)}"><font size="4" face="Arial">VIEW</font></a></h1>
          <p><strong>Edit Release Participation</strong></p>
          <p>Toggle which releases this member was involved with. Unchecked releases will not appear on the member's main page.</p>
        </div>
      </div>
    `;

    if (allPossibleReleases.length > 0) {
      // Sort releases by year
      allPossibleReleases.sort((a, b) => {
        const yearA = parseInt(a.year) || 0;
        const yearB = parseInt(b.year) || 0;
        return yearA - yearB;
      });

      editHTML += `<h2>Releases</h2>`;
      editHTML += `<table border="1" style="border-collapse: collapse; width: 100%; text-align: left; border: 2px solid #aa0000;">`;
      editHTML += `<tr><th>Include?</th><th>Release</th><th>Band</th><th>Year</th><th>Type</th></tr>`;
      
             allPossibleReleases.forEach(release => {
         // Use band name if bandKey is undefined, otherwise use bandKey
         const bandIdentifier = release.bandKey || release.bandName;
         const releaseKey = encodeReleaseKey(bandIdentifier, release.title);
         const isIncluded = currentParticipation[releaseKey] !== false; // Default to true if not explicitly set to false
        
        editHTML += `
          <tr>
            <td style="text-align: center;">
              <input type="checkbox" id="release-${releaseKey}" 
                     ${isIncluded ? 'checked' : ''} 
                     data-release-key="${releaseKey}"
                     style="transform: scale(1.5);">
            </td>
            <td><a href="release.html?band=${encodeURIComponent(release.bandName)}&release=${encodeURIComponent(release.title)}" style="color: #aa0000; text-decoration: none;">${release.title}</a></td>
            <td><a href="band.html?band=${encodeURIComponent(release.bandName)}" style="color: #aa0000; text-decoration: none;">${release.bandName}</a></td>
            <td>${release.year || "Unknown"}</td>
            <td>${release.release_type || "N/A"}</td>
          </tr>
        `;
      });
      
      editHTML += `</table>`;
      editHTML += `<br><button id="save-participation" style="background: #aa0000; color: white; border: none; padding: 10px 20px; cursor: pointer; font-size: 16px;">Save Changes</button>`;
    } else {
      editHTML += `<p>No releases found for this member.</p>`;
    }

    document.getElementById("member-edit-content").innerHTML = editHTML;

    // Add event listener for save button
    const saveButton = document.getElementById("save-participation");
    if (saveButton) {
      saveButton.addEventListener("click", async () => {
        const checkboxes = document.querySelectorAll('input[type="checkbox"][data-release-key]');
        const newParticipation = {};
        
        checkboxes.forEach(checkbox => {
          const releaseKey = checkbox.getAttribute('data-release-key');
          newParticipation[releaseKey] = checkbox.checked;
        });

        try {
          await set(ref(db, `memberParticipation/${memberName}`), newParticipation);
        } catch (error) {
          console.error('Error:', error);
          alert('Failed to save changes: ' + error.message);
        }
      });
    }

  } catch (error) {
    console.error("Error:", error);
    document.getElementById("member-edit-content").innerHTML = "<h1>Error loading member data.</h1>";
  }
});

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
  // The onAuthStateChanged will handle everything once auth is ready
});
