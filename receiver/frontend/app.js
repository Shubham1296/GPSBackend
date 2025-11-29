// ==================== AUTH ====================
const SERVER = localStorage.getItem("server");
const TOKEN = localStorage.getItem("jwt");

if (!SERVER || !TOKEN) {
    window.location.href = "login.html";
}

const API_URL = SERVER + "/route";

// ==================== GLOBALS ====================
let polylineLayer = null;
let potholeMarkers = [];
let gpsDots = [];
let allPoints = [];

// ==================== MAP INITIALIZATION ====================
const map = L.map("map", {
    zoomControl: true
}).setView([30.7, 76.7], 14);

L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors © CARTO'
}).addTo(map);

// ==================== UTILITY FUNCTIONS ====================
function getSeverityLevel(isPothole) {
    if (!isPothole) return null;
    // In future, you can add actual severity scoring
    const rand = Math.random();
    if (rand < 0.23) return 'critical';
    if (rand < 0.57) return 'high';
    if (rand < 0.85) return 'medium';
    return 'low';
}

function getSeverityColor(severity) {
    const colors = {
        'critical': '#ef4444',
        'high': '#f97316',
        'medium': '#eab308',
        'low': '#22c55e'
    };
    return colors[severity] || '#6b7280';
}

function formatTime(timestamp) {
    const now = Date.now();
    const diff = now - new Date(timestamp).getTime();
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    if (hours < 24) return `${hours} hr${hours > 1 ? 's' : ''} ago`;
    return `${days} day${days > 1 ? 's' : ''} ago`;
}

function formatCoords(lat, lon) {
    return `${parseFloat(lat).toFixed(4)}, ${parseFloat(lon).toFixed(4)}`;
}

// ==================== LOAD AND DISPLAY DATA ====================
async function loadRoute() {
    try {
        const res = await fetch(API_URL, {
            headers: {
                "Authorization": "Bearer " + TOKEN
            }
        });

        if (!res.ok) {
            throw new Error('Failed to fetch route data');
        }

        const json = await res.json();
        allPoints = json.points.map(p => ({
            ...p,
            severity: getSeverityLevel(p.is_pothole),
            timestamp: p.timestamp || Date.now()
        }));

        updateMetrics(allPoints);
        renderMap(allPoints);
        renderSeverityChart(allPoints);
        renderActivityList(allPoints);
        renderDetectionsTable(allPoints);
        setupControls();
        setupUIHandlers();

    } catch (error) {
        console.error('Error loading route:', error);
        alert('Failed to load route data. Please try again.');
    }
}

function renderMap(points) {
    // Clear existing layers
    if (polylineLayer) map.removeLayer(polylineLayer);
    potholeMarkers.forEach(m => map.removeLayer(m));
    gpsDots.forEach(d => map.removeLayer(d));
    potholeMarkers = [];
    gpsDots = [];

    const route = points
        .filter(p => p.lat && p.lon)
        .map(p => [p.lat, p.lon]);

    // Draw polyline
    polylineLayer = L.polyline(route, {
        color: "#22c55e",
        weight: 4,
        opacity: 0.6
    }).addTo(map);

    // Add GPS dots
    points.forEach(p => {
        if (!p.lat || !p.lon) return;
        
        const dot = L.circleMarker([p.lat, p.lon], {
            radius: 3,
            color: "white",
            fillColor: "white",
            fillOpacity: 0.8,
            weight: 1
        });
        
        dot.addTo(map);
        gpsDots.push(dot);
    });

    // Add pothole markers
    points.forEach(p => {
        if (!p.is_pothole || !p.lat || !p.lon) return;

        const color = getSeverityColor(p.severity);
        
        const marker = L.circleMarker([p.lat, p.lon], {
            radius: 6,
            color: color,
            fillColor: color,
            fillOpacity: 0.8,
            weight: 2
        });

        marker.on("click", async () => {
            const url = window.location.origin + p.file_path;
            let popupContent = `
                <div style="min-width: 200px;">
                    <div style="font-weight: 600; margin-bottom: 8px; color: #e5e7eb;">
                        <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${color}; margin-right: 6px;"></span>
                        Pothole Detected
                    </div>
                    <div style="font-size: 12px; color: #9ca3af; margin-bottom: 4px;">
                        Severity: <span style="color: ${color}; font-weight: 600;">${p.severity || 'Unknown'}</span>
                    </div>
                    <div style="font-size: 12px; color: #9ca3af; margin-bottom: 8px;">
                        ${formatCoords(p.lat, p.lon)}
                    </div>`;

            try {
                const resp = await fetch(url);
                if (resp.ok) {
                    popupContent += `<img src="${url}" class="pothole-popup-img" />`;
                } else {
                    popupContent += '<div style="font-size: 12px; color: #6b7280;">No image available</div>';
                }
            } catch {
                popupContent += '<div style="font-size: 12px; color: #6b7280;">Failed to load image</div>';
            }

            popupContent += '</div>';
            marker.bindPopup(popupContent, {
                maxWidth: 300
            }).openPopup();
        });

        marker.addTo(map);
        potholeMarkers.push(marker);
    });

    if (route.length > 0) {
        map.fitBounds(route);
    }
}

