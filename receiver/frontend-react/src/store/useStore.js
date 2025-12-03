import { create } from 'zustand';

const useStore = create((set, get) => ({
  // Auth state
  server: localStorage.getItem('server') || '',
  token: localStorage.getItem('jwt') || '',
  userEmail: '',

  // Data state
  allPoints: [],
  potholeMarkers: [],
  gpsDots: [],

  // UI state
  sidebarCollapsed: false,
  currentView: 'dashboard',
  loading: false,

  // Table state
  tableState: {
    currentPage: 1,
    itemsPerPage: 10,
    sortColumn: 'time',
    sortDirection: 'desc',
    searchQuery: '',
    severityFilter: 'all',
    selectedItems: new Set(),
  },

  // Actions
  setAuth: (server, token) => {
    localStorage.setItem('server', server);
    localStorage.setItem('jwt', token);
    set({ server, token });
  },

  logout: () => {
    localStorage.removeItem('jwt');
    localStorage.removeItem('server');
    set({ server: '', token: '', userEmail: '' });
  },

  setAllPoints: (points) => set({ allPoints: points }),

  setPotholeMarkers: (markers) => set({ potholeMarkers: markers }),

  setGpsDots: (dots) => set({ gpsDots: dots }),

  toggleSidebar: () => set((state) => ({
    sidebarCollapsed: !state.sidebarCollapsed
  })),

  setCurrentView: (view) => set({ currentView: view }),

  setLoading: (loading) => set({ loading }),

  updateTableState: (updates) => set((state) => ({
    tableState: { ...state.tableState, ...updates }
  })),

  toggleTableSelection: (id) => set((state) => {
    const newSelected = new Set(state.tableState.selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    return {
      tableState: { ...state.tableState, selectedItems: newSelected }
    };
  }),

  clearTableSelection: () => set((state) => ({
    tableState: { ...state.tableState, selectedItems: new Set() }
  })),
}));

export default useStore;
