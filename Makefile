.PHONY: help init update-gregory start-gregory stop-gregory logs-gregory clean-gregory status

# Default target
help: ## Show this help message
	@echo "Brain Regeneration Project - Available commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""

init: ## Initialize and setup the project (run this first)
	@echo "Initializing Brain Regeneration project..."
	git submodule update --init --recursive
	@echo "Project initialized successfully!"

update-gregory: ## Update GregoryAi submodule from upstream
	@echo "Updating GregoryAi submodule..."
	git submodule update --remote gregory-ai
	@echo "GregoryAi submodule updated successfully!"

start-gregory: ## Start GregoryAi using docker-compose
	@echo "Starting GregoryAi services..."
	cd gregory-ai && docker-compose up -d
	@echo "GregoryAi services started successfully!"
	@echo "You can check the logs with: make logs-gregory"

stop-gregory: ## Stop GregoryAi services
	@echo "Stopping GregoryAi services..."
	cd gregory-ai && docker-compose down
	@echo "GregoryAi services stopped successfully!"

logs-gregory: ## Show GregoryAi logs
	@echo "Showing GregoryAi logs (press Ctrl+C to exit)..."
	cd gregory-ai && docker-compose logs -f

status-gregory: ## Show status of GregoryAi services
	@echo "GregoryAi services status:"
	cd gregory-ai && docker-compose ps

restart-gregory: ## Restart GregoryAi services
	@echo "Restarting GregoryAi services..."
	cd gregory-ai && docker-compose down && docker-compose up -d
	@echo "GregoryAi services restarted successfully!"

clean-gregory: ## Stop and remove GregoryAi containers and volumes
	@echo "Cleaning up GregoryAi services..."
	cd gregory-ai && docker-compose down -v --remove-orphans
	@echo "GregoryAi services cleaned up successfully!"

# Hugo development server
h: ## Start Hugo development server (alias for hugo-dev)
	@echo "Starting Hugo development server..."
	hugo server -F -O -N -D

hugo-dev: h ## Alias for h command

hugo-dev-local: ## Start Hugo dev server pointed at local Django API (localhost:8000) — disables analytics
	@echo "Starting Hugo against local API (http://localhost:8000)..."
	HUGO_PARAMS_APIBASE=http://localhost:8000 HUGO_ENV=development hugo server -F -O -N -D

hugo-build: ## Build the Hugo site
	@echo "Building Hugo site..."
	hugo --minify

# Combined operations
dev: start-gregory h ## Start both GregoryAi and Hugo development server

setup: init ## Alias for init command
	@echo "Setup complete!"

# Status check
status: status-gregory ## Show overall project status
	@echo ""
	@echo "Hugo site status:"
	@if [ -d "public" ]; then echo "  ✓ Site built (public/ directory exists)"; else echo "  ✗ Site not built (run 'make hugo-build')"; fi
	@echo ""
