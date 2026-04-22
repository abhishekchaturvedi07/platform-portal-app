// We define a TypeScript interface for our GraphQL context
// This context is passed to every resolver and usually holds the user's JWT data
interface GraphQLContext {
  // The decoded user ID from the API Gateway's JWT validation
  userId: string;
}

// We define the shape of our resolvers to ensure strict TypeScript compilation
export const resolvers = {
  // The 'Query' object handles all data fetching operations (The 'Read' side of CQRS)
  Query: {
    // Resolver for 'getDocumentStatus', extracting 'documentId' from the arguments
    getDocumentStatus: async (_parent: any, args: { documentId: string }, context: GraphQLContext) => {
      // 1. In a real app, we would make a gRPC or REST call to the Data Ingestion Service here
      // For now, we return a mock object to satisfy the TypeScript contract
      return {
        // Return the exact ID requested by the frontend
        id: args.documentId,
        // Mock filename
        filename: "enterprise-architecture.pdf",
        // Mock status showing the async worker is currently processing it
        status: "PROCESSING",
        // Return the current date/time
        uploadedAt: new Date().toISOString(),
      };
    },

    // Resolver for 'askCopilot', demonstrating the Redis caching strategy
    askCopilot: async (_parent: any, args: { documentId: string; question: string }, context: GraphQLContext) => {
      // 1. We would first check our Redis cache to see if this exact question was asked before
      // const cachedAnswer = await redis.get(args.question);
      
      // 2. If no cache exists, we make a synchronous call to the FastAPI LangGraph Orchestrator
      // const aiResponse = await fetchFastAPI('/orchestrate', { body: args });

      // Return the mock response conforming to the 'CopilotResponse' GraphQL type
      return {
        // The mock AI answer
        answer: "Based on the provided document, the system uses an API Gateway.",
        // The source document used to generate the answer
        sources: [args.documentId],
        // Flag indicating this was NOT a cache hit, but a fresh AI generation
        isCached: false,
      };
    },
  },

  // The 'Mutation' object handles all data modifications (The 'Write' side of CQRS)
  Mutation: {
    // Resolver for 'uploadDocument', triggering the Event-Driven async flow
    uploadDocument: async (_parent: any, args: { filename: string; contentBase64: string }, context: GraphQLContext) => {
      // 1. Generate a unique ID for the new document transaction
      const newDocumentId = `doc_${Date.now()}`;

      // 2. We make a fast, synchronous call to the Data Ingestion Service to save the initial record (PostgreSQL/Mongo)
      // await db.documents.insert({ id: newDocumentId, status: 'PENDING' });

      // 3. CRITICAL ENTERPRISE PATTERN: We drop an event onto the Kafka/RabbitMQ broker
      // The AI FastAPI service will listen for this event and process the vector embeddings in the background
      // await kafka.publish('document.uploaded', { documentId: newDocumentId, content: args.contentBase64 });

      // 4. We immediately return a '202 Accepted' style response to the UI so it doesn't hang waiting for the AI
      return {
        // The newly generated ID so the UI can start polling for status updates
        id: newDocumentId,
        // The filename provided by the UI
        filename: args.filename,
        // The initial state, proving to the UI that the async pipeline has started
        status: "PENDING",
        // The exact time of the transaction
        uploadedAt: new Date().toISOString(),
      };
    },
  },
};