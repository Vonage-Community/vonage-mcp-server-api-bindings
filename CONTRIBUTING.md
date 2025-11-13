# Contributing to Vonage MCP Server API Bindings

Thanks for your interest in the project! We'd love to have you involved. This guide will help you
get started with contributing to this MCP (Model Context Protocol) server for Vonage APIs.

## Table of Contents

- [Opening an Issue](#opening-an-issue)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Making a Code Change](#making-a-code-change)
- [Code Quality Standards](#code-quality-standards)
- [Testing Your Changes](#testing-your-changes)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Reviewing a Pull Request](#reviewing-a-pull-request)

## Opening an Issue

We always welcome issues! If you've seen something that isn't quite right or you have a suggestion
for a new feature, please go ahead and open an issue in this project. Include as much information as
you have - it really helps.

**For bug reports, please include:**

- Description of the issue
- Steps to reproduce
- Expected behavior
- Actual behavior
- Your environment (Node.js version, OS, etc.)

**For feature requests, please include:**

- Description of the feature
- Use case and why it would be valuable
- Any implementation ideas you have

## Getting Started

### Prerequisites

- **Node.js**: Version 18 or higher
- **npm**: Comes with Node.js
- **Git**: For version control
- **Vonage Account**: To test the MCP server functionality
  - API Key and Secret
  - Application ID and Private Key (for some features)
  - A Vonage virtual number (for SMS/Voice features)

### Initial Setup

1. **Fork and Clone**

   ```bash
   git clone https://github.com/YOUR_USERNAME/vonage-mcp-server-api-bindings.git
   cd vonage-mcp-server-api-bindings
   ```

2. **Install Dependencies**

   ```bash
   make setup
   # or
   npm install
   ```

3. **Configure Environment**

   Create a `.env` file in the project root:

   ```env
   VONAGE_APPLICATION_ID=<YOUR_VONAGE_APPLICATION_ID>
   VONAGE_PRIVATE_KEY64=<YOUR_VONAGE_PRIVATE_KEY64>
   VONAGE_API_KEY=<YOUR_VONAGE_API_KEY>
   VONAGE_API_SECRET=<YOUR_VONAGE_API_SECRET>
   VONAGE_VIRTUAL_NUMBER=<YOUR_VONAGE_VIRTUAL_NUMBER>
   ```

   > **Tip**: Use [this tool](https://mylight.work/private-key-to-environment-variable) to convert
   > your private key file to base64 encoding.

4. **Verify Setup**
   ```bash
   make build
   make info
   ```

## Development Workflow

### Available Commands

We use a Makefile for common tasks. Run `make help` to see all available commands:

```bash
# Development
make dev              # Start TypeScript watch mode
make build            # Build the project
make clean            # Clean build artifacts

# Code Quality
make format           # Format code with Prettier
make format-check     # Check code formatting
make lint             # Run ESLint
make lint-fix         # Fix ESLint issues
make typecheck        # Run TypeScript type checking
make check            # Run all quality checks
make fix              # Fix all auto-fixable issues

# Testing & Validation
make test             # Run tests
make validate         # Validate package structure
make info             # Show package information

# Setup
make setup            # Initial project setup
make install          # Install dependencies
make reset            # Reset project to clean state
```

### Development Mode

Start the TypeScript compiler in watch mode:

```bash
make dev
```

This will automatically recompile when you make changes to TypeScript files in `src/`.

## Making a Code Change

1. **Create a Branch**

   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

2. **Make Your Changes**
   - Write your code in TypeScript (`src/index.ts`)
   - Follow the existing code style
   - Add comments for complex logic

3. **Run Quality Checks**

   ```bash
   make check
   ```

   This runs:
   - Prettier formatting check
   - ESLint linting
   - TypeScript type checking

4. **Fix Any Issues**

   ```bash
   make fix
   ```

   This automatically fixes:
   - Code formatting issues
   - Auto-fixable linting issues

5. **Build and Test**
   ```bash
   make build
   make validate
   ```

## Code Quality Standards

We maintain high code quality standards using automated tools:

### TypeScript

- All code is written in TypeScript
- Type safety is enforced
- Use proper types, avoid `any` when possible
- Run `make typecheck` to verify types

### Code Style

- **Prettier** for consistent formatting
  - 80 character line width
  - 2-space indentation
  - Single quotes
  - Semicolons required
  - LF line endings

- **ESLint** for code quality
  - TypeScript ESLint rules
  - Prettier integration
  - No unused variables
  - Proper error handling

### Pre-commit Checklist

Before committing, ensure:

```bash
make check    # All checks pass
make build    # Build succeeds
```

## Testing Your Changes

### Manual Testing

1. **Build the Package**

   ```bash
   make build
   ```

2. **Test Locally with MCP Client**

   You can test the MCP server using an MCP-compatible client like Claude Desktop, VS Code, or
   Cursor.

   Update your MCP configuration to use the local build:

   ```json
   "vonage-mcp-server-api-bindings": {
     "type": "stdio",
     "command": "node",
     "args": ["/path/to/vonage-mcp-server-api-bindings/build/index.js"],
     "env": {
       "VONAGE_API_KEY": "your-key",
       "VONAGE_API_SECRET": "your-secret",
       "VONAGE_VIRTUAL_NUMBER": "your-number"
     }
   }
   ```

3. **Test Package Installation**
   ```bash
   npm pack
   npm install -g ./vonage-vonage-mcp-server-api-bindings-*.tgz
   vonage-mcp-server
   ```

### Adding New Tools

When adding a new Vonage API tool:

1. Register the tool in `src/index.ts` using `server.registerTool()`
2. Define the input schema using Zod
3. Implement proper error handling
4. Update the README.md with the new tool documentation
5. Test the tool with actual Vonage API credentials

## Submitting a Pull Request

1. **Push Your Branch**

   ```bash
   git push origin feature/your-feature-name
   ```

2. **Open a Pull Request**
   - Go to the repository on GitHub
   - Click "New Pull Request"
   - Select your branch
   - Fill in the PR template with:
     - Description of changes
     - Why the change is needed
     - How to test the changes
     - Any related issues

3. **PR Requirements**
   - All CI checks must pass
   - Code must be formatted and linted
   - Build must succeed
   - Description must be clear and complete

4. **Code Review**
   - Be responsive to feedback
   - Make requested changes in new commits
   - Keep the discussion focused and professional

## Reviewing a Pull Request

To test someone else's pull request:

1. **Fetch and Checkout the PR**

   ```bash
   git fetch origin pull/ID/head:pr-ID
   git checkout pr-ID
   ```

   Or using the GitHub CLI:

   ```bash
   gh pr checkout PR_NUMBER
   ```

2. **Install and Build**

   ```bash
   make install
   make build
   ```

3. **Run Quality Checks**

   ```bash
   make check
   ```

4. **Test the Changes**

   ```bash
   # Run the built server
   make start

   # Or test in your MCP client
   node build/index.js
   ```

5. **Verify the Package**
   ```bash
   make validate
   ```

### When Switching Between Branches

Always rebuild after switching branches:

```bash
git checkout different-branch
make clean
make build
```

## Questions or Need Help?

- Open an issue for questions
- Check existing issues and PRs for similar topics
- Join our community discussions

Thank you for contributing to the Vonage MCP Server API Bindings! 🎉
