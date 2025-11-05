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

async function searchUsers() {
    const query = document.getElementById("searchBar").value.toLowerCase();
    const resultsList = document.getElementById("searchResults");

    if (query.length === 0) {
        resultsList.style.display = "none";
        return;
    }

    try {
        const dbRef = ref(db);
        const snapshot = await get(child(dbRef, 'users'));
        
        if (!snapshot.exists()) {
            resultsList.innerHTML = "<li style='color: #888; padding: 5px;'>No users found</li>";
            resultsList.style.display = "block";
            return;
        }

        const usersRaw = snapshot.val();
        const users = Object.entries(usersRaw).map(([key, val]) => ({
            username: key,
            ...val
        }));
        
        resultsList.innerHTML = "";
        let matches = [];

        // Get top 3 users by points for crown display
        const top3Users = [...users]
            .sort((a, b) => (b.points || 0) - (a.points || 0))
            .slice(0, 3)
            .map(user => user.username);

        users.forEach(user => {
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

            updatePriority(user.username, `Username: ${user.username}`);

            if (priority !== Infinity) {
                matches.push({ user, matchText, priority });
            }
        });

        // **Sort by priority (lower index appears first)**
        matches.sort((a, b) => a.priority - b.priority);

        if (matches.length === 0) {
            resultsList.innerHTML = "<li style='color: #888; padding: 5px;'>No results</li>";
        } else {
            matches.forEach(({ user, matchText }) => {
                let li = document.createElement("li");
                li.style.padding = "5px";
                li.style.cursor = "pointer";
                li.style.color = "#ffffff";

                const isTop3 = top3Users.includes(user.username);
                const displayName = isTop3 ? `👑 ${user.username}` : user.username;
                const displayColor = isTop3 ? "#FFD700" : "#ffffff";

                li.innerHTML = `<strong style="color: ${displayColor};">User:</strong> ${displayName}`;
                if (user.points !== undefined) {
                    li.innerHTML += `<br><span style="color: #888; font-size: 14px;">Points: ${user.points}</span>`;
                }

                li.onclick = function() {
                    window.location.href = `user.html?user=${encodeURIComponent(user.username)}`;
                };

                resultsList.appendChild(li);
            });
        }

        resultsList.style.display = "block";
    } catch (error) {
        console.error("Error loading user data:", error);
        resultsList.innerHTML = "<li style='color: #888; padding: 5px;'>Error loading data</li>";
        resultsList.style.display = "block";
    }
}

// Add event listener for search input
document.addEventListener('DOMContentLoaded', () => {
    const searchBar = document.getElementById('searchBar');
    if (searchBar) {
        searchBar.addEventListener('input', searchUsers);
    }
});

