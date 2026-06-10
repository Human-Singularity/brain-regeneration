# Brain Regeneration Observatory Makefile
#
# Frontend: this repo (Hugo) is built and served by Cloudflare Pages —
#           pushing to GitHub is the deployment (`make deploy-frontend`).
# Backend:  GregoryAI Django app on $(PROD_HOST). api.brain-regeneration.com is an
#           alternative hostname for api.gregory-ms.com, served from the
#           $(PROD_PROJECT_DIR) checkout on the server. Backend code lives in the
#           gregory-ms / GregoryAI repos, NOT here — push there first, then run
#           `make deploy-backend` to update and restart the running instance.

# Load variables from .env if present, stripping surrounding quotes
-include .env
export

# Strip surrounding single/double quotes from variables read from .env
POSTGRES_USER     := $(patsubst "%",%,$(patsubst '%',%,$(POSTGRES_USER)))
POSTGRES_PASSWORD := $(patsubst "%",%,$(patsubst '%',%,$(POSTGRES_PASSWORD)))
POSTGRES_DB       := $(patsubst "%",%,$(patsubst '%',%,$(POSTGRES_DB)))

PROD_HOST        ?= House
PROD_SSH_USER    ?= gregory
PROD_PROJECT_DIR ?= /home/gregory/gregory-ms-website
PROD_SSH         := ssh $(PROD_SSH_USER)@$(PROD_HOST)
BACKUP_DIR       := backups
DUMP_FILE        := $(BACKUP_DIR)/db_pull_$(shell date +%Y%m%d_%H%M%S).sql

.PHONY: help h hugo-dev hugo-dev-local hugo-build dev setup status \
	start-gregory stop-gregory logs-gregory status-gregory restart-gregory clean-gregory \
	deploy-frontend deploy-backend remote-pull remote-deps remote-migrate remote-restart remote-status \
	db-pull db-restore db-upgrade db-upgrade-finish

# Default target
help: ## Show this help message
	@echo "Brain Regeneration Project - Available commands:"
	@echo ""
	@grep -hE '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""

# ──────────────────────────────────────────────────────────────────────────────
# Local development — optional GregoryAI backend (docker compose) + Hugo
# ──────────────────────────────────────────────────────────────────────────────

start-gregory: ## Start GregoryAi using docker compose
	@echo "Starting GregoryAi services..."
	docker compose up -d
	@echo "GregoryAi services started successfully!"
	@echo "You can check the logs with: make logs-gregory"

stop-gregory: ## Stop GregoryAi services
	@echo "Stopping GregoryAi services..."
	docker compose down
	@echo "GregoryAi services stopped successfully!"

logs-gregory: ## Show GregoryAi logs
	@echo "Showing GregoryAi logs (press Ctrl+C to exit)..."
	docker compose logs -f

status-gregory: ## Show status of GregoryAi services
	@echo "GregoryAi services status:"
	docker compose ps

restart-gregory: ## Restart GregoryAi services
	@echo "Restarting GregoryAi services..."
	docker compose down && docker compose up -d
	@echo "GregoryAi services restarted successfully!"

clean-gregory: ## Stop and remove GregoryAi containers and volumes
	@echo "Cleaning up GregoryAi services..."
	docker compose down -v --remove-orphans
	@echo "GregoryAi services cleaned up successfully!"

# Hugo development server
h: ## Start Hugo development server (alias for hugo-dev)
	@echo "Starting Hugo development server..."
	hugo server -F -O -N -D

hugo-dev: h ## Alias for h command

hugo-dev-local: ## Start Hugo dev server pointed at local Django API (localhost:8000) — disables analytics
	@echo "Starting Hugo against local API (http://localhost:8000)..."
	HUGO_PARAMS_APIBASE=http://localhost:8000 HUGO_ENV=development hugo server -F -O -N -D

hugo-build-local: ## Build the Hugo site locally (CF Pages builds production on push)
	@echo "Building Hugo site..."
	hugo --minify

# Combined operations
dev: start-gregory h ## Start both GregoryAi and Hugo development server

setup: ## Setup the project
	@echo "Setup complete!"

# Status check
status: status-gregory ## Show overall local project status
	@echo ""
	@echo "Hugo site status:"
	@if [ -d "public" ]; then echo "  ✓ Site built (public/ directory exists)"; else echo "  ✗ Site not built (run 'make hugo-build')"; fi
	@echo ""

