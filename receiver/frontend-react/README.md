# RoadAI Dashboard - React Migration

## 🎯 What's Been Done

This is a **React + Vite** migration of the vanilla JavaScript dashboard. The foundation has been set up with modern tooling and architecture.

### ✅ Completed Setup

1. **Project Structure**
   - Vite + React configured
   - Zustand for state management
   - React Router for navigation
   - Leaflet ready for map integration

2. **Core Files Created**
   - `/src/store/useStore.js` - Global state management
   - `/src/utils/api.js` - API client functions
   - `/src/utils/helpers.js` - Utility functions
   - `/src/pages/Login.jsx` - Authentication page
   - `/src/App.jsx` - Main app with routing

3. **Dependencies Added**
   - `react` & `react-dom` - React framework
   - `react-router-dom` - Routing
   - `zustand` - State management (simpler than Redux)
   - `leaflet` & `react-leaflet` - Maps
   - `chart.js` & `react-chartjs-2` - Charts
   - `jszip` - Export functionality
   - `lucide-react` - Icon library

## 🚀 Getting Started

### 1. Install Dependencies

```bash
cd frontend-react
npm install
```

### 2. Start Development Server

```bash
npm run dev
```

Visit: http://localhost:3000

### 3. Build for Production

```bash
npm run build
```

Output will be in `/dist` directory.

## 📁 Recommended Component Structure

Here's the complete structure for finishing the migration:

```
frontend-react/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.jsx          # Sidebar navigation
│   │   │   ├── Header.jsx            # Top header with search
│   │   │   ├── Sidebar.css
│   │   │   └── Header.css
│   │   ├── dashboard/
│   │   │   ├── MetricsCards.jsx      # 4 metric cards
│   │   │   ├── SeverityChart.jsx     # Severity breakdown
│   │   │   ├── ActivityList.jsx      # Recent detections
│   │   │   └── styles.css
│   │   ├── map/
│   │   │   ├── MapPanel.jsx          # Main map component
│   │   │   ├── MapPopup.jsx          # Custom bottom popup
│   │   │   └── MapPanel.css
│   │   ├── table/
│   │   │   ├── PotholeTable.jsx      # Data table
│   │   │   ├── TableFilters.jsx      # Search & filters
│   │   │   ├── TablePagination.jsx   # Pagination controls
│   │   │   └── PotholeTable.css
│   │   ├── modals/
│   │   │   ├── ImageModal.jsx        # View pothole image
│   │   │   ├── CreateUserModal.jsx   # Create new user
│   │   │   └── Modal.css
│   │   └── common/
│   │       ├── Loader.jsx            # Loading spinner
│   │       ├── Button.jsx            # Reusable button
│   │       └── common.css
│   ├── pages/
│   │   ├── Login.jsx                 # ✅ Done
│   │   ├── Login.css                 # ✅ Done
│   │   ├── Dashboard.jsx             # TODO
│   │   └── Analytics.jsx             # TODO
│   ├── store/
│   │   └── useStore.js               # ✅ Done
│   ├── utils/
│   │   ├── api.js                    # ✅ Done
│   │   ├── helpers.js                # ✅ Done
│   │   └── export.js                 # TODO
│   ├── App.jsx                       # ✅ Done
│   ├── main.jsx                      # ✅ Done
│   └── index.css                     # ✅ Done
├── public/
│   └── logo.png                      # Copy from old frontend
├── package.json                      # ✅ Done
├── vite.config.js                    # ✅ Done
└── index.html                        # ✅ Done
```

## 🔧 Next Steps to Complete Migration

### Phase 1: Layout Components (2-3 hours)

1. **Sidebar Component**
   ```jsx
   // src/components/layout/Sidebar.jsx
   - Logo and title
   - Navigation items (Dashboard, Analytics, Alerts)
   - Create User button
   - Logout button
   - Collapse/expand functionality
   ```

2. **Header Component**
   ```jsx
   // src/components/layout/Header.jsx
   - Search bar with geocoding
   - Time range selector
   - Export button
   - Alert badge
   ```

### Phase 2: Dashboard View (4-5 hours)

3. **MetricsCards Component**
   - Total Distance
   - Total Potholes
   - Total Points
   - Average Severity

