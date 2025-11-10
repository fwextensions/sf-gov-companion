# Implementation Plan

## Phase 1: Extension Migration (Complete First)

- [x] 1. Setup monorepo structure





  - Create `packages/` directory and workspace subdirectories
  - Create new root package.json with workspace configuration
  - Create new root tsconfig.json for base TypeScript settings
  - Update .gitignore for monorepo structure
  - _Requirements: 1.1, 1.5, 3.1_

-

- [x] 2. Create shared types package



  - Create packages/shared directory structure
  - Create packages/shared/package.json
  - Create packages/shared/tsconfig.json extending root config

  - Create packages/shared/src/index.ts as main export file
  - _Requirements: 8.1, 8.2, 4.4_
-

- [x] 3. Extract and migrate shared types


  - Copy src/types/wagtail.ts to packages/shared/src/types/wagtail.ts
  - Copy src/types/airtable.ts to packages/shared/src/types/airtable.ts

  - Create packages/shared/src/types/index.ts to export all types
  - Update packages/shared/src/index.ts to re-export types
  - _Requirements: 8.1, 8.2, 7.4_

- [x] 4. Move extension code to workspace





  - Move src/ directory to packages/extension/src/
  - Move public/ directory to packages/extension/public/
  - Move dist/ directory to packages/extension/dist/ (if exists)
  - Move release/ directory to packages/extension/release/ (if exists)
  - _Requirements: 7.1, 7.2_

- [x] 5. Move extension configuration files





  - Move vite.config.ts to packages/extension/vite.config.ts
  - Move tailwind.config.ts to packages/extension/tailwind.config.ts
  - Move manifest.config.ts to packages/extension/manifest.config.ts
  - Move tsconfig.json to packages/extension/tsconfig.json and update to extend root
  - Move package.json to packages/extension/package.json and update name to @sf-gov/extension
  - _Requirements: 7.2, 7.3_

-

- [x] 6. Update extension package configuration



  - Add @sf-gov/shared workspace dependency to packages/extension/package.json
  - Update packages/extension/tsconfig.json to reference shared workspace
  - Verify all existing scripts (dev, build, preview, release) are preserved
  - _Requirements: 3.2, 4.2, 8.3_

- [x] 7. Update extension import paths





  - Update imports in packages/extension/src/ to use @sf-gov/shared for types
  - Remove local type imports that now come from shared package
  - Update any relative paths that changed due to directory move
  - _Requirements: 7.5, 8.3_
-

- [x] 8. Install and verify extension dependencies




  - Run npm install at root to link workspaces
  - Verify @sf-gov/shared is properly linked to extension
  - Verify all extension dependencies are installed
  - _Requirements: 3.1, 3.2, 3.5_

- [x] 9. Test extension workspace thoroughly






  - Run npm run dev:extension to verify dev server starts
  - Verify extension builds successfully with npm run build:extension
  - Verify types from @sf-gov/shared are accessible
  - Load extension in browser and test all existing functionality
  - Verify side panel opens and displays data correctly
  - Test all cards (Metadata, Translations, Media Assets, etc.)
  - _Requirements: 5.1, 5.2, 5.4, 6.2_

## Phase 2: API Package (Start After Extension Works)

- [x] 10. Create API package structure





  - Create packages/api directory structure
  - Create packages/api/api/ directory for serverless functions
  - Create packages/api/lib/ directory for utilities
  - Create packages/api/package.json with dependencies
  - Create packages/api/tsconfig.json extending root config
  - Create packages/api/vercel.json for Vercel configuration
  - _Requirements: 1.3, 3.3, 4.3_


- [x] 11. Implement Airtable proxy serverless function



  - Create packages/api/api/airtable-proxy.ts
  - Implement session validation logic using Wagtail API
  - Implement Vercel KV caching for session validation
  - Implement rate limiting using Vercel KV
  - Implement Airtable API fetching with proper error handling
  - Add CORS headers and origin validation

  - _Requirements: 8.4_

- [x] 12. Install and test API workspace





  - Install API dependencies
  - Verify @sf-gov/shared is properly linked to API
  - Run npm run dev:api to verify Vercel dev server starts
  - Test airtable-proxy endpoint locally
  - Verify environment variables are properly configured
  - _Requirements: 3.3, 5.1, 5.3, 5.4, 6.2_

- [ ] 13. Update extension to use API proxy
  - Update packages/extension/src/api/airtable-client.ts to call proxy endpoint
  - Implement cookie reading logic using chrome.cookies API
  - Add error handling for authentication failures
  - Update FeedbackCard component to handle auth states
  - Add manifest permissions for cookies
  - _Requirements: 8.3_

- [ ] 14. Update documentation
  - Update root README.md with monorepo structure overview
  - Document workspace-specific commands (dev:extension, dev:api, etc.)
  - Document how to add dependencies to specific workspaces
  - Update .kiro/steering/structure.md with new directory layout
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ] 15. Final verification
  - Run npm run build to build all workspaces
  - Verify extension dist/ output is correct
  - Verify API can be deployed to Vercel
  - Test end-to-end flow: extension -> API -> Airtable
  - Verify no broken imports or missing dependencies
  - _Requirements: 6.1, 6.3, 6.4_
