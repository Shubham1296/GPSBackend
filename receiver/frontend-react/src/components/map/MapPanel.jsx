import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { getSeverityColor } from '../../utils/helpers';
import './MapPanel.css';

function MapPanel({ points, potholes }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    if (!mapInstance.current && mapRef.current) {
      // Initialize map
      mapInstance.current = L.map(mapRef.current, {
        zoomControl: true
      }).setView([30.7, 76.7], 14);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors © CARTO'
      }).addTo(mapInstance.current);
    }

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapInstance.current) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Add GPS dots
    points.forEach(p => {
      if (!p.lat || !p.lon) return;

      const dot = L.circleMarker([p.lat, p.lon], {
        radius: 3,
        color: 'white',
        fillColor: 'white',
        fillOpacity: 0.8,
        weight: 1
      }).addTo(mapInstance.current);

      markersRef.current.push(dot);
    });

    // Add pothole markers
    potholes.forEach(p => {
      if (!p.lat || !p.lon) return;

      const color = getSeverityColor(p.severity);

      const marker = L.circleMarker([p.lat, p.lon], {
        radius: 6,
        color: color,
        fillColor: color,
        fillOpacity: 0.8,
        weight: 2
      }).addTo(mapInstance.current);

      marker.on('click', () => {
        alert(`Pothole: ${p.severity}\nLocation: ${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}`);
      });

      markersRef.current.push(marker);
    });

    // Fit bounds if we have points
    if (points.length > 0) {
      const validPoints = points.filter(p => p.lat && p.lon);
      if (validPoints.length > 0) {
        const bounds = L.latLngBounds(validPoints.map(p => [p.lat, p.lon]));
        mapInstance.current.fitBounds(bounds);
      }
    }

    // Invalidate size after a short delay
    setTimeout(() => {
      if (mapInstance.current) {
        mapInstance.current.invalidateSize();
      }
    }, 100);
  }, [points, potholes]);

  return (
    <div className="map-section">
      <div className="map-header">
        <h3>Live Map</h3>
        <div className="map-controls">
          <label className="map-toggle">
            <input type="checkbox" defaultChecked />
            <span>Show Potholes</span>
          </label>
          <label className="map-toggle">
            <input type="checkbox" />
            <span>Only Potholes</span>
          </label>
        </div>
      </div>
      <div ref={mapRef} className="map-container" />
    </div>
  );
}

export default MapPanel;
