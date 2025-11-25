# GridWeaver

[![CI](https://github.com/jchoi2x/gridweaver/actions/workflows/ci.yml/badge.svg)](https://github.com/jchoi2x/gridweaver/actions/workflows/ci.yml)

GridWeaver is a full-stack library ecosystem designed to decouple AG Grid configuration from frontend code. It enables developers to store table definitions (column layouts, data sources, sorting) in a database and render them dynamically on the client.

## Features

- **Schema-Driven:** Store AG Grid definitions in a database and render them dynamically
- **Frontend Renderer:** React component that consumes table definitions and renders AG Grid
- **Backend Middleware:** Hono-based API with standardized CRUD endpoints for managing definitions
- **Database Adapters:** Pluggable storage layer (MongoDB support)

## Packages

- **@gridweaver/core** - Shared types and utilities
- **@gridweaver/react** - React component wrapper for AG Grid
- **@gridweaver/api-hono** - Hono middleware for CRUD endpoints
- **@gridweaver/db-mongodb** - MongoDB storage adapter

## Development

This project uses [Nx](https://nx.dev) as its build system.

### Commands

```sh
# Build a package
npx nx build <package-name>

# Run tests
npx nx test <package-name>

# Lint a package
npx nx lint <package-name>

# Run any task
npx nx <target> <project-name>

# Visualize the project graph
npx nx graph
```