4. **MapPanel Component** (Critical!)
   ```jsx
   import { MapContainer, TileLayer } from 'react-leaflet'
   // Use react-leaflet for map
   // Add markers for potholes
   // Add GPS dots
   // Custom popup at bottom-left
   ```

5. **ActivityList Component**
   - Recent 5 potholes
   - Click to focus on map

6. **SeverityChart Component**
   - Horizontal bar chart
   - Critical/High/Medium/Low counts

### Phase 3: Table Component (3-4 hours)

7. **PotholeTable Component**
   - Sortable columns
   - Row selection with checkboxes
   - Action buttons (View, Export)
   - Pagination

8. **TableFilters Component**
   - Search input
   - Severity dropdown filter

### Phase 4: Modals (2-3 hours)

9. **ImageModal Component**
   - Display pothole image
   - Show metadata
   - View on Map button

10. **CreateUserModal Component**
    - Email input
    - Password inputs
    - Role selector (Admin/Ordinary)
    - Form validation

### Phase 5: Analytics View (2-3 hours)

11. **Analytics Page**
    - Chart.js integration
    - Distance over time chart
    - Potholes detected chart
    - Severity trend chart
    - Summary stats cards

### Phase 6: Export & Utilities (2 hours)

12. **Export Functions**
    - Export selected as ZIP
    - Export all as ZIP
    - JSZip integration

## 💡 Key Patterns to Follow

### 1. State Management (Zustand)

```jsx
import useStore from '../store/useStore';

function MyComponent() {
  // Read state
  const allPoints = useStore(state => state.allPoints);

  // Call actions
  const setLoading = useStore(state => state.setLoading);

  setLoading(true);
}
```

### 2. API Calls

```jsx
import { api } from '../utils/api';
import useStore from '../store/useStore';

const server = useStore(state => state.server);
const token = useStore(state => state.token);

const data = await api.fetchRoute(server, token);
```

### 3. Map Integration

```jsx
import { MapContainer, TileLayer, CircleMarker } from 'react-leaflet';

<MapContainer center={[30.7, 76.7]} zoom={14}>
  <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />

  {potholes.map(p => (
    <CircleMarker
      key={p.id}
      center={[p.lat, p.lon]}
      pathOptions={{ color: getSeverityColor(p.severity) }}
    />
  ))}
</MapContainer>
```

### 4. Modals Pattern

```jsx
function MyModal({ isOpen, onClose, children }) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
```

## 🎨 Styling Approach

All styles from `frontend/styles.css` can be split into component-specific CSS modules or kept in a single file. The base styles are already in `src/index.css`.

For components, create matching `.css` files:
- `Sidebar.jsx` → `Sidebar.css`
- `MapPanel.jsx` → `MapPanel.css`
- etc.

## 🔄 Migration Strategy

**Option 1: Gradual Migration**
- Keep both frontends running
- Migrate one view at a time
- Test thoroughly before switching

**Option 2: Side-by-Side Development**
- Reference vanilla JS version
- Rebuild components in React
- Much cleaner final code

## 📦 Docker Integration

Update your `docker-compose.yml`:

```yaml
frontend-react:
  build:
    context: ./frontend-react
    dockerfile: Dockerfile
  ports:
    - "3000:80"
  depends_on:
    - backend
```

Create `frontend-react/Dockerfile`:

```dockerfile
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## 🧪 Testing

```bash
# Lint code
npm run lint

# Type check (if using TypeScript)
npm run type-check
```

## 📈 Estimated Timeline

- **Solo developer**: 15-20 hours total
- **With help**: 8-12 hours

## ⚡ Quick Win: Complete Dashboard

Want to see immediate results? Focus on:
1. Dashboard.jsx with layout
2. MapPanel.jsx with basic markers
3. MetricsCards.jsx
4. Basic styling

This gives you a functional app in ~4 hours.

## 🤝 Need Help?

The foundation is solid. You can either:
1. Continue building components yourself following the patterns
2. Request specific components to be built
3. Ask for help with complex parts (map, charts, etc.)

## 📝 Notes

- All existing functionality is preserved in design
- State management is simpler with Zustand than Redux
- React hooks make code cleaner than vanilla JS
- Component reusability will speed up future development
- Better performance with React's virtual DOM
