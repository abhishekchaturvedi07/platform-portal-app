# Platform Portal: Project Brain

- **Role**: Next.js BFF (Backend-for-Frontend) and User UI.
- **Security**: Extracts `accessToken` from `localStorage` and passes it in the `Authorization` header.
- **UI Logic**: Features are gated. No token = No AI Ingestion/Chat components.
- **Core Stack**: Next.js (App Router), Apollo GraphQL, Tailwind.
