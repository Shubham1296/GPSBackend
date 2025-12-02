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
const suburbCache = {}; // Cache to store suburb names

async function getSuburbName(lat, lon) {
    const cacheKey = `${lat.toFixed(4)}_${lon.toFixed(4)}`;
    
    // Return cached suburb if available
    if (suburbCache[cacheKey]) {
        return suburbCache[cacheKey];
    }
    
    try {
        // const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
        // const data = await response.json();
        // console.log(data)
        
        // // Try to get suburb, neighborhood, or locality
        // const suburb = data.address?.suburb || 
        //               data.address?.neighborhood || 
        //               data.address?.locality || 
        //               data.address?.village ||
        //               `Sector ${Math.floor(Math.random() * 90) + 10}`;
        
        // suburbCache[cacheKey] = suburb;
        // return suburb;
        return `Sector ${Math.floor(Math.random() * 90) + 10}`;
    } catch (error) {
        console.error('Error fetching suburb:', error);
        return `Sector ${Math.floor(Math.random() * 90) + 10}`;
    }
}

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
            console.log("error while fetching route")
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
        setupTableControls();
        setupUIHandlers();

        // Hide page loader after everything is loaded
        hidePageLoader();

    } catch (error) {
        console.error('Error loading route:', error);
        // Hide loader even on error
        hidePageLoader();
    }
}