// ==================== UPDATE METRICS ====================
function updateMetrics(points) {
    // Calculate distance
    let totalDistance = 0;
    for (let i = 1; i < points.length; i++) {
        const p1 = L.latLng(points[i - 1].lat, points[i - 1].lon);
        const p2 = L.latLng(points[i].lat, points[i].lon);
        totalDistance += p1.distanceTo(p2);
    }

    const distanceKm = (totalDistance / 1000).toFixed(2);
    
    // Update elements only if they exist
    const metricDistance = document.getElementById("metricDistance");
    if (metricDistance) metricDistance.textContent = distanceKm + " km";
    
    const distanceChange = document.getElementById("distanceChange");
    if (distanceChange) distanceChange.textContent = "+2.3%";

    // Pothole count
    const potholes = points.filter(p => p.is_pothole);
    
    const metricPotholes = document.getElementById("metricPotholes");
    if (metricPotholes) metricPotholes.textContent = potholes.length;
    
    const potholeChange = document.getElementById("potholeChange");
    if (potholeChange) potholeChange.textContent = `+${Math.floor(potholes.length * 0.12)}`;

    // Points count
    const metricPoints = document.getElementById("metricPoints");
    if (metricPoints) metricPoints.textContent = points.length;
    
    const pointsChange = document.getElementById("pointsChange");
    if (pointsChange) pointsChange.textContent = `+${Math.floor(points.length * 0.16)}`;

    // Average severity
    const avgSeverity = calculateAverageSeverity(potholes);
    
    const metricSeverity = document.getElementById("metricSeverity");
    if (metricSeverity) metricSeverity.textContent = avgSeverity;
    
    const severityChange = document.getElementById("severityChange");
    if (severityChange) severityChange.textContent = "-0.8";

    // Alert badge
    const criticalCount = potholes.filter(p => p.severity === 'critical').length;
    
    const alertBadge = document.getElementById("alertBadge");
    if (alertBadge) alertBadge.textContent = criticalCount;
}

function calculateAverageSeverity(potholes) {
    if (potholes.length === 0) return "N/A";
    
    const severityScores = {
        'critical': 10,
        'high': 7,
        'medium': 5,
        'low': 3
    };
    
    const total = potholes.reduce((sum, p) => sum + (severityScores[p.severity] || 0), 0);
    const avg = total / potholes.length;
    
    return avg.toFixed(1) + "/10";
}

