// Helper utility functions
export const getSeverityLevel = (isPothole) => {
  if (!isPothole) return null;
  const rand = Math.random();
  if (rand < 0.23) return 'critical';
  if (rand < 0.57) return 'high';
  if (rand < 0.85) return 'medium';
  return 'low';
};

export const getSeverityColor = (severity) => {
  const colors = {
    critical: '#ef4444',
    high: '#f97316',
    medium: '#eab308',
    low: '#22c55e'
  };
  return colors[severity] || '#6b7280';
};

export const formatTime = (timestamp) => {
  const now = Date.now();
  const diff = now - new Date(timestamp).getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours} hr${hours > 1 ? 's' : ''} ago`;
  return `${days} day${days > 1 ? 's' : ''} ago`;
};

export const formatCoords = (lat, lon) => {
  return `${parseFloat(lat).toFixed(4)}, ${parseFloat(lon).toFixed(4)}`;
};

export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const getSuburbName = async (lat, lon) => {
  // Simplified - returns random sector
  return `Sector ${Math.floor(Math.random() * 90) + 10}`;
};
