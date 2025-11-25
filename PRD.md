# Product Requirements Document (PRD): GridWeaver

| Document Meta | Details                                      |
| ------------- | -------------------------------------------- |
| Project Name  | GridWeaver (Dynamic AG-Grid Definition Library) |
| Version       | 1.5                                          |
| Owner         | James Choi                                   |
| Last Updated  | 2024-12-20                                   |

## 1. Executive Summary
GridWeaver is a full-stack library ecosystem designed to decouple ag-grid configuration from frontend code. It enables developers to store table definitions (column layouts, data sources, sorting) in a database and render them dynamically on the client.
The system consists of a Frontend Renderer (starting with React) that consumes these definitions and a Backend Middleware (starting with Hono) that provides standardized CRUD endpoints for managing these definitions.

## 2. Problem Statement

- **Hardcoded Complexity:** Changing a column header, width, or hiding a column usually requires a frontend code change and deployment.
- **Repetitive Boilerplate:** Setting up ag-grid with remote data fetching usually involves rewriting the same boilerplate code for every new table.
- **Lack of Dynamic Control:** Product managers or admins cannot easily reconfigure views without developer intervention.

## 3. Architecture Overview
The solution follows a "Configuration as Code" pattern but stored in a database.

### 3.1 Component Diagram

- **Storage Layer:** Database (MongoDB initially) storing JSON definitions.
- **Backend Layer (@gridweaver/api-hono):** Middleware that exposes POST /defs, GET /defs/:id, PUT /defs/:id, DELETE /defs/:id.
- **Frontend Layer (@gridweaver/react):** A React component that takes a definitionId, fetches the config, and instantiates ag-grid.

## 4. Functional Requirements

### 4.1 The Table Definition Schema
The core of the library is the standardized JSON object stored in the DB.

- **id:** Unique identifier for the table configuration.
- **http:** Configuration for fetching data, containing the url and optional params (replacing hardcoded fetch logic).
- **columnDefs:** Standard ag-grid column definitions.
- **Value Formatter Strategy:** Since functions cannot be transmitted via JSON, valueFormatter logic is serialized using Angular Expressions (e.g., strings that are parsed safely on the client).
- **defaultSort:** (Optional) Configuration for initial sort state (e.g., `{ colId: 'created_at', sort: 'desc' }`).

### 4.2 Frontend Library (@gridweaver/react)

- **Input:**
  - `tableId`: String identifier for the definition.
  - `baseUrl`: URL for the definition API.
  - `componentRegistry`: A `Record<string, ReactComponent>` map. This allows the JSON definition to reference custom cell renderers by string name (e.g., `"cellRenderer": "StatusBadge"`), which the library resolves at runtime.
- **Process:**
  - Fetches the SerializedTableDefinition from the backend.
  - Parses columnDefs:
    - Converts valueFormatter arrays (Angular Expressions) into executable functions using an expression parser.
    - Resolves cellRenderer strings against the provided componentRegistry.
    - Injects context variables (\_, params, colDef, node, value, moment) into the expression scope.
  - Passes the http spec to the grid's datasource.
- **Output:** Renders a fully functional ag-grid instance.
- **Events:** Must bubble up standard grid events to the parent component.

### 4.3 Backend Library (@gridweaver/api-hono)

- **Pluggable Data Source:** The middleware must accept a generic StorageAdapter interface so definitions can be stored anywhere.
- **Validation:** Must validate incoming definitions against a Zod schema to ensure valid JSON structure before saving.
- **Security & Configuration:**
  - **Mutating Endpoints (POST, PUT, DELETE):**
    - These endpoints are disabled by default.
    - They are only registered/enabled if a secret string is passed to the middleware options.
    - When enabled, requests to these endpoints must include the header `x-secret` matching the configured secret.
  - **Read Endpoints (GET):**
    - Accepts an optional `authMiddleware` function in the configuration options.
    - If provided, this middleware runs before the definition is fetched (allowing for RBAC or standard auth checks).

## 5. Technical Specifications

### 5.1 Core Data Types
The following TypeScript definitions govern the contract between the API and the Client. These are exported via `@gridweaver/core/types`.

