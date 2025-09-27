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

async function logChange(db, labelKey, field, oldValue, newValue) {
    const user = auth.currentUser;
    const username = user && user.email ? user.email.replace("@punkarchives.com", "") : "anonymous";
    const logEntry = {
        labelKey,
        field,
        oldValue,
        newValue,
        username,
        timestamp: new Date().toISOString()
    };
    try {
        await set(push(ref(db, 'logs')), logEntry);
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
            const labelKey = span.getAttribute("data-label");
            const currentValue = span.textContent;
            const container = span.parentElement;

            // Check if this is a trusted-only field and verify user permissions
            if (this.classList.contains("trusted-only")) {
                const user = auth.currentUser;
                if (!user) {
                    alert("You must be logged in to edit this field.");
                    return;
                }

                // Check if user is trusted
                const lowercaseUsername = user.email.replace("@punkarchives.com", "").toLowerCase();
                const properUsername = user.email.replace("@punkarchives.com", "");

                const possiblePaths = [
                    `users/${user.uid}`,
                    `users/${properUsername}`,
                    `users/${lowercaseUsername}`,
                    `users/nxdx`
                ];

                let isTrusted = false;
                for (const path of possiblePaths) {
                    const userRef = ref(db, path);
                    get(userRef).then(userSnapshot => {
                        if (userSnapshot.exists()) {
                            const userData = userSnapshot.val();
                            if (userData.trusted === "true") {
                                isTrusted = true;
                            }
                        }
                    });
                }

                if (!isTrusted) {
                    alert("You don't have permission to edit this field.");
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
                    await set(ref(db, `labels/${labelKey}/${fieldPath}`), newValue);
                    await logChange(db, labelKey, fieldPath, currentValue, newValue);
                    const isMemberField = fieldPath.startsWith("members/");
                    const isTrackField = fieldPath.includes("/tracks/");
                    const isStoryField = fieldPath.includes("/story");
                    
                    // Rebuild the original HTML structure based on field type
                    if (isStoryField) {
                        container.innerHTML = `
                            <span class="editable-value" data-path="${fieldPath}" data-label="${labelKey}">${newValue}</span>
                            <button class="edit-button" style="margin-left: 5px; display: inline-block;">✏️</button>
                        `;
                    } else if (isTrackField) {
                        // For track fields, only rebuild the track name and buttons, not the entire structure
                        const trackIndex = fieldPath.split('/')[3]; // Get track index from path
                        const releaseIndex = fieldPath.split('/')[1]; // Get release index from path
                        
                        // Only rebuild the track name span and its immediate buttons
                        container.innerHTML = `<span class="editable-value" data-path="${fieldPath}" data-label="${labelKey}">${newValue}</span>
                            <button class="edit-button" style="margin-left: 5px; display: inline-block;">✏️</button>
                            <button class="lyrics-button" data-release-index="${releaseIndex}" data-track-index="${trackIndex}" data-label="${labelKey}" style="margin-left: 5px; display: inline-block; background-color: #8B0000; color: white; border: none; padding: 2px 6px; cursor: pointer;">📝 Lyrics</button>`;
                        
                        attachEditListeners();
                        
                        // Reattach lyrics button event listener
                        const lyricsBtn = container.querySelector('.lyrics-button');
                        if (lyricsBtn) {
                            lyricsBtn.addEventListener("click", async () => {
                                // Get current track data
                                const trackRef = ref(db, `labels/${labelKey}/compilations/${releaseIndex}/tracks/${trackIndex}`);
                                const trackSnapshot = await get(trackRef);
                                const trackData = trackSnapshot.exists() ? trackSnapshot.val() : {};
                                const currentLyrics = trackData.lyrics || '';

                                // Create lyrics editor modal
                                const modal = document.createElement("div");
                                modal.style.position = "fixed";
                                modal.style.top = "0";
                                modal.style.left = "0";
                                modal.style.width = "100%";
                                modal.style.height = "100%";
                                modal.style.backgroundColor = "rgba(0,0,0,0.8)";
                                modal.style.display = "flex";
                                modal.style.justifyContent = "center";
                                modal.style.alignItems = "center";
                                modal.style.zIndex = "10000";

                                modal.innerHTML = `
                                    <div style="
                                        background: #333;
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
                                        await set(ref(db, `labels/${labelKey}/compilations/${releaseIndex}/tracks/${trackIndex}`), updatedTrackData);
                                        await logChange(db, labelKey, `compilations/${releaseIndex}/tracks/${trackIndex}/lyrics`, currentLyrics, newLyrics);
                                        
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
                        }
                    } else {
                        container.innerHTML = `
                            <strong>${capitalize(fieldName)}:</strong>
                            <span class="editable-value" data-path="${fieldPath}" data-label="${labelKey}">${newValue}</span>
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
                        <span class="editable-value" data-path="${fieldPath}" data-label="${labelKey}">${currentValue}</span>
                        <button class="edit-button" style="margin-left: 5px; display: inline-block;">✏️</button>
                    `;
                } else if (isTrackField) {
                    // For track fields, only rebuild the track name and buttons, not the entire structure
                    const trackIndex = fieldPath.split('/')[3]; // Get track index from path
                    const releaseIndex = fieldPath.split('/')[1]; // Get release index from path
                    
                    // Only rebuild the track name span and its immediate buttons
                    container.innerHTML = `<span class="editable-value" data-path="${fieldPath}" data-label="${labelKey}">${currentValue}</span>
                        <button class="edit-button" style="margin-left: 5px; display: inline-block;">✏️</button>
                        <button class="lyrics-button" data-release-index="${releaseIndex}" data-track-index="${trackIndex}" data-label="${labelKey}" style="margin-left: 5px; display: inline-block; background-color: #8B0000; color: white; border: none; padding: 2px 6px; cursor: pointer;">📝 Lyrics</button>`;
                    
                    attachEditListeners();
                    
                    // Reattach lyrics button event listener
                    const lyricsBtn = container.querySelector('.lyrics-button');
                    if (lyricsBtn) {
                        lyricsBtn.addEventListener("click", async () => {
                            // Get current track data
                            const trackRef = ref(db, `labels/${labelKey}/compilations/${releaseIndex}/tracks/${trackIndex}`);
                            const trackSnapshot = await get(trackRef);
                            const trackData = trackSnapshot.exists() ? trackSnapshot.val() : {};
                            const currentLyrics = trackData.lyrics || '';

                            // Create lyrics editor modal
                            const modal = document.createElement("div");
                            modal.style.position = "fixed";
                            modal.style.top = "0";
                            modal.style.left = "0";
                            modal.style.width = "100%";
                            modal.style.height = "100%";
                            modal.style.backgroundColor = "rgba(0,0,0,0.8)";
                            modal.style.display = "flex";
                            modal.style.justifyContent = "center";
                            modal.style.alignItems = "center";
                            modal.style.zIndex = "10000";

                            modal.innerHTML = `
                                <div style="
                                    background: #333;
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
                                    await set(ref(db, `labels/${labelKey}/compilations/${releaseIndex}/tracks/${trackIndex}`), updatedTrackData);
                                    await logChange(db, labelKey, `compilations/${releaseIndex}/tracks/${trackIndex}/lyrics`, currentLyrics, newLyrics);
                                    
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
                    }
                } else {
                    container.innerHTML = `
                        <strong>${capitalize(fieldName)}:</strong>
                        <span class="editable-value" data-path="${fieldPath}" data-label="${labelKey}">${currentValue}</span>
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
    const labelName = urlParams.get("label");
    const compilationTitle = urlParams.get("compilation");

    if (!labelName || !compilationTitle) {
        document.getElementById("compilation-content").innerHTML = "<h2>No label or compilation selected. Add ?label=Label Name&compilation=Compilation Title to the URL.</h2>";
        return;
    }

    const dbRef = ref(db);
    try {
        const snapshot = await get(child(dbRef, 'labels'));
        if (!snapshot.exists()) return;

        const labelsRaw = snapshot.val();
        const labels = Object.entries(labelsRaw).map(([key, val]) => ({
            key,
            ...val
        }));
        const label = labels.find(l => l.label_name === labelName);
        if (!label) {
            document.getElementById("compilation-content").innerHTML = `<h2>Label '${labelName}' not found.</h2>`;
            return;
        }

        // Find the specific compilation
        const compilationIndex = label.compilations?.findIndex(c => c.title === compilationTitle);
        if (compilationIndex === -1 || !label.compilations[compilationIndex]) {
            document.getElementById("compilation-content").innerHTML = `<h2>Compilation '${compilationTitle}' not found.</h2>`;
            return;
        }

        const compilation = label.compilations[compilationIndex];

        let compilationHTML = `<h1>${compilation.title} <a href="compilation.html?label=${encodeURIComponent(labelName)}&compilation=${encodeURIComponent(compilationTitle)}"><font size="4" face="Arial">RETURN</font></a></h1>`;

        const editableField = (key, val, labelKey, path) => `
      <p><strong>${key.replace("_", " ")}:</strong>
      <span class="editable-value" data-path="${path}" data-label="${labelKey}">${val ?? "N/A"}</span>
      <button class="edit-button" style="margin-left: 5px; display: inline-block;">✏️</button></p>`;

        // Basic compilation information
        compilationHTML +=
            editableField("Title", compilation.title, label.key, `compilations/${compilationIndex}/title`) +
            editableField("Cover Image", compilation.cover_image, label.key, `compilations/${compilationIndex}/cover_image`) +
            editableField("Artists", compilation.artists, label.key, `compilations/${compilationIndex}/artists`) +
            editableField("Label", compilation.label, label.key, `compilations/${compilationIndex}/label`) +
            editableField("Year", compilation.year, label.key, `compilations/${compilationIndex}/year`) +
            editableField("Release Type", compilation.release_type, label.key, `compilations/${compilationIndex}/release_type`) +
            editableField("Physical Format", compilation.physical_format, label.key, `compilations/${compilationIndex}/physical_format`) +
            editableField("Limitation", compilation.limitation, label.key, `compilations/${compilationIndex}/limitation`) +
            editableField("Extra Info", compilation.extra_info, label.key, `compilations/${compilationIndex}/extra_info`) +
            editableField("YouTube Link", compilation.listen, label.key, `compilations/${compilationIndex}/listen`) +
            editableField("Flag", compilation.flag, label.key, `compilations/${compilationIndex}/flag`);

        // Extra Versions Section
        compilationHTML += `<hr><h2>Extra Versions</h2>`;
        compilationHTML += `<p><em>Add different versions (CD, Vinyl, Cassette, Rereleases) without cluttering the main compilation list.</em></p>`;
        
        if (compilation.extra_versions && Object.keys(compilation.extra_versions).length > 0) {
            compilationHTML += `<div style="margin-bottom: 20px;">`;
            Object.entries(compilation.extra_versions).forEach(([versionKey, version]) => {
                compilationHTML += `
                    <div style="border: 1px solid #ccc; margin-bottom: 15px; padding: 10px; background-color: rgba(0,0,0,0.1);">
                        <h3>Version: ${version.format || 'Unknown Format'}</h3>
                        <p><strong>Format:</strong> <span class="editable-value" data-path="compilations/${compilationIndex}/extra_versions/${versionKey}/format" data-label="${label.key}">${version.format ?? "N/A"}</span>
                        <button class="edit-button" style="margin-left: 5px; display: inline-block;">✏️</button></p>
                        <p><strong>Label:</strong> <span class="editable-value" data-path="compilations/${compilationIndex}/extra_versions/${versionKey}/label" data-label="${label.key}">${version.label ?? "N/A"}</span>
                        <button class="edit-button" style="margin-left: 5px; display: inline-block;">✏️</button></p>
                        <p><strong>Year:</strong> <span class="editable-value" data-path="compilations/${compilationIndex}/extra_versions/${versionKey}/year" data-label="${label.key}">${version.year ?? "N/A"}</span>
                        <button class="edit-button" style="margin-left: 5px; display: inline-block;">✏️</button></p>
                        <p><strong>Limitation:</strong> <span class="editable-value" data-path="compilations/${compilationIndex}/extra_versions/${versionKey}/limitation" data-label="${label.key}">${version.limitation ?? "N/A"}</span>
                        <button class="edit-button" style="margin-left: 5px; display: inline-block;">✏️</button></p>
                        <p><strong>Extra Info:</strong> <span class="editable-value" data-path="compilations/${compilationIndex}/extra_versions/${versionKey}/extra_info" data-label="${label.key}">${version.extra_info ?? "N/A"}</span>
                        <button class="edit-button" style="margin-left: 5px; display: inline-block;">✏️</button></p>
                        <p><strong>Cover Image:</strong> <span class="editable-value" data-path="compilations/${compilationIndex}/extra_versions/${versionKey}/cover_image" data-label="${label.key}">${version.cover_image ?? "N/A"}</span>
                        <button class="edit-button" style="margin-left: 5px; display: inline-block;">✏️</button></p>
                        ${version.cover_image ? `<div style="margin: 10px 0;"><img src="${version.cover_image}" alt="Version Cover" style="max-width: 150px; max-height: 150px; border: 1px solid #ccc;" /></div>` : ''}
                        <button class="delete-version-button" data-version-key="${versionKey}" data-label="${label.key}" data-compilation-index="${compilationIndex}" style="background-color: #cc0000; color: white; border: none; padding: 5px 10px; cursor: pointer; margin-top: 10px;">🗑️ Delete Version</button>
                    </div>
                `;
            });
            compilationHTML += `</div>`;
        } else {
            compilationHTML += `<p>No extra versions added yet.</p>`;
        }

        compilationHTML += `<button id="addVersionButton" style="background-color: #aa0000; color: white; border: none; padding: 10px 20px; cursor: pointer; margin-top: 10px;">➕ Add Extra Version</button>`;

        // Tracklist
        compilationHTML += `<hr><h2>Tracklist:</h2><ol>`;
        if (compilation.tracks && Object.keys(compilation.tracks).length > 0) {
            Object.entries(compilation.tracks).forEach(([trackIndex, trackData]) => {
                let trackName;
                if (typeof trackData === 'object' && trackData !== null) {
                    trackName = trackData.name || 'Unknown Track';
                } else {
                    trackName = trackData || 'Unknown Track';
                }
                compilationHTML += `
                    <li>
                        <span class="editable-value" data-path="compilations/${compilationIndex}/tracks/${trackIndex}/name" data-label="${label.key}">${trackName}</span>
                        <button class="edit-button" style="margin-left: 5px; display: inline-block;">✏️</button>
                        <button class="lyrics-button" data-release-index="${compilationIndex}" data-track-index="${trackIndex}" data-label="${label.key}" style="margin-left: 5px; display: inline-block; background-color: #8B0000; color: white; border: none; padding: 2px 6px; cursor: pointer;">📝 Lyrics</button>
                    </li>
                `;
            });
        }
        compilationHTML += `</ol>`;

        // Add track buttons
        compilationHTML += `
            <div style="margin-top:5px">
                <button class="add-track-button" data-release-index="${compilationIndex}" data-label="${label.key}" style="margin-right:5px">➕ Add Track</button>
                <button class="add-multiple-tracks-button" data-release-index="${compilationIndex}" data-label="${label.key}" data-count="2" style="margin-right:3px; padding: 2px 6px; font-size: 12px;">+2</button>
                <button class="add-multiple-tracks-button" data-release-index="${compilationIndex}" data-label="${label.key}" data-count="3" style="margin-right:3px; padding: 2px 6px; font-size: 12px;">+3</button>
                <button class="add-multiple-tracks-button" data-release-index="${compilationIndex}" data-label="${label.key}" data-count="4" style="margin-right:3px; padding: 2px 6px; font-size: 12px;">+4</button>
                <button class="add-multiple-tracks-button" data-release-index="${compilationIndex}" data-label="${label.key}" data-count="5" style="margin-right:3px; padding: 2px 6px; font-size: 12px;">+5</button>
            </div>
        `;

        document.getElementById("compilation-content").innerHTML = compilationHTML;
        attachEditListeners();

        // Add event listeners for new functionality
        document.querySelectorAll(".add-track-button").forEach(button => {
            button.addEventListener("click", async () => {
                const releaseIndex = button.getAttribute("data-release-index");
                const labelKey = button.getAttribute("data-label");
                
                const tracklistRef = ref(db, `labels/${labelKey}/compilations/${releaseIndex}/tracks`);
                const snapshot = await get(tracklistRef);
                const currentTracks = snapshot.exists() ? snapshot.val() : {};
                
                const nextIndex = Object.keys(currentTracks).length;
                const newTrack = { name: "undefined" };
                
                try {
                    await set(ref(db, `labels/${labelKey}/compilations/${releaseIndex}/tracks/${nextIndex}`), newTrack);
                    await logChange(db, labelKey, `compilations/${releaseIndex}/tracks/${nextIndex}`, "Track added", JSON.stringify(newTrack));
                    location.reload();
                } catch (err) {
                    alert("Failed to add track: " + err.message);
                }
            });
        });

        document.querySelectorAll(".add-multiple-tracks-button").forEach(button => {
            button.addEventListener("click", async () => {
                const releaseIndex = button.getAttribute("data-release-index");
                const labelKey = button.getAttribute("data-label");
                const count = parseInt(button.getAttribute("data-count"));
                
                const tracklistRef = ref(db, `labels/${labelKey}/compilations/${releaseIndex}/tracks`);
                const snapshot = await get(tracklistRef);
                const currentTracks = snapshot.exists() ? snapshot.val() : {};
                
                const nextIndex = Object.keys(currentTracks).length;
                
                try {
                    for (let i = 0; i < count; i++) {
                        const newTrack = { name: "undefined" };
                        await set(ref(db, `labels/${labelKey}/compilations/${releaseIndex}/tracks/${nextIndex + i}`), newTrack);
                        await logChange(db, labelKey, `compilations/${releaseIndex}/tracks/${nextIndex + i}`, "Track added", JSON.stringify(newTrack));
                    }
                    location.reload();
                } catch (err) {
                    alert("Failed to add tracks: " + err.message);
                }
            });
        });

        // Add version button functionality
        document.getElementById("addVersionButton")?.addEventListener("click", async () => {
            const versionKey = Date.now().toString();
            const newVersion = {
                format: "Unknown Format",
                label: "N/A",
                year: "N/A",
                limitation: "N/A",
                extra_info: "N/A",
                cover_image: "N/A"
            };
            
            try {
                await set(ref(db, `labels/${label.key}/compilations/${compilationIndex}/extra_versions/${versionKey}`), newVersion);
                await logChange(db, label.key, `compilations/${compilationIndex}/extra_versions/${versionKey}`, null, "New version added");
                
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
            } catch (error) {
                console.error("Error adding version:", error);
                alert("Failed to add version: " + error.message);
            }
        });

        // Delete version button functionality
        document.querySelectorAll(".delete-version-button").forEach(button => {
            button.addEventListener("click", async () => {
                const versionKey = button.getAttribute("data-version-key");
                const labelKey = button.getAttribute("data-label");
                const compilationIndex = button.getAttribute("data-compilation-index");
                
                if (!confirm("Are you sure you want to delete this version? This action cannot be undone.")) {
                    return;
                }
                
                try {
                    await set(ref(db, `labels/${labelKey}/compilations/${compilationIndex}/extra_versions/${versionKey}`), null);
                    await logChange(db, labelKey, `compilations/${compilationIndex}/extra_versions/${versionKey}`, "Version data", null);
                    location.reload();
                } catch (error) {
                    console.error("Error deleting version:", error);
                    alert("Failed to delete version: " + error.message);
                }
            });
        });

        // Lyrics button functionality
        document.querySelectorAll(".lyrics-button").forEach(button => {
            button.addEventListener("click", async () => {
                const releaseIndex = button.getAttribute("data-release-index");
                const trackIndex = button.getAttribute("data-track-index");
                const labelKey = button.getAttribute("data-label");
                
                // Get current track data
                const trackRef = ref(db, `labels/${labelKey}/compilations/${releaseIndex}/tracks/${trackIndex}`);
                const trackSnapshot = await get(trackRef);
                const trackData = trackSnapshot.exists() ? trackSnapshot.val() : {};
                const currentLyrics = trackData.lyrics || '';

                // Create lyrics editor modal
                const modal = document.createElement("div");
                modal.style.position = "fixed";
                modal.style.top = "0";
                modal.style.left = "0";
                modal.style.width = "100%";
                modal.style.height = "100%";
                modal.style.backgroundColor = "rgba(0,0,0,0.8)";
                modal.style.display = "flex";
                modal.style.justifyContent = "center";
                modal.style.alignItems = "center";
                modal.style.zIndex = "10000";

                modal.innerHTML = `
                    <div style="
                        background: #0A0A0A;
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
                        await set(ref(db, `labels/${labelKey}/compilations/${releaseIndex}/tracks/${trackIndex}`), updatedTrackData);
                        await logChange(db, labelKey, `compilations/${releaseIndex}/tracks/${trackIndex}/lyrics`, currentLyrics, newLyrics);
                        
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
});
