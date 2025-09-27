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

// Helper: slugify zine name for keys
function slugify(str) {
  return "zine_" + str.toLowerCase().replace(/\s+/g, "_").replace(/[^\w\-]/g, "");
}

function capitalize(text) {
  return text.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

// Log changes to firebase under logs/zines/{zineKey}
async function logChange(zineKey, field, oldValue, newValue) {
  const user = auth.currentUser;
  const username = user && user.email ? user.email.replace("@punkarchives.com", "") : "anonymous";
  const logEntry = {
    zineKey,
    field,
    oldValue,
    newValue,
    username,
    timestamp: new Date().toISOString()
  };
  try {
    await push(ref(db, `logs/zines/${zineKey}`), logEntry);
    console.log("Change logged:", logEntry);
  } catch (error) {
    console.error("Logging error:", error);
  }
}

// Inline editing helper for simple fields
function createEditableField(container, label, value, dataPath, zineKey) {
  container.innerHTML = `
    <strong>${label}:</strong>
    <span class="editable-value" data-path="${dataPath}" data-zine="${zineKey}">${value || "N/A"}</span>
    <button class="edit-button" style="margin-left:5px;">✏️</button>
  `;

  container.querySelector(".edit-button").addEventListener("click", () => {
    const span = container.querySelector(".editable-value");
    const oldValue = span.textContent;
    container.innerHTML = `
      <strong>${label}:</strong>
      <input type="text" class="edit-input" />
      <button class="save-button" style="margin-left:5px;">✅</button>
      <button class="cancel-button" style="margin-left:5px;">❌</button>
    `;
    // Set the value after creating the element to avoid quotation mark issues
    container.querySelector(".edit-input").value = oldValue;

    container.querySelector(".save-button").addEventListener("click", async () => {
      const newValue = container.querySelector(".edit-input").value;
      try {
        await set(ref(db, `zines/${zineKey}/${dataPath}`), newValue);
        await logChange(zineKey, dataPath, oldValue, newValue);
        createEditableField(container, label, newValue, dataPath, zineKey);
      } catch (err) {
        alert("Update failed: " + err.message);
      }
    });

    container.querySelector(".cancel-button").addEventListener("click", () => {
      createEditableField(container, label, oldValue, dataPath, zineKey);
    });
  });
}

// Editable authors array (comma-separated string editing)
function createEditableAuthors(container, authors, zineKey) {
  const authorsStr = authors.join(", ");
  container.innerHTML = `
    <strong>Authors:</strong>
    <span class="editable-value" data-path="authors" data-zine="${zineKey}">${authorsStr || "N/A"}</span>
    <button class="edit-button" style="margin-left:5px;">✏️</button>
  `;

  container.querySelector(".edit-button").addEventListener("click", () => {
    container.innerHTML = `
      <strong>Authors:</strong>
      <input type="text" value="${authorsStr}" class="edit-input" />
      <button class="save-button" style="margin-left:5px;">✅</button>
      <button class="cancel-button" style="margin-left:5px;">❌</button>
    `;

    const oldAuthors = authorsStr;

    container.querySelector(".save-button").addEventListener("click", async () => {
      const newAuthorsStr = container.querySelector(".edit-input").value;
      const newAuthors = newAuthorsStr.split(",").map(a => a.trim()).filter(Boolean);
      try {
        await set(ref(db, `zines/${zineKey}/authors`), newAuthors);
        await logChange(zineKey, "authors", oldAuthors, newAuthorsStr);
        createEditableAuthors(container, newAuthors, zineKey);
      } catch (err) {
        alert("Update failed: " + err.message);
      }
    });

    container.querySelector(".cancel-button").addEventListener("click", () => {
      createEditableAuthors(container, authors, zineKey);
    });
  });
}

// Editable issue component
function createEditableIssue(issue, issueIndex, zineKey, container) {
  const issueDiv = document.createElement("div");
  issueDiv.style.border = "1px solid #ccc";
  issueDiv.style.padding = "10px";
  issueDiv.style.marginBottom = "10px";

  function createField(label, value, fieldPath) {
    return `
      <p><strong>${capitalize(label)}:</strong>
      <span class="editable-value" data-path="issues/${issueIndex}/${fieldPath}" data-zine="${zineKey}">${value || "N/A"}</span>
      <button class="edit-button" style="margin-left:5px;">✏️</button></p>
    `;
  }

  issueDiv.innerHTML = createField("title", issue.title, "title") +
    createField("images (comma-separated URLs)", (issue.images || []).join(", "), "images");

  container.appendChild(issueDiv);

  // Attach listeners for editing each field
  issueDiv.querySelectorAll(".edit-button").forEach(button => {
    button.addEventListener("click", () => {
      const p = button.parentElement;
      const span = p.querySelector(".editable-value");
      const oldValue = span.textContent;
      const dataPath = span.getAttribute("data-path");

      p.innerHTML = `
        <strong>${capitalize(dataPath.split("/").pop())}:</strong>
        <input type="text" class="edit-input" />
        <button class="save-button" style="margin-left:5px;">✅</button>
        <button class="cancel-button" style="margin-left:5px;">❌</button>
      `;
      // Set the value after creating the element to avoid quotation mark issues
      p.querySelector(".edit-input").value = oldValue;

      p.querySelector(".save-button").addEventListener("click", async () => {
        const newValue = p.querySelector(".edit-input").value;
        let parsedValue = newValue;
        // If editing images, parse as array
        if (dataPath.endsWith("images")) {
          parsedValue = newValue.split(",").map(url => url.trim()).filter(Boolean);
        }
        try {
          await set(ref(db, `zines/${zineKey}/${dataPath}`), parsedValue);
          await logChange(zineKey, dataPath, oldValue, newValue);
          // Refresh issue display
          container.innerHTML = "";
	  const toptext = false
          loadZine(zineKey, container, toptext);
        } catch (err) {
          alert("Update failed: " + err.message);
        }
      });

      p.querySelector(".cancel-button").addEventListener("click", () => {
        container.innerHTML = "";
	const toptext = false
        loadZine(zineKey, container, toptext);
      });
    });
  });
}

// Main function to load and render editable zine data
async function loadZine(zineKey, container, toptext = true) {
  try {
    const snapshot = await get(ref(db, `zines/${zineKey}`));
    if (!snapshot.exists()) {
      container.innerHTML = `<h2>Zine not found.</h2>`;
      return;
    }
    const zine = snapshot.val();

    if (toptext) {
      container.innerHTML = `<h1>${zine.zine_name} <a href="zine.html?zine=${encodeURIComponent(zine.zine_name)}"><font size="4" face="Arial">RETURN</font></a></h1>`;

      // Authors
      const authorsContainer = document.createElement("div");
      createEditableAuthors(authorsContainer, zine.authors || [], zineKey);
      container.appendChild(authorsContainer);

      // Location
      const locationContainer = document.createElement("div");
      createEditableField(locationContainer, "Location", zine.location || "", "location", zineKey);
      container.appendChild(locationContainer);

      // Years Active
      const yearsContainer = document.createElement("div");
      createEditableField(yearsContainer, "Years Active", zine.years_active || "", "years_active", zineKey);
      container.appendChild(yearsContainer);

      // Description
      const descContainer = document.createElement("div");
      createEditableField(descContainer, "Description", zine.description || "", "description", zineKey);
      container.appendChild(descContainer);

      // Issues header
      const issuesHeader = document.createElement("h2");
      issuesHeader.textContent = "Issues:";
      container.appendChild(issuesHeader);
    }

    // Issues container
    const issuesContainer = document.createElement("div");
    container.appendChild(issuesContainer);

    if (Array.isArray(zine.issues) && zine.issues.length) {
      zine.issues.forEach((issue, idx) => {
        createEditableIssue(issue, idx, zineKey, issuesContainer);
      });
    } else {
      issuesContainer.innerHTML = "<p>No issues available.</p>";
    }

    if (toptext) {
      // Add new issue button
      const addIssueBtn = document.createElement("button");
      addIssueBtn.textContent = "Add New Issue";
      addIssueBtn.style.marginTop = "10px";
      container.appendChild(addIssueBtn);

      addIssueBtn.addEventListener("click", async () => {
        const newIssue = {
          title: "New Issue",
          images: []
        };
        try {
          const nextIndex = (zine.issues?.length) || 0;
          await set(ref(db, `zines/${zineKey}/issues/${nextIndex}`), newIssue);
          await logChange(zineKey, `issues/${nextIndex}`, "New Issue Added", JSON.stringify(newIssue));
          loadZine(zineKey, container, toptext);
        } catch (err) {
          alert("Failed to add new issue: " + err.message);
        }
      });
    }

  } catch (error) {
    console.error("Error loading zine:", error);
    container.innerHTML = "<h2>Error loading zine data.</h2>";
  }
}



	

document.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const zineParam = urlParams.get("zine");
auth.onAuthStateChanged((user) => {
  if (!user) {
    // User not logged in, redirect to login page or homepage
    window.location.href = '/login.html';
  }
});
  if (!zineParam) {
    document.getElementById("band-content").innerHTML = "<h1>No zine selected.</h1>";
    return;
  }

  const zineKey = slugify(zineParam);
  const container = document.getElementById("band-content");

  onAuthStateChanged(auth, user => {
    if (user) {
      loadZine(zineKey, container);
    } else {
      container.innerHTML = "<h1>Please sign in to edit.</h1>";
    }
  });
});
