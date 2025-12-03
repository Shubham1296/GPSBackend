import { useEffect, useState } from 'react';
import useStore from '../store/useStore';
import { api } from '../utils/api';
import { getSeverityLevel } from '../utils/helpers';
import Sidebar from '../components/layout/Sidebar';
import Header from '../components/layout/Header';
import MapPanel from '../components/map/MapPanel';
import MetricsCards from '../components/dashboard/MetricsCards';
import './Dashboard.css';

function Dashboard() {
  const { server, token, allPoints, setAllPoints, setLoading } = useStore();
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await api.fetchRoute(server, token);

      // Process points with severity
      const processedPoints = data.points.map(p => ({
        ...p,
        severity: getSeverityLevel(p.is_pothole),
        timestamp: p.timestamp || Date.now()
      }));

      setAllPoints(processedPoints);
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const potholes = allPoints.filter(p => p.is_pothole);

  return (
    <div className="dashboard-container">
      <Sidebar />

      <div className="main-content">
        <Header onRefresh={loadData} />

        <div className="dashboard-content">
          {error ? (
            <div className="error-banner">
              <p>Failed to load data: {error}</p>
              <button onClick={loadData} className="btn-secondary">
                Retry
              </button>
            </div>
          ) : (
            <>
              <MetricsCards points={allPoints} potholes={potholes} />

              <div className="main-grid">
                <MapPanel points={allPoints} potholes={potholes} />

                <div className="side-panels">
                  <div className="panel">
                    <div className="panel-header">
                      <h3>Recent Detections</h3>
                    </div>
                    <div className="panel-body">
                      {potholes.slice(0, 5).map((p, i) => (
                        <div key={i} className="activity-item">
                          <div className="activity-location">
                            Sector {Math.floor(Math.random() * 90) + 10}
                          </div>
                          <span className={`severity-badge ${p.severity}`}>
                            {p.severity}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
