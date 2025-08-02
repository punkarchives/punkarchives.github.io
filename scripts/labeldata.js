import { initializeApp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js";
import { getDatabase, ref, get, child } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-database.js";

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

document.addEventListener("DOMContentLoaded", async function () {
  const urlParams = new URLSearchParams(window.location.search);
  const labelName = urlParams.get("label");
  const labelName2 = urlParams.get("label");

  if (!labelName) {
    document.getElementById("label-content").innerHTML = "<h1>No label selected.</h1>";
    return;
  }

  try {
    const dbRef = ref(db);

    const labelsSnapshot = await get(child(dbRef, `labels`));
    const labels = labelsSnapshot.exists() ? labelsSnapshot.val() : {};
    const labelKey = Object.keys(labels).find(key => labels[key].label_name === labelName);
    const label = labels[labelKey];

    if (!label) {
      document.getElementById("label-content").innerHTML = "<h1>Label not found.</h1>";
      return;
    }

    let labelHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h1>${label.label_name} <a href="labeledit.html?label=${encodeURIComponent(labelName2)}"><font size="4" face="Arial">EDIT</font></a></h1>
          <p><strong>Location:</strong> ${label.location}</p>
          <p><strong>Years Active:</strong> ${label.years_active}</p>
          <p><strong>Description:</strong> ${label.description}</p>
          ${label.official_links && label.official_links.website ? `<p><strong>Official Website:</strong> <a href="${label.official_links.website}" target="_blank">${label.official_links.website}</a></p>` : ""}
        </div>
        <div>
          ${label.logo ? `<img src="${label.logo}" alt="${label.label_name} Logo" style="max-width: 200px; height: auto;" />` : ""}
        </div>
      </div>

<h2>Artists:</h2>
<ul>
  ${(label.bands || "")
    .split(",")
    .map(band => band.trim())
    .filter(band => band)
    .map(band => `<li><a href="band.html?band=${encodeURIComponent(band)}">${band}</a></li>`)
    .join("")}
</ul>

    `;

    document.getElementById("label-content").innerHTML = labelHTML;

    const bandsSnapshot = await get(child(dbRef, `bands`));
    const bands = bandsSnapshot.exists() ? Object.values(bandsSnapshot.val()) : [];

    let releases = [];

    bands.forEach(band => {
      (band.releases || []).forEach(release => {
        if (release.label === labelName) {
          releases.push({
            ...release,
            artist: band.band_name
          });
        }
      });
    });

    if (label.compilations) {
      Object.values(label.compilations).forEach(compilation => {
        releases.push({
          ...compilation,
          artist: compilation.artists,
          release_type: "Compilation",
          tracks: Object.values(compilation.tracks || {})
        });
      });
    }

    releases.sort((a, b) => {
      const yearA = parseInt((a.year?.match(/\b\d{4}\b/) || [0])[0], 10);
      const yearB = parseInt((b.year?.match(/\b\d{4}\b/) || [0])[0], 10);
      return yearA - yearB;
    });

    let releasesHTML = "<h2>Releases:</h2>";

    releases.forEach((release, index) => {
    let statusText = "";
    if (release.flag === "Delete") {
      statusText = ` <span style="color: red; font-weight: bold;">[Marked for Deletion]</span>`;
    } else if (release.flag === "Restore") {
      statusText = ` <span style="color: green; font-weight: bold;">[Marked for Restore]</span>`;
    }
      releasesHTML += `
        <div style="margin-bottom: 10px;">
          <u>
          <h3 class="release-title" data-image="${release.cover_image}" style="margin-bottom: 5px; cursor: pointer; display: inline-block;">
            ${release.title}${statusText}
          </h3>
          </u>
          <button class="download-image" data-image="${release.cover_image}" style="margin-left: 10px;">Download Image</button>
          <table class="release-details" style="border-collapse: collapse; border: 2px solid #aa0000;">
            <tr><td style="border: 1px solid #aa0000;"><strong>Artist(s):</strong></td><td style="border: 1px solid #aa0000;">${release.artist}</td></tr>
            <tr><td style="border: 1px solid #aa0000;"><strong>Label:</strong></td><td style="border: 1px solid #aa0000;">${release.label || "N/A"}</td></tr>
            <tr><td style="border: 1px solid #aa0000;"><strong>Release Date:</strong></td><td style="border: 1px solid #aa0000;">${release.year || "Unknown"}</td></tr>
            <tr><td style="border: 1px solid #aa0000;"><strong>Type:</strong></td><td style="border: 1px solid #aa0000;">${release.release_type || "N/A"}</td></tr>
            <tr><td style="border: 1px solid #aa0000;"><strong>Format:</strong></td><td style="border: 1px solid #aa0000;">${release.physical_format || "N/A"}</td></tr>
            <tr><td style="border: 1px solid #aa0000;"><strong>Limitation:</strong></td><td style="border: 1px solid #aa0000;">${release.limitation || "N/A"}</td></tr>
            <tr><td style="border: 1px solid #aa0000;"><strong>Extra Info:</strong></td><td style="border: 1px solid #aa0000;">${release.extra_info || "N/A"}</td></tr>
          </table>

          <button class="toggle-tracks" data-index="${index}" 
            style="display: block; margin-top: 5px; background: black; color: white; border: 1px solid red; padding: 5px;">
            Show Tracklist
          </button>
          <ol class="tracklist" id="tracklist-${index}" 
            style="display: none; margin-top: 5px; padding-left: 20px;">
            ${(release.tracks || []).map(track => `<li>${track}</li>`).join("")}
          </ol>
        </div>
      `;
    });

    if (releases.length === 0) {
      releasesHTML += "<p>No releases found for this label.</p>";
    }

    document.getElementById("label-content").innerHTML += releasesHTML;

    // Interactivity
    setTimeout(() => {
      document.querySelectorAll(".toggle-tracks").forEach(button => {
        button.addEventListener("click", function () {
          const index = this.getAttribute("data-index");
          const tracklist = document.getElementById(`tracklist-${index}`);
          tracklist.style.display = tracklist.style.display === "none" ? "block" : "none";
          this.textContent = tracklist.style.display === "none" ? "Show Tracklist" : "Hide Tracklist";
        });
      });

      const albumCover = document.createElement("img");
      albumCover.id = "album-cover";
      albumCover.style.position = "absolute";
      albumCover.style.width = "200px";
      albumCover.style.border = "2px solid white";
      albumCover.style.display = "none";
      albumCover.style.background = "black";
      albumCover.style.padding = "5px";
      albumCover.style.zIndex = "1000";
      albumCover.style.pointerEvents = "none";
      document.body.appendChild(albumCover);

      document.querySelectorAll(".release-title").forEach(title => {
        title.addEventListener("mouseover", function () {
          albumCover.src = this.getAttribute("data-image");
          albumCover.style.display = "block";
        });
        title.addEventListener("mousemove", event => {
          albumCover.style.top = `${event.pageY + 10}px`;
          albumCover.style.left = `${event.pageX + 10}px`;
        });
        title.addEventListener("mouseleave", () => albumCover.style.display = "none");
      });

      document.querySelectorAll(".download-image").forEach(button => {
        button.addEventListener("click", function () {
          const link = document.createElement("a");
          link.href = this.getAttribute("data-image");
          link.download = link.href.split("/").pop();
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        });
      });
    }, 100);

  } catch (error) {
    console.error("Error:", error);
    document.getElementById("label-content").innerHTML = "<h1>Error loading label data.</h1>";
  }
});