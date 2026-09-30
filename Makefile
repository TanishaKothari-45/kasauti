# Run `make help` to see everything.
SHELL := /bin/bash
NVM := source $$HOME/.nvm/nvm.sh && nvm use >/dev/null &&

.PHONY: help setup db-up db-down api agent web lint test

help:
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F ':.*## ' '{printf "  %-10s %s\n", $$1, $$2}'

setup: ## Install Python + Node dependencies
	uv sync
	cd web && $(NVM) npm install

db-up: ## Start Postgres in Docker
	docker compose up -d postgres

db-down: ## Stop Postgres
	docker compose down

api: ## Clinic API on :8000
	uv run uvicorn clinic_api.main:app --reload --port 8000

agent: ## Voice agent on :7860 (runs natively for Metal)
	uv run python -m voice_agent.bot

web: ## Console on :3000
	cd web && $(NVM) npm run dev

lint: ## Ruff + ESLint
	uv run ruff check services
	cd web && $(NVM) npm run lint

test: ## Python tests
	uv run pytest
