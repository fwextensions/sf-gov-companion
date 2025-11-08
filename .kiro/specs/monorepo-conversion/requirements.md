# Requirements Document

## Introduction

Convert the SF.gov Wagtail Extension project from a single-package structure to a monorepo with separate packages for the browser extension and the Vercel API proxy. This separation allows independent development, deployment, and versioning of the client and server components while maintaining shared types and utilities.

## Glossary

- **Monorepo**: A single repository containing multiple related packages or projects
- **Turborepo**: A high-performance build system for JavaScript/TypeScript monorepos
- **Workspace**: A package within the monorepo (e.g., extension, api)
- **Extension Package**: The browser extension code (Chrome/Edge Manifest V3)
- **API Package**: The Vercel serverless functions for Airtable proxy
- **Shared Package**: Common types and utilities used by both extension and API

## Requirements

### Requirement 1: Monorepo Structure

**User Story:** As a developer, I want the project organized as a monorepo so that I can manage the extension and API as separate but related packages.

#### Acceptance Criteria

1. THE System SHALL organize code into a `packages/` directory containing separate workspaces
2. THE System SHALL include an `extension` workspace containing all browser extension code
3. THE System SHALL include an `api` workspace containing all Vercel serverless functions
4. THE System SHALL include a `shared` workspace containing common TypeScript types and utilities
5. THE System SHALL maintain a root-level `package.json` that defines workspace configuration

### Requirement 2: Build Tool Configuration

**User Story:** As a developer, I want appropriate build tools for each package so that the extension and API can be built efficiently with their optimal tooling.

#### Acceptance Criteria

1. THE System SHALL use npm workspaces for monorepo management
2. THE Extension_Workspace SHALL continue using Vite with CRXJS for extension builds
3. THE API_Workspace SHALL use Vercel's build system (which uses Turbopack internally)
4. THE System SHALL define build scripts in the root `package.json` that orchestrate workspace builds
5. THE System SHALL support running workspace scripts independently or in parallel

### Requirement 3: Dependency Management

**User Story:** As a developer, I want dependencies properly scoped to each workspace so that packages only include what they need and shared dependencies are managed efficiently.

#### Acceptance Criteria

1. THE System SHALL use npm workspaces for dependency management
2. THE Extension_Workspace SHALL declare its own dependencies in `packages/extension/package.json`
3. THE API_Workspace SHALL declare its own dependencies in `packages/api/package.json`
4. THE Shared_Workspace SHALL declare its own dependencies in `packages/shared/package.json`
5. THE System SHALL hoist common dependencies to the root `node_modules` when possible

### Requirement 4: TypeScript Configuration

**User Story:** As a developer, I want TypeScript properly configured across workspaces so that type checking works correctly and types can be shared between packages.

#### Acceptance Criteria

1. THE System SHALL maintain a root `tsconfig.json` with shared TypeScript settings
2. THE Extension_Workspace SHALL extend the root TypeScript configuration
3. THE API_Workspace SHALL extend the root TypeScript configuration
4. THE Shared_Workspace SHALL export TypeScript types that other workspaces can import
5. THE System SHALL support workspace references for cross-package type checking

### Requirement 5: Development Workflow

**User Story:** As a developer, I want to run development servers for both packages simultaneously so that I can develop the extension and API together.

#### Acceptance Criteria

1. THE System SHALL provide a root-level `dev` script that starts both extension and API development servers
2. THE Extension_Workspace SHALL run its Vite dev server on its configured port
3. THE API_Workspace SHALL run Vercel dev server for local API testing
4. THE System SHALL support running individual workspace dev servers independently
5. THE System SHALL display clear output indicating which workspace each log message comes from

### Requirement 6: Build and Deployment

**User Story:** As a developer, I want to build and deploy packages independently so that extension and API releases are decoupled.

#### Acceptance Criteria

1. THE System SHALL provide a root-level `build` script that builds all workspaces
2. THE System SHALL support building individual workspaces with `npm run build --workspace=<workspace>`
3. THE Extension_Workspace SHALL output built extension to `packages/extension/dist/`
4. THE API_Workspace SHALL be deployable to Vercel independently
5. THE System SHALL maintain separate version numbers for extension and API packages

### Requirement 7: Code Migration

**User Story:** As a developer, I want existing code properly migrated to the monorepo structure so that all functionality is preserved.

#### Acceptance Criteria

1. THE System SHALL move all extension source code to `packages/extension/src/`
2. THE System SHALL move extension configuration files to `packages/extension/`
3. THE System SHALL create API package structure in `packages/api/`
4. THE System SHALL extract shared types to `packages/shared/src/types/`
5. THE System SHALL update all import paths to reflect new workspace structure

### Requirement 8: Shared Types Package

**User Story:** As a developer, I want shared TypeScript types in a separate package so that both extension and API can use consistent type definitions.

#### Acceptance Criteria

1. THE Shared_Workspace SHALL export Wagtail API types
2. THE Shared_Workspace SHALL export Airtable API types
3. THE Extension_Workspace SHALL import types from the shared workspace
4. THE API_Workspace SHALL import types from the shared workspace
5. THE System SHALL ensure type changes in shared workspace trigger rebuilds in dependent workspaces

### Requirement 9: Documentation Updates

**User Story:** As a developer, I want updated documentation so that I understand how to work with the monorepo structure.

#### Acceptance Criteria

1. THE System SHALL update the root README with monorepo structure overview
2. THE System SHALL document how to run development servers for each workspace
3. THE System SHALL document how to build individual workspaces
4. THE System SHALL document how to add dependencies to specific workspaces
5. THE System SHALL update steering rules to reflect new project structure