```typescript
type ColumnDefs = Array<ColDef | ColGroupDef>;

/**
 * The api returns back valueFormatter as an array of expressions instead of a function
 * because functions cannot be returned from an http request.
 * We utilize Angular Expressions (via a parser like `angular-expressions`) to serialize
 * the logic safely. The array of strings allows for multi-line expressions if needed.
 */
interface SerializedColumnDef extends Omit<ColDef, 'valueFormatter'> {
  // valueFormatter will be converted to a ValueFormatterFunc on the client
  /**
   * scope = { _, params, colDef, node, value, moment }
   */
  valueFormatter?: Array<string>;
}

/**
 * Describes how to fetch the table data from the api
 */
type TableHttpSpec = {
  url: string;
  params?: Record<string, any>;
};

/**
 * This is the table definition as it is returned from the api
 */
type SerializedTableDefinition = {
  http: TableHttpSpec;
  columnDefs: SerializedColumnDef[];
  defaultSort?: { colId: string; sort: 'asc' | 'desc' };
};

/**
 * This is the table definition as it is used by the ag-grid component.
 * It contains the datasource used to fetch the information from the api
 * and the column definitions (hydrated with real functions).
 */
type TableDefinition = {
  columnDefs: ColumnDefs;
  dataSource: IServerSideDatasource;
  defaultSort?: { colId: string; sort: 'asc' | 'desc' };
};
```

### 5.2 Package Structure & Build System
The project will be managed as a monorepo using Nx. This ensures efficient dependency management, caching, and unified tooling across all packages.

#### Core Packages

- **@gridweaver/core:** Shared logic, types, and utilities.
  - **Module Exports:**
    - `@gridweaver/core/types` - Shared interfaces (SerializedTableDefinition, etc).
    - `@gridweaver/core/utilities` - Shared helpers (validators, simple formatters).

#### Frontend Packages

- **@gridweaver/react:** (Priority) React component wrapper for AG Grid.
- **@gridweaver/angular:** (Future) Angular component wrapper.

#### API/Middleware Packages

- **@gridweaver/api-hono:** (Priority) Middleware factory for Hono (Cloudflare Workers/Edge support).
- **@gridweaver/api-express:** (Future) Middleware factory for Express.js.

#### Database Adapters

- **@gridweaver/db-mongodb:** (Priority) Mongoose/Mongo driver adapter.
- **@gridweaver/db-postgres:** (Future) PostgreSQL adapter.

### 5.3 Data Source Interface (TypeScript)
The backend middleware will rely on this interface to be database-agnostic.

```typescript
interface TableDefStorage {
  create(def: SerializedTableDefinition): Promise<string>;
  read(id: string): Promise<SerializedTableDefinition | null>;
  update(id: string, def: Partial<SerializedTableDefinition>): Promise<void>;
  delete(id: string): Promise<void>;
}
```

### 5.4 API Routes
When the middleware is mounted (e.g., at `/api/grid-defs`), it creates:

- **POST /** - Create a new table definition. (Requires `x-secret` header).
- **GET /:id** - Fetch a specific definition. (Protected by optional authMiddleware).
- **PUT /:id** - Update column structure or data source. (Requires `x-secret` header).
- **DELETE /:id** - Remove a definition. (Requires `x-secret` header).

## 6. User Stories

| ID   | Persona      | Action                                         | Benefit                                                            |
| ---- | ------------ | ---------------------------------------------- | ------------------------------------------------------------------ |
| US-1 | Frontend Dev | Mount `<DynamicGrid id="users-main" />`        | I get a full table without manually defining columns in JS.        |
| US-2 | Backend Dev  | Update the `http.url` in the DB                | The frontend switches data sources immediately without a rebuild.  |
| US-3 | Admin        | Send a PUT request to reorder columns          | The table layout updates for all users instantly.                  |

## 7. Implementation Plan

### Phase 1: Core Foundation & Tooling

- Initialize Nx Monorepo workspace.
- Initialize @gridweaver/core.
- Export SerializedTableDefinition and related interfaces from /types.
- Export common Zod schemas from /utilities.
- Define the database interface.

### Phase 2: Hono & Mongo Backend

- Implement @gridweaver/db-mongodb adapter using the core types.
- Implement @gridweaver/api-hono to expose the CRUD endpoints using the mongo adapter.
- Implement x-secret logic for mutating endpoints.
- Implement authMiddleware option for read endpoints.

### Phase 3: Client (React)

- Build @gridweaver/react.
- Implement the Angular Expression parser for valueFormatter.
- Implement componentRegistry logic for custom renderers.
- Map SerializedTableDefinition to TableDefinition (hydrating functions).

### Phase 4: Future Expansion

- Implement @gridweaver/api-express for legacy Node apps.
- Implement @gridweaver/db-postgres.
- Implement @gridweaver/angular.

## 8. Open Questions

- None remaining for Version 1.0.
