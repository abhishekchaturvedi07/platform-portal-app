# Frontend State Rules

- **Authentication**: When `Verify Access` is clicked, update `localStorage` and perform a `window.location.reload()` to refresh the Apollo Client headers.
- **Conditional Rendering**: AI sections MUST be wrapped in a check: `{token ? <AIComponent /> : <LockedState />}`.
- **API Calls**: Ensure all GraphQL mutations/queries include the bearer token in the context.
