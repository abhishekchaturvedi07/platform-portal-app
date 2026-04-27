// Import the Apollo Server class to create our GraphQL backend instance
import { ApolloServer } from '@apollo/server';
// Import the Next.js integration handler so Apollo can understand App Router's modern Web Request/Response objects
import { startServerAndCreateNextHandler } from '@as-integrations/next';
// Import NextRequest type to ensure our API route adheres to strict TypeScript typings
import { NextRequest } from 'next/server';

// Import the GraphQL schema (the exact shape of data the frontend is allowed to ask for)
// import { typeDefs } from '../../../graphql/typeDefs';
// Corrected relative paths to reach src/schema from src/app/api/graphql
import { typeDefs } from "../../../schema/typeDefs";
import { resolvers } from "../../../schema/resolvers";

// Instantiate the Apollo Server
const server = new ApolloServer({
  typeDefs,
  resolvers,
});

// Create the handler
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handler = startServerAndCreateNextHandler<NextRequest>(server as any, {
  context: async () => {
    return { userId: "mock-enterprise-user-id" };
  },
});

// Next.js 15+ Route Handler exports
export const GET = (request: NextRequest) => handler(request);
export const POST = (request: NextRequest) => handler(request);