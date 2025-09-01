import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-app.js";
import { getDatabase, ref, get, child } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-database.js";

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
const db = getDatabase(app);

// Function to encode release keys for Firebase (replace invalid characters)
function encodeReleaseKey(bandIdentifier, releaseTitle) {
  const key = `${bandIdentifier}-${releaseTitle}`;
  return key.replace(/[.#$\/\[\]]/g, '_');
}

document.addEventListener("DOMContentLoaded", async function () {
  const urlParams = new URLSearchParams(window.location.search);
  const memberName = urlParams.get("member");

  if (!memberName) {
    document.getElementById("member-content").innerHTML = "<h1>No member selected.</h1>";
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
      document.getElementById("member-content").innerHTML = "<h1>Member not found.</h1>";
      return;
    }

    // Get the first occurrence to display basic info
    const firstOccurrence = memberBands[0];
    const displayName = firstOccurrence.member.name;
    const realName = firstOccurrence.member.real_name;

    let memberHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h1>${realName} <a href="memberedit.html?member=${encodeURIComponent(memberName)}"><font size="4" face="Arial">EDIT</font></a></h1>
        </div>
      </div>
    `;

         // Group bands by member status and sort them
     const currentBands = [];
     const lastKnownBands = [];
     const formerBands = [];
     const otherBands = [];

     memberBands.forEach(({ band, member }) => {
       const status = member.status || "Other";
       const bandEntry = { band, member };
       
       if (status === "Current") {
         currentBands.push(bandEntry);
       } else if (status === "Last Known Lineup") {
         lastKnownBands.push(bandEntry);
       } else if (status === "Former") {
         formerBands.push(bandEntry);
       } else {
         otherBands.push(bandEntry);
       }
     });

     // Combine all bands in the desired order
     const allBandsInOrder = [...currentBands, ...lastKnownBands, ...formerBands, ...otherBands];

     if (allBandsInOrder.length > 0) {
       memberHTML += `<h2>Bands</h2>`;
       memberHTML += `<table border="1" style="border-collapse: collapse; width: 100%; text-align: left; border: 2px solid #aa0000;">`;
       memberHTML += `<tr><th>Band</th><th>Instrument</th><th>Time Active</th><th>Status</th></tr>`;
       
       allBandsInOrder.forEach(({ band, member }) => {
         memberHTML += `
           <tr>
             <td><a href="band.html?band=${encodeURIComponent(band.band_name)}" style="color: white; text-decoration: underline;">${band.band_name}</a></td>
             <td>${member.instrument || "N/A"}</td>
             <td>${member.time_active || "N/A"}</td>
             <td>${member.status || "N/A"}</td>
           </tr>
         `;
       });
       
       memberHTML += `</table>`;
     }

    // Get member release participation from database
    const memberParticipationRef = ref(db, `memberParticipation/${memberName}`);
    const participationSnapshot = await get(memberParticipationRef);
    const participation = participationSnapshot.exists() ? participationSnapshot.val() : {};

    // Add releases section if the member has been in bands with releases
    const allReleases = [];
         memberBands.forEach(({ band }) => {
       if (band.releases && Array.isArray(band.releases)) {
                   band.releases.forEach(release => {
            // Use band name if band.key is undefined, otherwise use band.key
            const bandIdentifier = band.key || band.band_name;
            const releaseKey = encodeReleaseKey(bandIdentifier, release.title);
            const isIncluded = participation[releaseKey] !== false; // Default to true if not explicitly set to false
          
          if (isIncluded) {
            allReleases.push({
              ...release,
              bandName: band.band_name
            });
          }
        });
      }
    });

    if (allReleases.length > 0) {
      // Sort releases by year
      allReleases.sort((a, b) => {
        const yearA = parseInt(a.year) || 0;
        const yearB = parseInt(b.year) || 0;
        return yearA - yearB;
      });

      memberHTML += `<hr><h2>Releases</h2>`;
      memberHTML += `<table border="1" style="border-collapse: collapse; width: 100%; text-align: left; border: 2px solid #aa0000;">`;
      memberHTML += `<tr><th>Release</th><th>Band</th><th>Year</th><th>Type</th></tr>`;
      
      allReleases.forEach(release => {
        memberHTML += `
          <tr>
            <td><a href="release.html?band=${encodeURIComponent(release.bandName)}&release=${encodeURIComponent(release.title)}" style="color: #aa0000; text-decoration: none;">${release.title}</a></td>
            <td><a href="band.html?band=${encodeURIComponent(release.bandName)}" style="color: #aa0000; text-decoration: none;">${release.bandName}</a></td>
            <td>${release.year || "Unknown"}</td>
            <td>${release.release_type || "N/A"}</td>
          </tr>
        `;
      });
      
      memberHTML += `</table>`;
    }

    document.getElementById("member-content").innerHTML = memberHTML;

  } catch (error) {
    console.error("Error:", error);
    document.getElementById("member-content").innerHTML = "<h1>Error loading member data.</h1>";
  }
});
