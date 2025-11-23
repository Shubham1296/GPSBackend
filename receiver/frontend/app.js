// Backend API
const API_URL = "http://localhost:8000/route";   // change for ngrok if needed

// Create map
var map = L.map("map").setView([30.7, 76.7], 14);

// Black & white tile layer
L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; OpenStreetMap & CARTO',
    subdomains: "abcd",
    maxZoom: 19
}).addTo(map);

// Load route + potholes
async function loadRoute() {
    const res = await fetch(API_URL);
    const json = await res.json();

    const points = json.points;

    // Extract coordinates
    const route = points.map(p => [p.lat, p.lon]);

    // Add green polyline
    L.polyline(route, {
        color: "lime",
        weight: 5
    }).addTo(map);

    // Add pothole markers
    points.forEach(p => {
        if (p.is_pothole === true) {
            L.circleMarker([p.lat, p.lon], {
                radius: 8,
                color: "red",
                fillColor: "red",
                fillOpacity: 1
            }).addTo(map);
        }
    });

    // Auto-zoom to route
    if (route.length > 0) {
        map.fitBounds(route);
    }
}

loadRoute();