# ──────────────────────────────────────────────────────────────────────────────
# Deployment
#
# Frontend: Cloudflare Pages watches GitHub — a push is a deploy, no build step.
# Backend:  the pipeline below updates the GregoryAI checkout on the server and
#           restarts the `gregory` container. It assumes the backend changes were
#           already pushed from the gregory-ms / GregoryAI repos.
# ──────────────────────────────────────────────────────────────────────────────

deploy-frontend: ## Push to GitHub — Cloudflare Pages builds and deploys the site
	@echo "🚀 Pushing to GitHub (Cloudflare Pages builds and deploys)..."
	@git push
	@echo "✅ Pushed — Cloudflare Pages deployment is on its way"

remote-pull: ## Pull latest backend code on the production server (no restart)
	@echo "🔄 Pulling changes on the production server..."
	@$(PROD_SSH) 'cd $(PROD_PROJECT_DIR) && git pull --no-edit && echo "✅ Remote repository updated"'

remote-deps: ## Install Python requirements in the gregory container
	@echo "📦 Installing dependencies on remote..."
	@$(PROD_SSH) 'docker exec gregory pip install -q -r $(PROD_PROJECT_DIR)/requirements.txt && echo "✅ Dependencies installed"'

remote-migrate: ## Run Django migrations on the production server
	@echo "🔄 Running database migrations..."
	@$(PROD_SSH) 'docker exec gregory python manage.py migrate && echo "✅ Database migrations complete"'

remote-restart: ## Restart the gregory application container
	@echo "🔄 Restarting application..."
	@$(PROD_SSH) 'docker restart gregory && echo "✅ Container restarted"'

deploy-backend: ## Update + restart the GregoryAI backend only if new commits were pulled
	@$(PROD_SSH) 'cd $(PROD_PROJECT_DIR) && \
		BEFORE=$$(git rev-parse HEAD) && \
		echo "🔄 Pulling from GitHub..." && \
		git pull --no-edit && \
		AFTER=$$(git rev-parse HEAD) && \
		if [ "$$BEFORE" = "$$AFTER" ]; then \
			echo "✅ Already up to date — no restart needed"; \
		else \
			echo "📦 Installing dependencies..." && \
			docker exec gregory pip install -q -r requirements.txt && \
			echo "🗃️  Running migrations..." && \
			docker exec gregory python manage.py migrate && \
			echo "🔄 Restarting container..." && \
			docker restart gregory && \
			echo "🎉 Backend deployment complete!"; \
		fi'

remote-status: ## Show backend container status and recent logs on the production server
	@echo "📊 Checking application status..."
	@$(PROD_SSH) 'echo "🔍 Container status:" && \
		docker ps | grep gregory && \
		echo "" && \
		echo "🔍 Recent logs:" && \
		docker logs gregory --tail 10'

# ──────────────────────────────────────────────────────────────────────────────
# Local database utilities (require the local docker compose backend)
# ──────────────────────────────────────────────────────────────────────────────

## Fetch the production DB and restore it into the local Docker postgres container.
## Production credentials are read from $(PROD_PROJECT_DIR)/gregory/.env on the
## server, so they don't need to match the local POSTGRES_* values.
db-pull: | $(BACKUP_DIR) ## Pull the production DB into the local Docker postgres
	@echo "==> Dumping production database from $(PROD_HOST) ..."
	$(PROD_SSH) \
		'set -a; . $(PROD_PROJECT_DIR)/gregory/.env; set +a; \
		 docker exec db pg_dump -U "$$POSTGRES_USER" -d "$$POSTGRES_DB" --no-owner --no-privileges -F p' \
		> $(DUMP_FILE)
	@echo "==> Dump saved to $(DUMP_FILE)"
	@echo "==> Waiting for local postgres to be ready ..."
	@until docker exec db pg_isready -U $(POSTGRES_USER) -q; do sleep 1; done
	@echo "==> Dropping and recreating local database $(POSTGRES_DB) ..."
	docker exec db psql -U $(POSTGRES_USER) -d postgres -c "DROP DATABASE IF EXISTS \"$(POSTGRES_DB)\";"
	docker exec db psql -U $(POSTGRES_USER) -d postgres -c "CREATE DATABASE \"$(POSTGRES_DB)\";"
	@echo "==> Restoring dump into local database ..."
	docker exec -i db psql -U $(POSTGRES_USER) -d $(POSTGRES_DB) < $(DUMP_FILE)
	@echo "==> Running Django migrations ..."
	docker exec gregory python manage.py migrate --run-syncdb
	docker exec gregory python manage.py createcachetable gregory_cache
	@echo "==> Done. Local database is now a copy of production."

