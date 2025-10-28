# Technology Stack

## Core Technologies

- **TypeScript 5.9**: Strict mode enabled with comprehensive type checking
- **React 19**: UI library for the side panel interface
- **Vite 7**: Build tool and development server
- **Tailwind CSS 4**: Utility-first CSS framework for styling
- **CRXJS**: Chrome extension framework with Vite integration

## Build System

The project uses Vite with the CRXJS plugin for Chrome extension development. The build process:
- Compiles TypeScript with strict type checking
- Bundles React components for the side panel
- Generates the extension manifest (v3)
- Creates a distributable zip file in the `release/` directory

## Key Dependencies

- `@crxjs/vite-plugin`: Chrome extension development with HMR
- `@vitejs/plugin-react`: React support in Vite
- `@tailwindcss/vite`: Tailwind CSS integration
- `vite-plugin-zip-pack`: Automatic zip packaging for distribution

## Common Commands

### Development
```bash
npm run dev
```
Starts the development server with hot module replacement (HMR). Changes to code are reflected immediately.

### Build
```bash
npm run build
```
Creates a production build in the `dist/` directory and generates a zip file in `release/` for distribution.

### Preview
```bash
npm run preview
```
Previews the production build locally.

### Load Extension in Browser
1. Run `npm run build`
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `dist/` directory

## TypeScript Configuration

Strict type checking is enforced:
- `strict: true` - All strict type checking options enabled
- `noUnusedLocals: true` - Error on unused local variables
- `noUnusedParameters: true` - Error on unused parameters
- `noFallthroughCasesInSwitch: true` - Error on switch fallthrough

Path alias `@/*` maps to `src/*` for cleaner imports.

## Code Style

- Always use JavaScript or TypeScript for code, never use Python.
- Always use tabs for indentation.
- Always use double quotes.
- Always use semicolons.
- Always use LF line endings, even on Windows.
- Use trailing commas in object and array literals, but not in function parameters.
- Use the `const` keyword for declarations, unless the variable is going to be re-assigned.
- Use the `let` keyword for declarations that will be re-assigned.
- Generally use functional and declarative programming patterns; use classes if it makes sense to manage many instances of the same type.
- Prefer iteration and modularization over code duplication.
- Use descriptive variable names with auxiliary verbs (e.g., isLoading, hasError).

In comments, start with a lowercase letter and do not end with a period unless the comment contains multiple sentences.  If a period is included, use two spaces after the period.

When writing commit messages, use the present tense.  Use a summary line, then a blank line, then a fairly detailed list of changes.  The commit message should almost never be a single line.

Kiro is running on Windows, but the integrated terminal is currently set up to use git bash as the shell.  Use bash commands unless otherwise instructed.
