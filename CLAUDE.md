# Claude Code Instructions

## Repository Context

This is the Dome TypeScript SDK (`@dome-api/sdk`) - a client library for interacting with the Dome API. The SDK provides access to market data, wallet analytics, order tracking, and trading functionality for prediction markets.

## Working Principles

- This is a TypeScript SDK published to npm as `@dome-api/sdk`
- **ALWAYS verify the build passes before committing** - Run `yarn build` and fix any TypeScript errors
- Follow existing patterns in the codebase
- Maintain backwards compatibility unless explicitly breaking changes are approved
- Update examples and documentation when adding new features

## PR & Deployment Workflow

**CRITICAL: Always follow this workflow when making changes:**

1. **Create a PR for your changes** - Never push directly to main
2. **Merge the PR to main** - Use `gh pr merge <PR#> --squash`
3. **Sync with remote main before any publishing:**
   ```bash
   git fetch origin main && git reset --hard origin/main
   ```
4. **Then publish (if releasing):**
   ```bash
   npm publish
   ```

**Why this matters:**
- Ensures published SDK matches what's merged to main
- Prevents publishing unreviewed or local-only changes
- Creates an audit trail of changes via PRs
- Allows easy rollback by reverting PRs

**Never do:**
- Push directly to main without a PR
- Publish without merging your PR first
- Skip the `git fetch origin main && git reset --hard origin/main` step

## Quick Reference

- SDK source code: `src/`
- Examples: `examples/`
- Tests: `src/tests/`
- Build output: `dist/`

## Testing

Before committing:
```bash
yarn build        # Verify TypeScript compiles
yarn test         # Run tests (if available)
```

## Documentation

- Update `README.md` when adding new public APIs
- Add examples in `examples/` for new features
- Keep inline JSDoc comments up to date
