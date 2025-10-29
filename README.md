# SF.gov Companion Extension

A cross-browser extension that provides content management information for SF.gov pages. The extension displays a side panel when users navigate SF.gov pages, showing metadata and administrative links retrieved from the Wagtail CMS API.

## Project Structure

```
sf-gov-companion/
├── dist/               # Build output
├── public/             # Public assets (icons, etc.)
├── src/
│   ├── api/            # Wagtail API client
│   ├── assets/         # Static assets
│   ├── background/     # Background service worker
│   ├── sidepanel/      # Side panel UI
│   │   ├── components/ # React components
│   └── types/          # TypeScript type definitions
└── manifest.config.ts  # Extension manifest configuration
```

## Development

### Prerequisites

- Node.js (v18 or higher)
- npm

### Setup

```bash
npm install
```

### Development Mode

```bash
npm run dev
```

This will start the development server with hot module replacement (HMR).

### Build

```bash
npm run build
```

This will create a production build in the `dist/` directory and generate a zip file for distribution.

### Load Extension in Browser

1. Build the extension: `npm run build`
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `dist/` directory

## TypeScript Configuration

The project uses TypeScript with strict mode enabled:

- `strict: true` - Enables all strict type checking options
- `noUnusedLocals: true` - Reports errors on unused local variables
- `noUnusedParameters: true` - Reports errors on unused parameters
- `noFallthroughCasesInSwitch: true` - Reports errors for fallthrough cases in switch statements

## Technology Stack

- **CRXJS**: Chrome extension framework with Vite integration
- **TypeScript**: Type-safe JavaScript
- **React**: UI library for side panel
- **Vite**: Build tool and development server

## Requirements

See `.kiro/specs/sf-gov-wagtail-extension/requirements.md` for detailed feature requirements.

## Documentation

- [React Documentation](https://reactjs.org/)
- [Vite Documentation](https://vitejs.dev/)
- [CRXJS Documentation](https://crxjs.dev/vite-plugin)
