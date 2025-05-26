    fetch(`latest_additions.json?v=${Date.now()}`)
        .then(response => response.json())
        .then(data => {
            let list = document.getElementById("latest-additions-list");
            data.latest_additions.forEach(band => {
                let link = document.createElement("a");
                link.href = band.url;
                link.innerHTML = `<u><font color="#ffffff">${band.name}</font></u>`;
                list.appendChild(link);
                list.appendChild(document.createElement("br"));
                list.appendChild(document.createElement("br"));
            });
        })
        .catch(error => console.error('Error loading latest additions:', error));