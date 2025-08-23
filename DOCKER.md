# 🐳 Docker Deployment Guide for DivvyUp

This guide explains how to run DivvyUp using Docker and Docker Compose for both development and production environments.

## 🚀 Quick Start

### Prerequisites
- **Docker** (20.10+) - [Install Docker](https://docs.docker.com/get-docker/)
- **Docker Compose** (2.0+) - Usually included with Docker Desktop
- **Make** (optional, for convenience commands)

### 1. Clone and Setup
```bash
git clone https://github.com/yourusername/divvyup.git
cd divvyup

# Initial setup (creates directories and .env file)
make setup
# OR manually:
# mkdir -p data data-dev
# cp .env.example .env
```

### 2. Configure Environment
Edit the `.env` file:
```bash
# REQUIRED: Change this JWT secret!
JWT_SECRET=your_very_secure_jwt_secret_here_change_me
```

### 3. Run the Application

**For Development:**
```bash
make dev
# OR: docker-compose -f docker-compose.dev.yml up --build
```

**For Production:**
```bash
make prod
# OR: docker-compose up --build -d
```

### 4. Access Your App
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000
- **Health Check**: http://localhost:4000/health

## 📁 Project Structure

```
divvyup/
├── docker-compose.yml          # Production configuration
├── docker-compose.dev.yml      # Development configuration
├── .env.example               # Environment template
├── Makefile                   # Convenience commands
├── backend/
│   ├── Dockerfile            # Multi-stage Dockerfile (dev + production)
│   └── .dockerignore
├── frontend/
│   ├── Dockerfile            # Multi-stage Dockerfile (dev + production)
│   ├── nginx.conf           # Nginx configuration for production
│   └── .dockerignore
└── data/                     # SQLite database storage
```

## 🛠️ Development Environment

### Features
- **Hot reloading** for both frontend and backend
- **Volume mounts** for live code changes
- **Separate databases** (dev.db vs production.db)
- **Easy debugging** with source maps

### Commands
```bash
# Start development environment
make dev

# View logs
make logs-dev

# Stop development environment
make dev-down

# Open Prisma Studio (database viewer)
docker-compose -f docker-compose.dev.yml exec backend npm run prisma:studio
```

### Development URLs
- **Frontend**: http://localhost:5173 (Vite dev server)
- **Backend**: http://localhost:4000
- **API Proxy**: http://localhost:5173/api (proxied to backend)

## 🚀 Production Environment

### Features
- **Optimized builds** with multi-stage Dockerfiles
- **Nginx** serving static files and proxying API
- **Health checks** for all services
- **Security hardening** (non-root users, minimal images)
- **Persistent data** with Docker volumes

### Commands
```bash
# Start production environment
make prod

# View logs
make logs

# Stop production environment
make prod-down

# Check health
make health
```

### Production URLs
- **Application**: http://localhost:3000
- **API**: http://localhost:3000/api (proxied through nginx)
- **Direct Backend**: http://localhost:4000 (also exposed)

## 📊 Service Details

### Backend Service
- **Base Image**: Node.js 22 Alpine
- **Development**: Hot reloading with nodemon, all dev dependencies
- **Production**: Compiled TypeScript, production dependencies only
- **Database**: SQLite (persistent volume)
- **Features**: TypeScript compilation, Prisma ORM, JWT auth
- **Health Check**: GET /health endpoint
- **Security**: Non-root user, minimal attack surface

### Frontend Service
- **Development**: Node.js with Vite dev server, hot reloading
- **Production**: Nginx Alpine serving static build
- **Features**: Optimized Svelte build, gzip compression, security headers
- **Reverse Proxy**: Routes /api/* to backend (production only)
- **Health Check**: HTTP request to frontend
- **Security**: Non-root users, CSP headers

## 🗄️ Database Management

### Automatic Migrations
Migrations run automatically when the backend container starts.

### Manual Database Operations
```bash
# Run migrations manually
docker-compose exec backend npm run prisma:migrate

# Open Prisma Studio
docker-compose exec backend npm run prisma:studio

# Generate Prisma client
docker-compose exec backend npm run prisma:generate

# View database
docker-compose exec backend ls -la /app/data/
```

### Database Location
- **Development**: `./data-dev/dev.db`
- **Production**: `./data/production.db`

### Backup Database
```bash
# Backup production database
cp data/production.db backups/production-$(date +%Y%m%d).db

# Backup development database
cp data-dev/dev.db backups/dev-$(date +%Y%m%d).db
```

## 🔧 Available Commands (Makefile)

```bash
make help       # Show all available commands
make setup      # Initial setup
make dev        # Start development
make prod       # Start production
make logs       # View production logs
make logs-dev   # View development logs
make status     # Show container status
make health     # Check service health
make restart    # Restart services
make clean      # Remove all containers and volumes
```

## 🌐 Deployment Options

### Local Development
Perfect for coding and testing:
```bash
make dev
```

### Local Production
Test production builds locally:
```bash
make prod
```

### Server Deployment
For deploying to a server:

1. **Copy files to server**:
   ```bash
   rsync -av --exclude node_modules --exclude data* . user@server:/path/to/divvyup/
   ```

2. **Setup on server**:
   ```bash
   ssh user@server
   cd /path/to/divvyup
   make setup
   # Edit .env with production values
   make prod
   ```

3. **Configure reverse proxy** (optional):
   - Use nginx/Caddy to proxy to port 3000
   - Add SSL certificates
   - Configure domain name

### Cloud Deployment
Deploy to cloud platforms:

- **DigitalOcean Droplet**: Use Docker Machine or manual setup
- **AWS EC2**: Deploy with Docker on EC2 instance
- **Google Cloud Run**: Convert to single container
- **Azure Container Instances**: Deploy multi-container app

## 🔒 Security Considerations

### Production Security
- ✅ **Non-root containers**: All services run as non-root users
- ✅ **Security headers**: Nginx adds security headers
- ✅ **Minimal images**: Alpine Linux base images
- ✅ **Health checks**: Monitor service health
- ✅ **Secret management**: JWT secrets via environment variables

### Recommended Additions
- **SSL/TLS**: Use Let's Encrypt or CloudFlare
- **Firewall**: Block direct access to port 4000
- **Monitoring**: Add Prometheus/Grafana
- **Backups**: Automated database backups
- **Updates**: Regular security updates

## 🐛 Troubleshooting

### Common Issues

**Container won't start:**
```bash
# Check logs
docker-compose logs backend
docker-compose logs frontend

# Check if ports are in use
sudo lsof -i :3000
sudo lsof -i :4000
```

**Database issues:**
```bash
# Reset database
docker-compose down -v
rm -rf data data-dev
make setup
make dev
```

**Permission errors:**
```bash
# Fix ownership
sudo chown -R $USER:$USER data data-dev
```

**Network issues:**
```bash
# Restart Docker network
docker-compose down
docker network prune
docker-compose up
```

### Debug Commands
```bash
# Enter backend container
docker-compose exec backend sh

# Enter frontend container
docker-compose exec frontend sh

# View container details
docker-compose ps
docker-compose top

# Monitor resource usage
docker stats
```

## 📈 Performance Tuning

### Resource Limits
Add to docker-compose.yml:
```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
```

### Storage Optimization
```bash
# Clean up unused Docker resources
docker system prune -af
docker volume prune -f

# Optimize images
docker build --no-cache backend/
```

## 🔄 CI/CD Integration

### GitHub Actions Example
```yaml
name: Docker Build and Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build and test
        run: |
          make setup
          make dev &
          sleep 30
          make health
```

This Docker setup gives you a complete, production-ready deployment that's easy to manage and scale! 🚀