db-restore: | $(BACKUP_DIR) ## Restore the most recent SQL dump from backups/ into the local DB
	$(eval LATEST := $(shell ls -t $(BACKUP_DIR)/*.sql 2>/dev/null | head -1))
	@if [ -z "$(LATEST)" ]; then echo "No backup files found in $(BACKUP_DIR)/"; exit 1; fi
	@echo "==> Restoring $(LATEST) ..."
	@until docker exec db pg_isready -U $(POSTGRES_USER) -q; do sleep 1; done
	docker exec db psql -U $(POSTGRES_USER) -d postgres -c "DROP DATABASE IF EXISTS \"$(POSTGRES_DB)\";"
	docker exec db psql -U $(POSTGRES_USER) -d postgres -c "CREATE DATABASE \"$(POSTGRES_DB)\";"
	docker exec -i db psql -U $(POSTGRES_USER) -d $(POSTGRES_DB) < $(LATEST)
	docker exec gregory python manage.py migrate --run-syncdb
	@echo "==> Done."

## Major-version Postgres upgrade (two-step for rollback safety).
##
## Pre-condition: docker-compose.yml's `db` image tag already points at the NEW major version.
## The currently running `db` container can still be on the OLD version — that is exactly what
## step 1 expects.
##
## Workflow:
##   1. make db-upgrade         # dumps current DB -> removes db container -> renames postgres-data
##   2. make db-upgrade-finish  # recreates db container from the new image, restores dump, migrates
##
## Rollback before step 2: revert docker-compose.yml's image tag,
##   `mv postgres-data.pre-upgrade.* postgres-data`, then `docker compose up -d db`.
UPGRADE_TIMESTAMP := $(shell date +%Y%m%d_%H%M%S)
UPGRADE_DUMP      := $(BACKUP_DIR)/pre_upgrade_$(UPGRADE_TIMESTAMP).sql

db-upgrade: | $(BACKUP_DIR) ## Step 1 of local Postgres major upgrade (dump + park data dir)
	@if [ ! -d "./postgres-data" ]; then \
		echo "ERROR: ./postgres-data does not exist. Run this target from the repo root after starting the db container at least once."; \
		exit 1; \
	fi
	@echo "==> Dumping current DB to $(UPGRADE_DUMP)"
	docker exec db pg_dump -U $(POSTGRES_USER) -d $(POSTGRES_DB) \
		--no-owner --no-privileges -F p > $(UPGRADE_DUMP)
	@echo "==> Removing db container (data dir on host is untouched)"
	docker compose rm -sf db
	@echo "==> Moving ./postgres-data aside (rollback safety)"
	mv ./postgres-data ./postgres-data.pre-upgrade.$(UPGRADE_TIMESTAMP)
	@echo "==> NEXT: run: make db-upgrade-finish"

db-upgrade-finish: | $(BACKUP_DIR) ## Step 2 of local Postgres major upgrade (restore into new image)
	@echo "==> Starting db container from new image (empty data dir)"
	docker compose up -d db
	@until docker exec db pg_isready -U $(POSTGRES_USER) -q; do sleep 1; done
	$(eval DUMP := $(shell ls -t $(BACKUP_DIR)/pre_upgrade_*.sql 2>/dev/null | head -1))
	@if [ -z "$(DUMP)" ]; then echo "No pre_upgrade_*.sql found in $(BACKUP_DIR)/"; exit 1; fi
	@echo "==> Restoring $(DUMP)"
	docker exec db psql -U $(POSTGRES_USER) -d postgres -c "DROP DATABASE IF EXISTS \"$(POSTGRES_DB)\";"
	docker exec db psql -U $(POSTGRES_USER) -d postgres -c "CREATE DATABASE \"$(POSTGRES_DB)\";"
	docker exec -i db psql -U $(POSTGRES_USER) -d $(POSTGRES_DB) < $(DUMP)
	@echo "==> Ensuring gregory app container is running"
	docker compose up -d gregory
	@echo "==> Running Django migrations"
	docker exec gregory python manage.py migrate --run-syncdb
	docker exec gregory python manage.py createcachetable gregory_cache
	@echo "==> Done. Verify, then remove postgres-data.pre-upgrade.* once happy."

$(BACKUP_DIR):
	mkdir -p $(BACKUP_DIR)