// ==================== SEVERITY CHART ====================
function renderSeverityChart(points) {
    const potholes = points.filter(p => p.is_pothole);
    
    const severityCounts = {
        'critical': potholes.filter(p => p.severity === 'critical').length,
        'high': potholes.filter(p => p.severity === 'high').length,
        'medium': potholes.filter(p => p.severity === 'medium').length,
        'low': potholes.filter(p => p.severity === 'low').length
    };

    const total = potholes.length || 1;

    const chartHTML = `
        <div class="severity-item">
            <div class="severity-label">
                <span class="severity-name">Critical</span>
                <span class="severity-count">${severityCounts.critical}</span>
            </div>
            <div class="severity-bar">
                <div class="severity-fill critical" style="width: ${(severityCounts.critical / total * 100)}%"></div>
            </div>
        </div>
        <div class="severity-item">
            <div class="severity-label">
                <span class="severity-name">High</span>
                <span class="severity-count">${severityCounts.high}</span>
            </div>
            <div class="severity-bar">
                <div class="severity-fill high" style="width: ${(severityCounts.high / total * 100)}%"></div>
            </div>
        </div>
        <div class="severity-item">
            <div class="severity-label">
                <span class="severity-name">Medium</span>
                <span class="severity-count">${severityCounts.medium}</span>
            </div>
            <div class="severity-bar">
                <div class="severity-fill medium" style="width: ${(severityCounts.medium / total * 100)}%"></div>
            </div>
        </div>
        <div class="severity-item">
            <div class="severity-label">
                <span class="severity-name">Low</span>
                <span class="severity-count">${severityCounts.low}</span>
            </div>
            <div class="severity-bar">
                <div class="severity-fill low" style="width: ${(severityCounts.low / total * 100)}%"></div>
            </div>
        </div>
    `;

    document.getElementById("severityChart").innerHTML = chartHTML;
    document.getElementById("criticalCount").textContent = severityCounts.critical;
    document.getElementById("highCount").textContent = severityCounts.high;
}

// ==================== ACTIVITY LIST ====================
function renderActivityList(points) {
    const potholes = points
        .filter(p => p.is_pothole)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 5);

    const listHTML = potholes.map(p => `
        <div class="activity-item" onclick="focusOnPoint(${p.lat}, ${p.lon})">
            <div class="activity-header">
                <div class="activity-location">Sector ${Math.floor(Math.random() * 90) + 10}</div>
                <span class="activity-severity ${p.severity}">${p.severity || 'Unknown'}</span>
            </div>
            <div class="activity-meta">
                <span>${formatCoords(p.lat, p.lon)}</span>
                <span>•</span>
                <span>${formatTime(p.timestamp)}</span>
            </div>
        </div>
    `).join('');

    document.getElementById("activityList").innerHTML = listHTML || '<div style="color: #6b7280; font-size: 13px; text-align: center; padding: 20px;">No recent detections</div>';
}

// ==================== DETECTIONS TABLE ====================
function renderDetectionsTable(points) {
    const potholes = points
        .filter(p => p.is_pothole)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 10);

    const tableHTML = potholes.map(p => `
        <tr>
            <td>
                <div class="table-location">
                    <div class="location-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                    </div>
                    <span>Sector ${Math.floor(Math.random() * 90) + 10}</span>
                </div>
            </td>
            <td>
                <span class="table-severity activity-severity ${p.severity}">${p.severity || 'Unknown'}</span>
            </td>
            <td class="table-coords">${formatCoords(p.lat, p.lon)}</td>
            <td class="table-time">${formatTime(p.timestamp)}</td>
            <td>
                <div class="table-actions-cell">
                    <a href="#" class="action-link" onclick="event.preventDefault(); focusOnPoint(${p.lat}, ${p.lon})">View</a>
                    <a href="#" class="action-link secondary" onclick="event.preventDefault(); exportPoint(${p.lat}, ${p.lon})">Export</a>
                </div>
            </td>
        </tr>
    `).join('');

    document.getElementById("detectionsTable").innerHTML = tableHTML || '<tr><td colspan="5" style="text-align: center; color: #6b7280; padding: 40px;">No detections found</td></tr>';
}

