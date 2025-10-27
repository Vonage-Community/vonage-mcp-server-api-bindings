# Vonage MCP Server API Bindings Makefile

.PHONY: help install build clean test lint dev start release-patch release-minor release-major publish check-clean check-branch check-npm-token

# Default target
help: ## Show this help message
	@echo "Vonage MCP Server API Bindings - Available commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# Development commands
install: ## Install dependencies
	npm ci

build: ## Build the project
	npm run build

clean: ## Clean build artifacts
	npm run clean

test: ## Run tests
	npm test

lint: ## Run linting (if configured)
	npm run lint || echo "No linting configured"

dev: ## Start development mode with watch
	npm run dev

start: ## Start the built application
	npm run start

# Quality checks
format: ## Format code with Prettier
	npm run format

format-check: ## Check code formatting
	npm run format:check

lint: ## Run ESLint
	npm run lint

lint-fix: ## Fix ESLint issues
	npm run lint:fix

typecheck: ## Run TypeScript type checking
	npm run typecheck

check: ## Run all quality checks (format, lint, typecheck)
	npm run check

fix: ## Fix all auto-fixable issues (format and lint)
	npm run fix

check-clean: ## Check if working directory is clean
	@if [ -n "$$(git status --porcelain)" ]; then \
		echo "❌ Working directory is not clean. Please commit or stash changes."; \
		exit 1; \
	fi
	@echo "✅ Working directory is clean"

check-branch: ## Check if on main branch
	@CURRENT_BRANCH=$$(git branch --show-current); \
	if [ "$$CURRENT_BRANCH" != "main" ]; then \
		echo "❌ Must be on main branch to release. Currently on: $$CURRENT_BRANCH"; \
		exit 1; \
	fi
	@echo "✅ On main branch"

check-npm-token: ## Check if NPM_TOKEN is set (for local publishing)
	@if [ -z "$$NPM_TOKEN" ]; then \
		echo "⚠️  NPM_TOKEN not set. Publishing will use npm login credentials."; \
	else \
		echo "✅ NPM_TOKEN is configured"; \
	fi

# Pre-release checks
pre-release: check-branch check-clean ## Run all pre-release checks
	@echo "🔍 Running pre-release checks..."
	@echo "📥 Pulling latest changes..."
	git pull origin main
	@echo "🎨 Checking code formatting..."
	$(MAKE) check
	@echo "🧪 Running tests..."
	$(MAKE) test
	@echo "🔨 Building project..."
	$(MAKE) build
	@echo "📦 Validating package..."
	npm publish --dry-run
	@echo "✅ Pre-release checks completed"

# Release commands
release-patch: pre-release ## Release a patch version (0.1.0 → 0.1.1)
	@echo "🚀 Creating patch release..."
	npm version patch
	$(MAKE) push-release

release-minor: pre-release ## Release a minor version (0.1.0 → 0.2.0)
	@echo "🚀 Creating minor release..."
	npm version minor
	$(MAKE) push-release

release-major: pre-release ## Release a major version (0.1.0 → 1.0.0)
	@echo "🚀 Creating major release..."
	npm version major
	$(MAKE) push-release

push-release: ## Push the release to git (internal target)
	@NEW_VERSION=$$(node -p "require('./package.json').version"); \
	echo "✅ New version: v$$NEW_VERSION"; \
	echo "📤 Pushing changes and tags..."; \
	git push origin main; \
	git push origin "v$$NEW_VERSION"; \
	echo "🎉 Release v$$NEW_VERSION completed!"; \
	echo "📦 GitHub Actions will automatically publish to NPM when the tag is pushed."; \
	echo "🔗 Check the workflow at: https://github.com/Vonage-Community/vonage-mcp-server-api-bindings/actions"

# Local publishing (for testing)
publish-local: build check-npm-token ## Publish to NPM locally (for testing)
	@echo "📦 Publishing to NPM..."
	npm publish --access public
	@echo "✅ Published successfully"

# Development workflow
setup: ## Initial project setup
	@echo "🔧 Setting up project..."
	$(MAKE) install
	$(MAKE) build
	@echo "✅ Project setup completed"

validate: ## Validate the package without publishing
	@echo "✅ Validating package structure..."
	@node -e "const pkg = require('./package.json'); console.log('Package:', pkg.name, 'v' + pkg.version)"
	$(MAKE) check
	$(MAKE) build
	npm publish --dry-run
	@echo "✅ Package validation passed"

# Cleanup
reset: clean ## Reset project to clean state
	@echo "🧹 Resetting project..."
	rm -rf node_modules package-lock.json
	@echo "✅ Project reset completed. Run 'make setup' to reinstall."

# Git helpers
status: ## Show git status
	git status

log: ## Show recent git log
	git log --oneline -10

# Package info
info: ## Show package information
	@echo "📦 Package Information:"
	@node -e "const pkg = require('./package.json'); console.log('Name:', pkg.name); console.log('Version:', pkg.version); console.log('Description:', pkg.description);"
	@echo ""
	@echo "📁 Build Status:"
	@if [ -d "build" ]; then echo "✅ Build directory exists"; ls -la build/; else echo "❌ Build directory missing"; fi

# Quick commands
quick-patch: ## Quick patch release (skips some checks)
	npm version patch
	git push origin main
	git push origin $$(git describe --tags --abbrev=0)

quick-minor: ## Quick minor release (skips some checks)
	npm version minor
	git push origin main
	git push origin $$(git describe --tags --abbrev=0)