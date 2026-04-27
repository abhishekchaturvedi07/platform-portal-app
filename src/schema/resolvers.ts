import { identityClient } from '../grpc/client';
//  NEW: Import Node.js File System and Path modules for our Storage Layer
import fs from "fs/promises";
import path from "path";
//  NEW: Import Node's native cryptography library for deduplication
import crypto from "crypto";

// We define a TypeScript interface for our GraphQL context
// This context is passed to every resolver and usually holds the user's JWT data
// interface GraphQLContext {
//   userId: string;
// }

// We define the shape of our resolvers to ensure strict TypeScript compilation
export const resolvers = {
  // The 'Query' object handles all data fetching operations (The 'Read' side of CQRS)
  Query: {
    // Resolver for 'getDocumentStatus', extracting 'documentId' from the arguments
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getDocumentStatus: async (_parent: any, args: { documentId: string }) => {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    askCopilot: async (_parent: any, args: { documentId: string; question: string }) => {
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    verifyAccess: async (_parent: any, args: { userId: string, role: string }) => {
        console.log(`[BFF] UI requested access check. Forwarding to gRPC...`);
        
        // Node.js gRPC uses old-school callbacks. 
        // We wrap it in a modern Promise so our GraphQL server can properly `await` the network response.
        return new Promise((resolve, reject) => {
          identityClient.ValidateUserAccess(
            { userId: args.userId, requiredRole: args.role }, 
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (error: any, response: any) => {
              if (error) {
                console.error("[BFF] gRPC Network Error:", error);
                reject(error);
              } else {
                console.log("[BFF] Received response from Microservice:", response);
                resolve(response);
              }
            }
          );
        });
      }
  },

  // The 'Mutation' object handles all data modifications (The 'Write' side of CQRS)
  Mutation: {
    // Resolver for 'uploadDocument', handling secure storage and deduplication
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    uploadDocument: async (_parent: any, args: { filename: string; contentBase64: string }) => {
      try {
        // 1. Define our "S3 Bucket" local path (an 'uploads' folder in the root directory).
        // GOLDEN RULE: Never pass data to an AI engine without securely storing the raw artifact first.
        const uploadDir = path.join(process.cwd(), "uploads");

        // 2. Ensure the directory actually exists on the hard drive (if not, create it dynamically)
        await fs.mkdir(uploadDir, { recursive: true });

        // 3. Decode the incoming Base64 string back into a raw binary buffer
        const fileBuffer = Buffer.from(args.contentBase64, "base64");

        // 4. CRYPTOGRAPHIC HASHING: Generate a SHA-256 fingerprint of the binary data
        // This ensures if a user uploads the exact same file twice, we catch it.
        const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
        
        // 5. We use the first 16 characters of the hash as our universally unique Document ID
        const documentId = `doc_${fileHash.substring(0, 16)}`;
        
        // 6. ENTERPRISE SECURITY: We save the file using its hash as the name to guarantee absolute uniqueness
        const filePath = path.join(uploadDir, `${documentId}.pdf`);

        // 7. THE DEDUPLICATION CHECK: Does this exact file already exist on our hard drive?
        try {
          await fs.access(filePath); // This checks if the file exists
          
          console.log(`♻️ [DEDUPLICATION] Exact file already exists! Skipping AI processing for: ${documentId}`);
          
          // Return immediately. Do not write the file, do not trigger the AI.
          return {
            id: documentId,
            filename: args.filename, // Return their original filename to avoid confusing the user
            status: "ALREADY_PROCESSED", // Tell the UI it was an instant cache hit
            uploadedAt: new Date().toISOString(),
          };
        } catch {
          // If fs.access throws an error, it means the file DOES NOT exist. We are clear to save it.
          console.log(`🆕 [STORAGE LAYER] New file detected. Saving securely to: ${filePath}`);
          
          // 8. Write the physical file to the hard drive
          await fs.writeFile(filePath, fileBuffer);

          // 9. CRITICAL ENTERPRISE PATTERN: We would drop an event onto the Kafka/RabbitMQ broker here.
          // The Python FastAPI service will listen for this event and process the vector embeddings in the background.
          // await kafka.publish('document.uploaded', { documentId: documentId, path: filePath });

          return {
            id: documentId,
            filename: args.filename,
            status: "STORED_SECURELY", 
            uploadedAt: new Date().toISOString(),
          };
        }
      } catch (error) {
        console.error("❌ [STORAGE ERROR]:", error);
        throw new Error("Failed to store the document in the secure layer.");
      }
    },
  },
};