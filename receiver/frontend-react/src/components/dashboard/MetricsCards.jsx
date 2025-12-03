import { TrendingUp, AlertTriangle, MapPin, Activity } from 'lucide-react';
import './MetricsCards.css';

function MetricsCards({ points, potholes }) {
  // Calculate distance
  let totalDistance = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].lat && points[i].lon && points[i-1].lat && points[i-1].lon) {
      const R = 6371;
      const dLat = (points[i].lat - points[i-1].lat) * Math.PI / 180;
      const dLon = (points[i].lon - points[i-1].lon) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(points[i-1].lat * Math.PI / 180) * Math.cos(points[i].lat * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      totalDistance += R * c;
    }
  }

  // Calculate average severity
  const severityScores = {
    critical: 10,
    high: 7,
    medium: 5,
    low: 3
  };

  const avgScore = potholes.length > 0
    ? potholes.reduce((sum, p) => sum + (severityScores[p.severity] || 0), 0) / potholes.length
    : 0;

  const metrics = [
    {
      icon: <MapPin />,
      title: 'Total Distance',
      value: `${totalDistance.toFixed(2)} km`,
      change: '+2.3%',
      positive: true
    },
    {
      icon: <AlertTriangle />,
      title: 'Total Potholes',
      value: potholes.length,
      change: `+${Math.floor(potholes.length * 0.12)}`,
      positive: false
    },
    {
      icon: <Activity />,
      title: 'Total Points',
      value: points.length,
      change: `+${Math.floor(points.length * 0.16)}`,
      positive: true
    },
    {
      icon: <TrendingUp />,
      title: 'Average Severity',
      value: `${avgScore.toFixed(1)}/10`,
      change: '-0.8',
      positive: true
    }
  ];

  return (
    <div className="metrics-grid">
      {metrics.map((metric, i) => (
        <div key={i} className="metric-card">
          <div className="metric-icon">{metric.icon}</div>
          <div className="metric-content">
            <div className="metric-label">{metric.title}</div>
            <div className="metric-value">{metric.value}</div>
            <div className={`metric-change ${metric.positive ? 'positive' : 'negative'}`}>
              {metric.change}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default MetricsCards;
