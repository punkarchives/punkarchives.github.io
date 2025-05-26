import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/11.3.0/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.3.0/firebase-auth.js";
import {
    getDatabase,
    ref,
    set,
    get,
    child,
    push
} from "https://www.gstatic.com/firebasejs/11.3.0/firebase-database.js";

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

auth.onAuthStateChanged((user) => {
  if (!user) {
    // User not logged in, redirect to login page or homepage
    window.location.href = '/login.html';
  }
});

async function logChange(db, bandKey, field, oldValue, newValue) {
    const user = auth.currentUser;
    const username = user && user.email ? user.email.replace("@punkarchives.com", "") : "anonymous";
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

function capitalize(text) {
    return text.split(" ").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

function attachEditListeners() {
    document.querySelectorAll(".edit-button").forEach(button => {
        button.addEventListener("click", function () {
            const span = this.previousElementSibling;
            const fieldPath = span.getAttribute("data-path");
            const bandKey = span.getAttribute("data-band");
            const currentValue = span.textContent;
            const container = span.parentElement;

            container.innerHTML = `
                <input type="text" value="${currentValue}" class="edit-input" />
                <button class="save-button" style="margin-left: 5px;">✅</button>
                <button class="cancel-button" style="margin-left: 5px;">❌</button>
            `;

            container.querySelector(".save-button").addEventListener("click", async () => {
                const fieldName = fieldPath.split("/").pop().replace(/_/g, " ");
                const newValue = container.querySelector(".edit-input").value;
                try {
                    await set(ref(db, `bands/${bandKey}/${fieldPath}`), newValue);
                    await logChange(db, bandKey, fieldPath, currentValue, newValue);
                    const isMemberField = fieldPath.startsWith("members/");
		    const isTrackField = fieldPath.includes("/tracks/");
                    container.innerHTML = `
                        ${!isMemberField && !isTrackField ? `<strong>${capitalize(fieldName)}:</strong>` : ""}
                        <span class="editable-value" data-path="${fieldPath}" data-band="${bandKey}">${newValue}</span>
                        <button class="edit-button" style="margin-left: 5px; display: inline-block;">✏️</button>
                    `;
                    attachEditListeners();
                } catch (err) {
                    alert("Update failed: " + err.message);
                }
            });

            container.querySelector(".cancel-button").addEventListener("click", () => {
                const fieldName = fieldPath.split("/").pop().replace(/_/g, " ");
                const isMemberField = fieldPath.startsWith("members/");
	        const isTrackField = fieldPath.includes("/tracks/");
                container.innerHTML = `
                    ${!isMemberField && !isTrackField ? `<strong>${capitalize(fieldName)}:</strong>` : ""}
                    <span class="editable-value" data-path="${fieldPath}" data-band="${bandKey}">${currentValue}</span>
                    <button class="edit-button" style="margin-left: 5px; display: inline-block;">✏️</button>
                `;
                attachEditListeners();
            });
        });
    });
}


document.addEventListener("DOMContentLoaded", async () => {


    const urlParams = new URLSearchParams(window.location.search);
    const bandName = urlParams.get("band");
    const bandName2 = urlParams.get("band");
    if (!bandName) {
        document.getElementById("band-content").innerHTML = "<h2>No band selected. Add ?band=Band Name to the URL.</h2>";
        return;
    }

    const dbRef = ref(db);
    try {
        const snapshot = await get(child(dbRef, 'bands'));
        if (!snapshot.exists()) return;

        const bandsRaw = snapshot.val();
        const bands = Object.entries(bandsRaw).map(([key, val]) => ({
            key,
            ...val
        }));
        const band = bands.find(b => b.band_name.toLowerCase() === bandName.toLowerCase());
        if (!band) {
            document.getElementById("band-content").innerHTML = `<h2>Band '${bandName}' not found.</h2>`;
            return;
        }

        let bandHTML = `<h1>${band.band_name} <a href="band.html?band=${encodeURIComponent(bandName2)}"><font size="4" face="Arial">RETURN</font></a></h1>`;

        const editableField = (key, val, bandKey) => `
      <p><strong>${key.replace("_", " ")}:</strong>
      <span class="editable-value" data-path="${key}" data-band="${bandKey}">${val ?? "N/A"}</span>
      <button class="edit-button" style="margin-left: 5px; display: inline-block;">✏️</button></p>`;

        bandHTML += ["Genres", "Location", "Years_Active", "Description", "Related_Bands"]
            .map(field => editableField(field, band[field], band.key)).join("");

        if (band.members?.length) {
    // Categorize members by status, including unknowns
    const categorizedMembers = {
        "Current": [],
        "Former": [],
        "Last Known Lineup": [],
        "Unknown": []
    };

    band.members.forEach((m, i) => {
        const status = m.status || "Unknown";
        if (!categorizedMembers[status]) {
            categorizedMembers[status] = []; 
        }
        categorizedMembers[status].push({
            ...m,
            index: i
        });
    });

    bandHTML += `<hr><h2>Band Members</h2><p>note: members will not display unless theyre given a status of "Current", "Former", or "Last Known Lineup"
    <table border="1"><tr><th>Name</th><th>Instrument</th><th>Time Active</th><th>Status</th></tr>`;

    const knownCategories = ["Current", "Former", "Last Known Lineup"];

    // First, list known categories
    knownCategories.forEach(status => {
        categorizedMembers[status].forEach(member => {
            bandHTML += `<tr>`;
            ["name", "instrument", "time_active", "status"].forEach(attr => {
                const safeValue = member?.[attr] ?? "N/A";
                bandHTML += `<td>
                    <span class="editable-value" data-path="members/${member.index}/${attr}" data-band="${band.key}">${safeValue}</span>
                    <button class="edit-button" style="margin-left: 5px; display: inline-block;">✏️</button>
                </td>`;
            });
            bandHTML += `</tr>`;
        });
    });

    // Then list unknown/other categories (excluding known ones)
    Object.keys(categorizedMembers).forEach(category => {
        if (!knownCategories.includes(category)) {
            categorizedMembers[category].forEach(member => {
                bandHTML += `<tr>`;
                ["name", "instrument", "time_active", "status"].forEach(attr => {
                    const safeValue = member?.[attr] ?? "N/A";
                    bandHTML += `<td>
                        <span class="editable-value" data-path="members/${member.index}/${attr}" data-band="${band.key}">${safeValue}</span>
                        <button class="edit-button" style="margin-left: 5px; display: inline-block;">✏️</button>
                    </td>`;
                });
                bandHTML += `</tr>`;
            });
        }
    });

    bandHTML += `</table>`;
    bandHTML += `
        <button id="add-member-button">
            Add Member
        </button>`;


if (band.releases?.length) {
  bandHTML += `<hr><h2>Releases</h2>`;

  const sortedReleases = band.releases
    .map((release, originalIndex) => ({ ...release, originalIndex }))
    .sort((a, b) => {
      const yearA = parseInt(a?.year) || 0;
      const yearB = parseInt(b?.year) || 0;
      return yearA - yearB;
    });

  sortedReleases.forEach((r) => {
    const isLocked = r.locked === true;
    const titleStyle = isLocked ? 'style="color: green;"' : '';
    const lockEmoji = isLocked ? ' 🔒' : '';

    bandHTML += `
      <div style="margin-bottom:20px">
        <h3><strong>Title:</strong> <span class="editable-value" data-path="releases/${r.originalIndex}/title" data-band="${band.key}">${r?.title ?? "N/A"}</span>
        ${!isLocked ? '<button class="edit-button" style="margin-left: 5px; display: inline-block;">✏️</button>' : ''}</h3>
        <p><strong>Image Link:</strong> <span class="editable-value" data-path="releases/${r.originalIndex}/cover_image" data-band="${band.key}">${r?.cover_image ?? "N/A"}</span>
        ${!isLocked ? '<button class="edit-button" style="margin-left: 5px; display: inline-block;">✏️</button>' : ''}</p>
        <p><strong>Label:</strong> <span class="editable-value" data-path="releases/${r.originalIndex}/label" data-band="${band.key}">${r?.label ?? "N/A"}</span>
        ${!isLocked ? '<button class="edit-button" style="margin-left: 5px; display: inline-block;">✏️</button>' : ''}</p>
        <p><strong>Year:</strong> <span class="editable-value" data-path="releases/${r.originalIndex}/year" data-band="${band.key}">${r?.year ?? "N/A"}</span>
        ${!isLocked ? '<button class="edit-button" style="margin-left: 5px; display: inline-block;">✏️</button>' : ''}</p>
        <p><strong>Type:</strong> <span class="editable-value" data-path="releases/${r.originalIndex}/release_type" data-band="${band.key}">${r?.release_type ?? "N/A"}</span>
        ${!isLocked ? '<button class="edit-button" style="margin-left: 5px; display: inline-block;">✏️</button>' : ''}</p>
        <p><strong>Format:</strong> <span class="editable-value" data-path="releases/${r.originalIndex}/physical_format" data-band="${band.key}">${r?.physical_format ?? "N/A"}</span>
        ${!isLocked ? '<button class="edit-button" style="margin-left: 5px; display: inline-block;">✏️</button>' : ''}</p>
        <p><strong>Limitation:</strong> <span class="editable-value" data-path="releases/${r.originalIndex}/limitation" data-band="${band.key}">${r?.limitation ?? "N/A"}</span>
        ${!isLocked ? '<button class="edit-button" style="margin-left: 5px; display: inline-block;">✏️</button>' : ''}</p>
        <p><strong>Extra Info:</strong> <span class="editable-value" data-path="releases/${r.originalIndex}/extra_info" data-band="${band.key}">${r?.extra_info ?? "N/A"}</span>
        ${!isLocked ? '<button class="edit-button" style="margin-left: 5px; display: inline-block;">✏️</button>' : ''}</p>
        <p><strong>Flag ('Delete' or 'Restore'):</strong> <span class="editable-value" data-path="releases/${r.originalIndex}/flag" data-band="${band.key}">${r?.flag ?? "N/A"}</span>
        ${!isLocked ? '<button class="edit-button" style="margin-left: 5px; display: inline-block;">✏️</button>' : ''}</p>
    `;

    if (Array.isArray(r.tracks) || typeof r.tracks === 'object') {
      bandHTML += `<p><strong>Tracklist:</strong></p><ol id="tracklist-${r.originalIndex}">`;
      const tracks = Object.entries(r.tracks || {});
      tracks.forEach(([index, trackName]) => {
        bandHTML += `
          <li>
            <span class="editable-value" data-path="releases/${r.originalIndex}/tracks/${index}" data-band="${band.key}">${trackName}</span>
            ${!isLocked ? '<button class="edit-button" style="margin-left: 5px; display: inline-block;">✏️</button>' : ''}
          </li>`;
      });
      bandHTML += `</ol>`;
      if (!isLocked) {
        bandHTML += `<button class="add-track-button" data-release-index="${r.originalIndex}" data-band="${band.key}" style="margin-top:5px">➕ Add Track</button>`;
      }
    }

    bandHTML += `</div><h2></h2>`;
  });
}

bandHTML += `<button id="addReleaseButton">Add New Release</button>`;

document.addEventListener("click", async (event) => {
  if (event.target.id === "addReleaseButton") {
    if (!band.releases) band.releases = [];

    const nextIndex = band.releases.length;

    const newRelease = {
      title: "undefined",
      cover_image: "undefined",
      label: "undefined",
      year: "undefined",
      release_type: "undefined",
      physical_format: "undefined",
      limitation: "undefined",
      extra_info: "undefined",
      tracks: {
	0: "undefined"
      }
    };

    try {
      // Save to Firebase
      await set(ref(db, `bands/${band.key}/releases/${nextIndex}`), newRelease);
      await logChange(db, band.key, `releases/${nextIndex}`, "New Release Added", JSON.stringify(newRelease));

      // Update local object and refresh the UI
      band.releases.push(newRelease);
      updateReleaseUI();
    } catch (err) {
      alert("Failed to add new release: " + err.message);
    }
  }
});
function updateReleaseUI() {
location.reload()
}


        const bandContainer = document.getElementById("band-content");
        if (bandContainer) {
            bandContainer.innerHTML = bandHTML;
            console.log("Band content loaded. Edit buttons should now be visible.");
            attachEditListeners();

document.querySelectorAll(".add-track-button").forEach(button => {
  button.addEventListener("click", async () => {
    const releaseIndex = button.getAttribute("data-release-index");
    const bandKey = button.getAttribute("data-band");

    const tracklistRef = ref(db, `bands/${bandKey}/releases/${releaseIndex}/tracks`);
    const snapshot = await get(tracklistRef);
    const currentTracks = snapshot.exists() ? snapshot.val() : {};

    const nextIndex = Object.keys(currentTracks).length;
    const newTrackName = "undefined";

    try {
      await set(ref(db, `bands/${bandKey}/releases/${releaseIndex}/tracks/${nextIndex}`), newTrackName);
      await logChange(db, bandKey, `releases/${releaseIndex}/tracks/${nextIndex}`, "Track added", newTrackName);

      const tracklistElement = document.getElementById(`tracklist-${releaseIndex}`);
      const newLi = document.createElement("li");
      newLi.innerHTML = `
        <span class="editable-value" data-path="releases/${releaseIndex}/tracks/${nextIndex}" data-band="${bandKey}">${newTrackName}</span>
        <button class="edit-button" style="margin-left: 5px; display: inline-block;">✏️</button>
      `;
      tracklistElement.appendChild(newLi);
      attachEditListeners();

    } catch (err) {
      alert("Failed to add track: " + err.message);
    }
  });
});

document.getElementById("add-member-button").addEventListener("click", async () => {
    const newMember = {
        name: "undefined",
        instrument: "undefined",
        time_active: "undefined",
        status: "undefined"
    };

    try {
        const membersRef = ref(db, `bands/${band.key}/members`);
        const snapshot = await get(membersRef);
        const members = snapshot.exists() ? snapshot.val() : [];

        members.push(newMember); // Add new member to the array
        await set(membersRef, members); // Save updated array

        location.reload(); // Reload to reflect changes (or re-render your band view)
    } catch (err) {
        alert("Failed to add member: " + err.message);
    }
});
}
        }
}
 catch (err) {
        console.error("Firebase error:", err);
    }
})
