# Design Document

## Overview

This design outlines the refactoring of the Chrome extension's side panel from vanilla HTML/TypeScript to a React-based architecture with Tailwind CSS v4. The refactoring will maintain all existing functionality while improving code organization, maintainability, and developer experience through componentization.

The design preserves the existing Chrome extension architecture (service worker, side panel) and API integration patterns while modernizing the UI layer.

## Architecture

### High-Level Structure

```
src/
├── sidepanel/
│   ├── index.html          # Entry HTML (minimal, mounts React)
│   ├── main.tsx            # React entry point
│   ├── App.tsx             # Root React component
│   ├── hooks/
│   │   └── useSfGovPage.ts # Custom hook for page data fetching
│   └── components/
│       ├── Card.tsx        # Base card component
│       ├── LoadingState.tsx
│       ├── ErrorState.tsx
│       ├── PageHeader.tsx
│       ├── EditLinkCard.tsx
│       ├── MetadataCard.tsx
│       ├── TranslationsCard.tsx
│       └── MediaAssetsCard.tsx
├── api/
│   └── wagtail-client.ts   # Existing API client (unchanged)
├── types/
│   └── wagtail.ts          # Existing types (unchanged)
└── background/
    └── service-worker.ts   # Existing service worker (unchanged)
```

### Technology Stack

- **React 19.2**: Already installed, will be used for component architecture
- **Tailwind CSS v4**: Will be installed and configured for styling
- **TypeScript**: Existing TypeScript setup will be maintained
- **Vite**: Existing build tool with React plugin already configured
- **@crxjs/vite-plugin**: Existing Chrome extension build plugin

## Components and Interfaces

### 1. App Component (App.tsx)

**Purpose**: Root component that manages application state and orchestrates child components

**Props**: None (root component)

**State**:
```typescript
interface AppState {
  pageData: WagtailPage | null
  error: ApiError | null
  isLoading: boolean
  currentUrl: string
  isOnSfGov: boolean
}
```

**Responsibilities**:
- Initialize Chrome tab listeners on mount
- Manage page data fetching via custom hook
- Determine which view to render (loading, error, or content)
- Clean up listeners on unmount

**Key Logic**:
- Uses `useSfGovPage` custom hook for data fetching and state management
- Conditionally renders LoadingState, ErrorState, or content components
- Handles tab change events through Chrome API

---

### 2. useSfGovPage Hook (hooks/useSfGovPage.ts)

**Purpose**: Custom hook that encapsulates all side panel logic including tab monitoring, data fetching, and caching

**Return Type**:
```typescript
interface UseSfGovPageReturn {
  pageData: WagtailPage | null
  error: ApiError | null
  isLoading: boolean
  isOnSfGov: boolean
  currentUrl: string
  retry: () => void
}
```

**Responsibilities**:
- Monitor Chrome tab changes (onUpdated, onActivated)
- Extract slug from SF.gov URLs
- Manage in-memory cache with TTL
- Debounce data fetching
- Handle loading and error states
- Provide retry functionality

**Key Implementation Details**:
- Uses `useEffect` for Chrome API listener setup/cleanup
- Uses `useState` for state management
- Uses `useCallback` for memoized retry function
- Implements debouncing with `useRef` for timer management
- Cache stored in `useRef` to persist across renders

---

### 3. LoadingState Component

**Purpose**: Display loading indicator when fetching data

**Props**: None

**UI Elements**:
- Centered container with spinner animation
- "Loading page information..." text

**Styling**: Tailwind utilities for flexbox centering, animations

---

### 4. ErrorState Component

**Purpose**: Display error messages with optional retry button

**Props**:
```typescript
interface ErrorStateProps {
  error: ApiError
  onRetry?: () => void
}
```

**UI Elements**:
- Error icon (⚠️)
- Error message text
- Retry button (conditional based on `error.retryable`)

**Styling**: Tailwind utilities for error styling (red accents, centered layout)

---

