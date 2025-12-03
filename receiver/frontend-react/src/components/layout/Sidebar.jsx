import { Menu, MapPin, BarChart3, Bell, Users, LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
import useStore from '../../store/useStore';
import './Sidebar.css';

function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, logout } = useStore();

  return (
    <div className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        {!sidebarCollapsed && (
          <>
            <img src="/logo.png" alt="Logo" className="sidebar-logo" />
            <div className="sidebar-title">
              <h2>RoadAI</h2>
              <p>v1.0</p>
            </div>
          </>
        )}
        <button onClick={toggleSidebar} className="sidebar-toggle">
          {sidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      <nav className="sidebar-nav">
        <a href="#" className="nav-item active">
          <MapPin size={20} />
          {!sidebarCollapsed && <span>Dashboard</span>}
        </a>
        <a href="#" className="nav-item">
          <BarChart3 size={20} />
          {!sidebarCollapsed && <span>Analytics</span>}
        </a>
        <a href="#" className="nav-item">
          <Bell size={20} />
          {!sidebarCollapsed && <span>Alerts</span>}
          <span className="nav-badge">3</span>
        </a>
      </nav>

      <div className="sidebar-footer">
        <button className="sidebar-btn" title="Create User">
          <Users size={20} />
          {!sidebarCollapsed && <span>Create User</span>}
        </button>

        <button onClick={logout} className="sidebar-btn danger" title="Logout">
          <LogOut size={20} />
          {!sidebarCollapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );
}

export default Sidebar;
