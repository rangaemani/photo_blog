BACKEND_DIR  := backend/photo_blog
FRONTEND_DIR := frontend/photo_blog
MANAGE       := python $(BACKEND_DIR)/manage.py
# ── Dev servers ───────────────────────────────────────────────────────────────

.PHONY: dev
dev: ## Start backend and frontend dev servers (requires two terminals — run separately)
	@echo "Run 'make backend' and 'make frontend' in separate terminals."

.PHONY: backend
backend: ## Start Django dev server
	cd $(BACKEND_DIR) && python manage.py runserver

.PHONY: frontend
frontend: ## Start Vite dev server
	cd $(FRONTEND_DIR) && npm run dev

# ── Database ──────────────────────────────────────────────────────────────────

.PHONY: migrate
migrate: ## Apply all pending migrations
	$(MANAGE) migrate

.PHONY: migrations
migrations: ## Generate new migrations from model changes
	$(MANAGE) makemigrations

.PHONY: pull-db
pull-db: ## Pull prod DB into local dev (fill in scripts/pull_prod_db.py first)
	python scripts/pull_prod_db.py

.PHONY: backfill-gps
backfill-gps: ## Dry-run GPS backfill against local DB
	$(MANAGE) backfill_gps

.PHONY: backfill-gps-write
backfill-gps-write: ## Apply GPS backfill against local DB
	$(MANAGE) backfill_gps --write

.PHONY: prod-migrate
prod-migrate: ## Run migrations against prod DB (set PROD_DATABASE_URL env var)
	python scripts/prod_manage.py migrate

.PHONY: prod-backfill-gps
prod-backfill-gps: ## Dry-run GPS backfill against prod DB (set PROD_DATABASE_URL env var)
	python scripts/prod_manage.py backfill_gps

.PHONY: prod-backfill-gps-write
prod-backfill-gps-write: ## Apply GPS backfill against prod DB
	python scripts/prod_manage.py backfill_gps --write

# ── Dependencies ──────────────────────────────────────────────────────────────

.PHONY: install
install: install-backend install-frontend ## Install all dependencies

.PHONY: install-backend
install-backend: ## Install Python dependencies
	pip install -r $(BACKEND_DIR)/requirements.txt

.PHONY: install-frontend
install-frontend: ## Install Node dependencies
	cd $(FRONTEND_DIR) && npm install

# ── Build ─────────────────────────────────────────────────────────────────────

.PHONY: build
build: ## Build frontend for production
	cd $(FRONTEND_DIR) && npm run build

# ── Django utilities ──────────────────────────────────────────────────────────

.PHONY: shell
shell: ## Open Django shell
	$(MANAGE) shell

.PHONY: superuser
superuser: ## Create a Django superuser
	$(MANAGE) createsuperuser

# ── Help ──────────────────────────────────────────────────────────────────────

.PHONY: help
help: ## List available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
