// Import the Apollo Server class to create our GraphQL backend instance
import { ApolloServer } from '@apollo/server';
// Import the Next.js integration handler so Apollo can understand App Router's modern Web Request/Response objects
import { startServerAndCreateNextHandler } from '@as-integrations/next';
// Import NextRequest type to ensure our API route adheres to strict TypeScript typings
import { NextRequest } from 'next/server';

// Import the GraphQL schema (the exact shape of data the frontend is allowed to ask for)
// import { typeDefs } from '../../../graphql/typeDefs';
import { typeDefs} from '../../../src/schema/typeDefs'
// Import the GraphQL resolvers (the functions that actually fetch/mutate the data)
import { resolvers } from '../../../src/schema/resolvers';

// Instantiate the Apollo Server with our schema and resolvers
// This acts as the central brain of our Backend-For-Frontend (BFF), sitting between the UI and the Microservices
const server = new ApolloServer({
  typeDefs,
  resolvers,
});

// Wrap the Apollo Server in the Next.js handler to translate incoming HTTP requests into GraphQL operations
// Bypass the strict generic type mismatch by casting server as 'any' : TypeScript strict mode is panicking because the Next.js Request types recently changed in Next.js 15, and the Apollo integration package is slightly behind on typings.
const handler = startServerAndCreateNextHandler<NextRequest>(server as any, {
  // The context function runs on every single request before it hits the resolvers
  // In a real enterprise app, we would validate the JWT from the API Gateway here
  context: async (req) => {
    // We return a mock decoded user ID to satisfy the GraphQLContext interface we defined in our resolvers
    return { userId: 'mock-enterprise-user-id' };
  },
});

// Export the handler for HTTP GET requests (This allows the Apollo Studio Sandbox/Playground UI to load in the browser)
export { handler as GET };

// Export the handler for HTTP POST requests (This is what the Next.js React frontend will actually use to fetch/mutate data)
export { handler as POST };