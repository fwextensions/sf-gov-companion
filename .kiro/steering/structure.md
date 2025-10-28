# Project Structure

## Directory Organization

```
sf-gov-wagtail-extension/
├── src/
│   ├── api/              # Wagtail API client and data fetching
│   ├── background/       # Background service worker for extension
│   ├── sidepanel/        # Side panel UI (React app)
│   │   ├── components/   # React components for UI cards
│   │   ├── hooks/        # Custom React hooks
│   │   ├── App.tsx       # Main side panel application
│   │   ├── sidepanel.ts  # Side panel entry point
│   │   └── index.html    # Side panel HTML template
│   ├── types/            # TypeScript type definitions
│   ├── assets/           # Static assets (images, icons)
│   └── components/       # Shared React components (if any)
├── public/               # Public assets (logo, icons)
├── dist/                 # Build output (generated)
├── release/              # Distribution zip files (generated)
├── .kiro/                # Kiro AI assistant configuration
│   ├── specs/            # Feature specifications and design docs
│   └── steering/         # AI assistant steering rules
├── manifest.config.ts    # Extension manifest configuration
├── vite.config.ts        # Vite build configuration
├── tailwind.config.ts    # Tailwind CSS configuration
└── tsconfig.*.json       # TypeScript configurations

```

## Key Architectural Patterns

### Component Structure
- **Card-based UI**: Side panel uses card components (`MetadataCard`, `TranslationsCard`, `MediaAssetsCard`, etc.) for modular display
- **Custom Hooks**: Business logic extracted into hooks (e.g., `useSfGovPage`) for reusability
- **State Management**: Component-level state with React hooks, no external state library

### API Layer
- **Centralized Client**: `src/api/wagtail-client.ts` handles all Wagtail API communication
- **Type Safety**: All API responses typed with interfaces from `src/types/wagtail.ts`
- **Error Handling**: Structured error types (`ApiError`) with retry logic

### Extension Architecture
- **Service Worker**: Background script (`src/background/service-worker.ts`) manages extension lifecycle
- **Side Panel**: React-based UI that opens when users navigate to SF.gov pages
- **Manifest v3**: Uses modern Chrome extension manifest version 3

## Import Conventions

Use the `@/` path alias for imports from `src/`:
```typescript
import { findPageBySlug } from '@/api/wagtail-client'
import type { WagtailPage } from '@/types/wagtail'
```

## Styling Approach

- Tailwind CSS utility classes for all styling
- No custom CSS files
- Responsive design with mobile-first approach
- Scoped to `src/sidepanel/**/*.{ts,tsx,html}` in Tailwind config
