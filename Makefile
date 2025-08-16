# Expensiarmus Docker Management

.PHONY: help build up down logs clean dev dev-down prod prod-down restart status setup

# Default target
help:
	@echo "Expensiarmus Docker Commands:"
	@echo "  setup     - Initial setup (create directories and .env)"
	@echo "  dev       - Start development environment"
	@echo "  dev-down  - Stop development environment"
	@echo "  prod      - Start production environment"
	@echo "  prod-down - Stop production environment"
	@echo "  build     - Build all images"
	@echo "  restart   - Restart all services"
	@echo "  logs      - Show logs for all services"
	@echo "  status    - Show container status"
	@echo "  clean     - Remove all containers, images, and volumes"

# Setup
setup:
	@echo "Setting up Expensiarmus..."
	@mkdir -p data data-dev
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "Created .env file. Please edit it with your configuration."; \
	fi
	@echo "Setup complete!"

# Development
dev: setup
	@echo "Starting development environment..."
	docker-compose -f docker-compose.dev.yml up --build

dev-down:
	@echo "Stopping development environment..."
	docker-compose -f docker-compose.dev.yml down

# Production
prod: setup
	@echo "Starting production environment..."
	docker-compose up --build -d

prod-down:
	@echo "Stopping production environment..."
	docker-compose down

# Build
build:
	@echo "Building all images..."
	docker-compose build
	docker-compose -f docker-compose.dev.yml build

# Restart
restart:
	@echo "Restarting services..."
	docker-compose restart

# Logs
logs:
	docker-compose logs -f

logs-dev:
	docker-compose -f docker-compose.dev.yml logs -f

# Status
status:
	@echo "Container status:"
	docker-compose ps
	@echo "\nDevelopment containers:"
	docker-compose -f docker-compose.dev.yml ps

# Database operations
db-migrate:
	@echo "Running database migrations..."
	docker-compose exec backend npm run prisma:migrate

db-studio:
	@echo "Opening Prisma Studio..."
	docker-compose exec backend npm run prisma:studio

# Clean up
clean:
	@echo "Cleaning up all Docker resources..."
	docker-compose down -v --remove-orphans
	docker-compose -f docker-compose.dev.yml down -v --remove-orphans
	docker system prune -f
	docker volume prune -f

# Health check
health:
	@echo "Checking service health..."
	@curl -f http://localhost:3000/ > /dev/null 2>&1 && echo "✅ Frontend is healthy" || echo "❌ Frontend is not responding"
	@curl -f http://localhost:4000/health > /dev/null 2>&1 && echo "✅ Backend is healthy" || echo "❌ Backend is not responding"
