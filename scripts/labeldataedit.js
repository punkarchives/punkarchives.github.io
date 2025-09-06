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
        await push(ref(db, `logs/${labelKey}`), logEntry);
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
            const labelKey = span.getAttribute("data-label");
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
                    await set(ref(db, `labels/${labelKey}/${fieldPath}`), newValue);
                    await logChange(db, labelKey, fieldPath, currentValue, newValue);
                    const isMemberField = fieldPath.startsWith("members/");
                    container.innerHTML = `
                        ${!isMemberField ? `<strong>${capitalize(fieldName)}:</strong>` : ""}
                        <span class="editable-value" data-path="${fieldPath}" data-label="${labelKey}">${newValue}</span>
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
                container.innerHTML = `
                    ${!isMemberField ? `<strong>${capitalize(fieldName)}:</strong>` : ""}
                    <span class="editable-value" data-path="${fieldPath}" data-label="${labelKey}">${currentValue}</span>
                    <button class="edit-button" style="margin-left: 5px; display: inline-block;">✏️</button>
                `;
                attachEditListeners();
            });
        });
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    const labelContainer = document.getElementById("label-content");
auth.onAuthStateChanged((user) => {
  if (!user) {
    // User not logged in, redirect to login page or homepage
    window.location.href = '/login.html';
  }
});
    console.log("DOM fully loaded.");
    if (!labelContainer) {
        console.error("label-content element is missing in the DOM.");
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const labelName = urlParams.get("label");
    const labelName2 = urlParams.get("label");

    if (!labelName) {
        labelContainer.innerHTML = "<h2>No label selected. Add ?label=label Name to the URL.</h2>";
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
        const label = labels.find(b => b.label_name.toLowerCase() === labelName.toLowerCase());
        if (!label) {
            labelContainer.innerHTML = `<h2>label '${labelName}' not found.</h2>`;
            return;
        }

        let labelHTML = `<h1>${label.label_name} <a href="label.html?label=${encodeURIComponent(labelName2)}"><font size="4" face="Arial">RETURN</font></a></h1>`;

        const editableField = (key, val, labelKey) => `
            <p><strong>${key.replace("_", " ")}:</strong>
            <span class="editable-value" data-path="${key}" data-label="${labelKey}">${val ?? "N/A"}</span>
            <button class="edit-button" style="margin-left: 5px; display: inline-block;">✏️</button></p>`;

        labelHTML += ["location", "years_active", "description", "bands", "logo"]
            .map(field => editableField(field, label[field], label.key)).join("");

        if (label.compilations?.length) {
            labelHTML += `<hr><h2>Compilations</h2>`;
            const sortedReleases = label.compilations
                .map((r, idx) => ({ ...r, originalIndex: idx }))
                .sort((a, b) => (parseInt(a.year) || 0) - (parseInt(b.year) || 0));

            sortedReleases.forEach(r => {
                const idx = r.originalIndex;
                labelHTML += `<div style="margin-bottom:20px">
                    <h3><strong>Title: </strong><span class="editable-value" data-path="compilations/${r.originalIndex}/title" data-label="${label.key}">${r?.title ?? "N/A"}</span><button class="edit-button" style="margin-left: 5px; display: inline-block;">✏️</button>
</h3>

        
                    ${["cover_image", "artists", "label", "year", "release_type", "physical_format", "limitation", "extra_info", "flag"]
                        .map(field => `<p><strong>${capitalize(field.replace(/_/g, " "))}:</strong> 
                        <span class="editable-value" data-path="compilations/${idx}/${field}" data-label="${label.key}">${r?.[field] ?? "N/A"}</span>
                        <button class="edit-button" style="margin-left: 5px; display: inline-block;">✏️</button></p>`).join("")}
                </div><p>(flag must be 'Delete' or 'Restore)</p><h2></h2>`;
            });

        }

	
            labelHTML += `<button id="addReleaseButton">Add New Compilation</button>`;
        labelContainer.innerHTML = labelHTML;
        console.log("label content loaded. Edit buttons should now be visible.");
        attachEditListeners();

        document.getElementById("addReleaseButton")?.addEventListener("click", async () => {
            const newRelease = {
                title: "undefined",
                cover_image: "undefined",
                label: "undefined",
                year: "undefined",
                release_type: "undefined",
                physical_format: "undefined",
                limitation: "undefined",
                extra_info: "undefined",
		artists: "undefined"
            };
            try {
                const nextIndex = label.compilations?.length || 0;
                await set(ref(db, `labels/${label.key}/compilations/${nextIndex}`), newRelease);
                await logChange(db, label.key, `releases/${nextIndex}`, "New Compilation Added", JSON.stringify(newRelease));
                
                // Award points to user for adding a compilation
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
                }
                
                location.reload();
            } catch (err) {
                alert("Failed to add new compilation: " + err.message);
            }
        });

    } catch (err) {
        console.error("Firebase error:", err);
    }
});
