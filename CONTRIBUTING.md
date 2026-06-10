# Contributing to Codebuddian

Thanks for your interest in contributing! This guide will help you get started.

## Development Setup

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9
- Obsidian (desktop) ≥ 1.7.2
- CodeBuddy CLI (`npm install -g @tencent-ai/codebuddy-code`)

### Getting Started

```bash
# Clone the repo
git clone https://github.com/aleexjiang/codebuddian.git
cd codebuddian

# Install dependencies
npm install

# Start dev mode (watches for changes and rebuilds)
npm run dev

# Build for production
npm run build
```

### Installing in Obsidian for Testing

After building, copy the output files to your vault's plugin directory:

```bash
cp main.js manifest.json styles.css /path/to/your/vault/.obsidian/plugins/codebuddian/
```

Then enable the plugin in Obsidian Settings → Community Plugins.

## Project Structure

```
src/
├── core/           # Provider-neutral interfaces and shared logic
├── providers/      # CLI backend implementations (codebuddy/)
├── features/       # Obsidian UI features (chat, inline-edit, settings)
├── app/            # Application-level wiring
├── shared/         # Reusable UI components
├── utils/          # Pure utility functions
├── i18n/           # Internationalization
└── style/          # CSS styles
```

**Key principle**: `core/` must never import from `providers/` or `features/`. Dependencies flow inward.

## Code Style

- TypeScript strict mode is enabled — no `any` without justification
- Use `import type` for type-only imports
- Follow existing naming conventions:
  - PascalCase for classes, interfaces, and types
  - camelCase for functions, methods, and variables
  - kebab-case for file names
- Keep files focused — one primary export per file

## Making Changes

1. **Create an issue** first to discuss the change (for non-trivial features)
2. **Fork the repo** and create a feature branch from `main`
   ```bash
   git checkout -b feature/my-feature
   ```
3. **Make your changes** with clear, atomic commits
4. **Run checks** before pushing:
   ```bash
   npm run typecheck   # TypeScript type checking
   npm run lint        # ESLint
   npm run build       # Ensure production build succeeds
   ```
5. **Push and open a Pull Request**

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add conversation export to markdown
fix: handle missing CLI path gracefully
docs: update settings table in README
refactor: extract message parsing into shared util
chore: upgrade esbuild to 0.25
```

## Pull Request Guidelines

- Keep PRs focused — one feature or fix per PR
- Include a clear description of what changed and why
- Reference any related issues (`Closes #123`)
- Ensure all checks pass (`typecheck`, `lint`, `build`)
- If adding user-facing features, update README.md accordingly
- If adding i18n strings, add both `zh-CN` and `en` translations

## Reporting Issues

When filing a bug report, please include:

- **Obsidian version** and OS (macOS / Windows / Linux)
- **CodeBuddy CLI version** (`codebuddy --version`)
- **Plugin version** (from manifest.json)
- Steps to reproduce
- Expected vs. actual behavior
- Console output if available (Ctrl/Cmd + Shift + I → Console)

## Adding Translations

1. Add keys to `src/i18n/types.ts` (both `ZhCN` and `En` interfaces)
2. Add translations in `src/i18n/constants.ts`
3. Use `t('key')` in your code — never hardcode UI strings

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
