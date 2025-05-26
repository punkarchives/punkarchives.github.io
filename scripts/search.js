const DEBUG = true; // Set to true for debugging

function searchBands() {
    const query = document.getElementById("searchBar").value.toLowerCase();
    const resultsList = document.getElementById("searchResults");

    if (query.length === 0) {
        resultsList.style.display = "none";
        return;
    }

    fetch("banddata.json")
        .then(response => response.json())
        .then(bands => {
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
                updatePriority(band.location, `Location: ${band.location}`);

                if (Array.isArray(band.genre)) {
                    for (let g of band.genre) {
                        updatePriority(g, `Genre: ${band.genre.join(", ")}`);
                    }
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
        })
        .catch(error => console.error("Error loading band data:", error));
}