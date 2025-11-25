// Backend API
const API_URL = "http://localhost:8000/route";

let polylineLayer = null;
let potholeMarkers = [];
let gpsDots = [];

const potholeIcon = L.icon({
    iconUrl:
        "data:image/svg+xml;base64," +
        btoa(`
        <svg xmlns="http://www.w3.org/2000/svg" width="6" height="6"
             viewBox="0 0 24 24" fill="red">
          <circle cx="12" cy="12" r="12"/>
        </svg>`),
    iconSize: [6, 6],
    iconAnchor: [3, 3],
    popupAnchor: [0, -3],
    className: "pothole-icon"
});

// Map
var map = L.map("map").setView([30.7, 76.7], 14);

L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; OpenStreetMap & CARTO',
    subdomains: "abcd",
    maxZoom: 19
}).addTo(map);


async function loadRoute() {
    const res = await fetch(API_URL);
    const json = await res.json();
    const points = json.points;

    const route = points.map(p => [p.lat, p.lon]);

    // --- Polyline ---
    polylineLayer = L.polyline(route, {
        color: "lime",
        weight: 5,
        opacity: 0.3
    }).addTo(map);

    // --- GPS dots ---
    points.forEach(p => {
        const dot = L.circleMarker([p.lat, p.lon], {
            radius: 3,
            color: "white",
            fillColor: "white",
            fillOpacity: 0.8
        });

        dot.addTo(map);
        gpsDots.push(dot);
    });

    // --- Pothole markers ---
    points.forEach(p => {
        if (p.is_pothole === true) {
            const marker = L.marker([p.lat, p.lon], { icon: potholeIcon });

            marker.on("click", async () => {
                let popup = "<b>Pothole Detected</b><br>";
                const url = p.file_path;

                try {
                    const resp = await fetch(url);
                    if (resp.ok) {
                        popup += `<img src="${url}" class="pothole-popup-img" />`;
                    } else {
                        popup += "No image found";
                    }
                } catch {
                    popup += "No image found";
                }
                marker.bindPopup(popup).openPopup();
            });

            marker.addTo(map);
            potholeMarkers.push(marker);
        }
    });

    map.fitBounds(route);

    setupControls();
}

function setupControls() {
    const togglePolyline = document.getElementById("togglePolyline");
    const togglePotholes = document.getElementById("togglePotholes");
    const toggleOnlyPotholes = document.getElementById("toggleOnlyPotholes");

    // Hide/show polyline
    togglePolyline.addEventListener("change", () => {
        if (togglePolyline.checked) {
            map.addLayer(polylineLayer);
        } else {
            map.removeLayer(polylineLayer);
        }
    });

    // Hide/show all potholes
    togglePotholes.addEventListener("change", () => {
        potholeMarkers.forEach(m => {
            if (togglePotholes.checked) {
                map.addLayer(m);
            } else {
                map.removeLayer(m);
            }
        });
    });

    // Show only potholes (hide dots)
    toggleOnlyPotholes.addEventListener("change", () => {
        if (toggleOnlyPotholes.checked) {
            gpsDots.forEach(dot => map.removeLayer(dot));
            potholeMarkers.forEach(m => map.addLayer(m));
        } else {
            gpsDots.forEach(dot => map.addLayer(dot));
        }
    });
}

loadRoute();