// ==================== MAP CONTROLS ====================
function setupControls() {
    const togglePolyline = document.getElementById("togglePolyline");
    const togglePotholes = document.getElementById("togglePotholes");
    const toggleOnlyPotholes = document.getElementById("toggleOnlyPotholes");

    togglePolyline.onchange = () => {
        if (togglePolyline.checked) {
            map.addLayer(polylineLayer);
        } else {
            map.removeLayer(polylineLayer);
        }
    };

    togglePotholes.onchange = () => {
        potholeMarkers.forEach(m => {
            if (togglePotholes.checked) {
                map.addLayer(m);
            } else {
                map.removeLayer(m);
            }
        });
    };

    toggleOnlyPotholes.onchange = () => {
        if (toggleOnlyPotholes.checked) {
            gpsDots.forEach(d => map.removeLayer(d));
        } else {
            gpsDots.forEach(d => map.addLayer(d));
        }
    };
}

// ==================== UI HANDLERS ====================
function setupUIHandlers() {
    // Sidebar toggle - FIXED
    const sidebarToggle = document.getElementById("sidebarToggle");
    const sidebar = document.getElementById("sidebar");
    const mainContent = document.querySelector(".main-content");

    sidebarToggle.onclick = () => {
        const isCollapsed = sidebar.classList.toggle("collapsed");
        
        // Update main content margin
        if (isCollapsed) {
            mainContent.style.marginLeft = "80px";
        } else {
            mainContent.style.marginLeft = "240px";
        }

        // Recalculate map size after sidebar animation
        setTimeout(() => {
            map.invalidateSize();
        }, 300);
    };

    // Logout
    document.getElementById("logoutBtn").onclick = () => {
        localStorage.removeItem("jwt");
        localStorage.removeItem("server");
        window.location.href = "login.html";
    };

    // Export button
    document.getElementById("exportBtn").onclick = () => {
        exportReport();
    };

    // Search functionality
    document.getElementById("searchInput").addEventListener("input", (e) => {
        // Implement search functionality
        console.log("Search:", e.target.value);
    });

    // Time range selector
    document.getElementById("timeRange").addEventListener("change", (e) => {
        console.log("Time range changed:", e.target.value);
        // Implement time range filtering
    });

    // Extract and display user email from JWT if possible
    try {
        const payload = JSON.parse(atob(TOKEN.split('.')[1]));
        document.getElementById("userEmail").textContent = payload.email || payload.sub || "—";
    } catch {
        document.getElementById("userEmail").textContent = "—";
    }
}

// ==================== HELPER FUNCTIONS ====================
function focusOnPoint(lat, lon) {
    map.setView([lat, lon], 17);
    
    // Find and open the marker
    potholeMarkers.forEach(marker => {
        const markerLatLng = marker.getLatLng();
        if (Math.abs(markerLatLng.lat - lat) < 0.0001 && Math.abs(markerLatLng.lng - lon) < 0.0001) {
            marker.fire('click');
        }
    });
}

function exportPoint(lat, lon) {
    const point = allPoints.find(p => 
        Math.abs(p.lat - lat) < 0.0001 && Math.abs(p.lon - lon) < 0.0001
    );
    
    if (point) {
        const data = JSON.stringify(point, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pothole_${lat}_${lon}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
}

function exportReport() {
    const potholes = allPoints.filter(p => p.is_pothole);
    
    // Safely get metric values
    const getMetricText = (id) => {
        const element = document.getElementById(id);
        return element ? element.textContent : 'N/A';
    };
    
    const report = {
        generated: new Date().toISOString(),
        summary: {
            totalDistance: getMetricText("metricDistance"),
            totalPotholes: potholes.length,
            totalPoints: allPoints.length,
            averageSeverity: calculateAverageSeverity(potholes)
        },
        potholes: potholes.map(p => ({
            lat: p.lat,
            lon: p.lon,
            severity: p.severity,
            timestamp: p.timestamp,
            imagePath: p.file_path
        }))
    };
    
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roadai_report_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// ==================== INITIALIZE ====================
loadRoute();

// Auto-refresh every 30 seconds
setInterval(loadRoute, 30000);