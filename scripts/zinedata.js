import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getDatabase, ref, get, child } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js";

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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

document.addEventListener("DOMContentLoaded", function () {
    const urlParams = new URLSearchParams(window.location.search);
    const zineName = urlParams.get("zine");

    if (!zineName) {
        document.getElementById("band-content").innerHTML = "<h1>No zine selected.</h1>";
        return;
    }

function slugify(str) {
    return "zine_" + str.toLowerCase().replace(/\s+/g, "_").replace(/[^\w\-]/g, "");
}

const zineParam = urlParams.get("zine");
if (!zineParam) {
    document.getElementById("band-content").innerHTML = "<h1>No zine selected.</h1>";
    return;
}

const zineKey = slugify(zineParam);
const zineRef = ref(db, `zines/${zineKey}`);


    get(zineRef).then(snapshot => {
        if (!snapshot.exists()) {
            document.getElementById("band-content").innerHTML = "<h1>Zine not found.</h1>";
            return;
        }

        const band = snapshot.val();

        let bandHTML = `
            <h1>${zineName} <a href="zineedit.html?zine=${encodeURIComponent(zineName)}"><font size="4" face="Arial">EDIT</font></a></h1>
            <p><strong>Authors:</strong> ${(band.authors || []).join(", ")}</p>
            <p><strong>Location:</strong> ${band.location || "Unknown"}</p>
            <p><strong>Years Active:</strong> ${band.years_active || "N/A"}</p>
            <p><strong>Description:</strong> ${band.description || "N/A"}</p>
            <h2>Issues:</h2>
            <div id="issues-container"></div>
        `;

        document.getElementById("band-content").innerHTML = bandHTML;

        const issuesContainer = document.getElementById("issues-container");

        if (Array.isArray(band.issues) && band.issues.length > 0) {
            band.issues.forEach((issue, issueIndex) => {
                let issueDiv = document.createElement("div");
                issueDiv.style.marginBottom = "20px";
                issueDiv.style.textAlign = "center";

                let issueTitle = document.createElement("h3");
                issueTitle.textContent = issue.title || `Issue ${issueIndex + 1}`;
                issueDiv.appendChild(issueTitle);

                let imageContainer = document.createElement("div");
                imageContainer.style.position = "relative";
                imageContainer.style.display = "inline-block";

                let img = document.createElement("img");
                img.style.width = "500px";
                img.style.borderRadius = "0px";
                img.style.display = "block";
                img.style.margin = "0 auto";

                let images = Array.isArray(issue.images) ? issue.images : [];
                if (images.length > 0) {
                    img.src = images[0];
                    img.alt = `${issue.title} - Page 1`;
                } else {
                    img.src = "";
                    img.alt = "No images available.";
                }

                let currentIndex = 0;

                // Left (Previous) button
                let leftButton = document.createElement("button");
                leftButton.innerHTML = "&#9665;";
                leftButton.style.position = "absolute";
                leftButton.style.left = "0";
                leftButton.style.top = "50%";
                leftButton.style.transform = "translateY(-50%)";
                leftButton.style.background = "rgba(0, 0, 0, 0.5)";
                leftButton.style.color = "white";
                leftButton.style.border = "none";
                leftButton.style.padding = "10px";
                leftButton.style.cursor = "pointer";
                leftButton.style.borderRadius = "5px";
                leftButton.style.display = images.length > 1 ? "block" : "none";

                leftButton.onclick = function () {
                    if (currentIndex > 0) {
                        currentIndex--;
                        img.src = images[currentIndex];
                        img.alt = `${issue.title} - Page ${currentIndex + 1}`;
                    }
                    updateButtons();
                };

                // Right (Next) button
                let rightButton = document.createElement("button");
                rightButton.innerHTML = "&#9655;";
                rightButton.style.position = "absolute";
                rightButton.style.right = "0";
                rightButton.style.top = "50%";
                rightButton.style.transform = "translateY(-50%)";
                rightButton.style.background = "rgba(0, 0, 0, 0.5)";
                rightButton.style.color = "white";
                rightButton.style.border = "none";
                rightButton.style.padding = "10px";
                rightButton.style.cursor = "pointer";
                rightButton.style.borderRadius = "5px";
                rightButton.style.display = images.length > 1 ? "block" : "none";

                rightButton.onclick = function () {
                    if (currentIndex < images.length - 1) {
                        currentIndex++;
                        img.src = images[currentIndex];
                        img.alt = `${issue.title} - Page ${currentIndex + 1}`;
                    }
                    updateButtons();
                };

                function updateButtons() {
                    leftButton.style.display = currentIndex > 0 ? "block" : "none";
                    rightButton.style.display = currentIndex < images.length - 1 ? "block" : "none";
                }

                imageContainer.appendChild(leftButton);
                imageContainer.appendChild(img);
                imageContainer.appendChild(rightButton);
                issueDiv.appendChild(imageContainer);
                issuesContainer.appendChild(issueDiv);
            });
        } else {
            issuesContainer.innerHTML = "<p>No issues available.</p>";
        }

    }).catch(error => {
        console.error("Error loading zine data:", error);
        document.getElementById("band-content").innerHTML = "<h1>Error loading zine data.</h1>";
    });
});