### 5. Card Component (Base Component)

**Purpose**: Reusable base card component that provides consistent styling and structure for all card-based sections

**Props**:
```typescript
interface CardProps {
  title?: string
  children: React.ReactNode
  className?: string
}
```

**UI Elements**:
- Container with consistent padding, background, border, and shadow
- Optional title section with consistent typography
- Content area for children

**Styling**: 
- Tailwind utilities for card container (background, border, rounded corners, shadow)
- Consistent padding and spacing
- Title styling when provided

**Usage Pattern**:
All card components (EditLinkCard, MetadataCard, TranslationsCard, MediaAssetsCard) will use this base component:
```tsx
<Card title="Section Title">
  {/* Card content */}
</Card>
```

---

### 6. PageHeader Component

**Purpose**: Display page title and content type badge

**Props**:
```typescript
interface PageHeaderProps {
  title: string
  contentType: string
}
```

**UI Elements**:
- Page title (h1)
- Content type badge with formatted text

**Utilities**:
- `formatContentType` function to convert technical type names to human-readable format

**Styling**: Tailwind utilities for header styling, badge styling

---

### 7. EditLinkCard Component

**Purpose**: Display edit link to Wagtail admin

**Props**:
```typescript
interface EditLinkCardProps {
  pageId: number
}
```

**UI Elements**:
- Uses base Card component with title "Edit Page"
- External link to Wagtail admin edit page

**Styling**: Tailwind utilities for link styling

---

### 8. MetadataCard Component

**Purpose**: Display page metadata in a grid layout

**Props**:
```typescript
interface MetadataCardProps {
  partnerAgency: string | null
  contentType: string
}
```

**UI Elements**:
- Uses base Card component with title "Metadata"
- Grid layout with label-value pairs
- Empty state handling for missing partner agency

**Styling**: Tailwind utilities for grid layout, label-value pairs

---

### 9. TranslationsCard Component

**Purpose**: Display available translations with links

**Props**:
```typescript
interface TranslationsCardProps {
  translations: Translation[]
}
```

**UI Elements**:
- Uses base Card component with title "Translations"
- List of translation links with language badges
- Empty state message when no translations

**Styling**: Tailwind utilities for list layout, language badges

---

### 10. MediaAssetsCard Component

**Purpose**: Display images and files associated with the page

**Props**:
```typescript
interface MediaAssetsCardProps {
  images: MediaAsset[]
  files: MediaAsset[]
}
```

**UI Elements**:
- Uses base Card component with title "Media Assets"
- Two subsections: Images and Files
- Lists of media items with external links
- Empty state messages for each subsection

**Styling**: Tailwind utilities for subsection layout, media lists

---

### 11. Main Entry Point (main.tsx)

**Purpose**: Initialize React application

**Responsibilities**:
- Import Tailwind CSS
- Get root DOM element
- Create React root
- Render App component

**Code Structure**:
```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css' // Tailwind imports

const root = document.getElementById('root')
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}
```

## Data Models

### Existing Types (Unchanged)

The following types from `src/types/wagtail.ts` will continue to be used:

```typescript
interface WagtailPage {
  id: number
  title: string
  contentType: string
  partnerAgency: string | null
  translations: Translation[]
  images: MediaAsset[]
  files: MediaAsset[]
}

interface Translation {
  language: string
  title: string
  editUrl: string
}

interface MediaAsset {
  url: string
  title: string
  filename?: string
}

interface ApiError {
  type: 'not_found' | 'server_error' | 'network' | 'timeout'
  message: string
  retryable: boolean
}

interface CacheEntry {
  data: WagtailPage | null
  error?: ApiError
  timestamp: number
}
```

### New Internal Types

```typescript
// Tab state tracking
interface TabState {
  url: string
  slug: string
  isOnSfGov: boolean
}

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const DEBOUNCE_DELAY = 300 // 300ms
```

## Tailwind CSS v4 Configuration

### Installation