function hidePageLoader() {
    const loader = document.getElementById('pageLoader');
    if (loader) {
        loader.classList.add('hidden');
        // Remove from DOM after animation completes
        setTimeout(() => {
            loader.style.display = 'none';
        }, 300);
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

        marker.on("click", () => {
            const url = window.location.origin + p.file_path;
            const panel = document.getElementById('mapPopupPanel');
            const popupContentDiv = document.getElementById('popupContent');

            // Show popup immediately with initial content
            let popupContent = `
                <div style="min-width: 280px;">
                    <div style="font-weight: 600; margin-bottom: 12px; color: #e5e7eb; font-size: 16px;">
                        <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${color}; margin-right: 8px;"></span>
                        Pothole Detected
                    </div>
                    <div style="font-size: 13px; color: #9ca3af; margin-bottom: 6px;">
                        Severity: <span style="color: ${color}; font-weight: 600;">${p.severity || 'Unknown'}</span>
                    </div>
                    <div style="font-size: 13px; color: #9ca3af; margin-bottom: 12px;">
                        ${formatCoords(p.lat, p.lon)}
                    </div>
                    <div id="popupImageContainer" style="margin-bottom: 12px;">
                        <div style="text-align: center; padding: 20px; color: #6b7280;">Loading image...</div>
                    </div>
                    <button onclick="deletePothole(${p.lat}, ${p.lon})" style="
                        width: 100%;
                        padding: 10px 16px;
                        background: #ef4444;
                        color: white;
                        border: none;
                        border-radius: 6px;
                        font-size: 13px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.2s;
                    " onmouseover="this.style.background='#dc2626'" onmouseout="this.style.background='#ef4444'">
                        Delete Pothole
                    </button>
                </div>`;

            popupContentDiv.innerHTML = popupContent;
            panel.style.display = 'block';

            // Load image asynchronously
            const imageContainer = document.getElementById('popupImageContainer');
            fetch(url)
                .then(resp => {
                    if (resp.ok) {
                        imageContainer.innerHTML = `<img src="${url}" style="width: 100%; max-height: 300px; object-fit: contain; border-radius: 8px;" />`;
                    } else {
                        imageContainer.innerHTML = `
                            <div style="text-align: center; padding: 20px; background: rgba(239, 68, 68, 0.1); border: 1px dashed rgba(239, 68, 68, 0.3); border-radius: 8px; color: #ef4444;">
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom: 8px;">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                    <polyline points="21 15 16 10 5 21"></polyline>
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                </svg>
                                <div style="font-size: 13px;">Image not found</div>
                            </div>`;
                    }
                })
                .catch(() => {
                    imageContainer.innerHTML = `
                        <div style="text-align: center; padding: 20px; background: rgba(239, 68, 68, 0.1); border: 1px dashed rgba(239, 68, 68, 0.3); border-radius: 8px; color: #ef4444;">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom: 8px;">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                <polyline points="21 15 16 10 5 21"></polyline>
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                            </svg>
                            <div style="font-size: 13px;">Failed to load image</div>
                        </div>`;
                });
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
}

// ==================== ACTIVITY LIST ====================
async function renderActivityList(points) {
    const potholes = points
        .filter(p => p.is_pothole)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 5);

    const listHTML = await Promise.all(potholes.map(async p => {
        const suburb = await getSuburbName(p.lat, p.lon);
        return `
        <div class="activity-item" onclick="focusOnPoint(${p.lat}, ${p.lon})">
            <div class="activity-header">
                <div class="activity-location">${suburb}</div>
                <span class="activity-severity ${p.severity}">${p.severity || 'Unknown'}</span>
            </div>
            <div class="activity-meta">
                <span>${formatCoords(p.lat, p.lon)}</span>
                <span>•</span>
                <span>${formatTime(p.timestamp)}</span>
            </div>
        </div>
    `;
    })).then(items => items.join(''));

    document.getElementById("activityList").innerHTML = listHTML || '<div style="color: #6b7280; font-size: 13px; text-align: center; padding: 20px;">No recent detections</div>';
}

// ==================== DETECTIONS TABLE ====================
// ==================== TABLE STATE ====================
let tableState = {
    allPotholes: [],
    filteredPotholes: [],
    currentPage: 1,
    itemsPerPage: 10,
    sortColumn: 'time',
    sortDirection: 'desc',
    searchQuery: '',
    severityFilter: 'all',
    selectedItems: new Set()
};

async function renderDetectionsTable(points) {
    // Store all potholes with location names
    const potholes = points.filter(p => p.is_pothole);

    tableState.allPotholes = await Promise.all(potholes.map(async p => ({
        ...p,
        location: await getSuburbName(p.lat, p.lon),
        id: `${p.lat}_${p.lon}` // Unique ID for selection
    })));

    // Apply filters and sorting
    applyTableFilters();
}

function applyTableFilters() {
    let filtered = [...tableState.allPotholes];

    // Apply search filter
    if (tableState.searchQuery) {
        const query = tableState.searchQuery.toLowerCase();
        filtered = filtered.filter(p =>
            p.location.toLowerCase().includes(query) ||
            (p.severity && p.severity.toLowerCase().includes(query)) ||
            formatCoords(p.lat, p.lon).includes(query)
        );
    }

    // Apply severity filter
    if (tableState.severityFilter !== 'all') {
        filtered = filtered.filter(p => p.severity === tableState.severityFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
        let aVal, bVal;

        switch (tableState.sortColumn) {
            case 'location':
                aVal = a.location;
                bVal = b.location;
                break;
            case 'severity':
                const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
                aVal = severityOrder[a.severity] || 0;
                bVal = severityOrder[b.severity] || 0;
                break;
            case 'time':
                aVal = new Date(a.timestamp);
                bVal = new Date(b.timestamp);
                break;
            default:
                return 0;
        }

        if (tableState.sortDirection === 'asc') {
            return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
        } else {
            return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
        }
    });

    tableState.filteredPotholes = filtered;
    tableState.currentPage = 1; // Reset to first page
    renderTablePage();
}

function renderTablePage() {
    const start = (tableState.currentPage - 1) * tableState.itemsPerPage;
    const end = start + tableState.itemsPerPage;
    const pageItems = tableState.filteredPotholes.slice(start, end);

    const tableHTML = pageItems.map(p => `
        <tr data-id="${p.id}">
            <td>
                <input type="checkbox" class="row-checkbox" data-id="${p.id}" ${tableState.selectedItems.has(p.id) ? 'checked' : ''}>
            </td>
            <td>
                <div class="table-location">
                    <div class="location-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                    </div>
                    <span>${p.location}</span>
                </div>
            </td>
            <td>
                <span class="table-severity activity-severity ${p.severity}">${p.severity || 'Unknown'}</span>
            </td>
            <td class="table-coords">${formatCoords(p.lat, p.lon)}</td>
            <td class="table-time">${formatTime(p.timestamp)}</td>
            <td>
                <div class="table-actions-cell">
                    <a href="#" class="action-link" onclick="event.preventDefault(); viewPotholeImage(${p.lat}, ${p.lon})">View</a>
                    <a href="#" class="action-link secondary" onclick="event.preventDefault(); exportPoint(${p.lat}, ${p.lon})">Export</a>
                </div>
            </td>
        </tr>
    `).join('');

    document.getElementById("detectionsTable").innerHTML = tableHTML ||
        '<tr><td colspan="6" style="text-align: center; color: #6b7280; padding: 40px;">No detections found</td></tr>';

    // Update pagination info
    updatePaginationInfo();

    // Setup row checkboxes
    setupTableCheckboxes();
}

function updatePaginationInfo() {
    const total = tableState.filteredPotholes.length;
    const start = total > 0 ? (tableState.currentPage - 1) * tableState.itemsPerPage + 1 : 0;
    const end = Math.min(tableState.currentPage * tableState.itemsPerPage, total);

    document.getElementById('showingStart').textContent = start;
    document.getElementById('showingEnd').textContent = end;
    document.getElementById('totalEntries').textContent = total;

    // Update pagination buttons
    const totalPages = Math.ceil(total / tableState.itemsPerPage);
    document.getElementById('prevPage').disabled = tableState.currentPage === 1;
    document.getElementById('nextPage').disabled = tableState.currentPage >= totalPages;

    // Render page numbers
    renderPaginationPages(totalPages);
}

function renderPaginationPages(totalPages) {
    const pagesContainer = document.getElementById('paginationPages');
    let pagesHTML = '';

    // Show max 5 page numbers
    let startPage = Math.max(1, tableState.currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);

    if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
    }

    if (startPage > 1) {
        pagesHTML += `<button class="page-num" data-page="1">1</button>`;
        if (startPage > 2) {
            pagesHTML += `<span class="page-ellipsis">...</span>`;
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        pagesHTML += `<button class="page-num ${i === tableState.currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            pagesHTML += `<span class="page-ellipsis">...</span>`;
        }
        pagesHTML += `<button class="page-num" data-page="${totalPages}">${totalPages}</button>`;
    }

    pagesContainer.innerHTML = pagesHTML;

    // Setup page button handlers
    pagesContainer.querySelectorAll('.page-num').forEach(btn => {
        btn.onclick = () => {
            tableState.currentPage = parseInt(btn.dataset.page);
            renderTablePage();
        };
    });
}

function setupTableCheckboxes() {
    // Row checkboxes
    document.querySelectorAll('.row-checkbox').forEach(checkbox => {
        checkbox.onchange = (e) => {
            const id = e.target.dataset.id;
            if (e.target.checked) {
                tableState.selectedItems.add(id);
            } else {
                tableState.selectedItems.delete(id);
            }
            updateSelectionUI();
        };
    });

    // Update select all checkbox state
    updateSelectAllCheckbox();
}

function updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    const currentPageIds = tableState.filteredPotholes
        .slice((tableState.currentPage - 1) * tableState.itemsPerPage, tableState.currentPage * tableState.itemsPerPage)
        .map(p => p.id);

    const allChecked = currentPageIds.length > 0 && currentPageIds.every(id => tableState.selectedItems.has(id));
    const someChecked = currentPageIds.some(id => tableState.selectedItems.has(id));

    selectAllCheckbox.checked = allChecked;
    selectAllCheckbox.indeterminate = someChecked && !allChecked;
}

function updateSelectionUI() {
    const count = tableState.selectedItems.size;
    document.getElementById('selectedCount').textContent = count;
    document.getElementById('exportSelectedBtn').disabled = count === 0;
    updateSelectAllCheckbox();
}

function setupTableControls() {
    // Search input
    document.getElementById('tableSearch').addEventListener('input', (e) => {
        tableState.searchQuery = e.target.value;
        applyTableFilters();
    });

    // Severity filter
    document.getElementById('severityFilter').addEventListener('change', (e) => {
        tableState.severityFilter = e.target.value;
        applyTableFilters();
    });

    // Select all checkbox
    document.getElementById('selectAllCheckbox').onchange = (e) => {
        const currentPageIds = tableState.filteredPotholes
            .slice((tableState.currentPage - 1) * tableState.itemsPerPage, tableState.currentPage * tableState.itemsPerPage)
            .map(p => p.id);

        if (e.target.checked) {
            currentPageIds.forEach(id => tableState.selectedItems.add(id));
        } else {
            currentPageIds.forEach(id => tableState.selectedItems.delete(id));
        }
        renderTablePage();
        updateSelectionUI();
    };

    // Sortable headers
    document.querySelectorAll('.sortable').forEach(header => {
        header.onclick = () => {
            const sortColumn = header.dataset.sort;
            if (tableState.sortColumn === sortColumn) {
                tableState.sortDirection = tableState.sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                tableState.sortColumn = sortColumn;
                tableState.sortDirection = 'desc';
            }

            // Update UI
            document.querySelectorAll('.sortable').forEach(h => h.classList.remove('sorted-asc', 'sorted-desc'));
            header.classList.add(tableState.sortDirection === 'asc' ? 'sorted-asc' : 'sorted-desc');

            applyTableFilters();
        };
    });

    // Pagination buttons
    document.getElementById('prevPage').onclick = () => {
        if (tableState.currentPage > 1) {
            tableState.currentPage--;
            renderTablePage();
        }
    };

    document.getElementById('nextPage').onclick = () => {
        const totalPages = Math.ceil(tableState.filteredPotholes.length / tableState.itemsPerPage);
        if (tableState.currentPage < totalPages) {
            tableState.currentPage++;
            renderTablePage();
        }
    };

    // Export selected button
    document.getElementById('exportSelectedBtn').onclick = () => {
        exportSelectedPotholes();
    };
}

async function exportSelectedPotholes() {
    const exportBtn = document.getElementById("exportSelectedBtn");
    const originalText = exportBtn.innerHTML;

    if (tableState.selectedItems.size === 0) {
        alert('Please select at least one pothole to export');
        return;
    }

    try {
        exportBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path></svg><span>Preparing...</span>';
        exportBtn.disabled = true;

        // Get selected potholes
        const selectedPotholes = tableState.allPotholes.filter(p => tableState.selectedItems.has(p.id));

        const report = {
            generated: new Date().toISOString(),
            summary: {
                totalSelected: selectedPotholes.length,
                bySeverity: {
                    critical: selectedPotholes.filter(p => p.severity === 'critical').length,
                    high: selectedPotholes.filter(p => p.severity === 'high').length,
                    medium: selectedPotholes.filter(p => p.severity === 'medium').length,
                    low: selectedPotholes.filter(p => p.severity === 'low').length
                }
            },
            potholes: selectedPotholes.map(p => ({
                location: p.location,
                lat: p.lat,
                lon: p.lon,
                severity: p.severity,
                timestamp: p.timestamp,
                imagePath: p.file_path
            }))
        };

        // Create ZIP
        const zip = new JSZip();
        zip.file("selected_potholes.json", JSON.stringify(report, null, 2));

        // Add images
        const imagesFolder = zip.folder("images");
        let successCount = 0;

        for (let i = 0; i < selectedPotholes.length; i++) {
            const pothole = selectedPotholes[i];
            if (!pothole.file_path) continue;

            exportBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg><span>Image ${i + 1}/${selectedPotholes.length}</span>`;

            try {
                const imageUrl = SERVER + pothole.file_path;
                const response = await fetch(imageUrl, {
                    headers: { "Authorization": "Bearer " + TOKEN }
                });

                if (response.ok) {
                    const blob = await response.blob();
                    const filename = pothole.file_path.split('/').pop() || `image_${i}.jpg`;
                    imagesFolder.file(filename, blob);
                    successCount++;
                }
            } catch (error) {
                console.error(`Error fetching image ${i}:`, error);
            }
        }

        // Generate ZIP
        exportBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg><span>Creating ZIP...</span>';

        const content = await zip.generateAsync({
            type: "blob",
            compression: "DEFLATE",
            compressionOptions: { level: 6 }
        });

        // Download
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `selected_potholes_${Date.now()}.zip`;
        a.click();
        URL.revokeObjectURL(url);

        exportBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg><span>Downloaded!</span>';

        setTimeout(() => {
            exportBtn.innerHTML = originalText;
            exportBtn.disabled = false;
        }, 2000);

    } catch (error) {
        console.error("Export error:", error);
        alert("Export failed. Please try again.");
        exportBtn.innerHTML = originalText;
        exportBtn.disabled = false;
    }
}

// ==================== MAP CONTROLS ====================
function setupControls() {
    // const togglePolyline = document.getElementById("togglePolyline");
    const togglePotholes = document.getElementById("togglePotholes");
    const toggleOnlyPotholes = document.getElementById("toggleOnlyPotholes");

    // togglePolyline.onchange = () => {
    //     if (togglePolyline.checked) {
    //         map.addLayer(polylineLayer);
    //     } else {
    //         map.removeLayer(polylineLayer);
    //     }
    // };

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
    // View switching
    const navItems = document.querySelectorAll('.nav-item[data-view]');
    const mainGrid = document.querySelector('.main-grid');
    const tablePanel = document.querySelector('.table-panel');
    const analyticsView = document.getElementById('analyticsView');

    navItems.forEach(item => {
        item.onclick = () => {
            // Update active state
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // Switch views
            const view = item.dataset.view;
            if (view === 'analytics') {
                mainGrid.style.display = 'none';
                tablePanel.style.display = 'none';
                analyticsView.style.display = 'block';
                renderAnalytics(allPoints);
            } else if (view === 'dashboard') {
                mainGrid.style.display = 'grid';
                tablePanel.style.display = 'block';
                analyticsView.style.display = 'none';
                setTimeout(() => map.invalidateSize(), 100);
            } else if (view === 'alerts') {
                // Future: Add alerts view
                console.log('Alerts view not implemented yet');
            }
        };
    });

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

    // Create User button
    document.getElementById("createUserBtn").onclick = () => {
        openCreateUserModal();
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

async function exportReport() {
    const exportBtn = document.getElementById("exportBtn");
    const originalText = exportBtn.innerHTML;

    try {
        // Show loading state
        exportBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path></svg><span>Preparing...</span>';
        exportBtn.disabled = true;

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
            })),
            allPoints: allPoints.map(p => ({
                lat: p.lat,
                lon: p.lon,
                timestamp: p.timestamp,
                is_pothole: p.is_pothole
            }))
        };

        // Create ZIP file
        const zip = new JSZip();

        // Add JSON report
        zip.file("report.json", JSON.stringify(report, null, 2));

        // Create images folder
        const imagesFolder = zip.folder("images");

        // Fetch and add images
        exportBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path></svg><span>Downloading images...</span>';

        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < potholes.length; i++) {
            const pothole = potholes[i];
            if (!pothole.file_path) continue;

            // Update progress
            exportBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path></svg><span>Image ${i + 1}/${potholes.length}</span>`;

            try {
                // Construct image URL (assuming file_path is relative to server)
                const imageUrl = SERVER + pothole.file_path;

                const response = await fetch(imageUrl, {
                    headers: {
                        "Authorization": "Bearer " + TOKEN
                    }
                });

                if (response.ok) {
                    const blob = await response.blob();
                    const filename = pothole.file_path.split('/').pop() || `image_${i}.jpg`;
                    imagesFolder.file(filename, blob);
                    successCount++;
                } else {
                    console.warn(`Failed to fetch image: ${imageUrl}`);
                    failCount++;
                }
            } catch (error) {
                console.error(`Error fetching image ${i}:`, error);
                failCount++;
            }
        }

        // Add README
        const readme = `RoadAI Export Report
Generated: ${new Date().toISOString()}

Summary:
- Total Potholes: ${potholes.length}
- Images Included: ${successCount}
- Failed Downloads: ${failCount}
- Total GPS Points: ${allPoints.length}

Contents:
- report.json: Complete data report with GPS coordinates and metadata
- images/: Folder containing ${successCount} pothole images

Note: Image filenames correspond to the 'imagePath' field in report.json
`;
        zip.file("README.txt", readme);

        // Generate ZIP
        exportBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path></svg><span>Creating ZIP...</span>';

        const content = await zip.generateAsync({
            type: "blob",
            compression: "DEFLATE",
            compressionOptions: {
                level: 6
            }
        });

        // Download ZIP
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `roadai_report_${Date.now()}.zip`;
        a.click();
        URL.revokeObjectURL(url);

        // Show success message
        exportBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg><span>Downloaded!</span>';

        setTimeout(() => {
            exportBtn.innerHTML = originalText;
            exportBtn.disabled = false;
        }, 2000);

    } catch (error) {
        console.error("Export error:", error);
        alert("Export failed. Please try again.");
        exportBtn.innerHTML = originalText;
        exportBtn.disabled = false;
    }
}

// ==================== IMAGE MODAL ====================
let currentPotholeCoords = null;

function viewPotholeImage(lat, lon) {
    const point = allPoints.find(p =>
        Math.abs(p.lat - lat) < 0.0001 && Math.abs(p.lon - lon) < 0.0001
    );

    if (!point) {
        alert('Pothole data not found');
        return;
    }

    currentPotholeCoords = { lat, lon };

    // Show modal
    const modal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');
    const imageLoading = document.getElementById('imageLoading');
    const imageError = document.getElementById('imageError');
    const modalInfo = document.getElementById('modalInfo');

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Reset states
    modalImage.style.display = 'none';
    imageLoading.style.display = 'flex';
    imageError.style.display = 'none';

    // Set info
    modalInfo.innerHTML = `
        <div style="display: flex; gap: 16px; flex-wrap: wrap; margin-top: 8px;">
            <span class="modal-info-item">
                <strong>Severity:</strong>
                <span class="table-severity activity-severity ${point.severity}" style="margin-left: 4px;">${point.severity || 'Unknown'}</span>
            </span>
            <span class="modal-info-item">
                <strong>Location:</strong> ${formatCoords(lat, lon)}
            </span>
            <span class="modal-info-item">
                <strong>Time:</strong> ${formatTime(point.timestamp)}
            </span>
        </div>
    `;

    // Load image
    if (point.file_path) {
        const imageUrl = SERVER + point.file_path;

        // Create new image to preload
        const img = new Image();

        img.onload = () => {
            modalImage.src = imageUrl;
            modalImage.style.display = 'block';
            imageLoading.style.display = 'none';
        };

        img.onerror = () => {
            imageLoading.style.display = 'none';
            imageError.style.display = 'flex';
        };

        img.src = imageUrl;
    } else {
        imageLoading.style.display = 'none';
        imageError.style.display = 'flex';
    }

    // Setup "View on Map" button
    const viewOnMapBtn = document.getElementById('viewOnMapBtn');
    viewOnMapBtn.onclick = () => {
        closeImageModal();
        focusOnPoint(lat, lon);
    };
}

function closeImageModal() {
    const modal = document.getElementById('imageModal');
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
    currentPotholeCoords = null;
}

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modal = document.getElementById('imageModal');
        if (modal.style.display === 'flex') {
            closeImageModal();
        }
    }
});

// ==================== ANALYTICS ====================
let distanceChartInstance = null;
let potholesChartInstance = null;
let severityTrendChartInstance = null;

function calculateDistance(lat1, lon1, lat2, lon2) {
    // Haversine formula to calculate distance between two coordinates
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function getTotalDistance(points) {
    let totalDistance = 0;
    for (let i = 1; i < points.length; i++) {
        if (points[i].lat && points[i].lon && points[i-1].lat && points[i-1].lon) {
            totalDistance += calculateDistance(
                points[i-1].lat, points[i-1].lon,
                points[i].lat, points[i].lon
            );
        }
    }
    return totalDistance;
}

function getLast7DaysData(points) {
    const now = new Date();
    const labels = [];
    const dailyDistance = {};
    const dailyPotholes = {};
    const dailySeverity = {
        critical: {},
        high: {},
        medium: {},
        low: {}
    };

    // Initialize last 7 days
    for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        dailyDistance[dateStr] = 0;
        dailyPotholes[dateStr] = 0;
        dailySeverity.critical[dateStr] = 0;
        dailySeverity.high[dateStr] = 0;
        dailySeverity.medium[dateStr] = 0;
        dailySeverity.low[dateStr] = 0;
    }

    // Group points by date and calculate distance
    const pointsByDate = {};
    points.forEach(p => {
        if (!p.timestamp) return;
        const date = new Date(p.timestamp).toISOString().split('T')[0];
        if (!pointsByDate[date]) pointsByDate[date] = [];
        pointsByDate[date].push(p);

        // Count potholes
        if (p.is_pothole && dailyPotholes[date] !== undefined) {
            dailyPotholes[date]++;

            // Count by severity
            if (p.severity && dailySeverity[p.severity][date] !== undefined) {
                dailySeverity[p.severity][date]++;
            }
        }
    });

    // Calculate distance for each day
    Object.keys(pointsByDate).forEach(date => {
        if (dailyDistance[date] !== undefined) {
            dailyDistance[date] = getTotalDistance(pointsByDate[date]);
        }
    });

    return {
        labels,
        distance: labels.map((_, i) => {
            const date = new Date(now);
            date.setDate(date.getDate() - (6 - i));
            const dateStr = date.toISOString().split('T')[0];
            return dailyDistance[dateStr] || 0;
        }),
        potholes: labels.map((_, i) => {
            const date = new Date(now);
            date.setDate(date.getDate() - (6 - i));
            const dateStr = date.toISOString().split('T')[0];
            return dailyPotholes[dateStr] || 0;
        }),
        severity: {
            critical: labels.map((_, i) => {
                const date = new Date(now);
                date.setDate(date.getDate() - (6 - i));
                const dateStr = date.toISOString().split('T')[0];
                return dailySeverity.critical[dateStr] || 0;
            }),
            high: labels.map((_, i) => {
                const date = new Date(now);
                date.setDate(date.getDate() - (6 - i));
                const dateStr = date.toISOString().split('T')[0];
                return dailySeverity.high[dateStr] || 0;
            }),
            medium: labels.map((_, i) => {
                const date = new Date(now);
                date.setDate(date.getDate() - (6 - i));
                const dateStr = date.toISOString().split('T')[0];
                return dailySeverity.medium[dateStr] || 0;
            }),
            low: labels.map((_, i) => {
                const date = new Date(now);
                date.setDate(date.getDate() - (6 - i));
                const dateStr = date.toISOString().split('T')[0];
                return dailySeverity.low[dateStr] || 0;
            })
        }
    };
}

function renderAnalytics(points) {
    // Calculate stats
    const totalPotholes = points.filter(p => p.is_pothole).length;
    const totalDistance = getTotalDistance(points);
    const criticalPotholes = points.filter(p => p.is_pothole && p.severity === 'critical').length;
    const avgPotholesPerKm = totalDistance > 0 ? (totalPotholes / totalDistance).toFixed(2) : 0;

    // Update stat cards
    document.getElementById('totalPotholes').textContent = totalPotholes;
    document.getElementById('totalDistance').textContent = totalDistance.toFixed(2) + ' km';
    document.getElementById('criticalPotholes').textContent = criticalPotholes;
    document.getElementById('avgPotholesPerKm').textContent = avgPotholesPerKm;

    // Get last 7 days data
    const weekData = getLast7DaysData(points);

    // Render charts
    renderDistanceChart(weekData.labels, weekData.distance);
    renderPotholesChart(weekData.labels, weekData.potholes);
    renderSeverityTrendChart(weekData.labels, weekData.severity);
}

function renderDistanceChart(labels, data) {
    const ctx = document.getElementById('distanceChart');
    if (!ctx) return;

    if (distanceChartInstance) {
        distanceChartInstance.destroy();
    }

    distanceChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Distance (km)',
                data: data,
                backgroundColor: 'rgba(102, 126, 234, 0.8)',
                borderColor: 'rgba(102, 126, 234, 1)',
                borderWidth: 2,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: '#8b92a7',
                        callback: function(value) {
                            return value.toFixed(1) + ' km';
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#8b92a7'
                    }
                }
            }
        }
    });
}

function renderPotholesChart(labels, data) {
    const ctx = document.getElementById('potholesChart');
    if (!ctx) return;

    if (potholesChartInstance) {
        potholesChartInstance.destroy();
    }

    potholesChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Potholes Detected',
                data: data,
                backgroundColor: 'rgba(245, 87, 108, 0.2)',
                borderColor: 'rgba(245, 87, 108, 1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 6,
                pointBackgroundColor: 'rgba(245, 87, 108, 1)',
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: '#8b92a7',
                        stepSize: 1
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#8b92a7'
                    }
                }
            }
        }
    });
}

function renderSeverityTrendChart(labels, severityData) {
    const ctx = document.getElementById('severityTrendChart');
    if (!ctx) return;

    if (severityTrendChartInstance) {
        severityTrendChartInstance.destroy();
    }

    severityTrendChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Critical',
                    data: severityData.critical,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'High',
                    data: severityData.high,
                    borderColor: '#f97316',
                    backgroundColor: 'rgba(249, 115, 22, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Medium',
                    data: severityData.medium,
                    borderColor: '#eab308',
                    backgroundColor: 'rgba(234, 179, 8, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Low',
                    data: severityData.low,
                    borderColor: '#22c55e',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    stacked: false,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: '#8b92a7',
                        stepSize: 1
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#8b92a7'
                    }
                }
            }
        }
    });
}

// ==================== MAP POPUP PANEL ====================
function closeMapPopup() {
    const panel = document.getElementById('mapPopupPanel');
    panel.style.display = 'none';
}

// ==================== DELETE POTHOLE ====================
async function deletePothole(lat, lon) {
    if (!confirm('Are you sure you want to delete this pothole?')) {
        return;
    }

    try {
        const response = await fetch(`${SERVER}/pothole/${lat}/${lon}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${TOKEN}`
            }
        });

        if (response.ok) {
            alert('Pothole deleted successfully');
            // Reload the route to refresh the map
            loadRoute();
        } else {
            const error = await response.json();
            alert(`Failed to delete pothole: ${error.detail || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('Delete error:', error);
        alert('Failed to delete pothole. Please try again.');
    }
}

