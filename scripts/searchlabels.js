const DEBUG = true; // Set to true for debugging

function searchBands() {
    const query = document.getElementById("searchBar").value.toLowerCase();
    const resultsList = document.getElementById("searchResults");

    if (query.length === 0) {
        resultsList.style.display = "none";
        return;
    }

    fetch("labeldata.json")
        .then(response => response.json())
        .then(bands => {
            resultsList.innerHTML = "";
            let matches = [];

            bands.forEach(band => {
                let matchText = "";
                let matchFound = false;

                function checkMatch(field, text) {
                    if (typeof field === "string" && field.toLowerCase().includes(query)) {
                        matchText = text;
                        matchFound = true;
                    }
                }

                checkMatch(band.band_name, `Label Name: ${band.band_name}`);
                checkMatch(band.location, `Location: ${band.location}`);

                if (Array.isArray(band.authors)) {
                    band.authors.forEach(author => {
                        checkMatch(author, `Author: ${band.authors.join(", ")}`);
                    });
                }

                if (matchFound) {
                    matches.push({ band, matchText });
                }
            });

            if (matches.length === 0) {
                resultsList.innerHTML = "<li style='color: #888; padding: 5px;'>No results</li>";
            } else {
                matches.forEach(({ band, matchText }) => {
                    let li = document.createElement("li");
                    li.style.padding = "5px";
                    li.style.cursor = "pointer";
                    li.style.color = "#ffffff";

                    li.innerHTML = `<strong>Label:</strong> ${band.band_name}`;
                    if (matchText) {
                        li.innerHTML += `<br><span style="color: #888; font-size: 14px;">${matchText}</span>`;
                    }

                    li.onclick = function() {
                        window.location.href = `label.html?label=${encodeURIComponent(band.band_name)}`;
                    };

                    resultsList.appendChild(li);
                });
            }

            resultsList.style.display = "block";
        })
        .catch(error => console.error("Error loading label data:", error));
}
