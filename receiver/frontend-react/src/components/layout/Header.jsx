import { Search, Calendar, Download, RefreshCw } from 'lucide-react';
import './Header.css';

function Header({ onRefresh }) {
  return (
    <header className="header">
      <div className="header-left">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search locations..."
          />
        </div>
      </div>

      <div className="header-right">
        <select className="time-range-select">
          <option>Last 24 Hours</option>
          <option>Last 7 Days</option>
          <option>Last 30 Days</option>
          <option>All Time</option>
        </select>

        <button onClick={onRefresh} className="header-btn" title="Refresh">
          <RefreshCw size={18} />
        </button>

        <button className="header-btn" title="Export">
          <Download size={18} />
        </button>
      </div>
    </header>
  );
}

export default Header;