// ==================== CREATE USER MODAL ====================
function openCreateUserModal() {
    const modal = document.getElementById('createUserModal');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Clear form
    document.getElementById('createUserForm').reset();
    document.getElementById('createUserError').style.display = 'none';
    document.getElementById('createUserSuccess').style.display = 'none';
}

function closeCreateUserModal() {
    const modal = document.getElementById('createUserModal');
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

async function submitCreateUser() {
    const email = document.getElementById('newUserEmail').value;
    const password = document.getElementById('newUserPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    const errorDiv = document.getElementById('createUserError');
    const successDiv = document.getElementById('createUserSuccess');

    // Hide previous messages
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';

    // Validate inputs
    if (!email || !password || !confirmPassword) {
        errorDiv.textContent = 'Please fill in all fields';
        errorDiv.style.display = 'block';
        return;
    }

    if (password !== confirmPassword) {
        errorDiv.textContent = 'Passwords do not match';
        errorDiv.style.display = 'block';
        return;
    }

    if (password.length < 6) {
        errorDiv.textContent = 'Password must be at least 6 characters';
        errorDiv.style.display = 'block';
        return;
    }

    try {
        const response = await fetch(`${SERVER}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            successDiv.textContent = 'User created successfully!';
            successDiv.style.display = 'block';

            // Clear form
            document.getElementById('createUserForm').reset();

            // Close modal after 2 seconds
            setTimeout(() => {
                closeCreateUserModal();
            }, 2000);
        } else {
            errorDiv.textContent = data.detail || 'Failed to create user';
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        console.error('Create user error:', error);
        errorDiv.textContent = 'An error occurred. Please try again.';
        errorDiv.style.display = 'block';
    }
}

// ==================== INITIALIZE ====================
loadRoute();

// Auto-refresh every 30 seconds
// setInterval(loadRoute, 30000);