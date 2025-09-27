// Firebase imports
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

const DEBUG = true; // Set to true for debugging

async function searchBands() {
    const query = document.getElementById("searchBar").value.toLowerCase();
    const resultsList = document.getElementById("searchResults");

    if (query.length === 0) {
        resultsList.style.display = "none";
        return;
    }

    try {
        const dbRef = ref(db);
        const snapshot = await get(child(dbRef, 'zines'));
        
        if (!snapshot.exists()) {
            resultsList.innerHTML = "<li style='color: #888; padding: 5px;'>No zines found</li>";
            resultsList.style.display = "block";
            return;
        }

        const zinesRaw = snapshot.val();
        const zines = Object.entries(zinesRaw).map(([key, val]) => ({
            key,
            ...val
        }));
            resultsList.innerHTML = "";
            let matches = [];

            zines.forEach(zine => {
                let matchText = "";
                let priority = Infinity; // Lower is better

                function updatePriority(field, text) {
                    if (typeof field === "string") {
                        let pos = field.toLowerCase().indexOf(query);
                        if (pos !== -1 && pos < priority) {
                            priority = pos;
                            matchText = text;
                        }
                    }
                }

                updatePriority(zine.zine_name, `Zine Name: ${zine.zine_name}`);
                updatePriority(zine.location, `Location: ${zine.location}`);

                // Search in authors array if it exists
                if (Array.isArray(zine.authors)) {
                    for (let author of zine.authors) {
                        updatePriority(author, `Author: ${zine.authors.join(", ")}`);
                    }
                }

                // Search in authors string if it exists
                if (typeof zine.authors === "string") {
                    updatePriority(zine.authors, `Author: ${zine.authors}`);
                }

                if (priority !== Infinity) {
                    matches.push({ zine, matchText, priority });
                }
            });

            // **Sort by priority (lower index appears first)**
            matches.sort((a, b) => a.priority - b.priority);

            if (matches.length === 0) {
                resultsList.innerHTML = "<li style='color: #888; padding: 5px;'>No results</li>";
            } else {
                matches.forEach(({ zine, matchText }) => {
                    let li = document.createElement("li");
                    li.style.padding = "5px";
                    li.style.cursor = "pointer";
                    li.style.color = "#ffffff";

                    li.innerHTML = `<strong>Zine:</strong> ${zine.zine_name}`;
                    if (matchText) {
                        li.innerHTML += `<br><span style="color: #888; font-size: 14px;">${matchText}</span>`;
                    }

                    li.onclick = function() {
                        window.location.href = `zine.html?zine=${encodeURIComponent(zine.zine_name)}`;
                    };

                    resultsList.appendChild(li);
                });
            }

            resultsList.style.display = "block";
        } catch (error) {
            console.error("Error loading zine data:", error);
            resultsList.innerHTML = "<li style='color: #888; padding: 5px;'>Error loading data</li>";
            resultsList.style.display = "block";
        }
    }

    // Add event listener for search input
    document.addEventListener('DOMContentLoaded', () => {
        const searchBar = document.getElementById('searchBar');
        if (searchBar) {
            searchBar.addEventListener('input', searchBands);
        }
    });
