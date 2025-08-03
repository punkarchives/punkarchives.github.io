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
        const snapshot = await get(child(dbRef, 'bands'));
        
        if (!snapshot.exists()) {
            resultsList.innerHTML = "<li style='color: #888; padding: 5px;'>No bands found</li>";
            resultsList.style.display = "block";
            return;
        }

        const bandsRaw = snapshot.val();
        const bands = Object.entries(bandsRaw).map(([key, val]) => ({
            key,
            ...val
        }));
            resultsList.innerHTML = "";
            let matches = [];

            bands.forEach(band => {
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

                updatePriority(band.band_name, `Band Name: ${band.band_name}`);
                updatePriority(band.Location, `Location: ${band.Location}`);

                // Search in Genres array if it exists
                if (Array.isArray(band.Genres)) {
                    for (let g of band.Genres) {
                        updatePriority(g, `Genre: ${band.Genres.join(", ")}`);
                    }
                }

                // Search in Genres string if it exists
                if (typeof band.Genres === "string") {
                    updatePriority(band.Genres, `Genre: ${band.Genres}`);
                }

                if (Array.isArray(band.releases)) {
                    for (let release of band.releases) {
                        if (release.title) updatePriority(release.title, `Release: ${release.title}`);
                        if (release.label) updatePriority(release.label, `Label: ${release.label}`);
                    }
                }

                if (priority !== Infinity) {
                    matches.push({ band, matchText, priority });
                }
            });

            // **Sort by priority (lower index appears first)**
            matches.sort((a, b) => a.priority - b.priority);

            if (matches.length === 0) {
                resultsList.innerHTML = "<li style='color: #888; padding: 5px;'>No results</li>";
            } else {
                matches.forEach(({ band, matchText }) => {
                    let li = document.createElement("li");
                    li.style.padding = "5px";
                    li.style.cursor = "pointer";
                    li.style.color = "#ffffff";

                    li.innerHTML = `<strong>Band:</strong> ${band.band_name}`;
                    if (matchText) {
                        li.innerHTML += `<br><span style="color: #888; font-size: 14px;">${matchText}</span>`;
                    }

                    li.onclick = function() {
                        window.location.href = `band.html?band=${encodeURIComponent(band.band_name)}`;
                    };

                    resultsList.appendChild(li);
                });
            }

            resultsList.style.display = "block";
        } catch (error) {
            console.error("Error loading band data:", error);
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