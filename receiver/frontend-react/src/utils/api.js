// API utilities
export const api = {
  async fetchRoute(server, token) {
    const response = await fetch(`${server}/route`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch route data');
    }

    return response.json();
  },

  async login(server, email, password) {
    const response = await fetch(`${server}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      throw new Error('Invalid credentials');
    }

    return response.json();
  },

  async register(server, email, password, role = 'ordinary') {
    const response = await fetch(`${server}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password, role })
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.detail || 'Registration failed');
    }

    return response.json();
  },

  async deletePothole(server, token, lat, lon) {
    const response = await fetch(`${server}/pothole/${lat}/${lon}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.detail || 'Failed to delete pothole');
    }

    return response.json();
  }
};
