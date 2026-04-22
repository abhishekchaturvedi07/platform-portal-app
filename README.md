# 💻 Platform Portal (Next.js + GraphQL BFF)

This repository houses the frontend UI and the Backend-For-Frontend (BFF) API layer for the Enterprise Internal Developer Portal (IDP).

> **Architectural Source of Truth:** > This application is a deployable micro-frontend. For the full system blueprints, capabilities catalog, and macro-architecture diagrams, please refer to the central [Engineering Platform Repository](https://github.com/abhishekchaturvedi07/engineering-platform).

---

## 🏗️ Tech Stack

- **Framework:** Next.js (App Router)
- **Language:** TypeScript (Strict Mode)
- **API Layer (BFF):** Apollo GraphQL Server
- **Styling:** Tailwind CSS

## 🚀 Local Development

**1. Install dependencies:**
\`\`\`bash
npm install
\`\`\`

**2. Start the development server:**
\`\`\`bash
npm run dev
\`\`\`

**3. Access the application:**

- UI Frontend: [http://localhost:3000](http://localhost:3000)
- GraphQL Playground: [http://localhost:3000/api/graphql](http://localhost:3000/api/graphql)

---

## 📂 Project Structure

- `/src/app` - React Server Components, Client Components, and UI routing.
- `/src/app/api/graphql` - The serverless endpoint hosting our BFF.
- `/src/graphql` - GraphQL Schema definitions (`typeDefs`) and `resolvers`.
