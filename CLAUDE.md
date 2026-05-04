# BFF Gateway Project Rules

- **Tech Stack**: Next.js (App Router), Apollo GraphQL, Tailwind CSS.
- **Security**: All outbound requests to `ai-orchestrator` MUST include the `Authorization: Bearer <token>` header extracted from `localStorage`.
- **UI Logic**: Sensitive AI components (Ingestion/Chat) must be conditionally rendered based on the presence of `accessToken`.
- **Naming Convention**: Use PascalCase for Components and camelCase for hooks/utilities.
