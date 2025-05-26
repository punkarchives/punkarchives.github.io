document.getElementById("randomBandButton").addEventListener("click", function () {
    fetch("banddata.json")
        .then(response => response.json())
        .then(bands => {
            if (bands.length === 0) {
                alert("No bands available.");
                return;
            }
            const randomBand = bands[Math.floor(Math.random() * bands.length)];
            window.location.href = `band.html?band=${encodeURIComponent(randomBand.band_name)}`;
        })
        .catch(error => console.error("Error loading band data:", error));
});