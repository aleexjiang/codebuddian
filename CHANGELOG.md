# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-06-10

### Added

- ACP transport (`codebuddy --acp --acp-transport stdio`) for streaming chat via ndJSON
- Print transport for one-shot inline edits (`codebuddy -p --output-format stream-json`)
- Provider-neutral core architecture: `ChatRuntime`, `ProviderRegistry`, `ApprovalManager`
- CodeBuddy CLI auto-detect and manual path configuration
- Chat sidebar with multi-tab conversation management
- Tool approval flow with accept/reject UI cards
- Inline edit modal with diff preview
- MCP server configuration support
- zh-CN / en bilingual i18n (auto-follows system locale)
- Full settings panel: CLI path, model, permission mode, system prompt, MCP, advanced options
- Obsidian commands: Open chat, New chat tab, Inline edit selection, Toggle plan mode, Cancel current turn
- Ribbon icon for quick access
- esbuild production build pipeline
- TypeScript strict mode with full type coverage

[0.1.0]: https://github.com/aleexjiang/codebuddian/releases/tag/v0.1.0
