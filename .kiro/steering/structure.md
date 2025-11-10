# Project Structure

## Monorepo Organization

This project is organized as an npm workspaces monorepo with three packages:

```
sf-gov-companion/
├── packages/
│   ├── extension/          # Browser extension workspace (@sf-gov/extension)
│   │   ├── src/
│   │   │   ├── api/        # Wagtail and Airtable API clients
│   │   │   ├── background/ # Background service worker for extension
│   │   │   ├── sidepanel/  # Side panel UI (React app)
│   │   │   │   ├── components/ # React components for UI cards
│   │   │   │   ├── hooks/  # Custom React hooks
│   │   │   │   ├── App.tsx # Main side panel application
│   │   │   │   ├── sidepanel.ts # Side panel entry point
│   │   │   │   └── index.html # Side panel HTML template
│   │   │   ├── assets/     # Static assets (images, icons)
│   │   │   └── components/ # Shared React components (if any)
│   │   ├── public/         # Public assets (logo, icons)
│   │   ├── dist/           # Build output (generated)
│   │   ├── release/        # Distribution zip files (generated)
│   │   ├── manifest.config.ts # Extension manifest configuration
│   │   ├── vite.config.ts  # Vite build configuration
│   │   ├── tailwind.config.ts # Tailwind CSS configuration
│   │   ├── tsconfig.json   # TypeScript configuration (extends root)
│   │   └── package.json    # Extension dependencies
│   │
│   ├── server/             # Vercel API workspace (@sf-gov/server)
│   │   ├── api/            # Serverless functions
│   │   │   └── airtable-proxy.ts # Airtable proxy endpoint
│   │   ├── lib/            # Utility functions
│   │   ├── vercel.json     # Vercel configuration
│   │   ├── tsconfig.json   # TypeScript configuration (extends root)
│   │   └── package.json    # API dependencies
│   │
│   └── shared/             # Shared types workspace (@sf-gov/shared)
│       ├── src/
│       │   ├── types/      # Shared TypeScript types
│       │   │   ├── wagtail.ts   # Wagtail API types
│       │   │   ├── airtable.ts  # Airtable API types
│       │   │   └── index.ts     # Type exports
│       │   └── index.ts    # Main export file
│       ├── tsconfig.json   # TypeScript configuration (extends root)
│       └── package.json    # Shared package config
│
├── .kiro/                  # Kiro AI assistant configuration
│   ├── specs/              # Feature specifications and design docs
│   └── steering/           # AI assistant steering rules
├── node_modules/           # Hoisted dependencies
├── package.json            # Root workspace configuration
├── tsconfig.json           # Root TypeScript configuration
└── README.md               # Project documentation

```

## Key Architectural Patterns

### Workspace Architecture
- **Extension Workspace**: Browser extension with React UI, built with Vite and CRXJS
- **API Workspace**: Vercel serverless functions for Airtable proxy with authentication and rate limiting
- **Shared Workspace**: Common TypeScript types used by both extension and API
- **Independent Deployment**: Extension and API can be built and deployed separately

### Component Structure (Extension)
- **Card-based UI**: Side panel uses card components (`MetadataCard`, `TranslationsCard`, `MediaAssetsCard`, `FeedbackCard`, etc.) for modular display
- **Custom Hooks**: Business logic extracted into hooks (e.g., `useSfGovPage`) for reusability
- **State Management**: Component-level state with React hooks, no external state library

### API Layer
- **Wagtail Client**: `packages/extension/src/api/wagtail-client.ts` handles all Wagtail API communication
- **Airtable Client**: `packages/extension/src/api/airtable-client.ts` calls the proxy endpoint
- **Proxy Endpoint**: `packages/server/api/airtable-proxy.ts` handles authentication and rate limiting
- **Type Safety**: All API responses typed with interfaces from `@sf-gov/shared`
- **Error Handling**: Structured error types (`ApiError`) with retry logic

### Extension Architecture
- **Service Worker**: Background script (`packages/extension/src/background/service-worker.ts`) manages extension lifecycle
- **Side Panel**: React-based UI that opens when users navigate to SF.gov pages
- **Manifest v3**: Uses modern Chrome extension manifest version 3

## Import Conventions

### Within Extension Workspace
Use the `@/` path alias for imports from `packages/extension/src/`:
```typescript
import { findPageBySlug } from '@/api/wagtail-client';
import { useSfGovPage } from '@/sidepanel/hooks/useSfGovPage';
```

### Importing Shared Types
Import shared types from the `@sf-gov/shared` workspace:
```typescript
import type { WagtailPage, AirtableRecord } from '@sf-gov/shared';
```

### Within API Workspace
Import shared types in serverless functions:
```typescript
import type { AirtableRecord, AirtableFeedbackFields } from '@sf-gov/shared';
```

## Styling Approach

- Tailwind CSS utility classes for all styling
- No custom CSS files
- Responsive design with mobile-first approach
- Scoped to `src/sidepanel/**/*.{ts,tsx,html}` in Tailwind config
