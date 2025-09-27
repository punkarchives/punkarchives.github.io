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

async function isUserVeryTrusted() {
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
                return userData.verytrusted === "true";
            }
        }
        return false;
    } catch (error) {
        console.error("Error checking verytrusted status:", error);
        return false;
    }
}

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
                
                const isTrusted = await isUserTrusted();
                if (!isTrusted) {
                    alert("Your account is not trusted enough for this action. Please contact an administrator.");
                    return;
                }
            }

            // Check if this is a verytrusted-only field and verify user permissions
            if (this.classList.contains("verytrusted-only")) {
                const user = auth.currentUser;
                if (!user) {
                    alert("You must be logged in to edit this field.");
                    return;
                }
                
                const isVeryTrusted = await isUserVeryTrusted();
                if (!isVeryTrusted) {
                    alert("Your account is not verytrusted enough for this action. Please contact an administrator.");
                    return;
                }
            }

            // Check if this is a story field and use textarea for better editing
            const isStoryField = fieldPath.includes("/story");
            
            if (isStoryField) {
                container.innerHTML = `
                    <textarea class="edit-input" rows="8" style="width: 100%; min-height: 150px;"></textarea>
                    <button class="save-button" style="margin-left: 5px;">✅</button>
                    <button class="cancel-button" style="margin-left: 5px;">❌</button>
                `;
                // Set the value after creating the element to avoid quotation mark issues
                container.querySelector(".edit-input").value = currentValue;
            } else {
                container.innerHTML = `
                    <input type="text" class="edit-input" />
                    <button class="save-button" style="margin-left: 5px;">✅</button>
                    <button class="cancel-button" style="margin-left: 5px;">❌</button>
                `;
                // Set the value after creating the element to avoid quotation mark issues
                container.querySelector(".edit-input").value = currentValue;
            }

            container.querySelector(".save-button").addEventListener("click", async () => {
                const fieldName = fieldPath.split("/").pop().replace(/_/g, " ");
                const newValue = container.querySelector(".edit-input").value || container.querySelector(".edit-input").textContent;
                try {
                    await set(ref(db, `bands/${bandKey}/${fieldPath}`), newValue);
                    await logChange(db, bandKey, fieldPath, currentValue, newValue);
                    const isStoryField = fieldPath.includes("/story");
                    
                    // Rebuild the original HTML structure based on field type
                    if (isStoryField) {
                        container.innerHTML = `
                            <span class="editable-value" data-path="${fieldPath}" data-band="${bandKey}">${newValue}</span>
                            <button class="edit-button" style="margin-left: 5px; display: inline-block;">✏️</button>
                        `;
                    } else {
                        container.innerHTML = `
                            <strong>${capitalize(fieldName)}:</strong>
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
                const isStoryField = fieldPath.includes("/story");
                
                if (isStoryField) {
                    container.innerHTML = `
                        <span class="editable-value" data-path="${fieldPath}" data-band="${bandKey}">${currentValue}</span>
                        <button class="edit-button" style="margin-left: 5px; display: inline-block;">✏️</button>
                    `;
                } else {
                    container.innerHTML = `
                        <strong>${capitalize(fieldName)}:</strong>
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
    const releaseTitle = urlParams.get("release");

    if (!bandName || !releaseTitle) {
        document.getElementById("release-content").innerHTML = "<h2>No band or release selected. Add ?band=Band Name&release=Release Title to the URL.</h2>";
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
        const band = bands.find(b => b.band_name === bandName);
        if (!band) {
            document.getElementById("release-content").innerHTML = `<h2>Band '${bandName}' not found.</h2>`;
            return;
        }

        // Find the specific release
        const releaseIndex = band.releases?.findIndex(r => r.title === releaseTitle);
        if (releaseIndex === -1 || !band.releases[releaseIndex]) {
            document.getElementById("release-content").innerHTML = `<h2>Release '${releaseTitle}' not found.</h2>`;
            return;
        }

        const release = band.releases[releaseIndex];

        let releaseHTML = `<h1>${release.title} <a href="release.html?band=${encodeURIComponent(bandName)}&release=${encodeURIComponent(releaseTitle)}"><font size="4" face="Arial">RETURN</font></a></h1>`;

        const editableField = (key, val, bandKey, path) => `
      <p><strong>${key.replace("_", " ")}:</strong>
      <span class="editable-value" data-path="${path}" data-band="${bandKey}">${val ?? "N/A"}</span>
      <button class="edit-button" style="margin-left: 5px; display: inline-block;">✏️</button></p>`;

        // Basic release information
        releaseHTML += editableField("Title", release.title, band.key, `releases/${releaseIndex}/title`);
        releaseHTML += editableField("Cover Image", release.cover_image, band.key, `releases/${releaseIndex}/cover_image`);
        releaseHTML += editableField("Label", release.label, band.key, `releases/${releaseIndex}/label`);
        releaseHTML += editableField("Year", release.year, band.key, `releases/${releaseIndex}/year`);
        releaseHTML += editableField("Release Type", release.release_type, band.key, `releases/${releaseIndex}/release_type`);
        releaseHTML += editableField("Physical Format", release.physical_format, band.key, `releases/${releaseIndex}/physical_format`);
        releaseHTML += editableField("Limitation", release.limitation, band.key, `releases/${releaseIndex}/limitation`);
        releaseHTML += editableField("Extra Info", release.extra_info, band.key, `releases/${releaseIndex}/extra_info`);
        releaseHTML += `<p><strong>YouTube Link:</strong> <span class="editable-value" data-path="releases/${releaseIndex}/listen" data-band="${band.key}">${release?.listen ?? "N/A"}</span>
        <button class="edit-button trusted-only" style="margin-left: 5px; display: inline-block;">✏️</button></p>`;
        releaseHTML += editableField("Flag", release.flag, band.key, `releases/${releaseIndex}/flag`);

        // Add cover image preview if available
        if (release?.cover_image) {
            releaseHTML += `<div style="margin: 10px 0;"><img src="${release.cover_image}" alt="Current Cover" style="max-width: 200px; max-height: 200px; border: 1px solid #ccc;" /></div>`;
        }

        // Extra Versions Section
        releaseHTML += `<hr><h2>Extra Versions</h2>`;
        releaseHTML += `<p><em>Add different versions (CD, Vinyl, Cassette, Rereleases) without cluttering the main release list.</em></p>`;
        
        if (release.extra_versions && Object.keys(release.extra_versions).length > 0) {
            releaseHTML += `<div style="margin-bottom: 20px;">`;
            Object.entries(release.extra_versions).forEach(([versionKey, version]) => {
                releaseHTML += `
                    <div style="border: 1px solid #ccc; margin-bottom: 15px; padding: 10px; background-color: rgba(0,0,0,0.1);">
                        <h3>Version: ${version.format || 'Unknown Format'}</h3>
                        <p><strong>Format:</strong> <span class="editable-value" data-path="releases/${releaseIndex}/extra_versions/${versionKey}/format" data-band="${band.key}">${version.format ?? "N/A"}</span>
                        <button class="edit-button" style="margin-left: 5px; display: inline-block;">✏️</button></p>
                        <p><strong>Label:</strong> <span class="editable-value" data-path="releases/${releaseIndex}/extra_versions/${versionKey}/label" data-band="${band.key}">${version.label ?? "N/A"}</span>
                        <button class="edit-button" style="margin-left: 5px; display: inline-block;">✏️</button></p>
                        <p><strong>Year:</strong> <span class="editable-value" data-path="releases/${releaseIndex}/extra_versions/${versionKey}/year" data-band="${band.key}">${version.year ?? "N/A"}</span>
                        <button class="edit-button" style="margin-left: 5px; display: inline-block;">✏️</button></p>
                        <p><strong>Limitation:</strong> <span class="editable-value" data-path="releases/${releaseIndex}/extra_versions/${versionKey}/limitation" data-band="${band.key}">${version.limitation ?? "N/A"}</span>
                        <button class="edit-button" style="margin-left: 5px; display: inline-block;">✏️</button></p>
                        <p><strong>Extra Info:</strong> <span class="editable-value" data-path="releases/${releaseIndex}/extra_versions/${versionKey}/extra_info" data-band="${band.key}">${version.extra_info ?? "N/A"}</span>
                        <button class="edit-button" style="margin-left: 5px; display: inline-block;">✏️</button></p>
                        <p><strong>Cover Image:</strong> <span class="editable-value" data-path="releases/${releaseIndex}/extra_versions/${versionKey}/cover_image" data-band="${band.key}">${version.cover_image ?? "N/A"}</span>
                        <button class="edit-button" style="margin-left: 5px; display: inline-block;">✏️</button></p>
                        ${version.cover_image ? `<div style="margin: 10px 0;"><img src="${version.cover_image}" alt="Version Cover" style="max-width: 150px; max-height: 150px; border: 1px solid #ccc;" /></div>` : ''}
                        <button class="delete-version-button" data-version-key="${versionKey}" data-band="${band.key}" data-release-index="${releaseIndex}" style="background-color: #cc0000; color: white; border: none; padding: 5px 10px; cursor: pointer; margin-top: 10px;">🗑️ Delete Version</button>
                    </div>
                `;
            });
            releaseHTML += `</div>`;
        } else {
            releaseHTML += `<p>No extra versions added yet.</p>`;
        }

        releaseHTML += `<button id="addVersionButton" style="background-color: #aa0000; color: white; border: none; padding: 10px 20px; cursor: pointer; margin-top: 10px;">➕ Add Extra Version</button>`;

        // Tracklist section
        if (release.tracks && Object.keys(release.tracks).length > 0) {
            releaseHTML += `<hr><h2>Tracklist</h2>`;
            releaseHTML += `<ol>`;
            Object.entries(release.tracks).forEach(([trackIndex, trackData]) => {
                const trackName = typeof trackData === 'object' ? trackData.name : trackData;
                releaseHTML += `
                    <li>
                        <span class="editable-value" data-path="releases/${releaseIndex}/tracks/${trackIndex}/name" data-band="${band.key}">${trackName}</span>
                        <button class="edit-button" style="margin-left: 5px; display: inline-block;">✏️</button>
                        <button class="lyrics-button" data-release-index="${releaseIndex}" data-track-index="${trackIndex}" data-band="${band.key}" style="margin-left: 5px; display: inline-block; background-color: #8B0000; color: white; border: none; padding: 2px 6px; cursor: pointer;">📝 Lyrics</button>
                    </li>
                `;
            });
            releaseHTML += `</ol>`;
            releaseHTML += `<div style="margin-top:5px">
                <button class="add-track-button" data-release-index="${releaseIndex}" data-band="${band.key}" style="margin-right:5px">➕ Add Track</button>
                <button class="add-multiple-tracks-button" data-release-index="${releaseIndex}" data-band="${band.key}" data-count="2" style="margin-right:3px; padding: 2px 6px; font-size: 12px;">+2</button>
                <button class="add-multiple-tracks-button" data-release-index="${releaseIndex}" data-band="${band.key}" data-count="3" style="margin-right:3px; padding: 2px 6px; font-size: 12px;">+3</button>
                <button class="add-multiple-tracks-button" data-release-index="${releaseIndex}" data-band="${band.key}" data-count="4" style="margin-right:3px; padding: 2px 6px; font-size: 12px;">+4</button>
                <button class="add-multiple-tracks-button" data-release-index="${releaseIndex}" data-band="${band.key}" data-count="5" style="margin-right:3px; padding: 2px 6px; font-size: 12px;">+5</button>
            </div>`;
        }

        document.getElementById("release-content").innerHTML = releaseHTML;
        attachEditListeners();

        // Add event listeners for version management
        document.getElementById("addVersionButton").addEventListener("click", async () => {
            const newVersion = {
                format: "undefined",
                label: "undefined",
                year: "undefined",
                limitation: "undefined",
                extra_info: "undefined",
                cover_image: "undefined"
            };

            try {
                // Get current extra versions or create empty object
                const extraVersionsRef = ref(db, `bands/${band.key}/releases/${releaseIndex}/extra_versions`);
                const extraVersionsSnapshot = await get(extraVersionsRef);
                const currentVersions = extraVersionsSnapshot.exists() ? extraVersionsSnapshot.val() : {};
                
                // Find next available key
                const nextKey = Object.keys(currentVersions).length;
                
                // Add new version
                await set(ref(db, `bands/${band.key}/releases/${releaseIndex}/extra_versions/${nextKey}`), newVersion);
                await logChange(db, band.key, `releases/${releaseIndex}/extra_versions/${nextKey}`, "New Version Added", JSON.stringify(newVersion));
                
                // Award points to user for adding a version
                const user = auth.currentUser;
                if (user) {
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
                    
                    const userRef = ref(db, `users/${properUsername}/points`);
                    const snapshot = await get(userRef);
                    let currentPoints = 0;
                    if (snapshot.exists()) {
                        currentPoints = snapshot.val();
                    }

                    await set(userRef, currentPoints + 1);
                    
                    // Award monthly version points
                    console.log('💿 Attempting to award monthly version points...');
                    console.log('window.monthlyPoints available:', !!window.monthlyPoints);
                    if (window.monthlyPoints && window.monthlyPoints.awardMonthlyVersionPoints) {
                        console.log('✅ Calling awardMonthlyVersionPoints...');
                        window.monthlyPoints.awardMonthlyVersionPoints();
                    } else {
                        console.log('❌ monthlyPoints or awardMonthlyVersionPoints not available');
                    }
                }
                
                location.reload();
            } catch (err) {
                alert("Failed to add new version: " + err.message);
            }
        });

        // Add event listeners for delete version buttons
        document.querySelectorAll(".delete-version-button").forEach(button => {
            button.addEventListener("click", async () => {
                const versionKey = button.getAttribute("data-version-key");
                const bandKey = button.getAttribute("data-band");
                const releaseIndex = button.getAttribute("data-release-index");
                
                if (confirm("Are you sure you want to delete this version?")) {
                    try {
                        await set(ref(db, `bands/${bandKey}/releases/${releaseIndex}/extra_versions/${versionKey}`), null);
                        await logChange(db, bandKey, `releases/${releaseIndex}/extra_versions/${versionKey}`, "Version Deleted", "null");
                        location.reload();
                    } catch (err) {
                        alert("Failed to delete version: " + err.message);
                    }
                }
            });
        });

        // Add event listeners for add track buttons
        document.querySelectorAll(".add-track-button").forEach(button => {
            button.addEventListener("click", async () => {
                const releaseIndex = button.getAttribute("data-release-index");
                const bandKey = button.getAttribute("data-band");

                const tracklistRef = ref(db, `bands/${bandKey}/releases/${releaseIndex}/tracks`);
                const snapshot = await get(tracklistRef);
                const currentTracks = snapshot.exists() ? snapshot.val() : {};

                const nextIndex = Object.keys(currentTracks).length;
                const newTrack = { name: "undefined" };

                try {
                    await set(ref(db, `bands/${bandKey}/releases/${releaseIndex}/tracks/${nextIndex}`), newTrack);
                    await logChange(db, bandKey, `releases/${releaseIndex}/tracks/${nextIndex}`, "Track added", JSON.stringify(newTrack));
                    location.reload();
                } catch (err) {
                    alert("Failed to add track: " + err.message);
                }
            });
        });

        // Add event listeners for multiple track buttons
        document.querySelectorAll(".add-multiple-tracks-button").forEach(button => {
            button.addEventListener("click", async () => {
                const releaseIndex = button.getAttribute("data-release-index");
                const bandKey = button.getAttribute("data-band");
                const count = parseInt(button.getAttribute("data-count"));

                const tracklistRef = ref(db, `bands/${bandKey}/releases/${releaseIndex}/tracks`);
                const snapshot = await get(tracklistRef);
                const currentTracks = snapshot.exists() ? snapshot.val() : {};

                const nextIndex = Object.keys(currentTracks).length;

                try {
                    for (let i = 0; i < count; i++) {
                        const newTrack = { name: "undefined" };
                        await set(ref(db, `bands/${bandKey}/releases/${releaseIndex}/tracks/${nextIndex + i}`), newTrack);
                        await logChange(db, bandKey, `releases/${releaseIndex}/tracks/${nextIndex + i}`, "Track added", JSON.stringify(newTrack));
                    }
                    location.reload();
                } catch (err) {
                    alert("Failed to add tracks: " + err.message);
                }
            });
        });

        // Add event listeners for lyrics buttons
        document.querySelectorAll(".lyrics-button").forEach(button => {
            button.addEventListener("click", async () => {
                const releaseIndex = button.getAttribute("data-release-index");
                const trackIndex = button.getAttribute("data-track-index");
                const bandKey = button.getAttribute("data-band");

                // Get current track data
                const trackRef = ref(db, `bands/${bandKey}/releases/${releaseIndex}/tracks/${trackIndex}`);
                const trackSnapshot = await get(trackRef);
                const trackData = trackSnapshot.exists() ? trackSnapshot.val() : {};
                const currentLyrics = trackData.lyrics || '';

                // Create lyrics editor modal
                const modal = document.createElement("div");
                modal.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(0, 0, 0, 0.7);
                    z-index: 1000;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                `;

                modal.innerHTML = `
                    <div style="
                        background: #0a0a0a;
                        padding: 20px;
                        border-radius: 8px;
                        width: 80%;
                        max-width: 600px;
                        max-height: 80%;
                        overflow-y: auto;
                    ">
                        <h3>Edit Lyrics</h3>
                        <p><strong>Track:</strong> ${trackData.name || 'Unknown Track'}</p>
                        <textarea id="lyrics-editor" rows="15" style="width: 100%; margin: 10px 0; font-family: monospace;">${currentLyrics}</textarea>
                        <div style="margin-top: 15px;">
                            <button id="save-lyrics" style="color: white; border: none; padding: 8px 16px; margin-right: 10px; cursor: pointer;">💾 Save Lyrics</button>
                            <button id="cancel-lyrics" style="color: white; border: none; padding: 8px 16px; cursor: pointer;">❌ Cancel</button>
                        </div>
                    </div>
                `;

                document.body.appendChild(modal);

                // Save lyrics
                document.getElementById("save-lyrics").addEventListener("click", async () => {
                    const newLyrics = document.getElementById("lyrics-editor").value;
                    
                    try {
                        const updatedTrackData = { 
                            ...trackData, 
                            name: trackData.name || 'Unknown Track',
                            lyrics: newLyrics 
                        };
                        await set(ref(db, `bands/${bandKey}/releases/${releaseIndex}/tracks/${trackIndex}`), updatedTrackData);
                        await logChange(db, bandKey, `releases/${releaseIndex}/tracks/${trackIndex}/lyrics`, currentLyrics, newLyrics);
                        
                        document.body.removeChild(modal);
                        location.reload();
                    } catch (err) {
                        alert("Failed to save lyrics: " + err.message);
                    }
                });

                // Cancel
                document.getElementById("cancel-lyrics").addEventListener("click", () => {
                    document.body.removeChild(modal);
                });

                // Close modal when clicking outside
                modal.addEventListener("click", (e) => {
                    if (e.target === modal) {
                        document.body.removeChild(modal);
                    }
                });
            });
        });

    } catch (err) {
        console.error("Firebase error:", err);
    }
})
