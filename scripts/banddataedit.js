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
        button.addEventListener("click", async function() {
            const span = this.previousElementSibling;
            const fieldPath = span.getAttribute("data-path");
            const bandKey = span.getAttribute("data-band");
            const currentValue = span.textContent;
            const container = span.parentElement;
            
            // Check if this is a trusted-only field and verify user permissions
            if (this.classList.contains("trusted-only")) {
                const user = auth.currentUser;
                if (!user) {
                    alert("You must be logged in to edit this field.");
                    return;
                }
                
                console.log("Current user:", user.email);
                console.log("User UID:", user.uid);
                
                try {
                    // Try different possible paths for user data
                    const possiblePaths = [
                        `users/${user.uid}`,
                        `users/${user.email.replace("@punkarchives.com", "")}`,
                        `users/nxdx`
                    ];
                    
                    let userData = null;
                    let foundPath = null;
                    
                    for (const path of possiblePaths) {
                        console.log("Checking path:", path);
                        const userRef = ref(db, path);
                        const userSnapshot = await get(userRef);
                        if (userSnapshot.exists()) {
                            userData = userSnapshot.val();
                            foundPath = path;
                            console.log("Found user data at:", path, userData);
                            break;
                        }
                    }
                    
                    if (!userData) {
                        console.log("No user data found in any path");
                        alert("User data not found. Please contact an administrator.");
                        return;
                    }
                    
                    console.log("User trusted value:", userData.trusted, "Type:", typeof userData.trusted);
                    
                    if (userData.trusted !== "true") {
                        alert("Your account is not trusted enough for this action. Please contact an administrator.");
                        return;
                    }
                    
                    console.log("User is trusted, proceeding with edit");
                    
                } catch (error) {
                    console.error("Error checking user permissions:", error);
                    alert("Error checking user permissions. Please try again.");
                    return;
                }
            }

            // Check if this is a story field and use textarea for better editing
            const isStoryField = fieldPath.includes("/story");
            
            if (isStoryField) {
                container.innerHTML = `
                    <textarea class="edit-input" rows="8" style="width: 100%; min-height: 150px;">${currentValue}</textarea>
                    <button class="save-button" style="margin-left: 5px;">✅</button>
                    <button class="cancel-button" style="margin-left: 5px;">❌</button>
                `;
            } else {
                container.innerHTML = `
                    <input type="text" class="edit-input" value="${currentValue}" />
                    <button class="save-button" style="margin-left: 5px;">✅</button>
                    <button class="cancel-button" style="margin-left: 5px;">❌</button>
                `;
            }

            container.querySelector(".save-button").addEventListener("click", async () => {
                const fieldName = fieldPath.split("/").pop().replace(/_/g, " ");
                const newValue = container.querySelector(".edit-input").value || container.querySelector(".edit-input").textContent;
                try {
                    await set(ref(db, `bands/${bandKey}/${fieldPath}`), newValue);
                    await logChange(db, bandKey, fieldPath, currentValue, newValue);
                    const isMemberField = fieldPath.startsWith("members/");
                    const isTrackField = fieldPath.includes("/tracks/");
                    const isStoryField = fieldPath.includes("/story");
                    
                    // Rebuild the original HTML structure based on field type
                    if (isStoryField) {
                        container.innerHTML = `
                            <span class="editable-value" data-path="${fieldPath}" data-band="${bandKey}">${newValue}</span>
                            <button class="edit-button" style="margin-left: 5px; display: inline-block;">✏️</button>
                        `;
                    } else {
                        container.innerHTML = `
                            ${!isMemberField && !isTrackField ? `<strong>${capitalize(fieldName)}:</strong>` : ""}
                            <span class="editable-value" data-path="${fieldPath}" data-band="${bandKey}">${newValue}</span>
                            <button class="edit-button" style="margin-left: 5px; display: inline-block;">✏️</button>
                        `;
                    }
                    attachEditListeners();
                } catch (err) {
                    alert("Update failed: " + err.message);
                }
            });

            container.querySelector(".cancel-button").addEventListener("click", () => {
                const fieldName = fieldPath.split("/").pop().replace(/_/g, " ");
                const isMemberField = fieldPath.startsWith("members/");
                const isTrackField = fieldPath.includes("/tracks/");
                const isStoryField = fieldPath.includes("/story");
                
                // For story fields, just restore the original content without rebuilding the entire structure
                if (isStoryField) {
                    container.innerHTML = `
                        <span class="editable-value" data-path="${fieldPath}" data-band="${bandKey}">${currentValue}</span>
                        <button class="edit-button" style="margin-left: 5px; display: inline-block;">✏️</button>
                    `;
                } else {
                    container.innerHTML = `
                        ${!isMemberField && !isTrackField ? `<strong>${capitalize(fieldName)}:</strong>` : ""}
                        <span class="editable-value" data-path="${fieldPath}" data-band="${bandKey}">${currentValue}</span>
                        <button class="edit-button" style="margin-left: 5px; display: inline-block;">✏️</button>
                    `;
                }
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
        
        // Add background image field with trusted user check
        bandHTML += `<p><strong>Background Image:</strong> <span class="editable-value" data-path="backgroundimg" data-band="${band.key}">${band?.backgroundimg ?? "N/A"}</span>
        <button class="edit-button trusted-only" style="margin-left: 5px; display: inline-block;">✏️</button></p>`;

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
// --- Community Notes Section ---
const currentUser = auth.currentUser;
if (!band.notes) band.notes = {};

let notesHTML = "<hr><h2>Community Notes</h2>";
Object.entries(band.notes).forEach(([noteKey, noteObj]) => {
  const canEdit = currentUser && noteObj.user === currentUser.email.replace("@punkarchives.com", "");
  notesHTML += `
    <div style="border:1px solid #ccc; margin-bottom:10px; padding:5px;">
      <p><strong>Title:</strong> ${noteObj.title}</p>
      <p><strong>Submitted by:</strong> ${noteObj.user || "Unknown"}</p>
      <p><strong>Status:</strong> ${noteObj.status}</p>
      <p><strong>Note:</strong><br>${noteObj.text}</p>
      ${canEdit ? `<button class="edit-note-button" data-note-key="${noteKey}">✏️ Edit Note</button>` : ""}
    </div>
  `;
});

notesHTML += `<button id="add-note-button" style="margin-top:10px;">➕ Add New Note</button>`;
document.getElementById("band-content").insertAdjacentHTML("beforeend", notesHTML);

// --- Add Note Button Listener ---
document.getElementById("add-note-button").addEventListener("click", () => {
  const formContainer = document.createElement("div");
  formContainer.style.background = "#f0f0f0";
  formContainer.style.border = "1px solid #aaa";
  formContainer.style.padding = "10px";
  formContainer.style.marginTop = "10px";

  formContainer.innerHTML = `
    <h3>Add New Note</h3>
    <label>Title: <input type="text" id="new-note-title" style="width: 100%;" /></label><br><br>
    <label>Status:
      <select id="new-note-status" style="width: 100%;">
        <option value="Firsthand">Firsthand</option>
        <option value="Secondhand">Secondhand</option>
        <option value="Rumor">Rumor</option>
      </select>
    </label><br><br>
    <label>Note Text:<br><textarea id="new-note-text" rows="4" style="width: 100%;"></textarea></label><br><br>
    <button id="save-new-note">✅ Save Note</button>
    <button id="cancel-new-note">❌ Cancel</button>
  `;
  document.getElementById("band-content").appendChild(formContainer);

  document.getElementById("save-new-note").addEventListener("click", async () => {
    const title = document.getElementById("new-note-title").value.trim();
    const status = document.getElementById("new-note-status").value.trim();
    const text = document.getElementById("new-note-text").value.trim();

    if (!title || !status || !text) {
      alert("All fields are required.");
      return;
    }

    const newNote = {
      title,
      status,
      text,
      user: currentUser.email.replace("@punkarchives.com", "")
    };

    try {
      const newNoteKey = push(ref(db, `bands/${band.key}/notes`)).key;
      await set(ref(db, `bands/${band.key}/notes/${newNoteKey}`), newNote);
      await logChange(db, band.key, `notes/${newNoteKey}`, "New Note", JSON.stringify(newNote));
      location.reload();
    } catch (err) {
      alert("Error saving note: " + err.message);
    }
  });

  document.getElementById("cancel-new-note").addEventListener("click", () => {
    formContainer.remove();
  });
});

// --- Edit Existing Notes ---
document.querySelectorAll(".edit-note-button").forEach(button => {
  button.addEventListener("click", () => {
    const noteKey = button.getAttribute("data-note-key");
    const note = band.notes[noteKey];

    const formContainer = document.createElement("div");
    formContainer.style.background = "#f9f9f9";
    formContainer.style.border = "1px solid #aaa";
    formContainer.style.padding = "10px";
    formContainer.style.marginTop = "10px";

    formContainer.innerHTML = `
      <h3>Edit Note</h3>
      <label>Title: <input type="text" id="edit-note-title" value="${note.title}" style="width: 100%;" /></label><br><br>
      <label>Status:
        <select id="edit-note-status" style="width: 100%;">
          <option value="Firsthand" ${note.status === "Firsthand" ? "selected" : ""}>Firsthand</option>
          <option value="Secondhand" ${note.status === "Secondhand" ? "selected" : ""}>Secondhand</option>
          <option value="Rumor" ${note.status === "Rumor" ? "selected" : ""}>Rumor</option>
        </select>
      </label><br><br>
      <label>Note Text:<br><textarea id="edit-note-text" rows="4" style="width: 100%;">${note.text}</textarea></label><br><br>
      <button id="save-edit-note">✅ Save Changes</button>
      <button id="cancel-edit-note">❌ Cancel</button>
    `;
    document.getElementById("band-content").appendChild(formContainer);

    document.getElementById("save-edit-note").addEventListener("click", async () => {
      const title = document.getElementById("edit-note-title").value.trim();
      const status = document.getElementById("edit-note-status").value.trim();
      const text = document.getElementById("edit-note-text").value.trim();

      if (!title || !status || !text) {
        alert("All fields required.");
        return;
      }

      const updatedNote = { ...note, title, status, text };

      try {
        await set(ref(db, `bands/${band.key}/notes/${noteKey}`), updatedNote);
        await logChange(db, band.key, `notes/${noteKey}`, JSON.stringify(note), JSON.stringify(updatedNote));
        location.reload();
      } catch (err) {
        alert("Error updating note: " + err.message);
      }
    });

    document.getElementById("cancel-edit-note").addEventListener("click", () => {
      formContainer.remove();
    });
  });
});


            if (band.releases?.length) {
                bandHTML += `<hr><h2>Releases</h2>`;

                const sortedReleases = band.releases
                    .map((release, originalIndex) => ({
                        ...release,
                        originalIndex
                    }))
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
        <h3 ${titleStyle}><strong>Title:</strong> <span class="editable-value" data-path="releases/${r.originalIndex}/title" data-band="${band.key}">${r?.title ?? "N/A"}${lockEmoji}</span>
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
        <p><strong>YouTube Link:</strong> <span class="editable-value" data-path="releases/${r.originalIndex}/listen" data-band="${band.key}">${r?.listen ?? "N/A"}</span>
        ${!isLocked ? '<button class="edit-button trusted-only" style="margin-left: 5px; display: inline-block;">✏️</button>' : ''}</p>
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
            
            // Add Stories Section
            if (band.stories?.length) {
                bandHTML += `<hr><h2>Stories</h2><p>note: stories will not display unless theyre given a status of "Firsthand", "Secondhand", or "Rumor"</p>`;
                
                band.stories.forEach((story, storyIndex) => {
                    const currentUser = auth.currentUser;
                    const canEdit = currentUser && story.author === currentUser.email.replace("@punkarchives.com", "");
                    
                    bandHTML += `
                        <div style="border: 1px solid #ccc; margin-bottom: 15px; padding: 10px;">
                            <h3><strong>Title:</strong> <span class="editable-value" data-path="stories/${storyIndex}/title" data-band="${band.key}">${story?.title ?? "N/A"}</span>
                            ${canEdit ? '<button class="edit-button" style="margin-left: 5px; display: inline-block;">✏️</button>' : ''}</h3>
                            <p><strong>Author:</strong> ${story?.author ?? "Unknown"}</p>
                            <p><strong>Status:</strong> <span class="editable-value" data-path="stories/${storyIndex}/status" data-band="${band.key}">${story?.status ?? "N/A"}</span>
                            ${canEdit ? '<button class="edit-button" style="margin-left: 5px; display: inline-block;">✏️</button>' : ''}</p>
                            <p><strong>Story:</strong></p>
                            <div style="margin-left: 20px;">
                                <span class="editable-value" data-path="stories/${storyIndex}/story" data-band="${band.key}">${story?.story ?? "N/A"}</span>
                                ${canEdit ? '<button class="edit-button" style="margin-left: 5px; display: inline-block;">✏️</button>' : ''}
                            </div>
                        </div>
                    `;
                });
            }
            
            bandHTML += `<button id="addStoryButton">Add New Story</button>`;

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
                        listen: "",
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
                
                if (event.target.id === "addStoryButton") {
                    const user = auth.currentUser;
                    if (!user) {
                        alert("You must be logged in to add a story.");
                        return;
                    }
                    
                    if (!band.stories) band.stories = [];
                    
                    const nextIndex = band.stories.length;
                    const author = user.email.replace("@punkarchives.com", "");
                    
                    const newStory = {
                        title: "undefined",
                        author: author,
                        status: "undefined",
                        story: "undefined"
                    };
                    
                    try {
                        // Save to Firebase
                        await set(ref(db, `bands/${band.key}/stories/${nextIndex}`), newStory);
                        await logChange(db, band.key, `stories/${nextIndex}`, "New Story Added", JSON.stringify(newStory));
                        
                        // Reload the page to show the new story
                        location.reload();
                    } catch (err) {
                        alert("Failed to add new story: " + err.message);
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
                        await set(membersRef, members);

                        location.reload();
                    } catch (err) {
                        alert("Failed to add member: " + err.message);
                    }
                });
            }
        }
    } catch (err) {
        console.error("Firebase error:", err);
    }
})
