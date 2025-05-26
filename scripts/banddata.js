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
        <th>Name</th><th>Instrument</th><th>Time Active</th><th>Status</th>
      </tr>`;

  ["Current", "Last Known Lineup", "Former"].forEach(status => {
    categorizedMembers[status].forEach(member => {
const cleanStatus = member.status?.trim().normalize("NFKC");

if (categorizedMembers[cleanStatus]) {
  categorizedMembers[cleanStatus].push(member);
}

      bandHTML += `
        <tr>
          <td>${member.name}</td>
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

  bandHTML += `<hr><h2>Discography</h2><p>Note: Hover your mouse over an album title to see the album art.</p>`;

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
            ${release.title}${statusText}
          </h3>
        </u>
        <button class="download-image" data-image="${release.cover_image}" style="margin-left: 10px;">Download Image</button>
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
          ${release.tracks?.map(track => `<li>${track}</li>`).join("")}
        </ol>
      </div>`;
  });
}



    document.getElementById("band-content").innerHTML = bandHTML;
const flagBtn = document.getElementById("flag-incomplete-btn");
const flagStatus = document.getElementById("flag-status");

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
