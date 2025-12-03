# Docker Deployment Guide

## 🐳 Running the React Frontend with Docker

The React frontend is now fully configured to run with Docker Compose!

## 🚀 Quick Start

### 1. Build and Start All Services

```bash
# From the receiver directory
docker-compose up -d --build
```

This will start:
- **PostgreSQL** (port 5432)
- **PgAdmin** (port 5050)
- **Backend** (port 8000)
- **Frontend (Vanilla JS)** (port 8080)
- **Frontend (React)** (port 3000) ← NEW!

### 2. Access the React Dashboard

Open your browser and visit:

**http://localhost:3000**

### 3. Login

Use your credentials:
- **Server:** `http://localhost:8000`
- **Email:** your_email@example.com
- **Password:** your_password

## 📊 Service Ports

| Service | Port | URL |
|---------|------|-----|
| PostgreSQL | 5432 | - |
| PgAdmin | 5050 | http://localhost:5050 |
| Backend API | 8000 | http://localhost:8000 |
| Frontend (Old) | 8080 | http://localhost:8080 |
| **Frontend (React)** | **3000** | **http://localhost:3000** |

## 🔧 Useful Commands

### View Logs

```bash
# All services
docker-compose logs -f

# Just React frontend
docker-compose logs -f frontend-react

# Just backend
docker-compose logs -f backend
```

### Restart React Frontend

```bash
docker-compose restart frontend-react
```

### Rebuild React Frontend

```bash
docker-compose up -d --build frontend-react
```

### Stop All Services

```bash
docker-compose down
```

### Stop and Remove Volumes

```bash
docker-compose down -v
```

## 🔍 Troubleshooting

### Issue: React app shows blank page

**Solution:**
```bash
# Check logs
docker-compose logs frontend-react

# Rebuild
docker-compose up -d --build frontend-react
```

### Issue: Cannot connect to backend

**Solution:**
1. Make sure backend is running: `docker-compose ps`
2. Check backend logs: `docker-compose logs backend`
3. Verify server URL in login: `http://localhost:8000`

### Issue: Images not loading

**Solution:**
The storage volume is shared between backend and frontend:
```bash
# Check if volume is mounted
docker-compose exec frontend-react ls -la /usr/share/nginx/html/storage/frames
```

### Issue: Port 3000 already in use

**Solution:**
Change the port in docker-compose.yml:
```yaml
frontend-react:
  ports:
    - "3001:80"  # Change 3000 to 3001
```

## 📁 What's Inside the Container

The React frontend container:
1. **Builds** the React app with Vite
2. **Serves** with Nginx
3. **Shares** storage volume with backend
4. **Proxies** API requests to backend (optional)

## 🎨 Development vs Production

### Development (Current Setup)
- Hot reload disabled (Docker serves built files)
- Changes require rebuild
- Good for testing deployment

### Local Development
For faster development with hot reload:
```bash
# Outside Docker
cd frontend-react
npm install
npm run dev
# Visit http://localhost:5173
```

## 🔄 Updating the App

When you make changes to React code:

```bash
# Rebuild and restart
docker-compose up -d --build frontend-react

# Or for a clean rebuild
docker-compose down
docker-compose up -d --build
```

## 🚢 Production Deployment

For production, the Dockerfile uses multi-stage builds:

1. **Stage 1:** Builds React app with Node.js
2. **Stage 2:** Serves with Nginx (small, efficient)

**Final image size:** ~25MB (vs ~1GB with Node)

## 🔐 Environment Variables

You can configure the API URL:

```yaml
# In docker-compose.yml
frontend-react:
  environment:
    - VITE_API_URL=http://your-backend-url:8000
```

## 📦 Both Frontends Running

You now have **both frontends** running simultaneously:

- **Vanilla JS** (port 8080) - Original version
- **React** (port 3000) - New version

This allows:
- Side-by-side comparison
- Gradual migration
- Fallback option
- Testing both versions

## 🎯 Next Steps

1. **Try it now:** http://localhost:3000
2. **Compare with old:** http://localhost:8080
3. **Check logs:** `docker-compose logs -f frontend-react`
4. **Make changes:** Edit code → rebuild → refresh

## 💡 Tips

- React frontend uses **production build** in Docker
- For development, use `npm run dev` outside Docker
- Backend storage is shared via volume mount
- Nginx caches static assets for performance
- Both frontends can run together

Enjoy your new React dashboard! 🎉
