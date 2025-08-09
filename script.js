


document.addEventListener("DOMContentLoaded", () => {

    function displaySightings() {
        markersLayer.clearLayers();
    
        const classFilter = document.getElementById("classFilter").value;
        let filteredSightings = allSightings.filter(sighting =>
            classFilter === "all" || (sighting.taxon && sighting.taxon.iconic_taxon_name === classFilter)
        );
    
        if (filteredSightings.length === 0) {
            console.warn("No sightings found!");
            return;
        }
    
        filteredSightings.forEach(({ geojson, taxon, photos, uri }) => {
            if (!geojson || !geojson.coordinates || geojson.coordinates.length < 2) return; 
    
            let lat = geojson.coordinates[1]; // Latitude
            let lon = geojson.coordinates[0]; // Longitude
            let species = taxon?.iconic_taxon_name || "Unknown";
            let color = speciesColors[species] || "#34495e";
            let commonName = taxon?.preferred_common_name || "Unknown";
            let scientificName = taxon?.name || "Unknown";
            let imageUrl = photos?.[0]?.url || "https://www.inaturalist.org/assets/iconic_taxa/unknown.svg";
            let observationUrl = uri || "#";
    
            let wikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(scientificName)}`;
    
            let marker = L.circleMarker([lat, lon], {
                color: color,
                fillColor: color,
                fillOpacity: 0.8,
                radius: 8
            }).bindPopup(`
                <h3>${commonName}</h3>
                <p><em>${scientificName}</em></p>
                <a href="${observationUrl}" target="_blank"><img src="${imageUrl}" width="150"></a>
                <br>
                <a href="${wikiUrl}" target="_blank">Wikipedia</a>
            `);
    
            marker.addTo(markersLayer);
        });
    
        updateResultsInfo();
    }

    // Initialize Map
    let map = L.map('map', { zoomControl: false }).setView([37.7749, -122.4194], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const speciesColors = {
        Mammalia: "#3498db", Aves: "#e74c3c", Reptilia: "#27ae60",
        Amphibia: "#9b59b6", Actinopterygii: "#f39c12", Insecta: "#f1c40f",
        Arachnida: "#8e44ad", Plantae: "#2ecc71", Fungi: "#95a5a6", Unknown: "#34495e"
    };

    let markersLayer = L.layerGroup().addTo(map);
    let allSightings = [];
    let countdownTimer;
    let activeFetchController = null;

    async function getCoordinates(zipCode) {
        let response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${zipCode}`);
        let data = await response.json();
        return data.length ? { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) } : null;
    }

    async function searchAnimals() {
        let zipCode = document.getElementById("zipCode").value;
        let countdownElement = document.getElementById("countdown");
        let resultsInfo = document.getElementById("results-info");

        if (!zipCode) return alert("Please enter a ZIP code.");

        if (activeFetchController) activeFetchController.abort();
        activeFetchController = new AbortController();
        const { signal } = activeFetchController;

        let location = await getCoordinates(zipCode);
        if (!location) return alert("Invalid ZIP code.");

        map.setView([location.lat, location.lon], 12);
        markersLayer.clearLayers();
        allSightings = [];
        countdownElement.style.display = "block";

        let timeLeft = 15;
        countdownElement.textContent = `Fetching data . . . time remaining: ${timeLeft}`;

        function updateCountdown() {
            if (timeLeft > 0) {
                timeLeft--;
                countdownElement.textContent = `Fetching data . . . time remaining: ${timeLeft}`;
            } else {
                clearInterval(countdownTimer);
                countdownElement.style.display = "none";
                updateResultsInfo();
            }
        }

        clearInterval(countdownTimer);
        countdownTimer = setInterval(updateCountdown, 1000);
        updateCountdown();

        let startTime = Date.now();
        let page = 1;
        let fetchPromises = [];

        async function fetchPages() {
            let startTime = Date.now();
            let page = 1;
            let fetchPromises = [];
        
            while (Date.now() - startTime < 15000) {
                let url = `https://api.inaturalist.org/v1/observations?lat=${location.lat}&lng=${location.lon}&radius=5&per_page=200&page=${page}`;
                fetchPromises.push(fetch(url, { signal }).then(res => res.json()));
        
                if (fetchPromises.length >= 5) {
                    let results = await Promise.all(fetchPromises);
                    fetchPromises = [];
                    results.forEach(data => {
                        if (data.results && data.results.length > 0) {
                            let validResults = data.results.filter(obs => obs.geojson && obs.geojson.coordinates);
                            allSightings.push(...validResults);
                        }
                    });
                }
                page++;
            }
        
            if (fetchPromises.length > 0) {
                let results = await Promise.all(fetchPromises);
                results.forEach(data => {
                    if (data.results && data.results.length > 0) {
                        let validResults = data.results.filter(obs => obs.geojson && obs.geojson.coordinates);
                        allSightings.push(...validResults);
                    }
                });
            }
        }
        

        await fetchPages();

        clearInterval(countdownTimer);
        countdownElement.style.display = "none";
        updateResultsInfo();
        displaySightings();
    }

    function updateResultsInfo() {
        const classFilter = document.getElementById("classFilter").value;
        let filteredSightings = allSightings.filter(sighting =>
            classFilter === "all" || (sighting.taxon && sighting.taxon.iconic_taxon_name === classFilter)
        );

        let resultsInfo = document.getElementById("results-info");
        resultsInfo.textContent = `Max results found: ${filteredSightings.length}`;
        resultsInfo.style.color = classFilter === "all" || filteredSightings.length === 0 
            ? "#000"  
            : speciesColors[classFilter] || "#000"; 
        resultsInfo.style.display = "block";
    }

    document.getElementById("searchButton").addEventListener("click", searchAnimals);
    document.getElementById("classFilter").addEventListener("change", displaySightings);
});