```bash
npm install -D tailwindcss@next @tailwindcss/vite@next
```

### Configuration Files

**tailwind.config.ts**:
```typescript
import type { Config } from 'tailwindcss'

export default {
  content: [
    './src/sidepanel/**/*.{ts,tsx,html}',
  ],
  theme: {
    extend: {
      colors: {
        // SF.gov brand colors if needed
      },
    },
  },
} satisfies Config
```

**src/sidepanel/index.css**:
```css
@import "tailwindcss";
```

### Vite Configuration Update

Update `vite.config.ts` to include Tailwind plugin:
```typescript
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // Add Tailwind plugin
    crx({ manifest }),
    zip({ outDir: 'release', outFileName: `crx-${name}-${version}.zip` }),
  ],
  // ... rest of config
})
```

## Error Handling

### Error Display Strategy

1. **Network Errors**: Show error with retry button
2. **Not Found Errors**: Show error without retry button
3. **Server Errors**: Show error with retry button
4. **Timeout Errors**: Show error with retry button
5. **Not on SF.gov**: Show informational message without retry button

### Error Recovery

- Retry button clears cache for current slug and refetches
- Cache prevents repeated failed requests for non-retryable errors
- Debouncing prevents excessive API calls during rapid tab changes

## Testing Strategy

### Component Testing Approach

1. **Unit Tests**: Test individual components in isolation
   - Test component rendering with various props
   - Test conditional rendering logic
   - Test event handlers

2. **Hook Tests**: Test custom hook behavior
   - Test state transitions
   - Test Chrome API integration (with mocks)
   - Test caching logic
   - Test debouncing behavior

3. **Integration Tests**: Test component interactions
   - Test App component with different states
   - Test data flow from hook to components

### Testing Tools

- **Vitest**: Already available in the project for unit testing
- **React Testing Library**: For component testing
- **Chrome API Mocks**: Mock Chrome extension APIs for testing

### Key Test Scenarios

1. Loading state displays correctly
2. Error state displays with correct message and retry button visibility
3. Content renders correctly with valid page data
4. Tab changes trigger data fetching
5. Cache prevents duplicate API calls
6. Debouncing delays API calls appropriately
7. Retry functionality clears cache and refetches
8. Not on SF.gov message displays when appropriate

## Migration Strategy

### Phase 1: Setup
1. Install Tailwind CSS v4 and configure
2. Create component directory structure
3. Set up main.tsx entry point
4. Update index.html to use React root

### Phase 2: Component Creation
1. Create LoadingState and ErrorState components
2. Create card components (PageHeader, EditLinkCard, etc.)
3. Create useSfGovPage custom hook
4. Create App component

### Phase 3: Integration
1. Wire up components in App
2. Test all functionality
3. Remove old sidepanel.ts and sidepanel.css
4. Remove HelloWorld.tsx

### Phase 4: Validation
1. Test in Chrome extension environment
2. Verify all features work (loading, errors, content display, retry)
3. Verify tab listeners work correctly
4. Verify caching and debouncing work

## Visual Design Consistency

The refactored UI will maintain visual consistency with the current design:

- **Card-based layout**: Each section in a distinct card
- **Color scheme**: Maintain existing color palette
- **Typography**: Similar font sizes and weights
- **Spacing**: Consistent padding and margins
- **Interactive elements**: Links and buttons styled similarly

Tailwind utilities will be used to replicate the existing CSS styles while providing better maintainability and consistency.

## Performance Considerations

1. **Caching**: In-memory cache with 5-minute TTL reduces API calls
2. **Debouncing**: 300ms debounce prevents excessive fetching during rapid tab changes
3. **React Optimization**: Use React.memo for components that don't need frequent re-renders
4. **Code Splitting**: Vite automatically handles code splitting for the extension

## Browser Compatibility

- Chrome extension manifest v3 compatibility maintained
- React 19 features used (already in package.json)
- Tailwind v4 CSS output compatible with Chrome extension environment
