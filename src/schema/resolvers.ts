import { identityClient } from '../grpc/client';
import { createClient } from 'redis';
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

import { publishEvent } from '../utils/rabbitmq';

/**
 * ARCHITECTURAL NOTE:
 * This file serves as our "BFF" (Backend-for-Frontend) Gateway.
 * We follow the CQRS pattern: 
 * - Queries: Read-only operations that fetch data.
 * - Mutations: Write operations that modify state and trigger microservice events.
 */

// --- REDIS INITIALIZATION ---
/**
 * We initialize the Redis client to connect to our local Homebrew-managed instance.
 * Using a cache prevents redundant, expensive LLM calls for identical questions.
 */
// [UPDATE]: We use the Docker environment variable or fallback to the Docker service name
const REDIS_URL = process.env.REDIS_URL || 'redis://redis-cache:6379';
const redisClient = createClient({ url: REDIS_URL });
redisClient.on('error', (err) => console.error('❌ [REDIS] Client Error', err));
redisClient.connect().then(() => console.log("⚡ [BFF] Connected to Redis Cache Layer"));
// ----------------------------

export const resolvers = {
  // --- QUERY SECTION (The 'Read' side) ---
  Query: {
    /**
     * getDocumentStatus:
     * In a live environment, this would poll a Redis instance or a Postgres DB 
     * to check if the Python worker has finished vectorizing the file.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getDocumentStatus: async (_parent: any, args: { documentId: string }) => {
      return {
        id: args.documentId,
        filename: "enterprise-architecture.pdf",
        status: "PROCESSING",
        uploadedAt: new Date().toISOString(),
      };
    },

    getUploadedDocuments: async () => {
      const uploadDir = path.join(process.cwd(), "uploads");
      try {
        const files = await fs.readdir(uploadDir);
        // Map the physical filenames (doc_123.pdf) back into metadata objects
        return files
          .filter(f => f.startsWith('doc_'))
          .map(f => ({
            id: f.replace('.pdf', ''),
            filename: f // In a real app, you'd store the original name in a DB
          }));
      } catch {
        return []; // Return empty if folder doesn't exist yet
      }
    },

    /**
     * askCopilot (Modified with Cache-Aside Pattern & Layer 0 Security):
     * This is the bridge between the React Chat UI and the Python LLM Engine.
     * Before hitting the Python engine, we check Redis for a pre-existing answer.
     * [UPDATE - PHASE 12]: We now forward the user's JWT identity token to the 
     * AI Engine to enforce row-level document security.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    askCopilot: async (_parent: any, args: { documentId: string; question: string }, context: any) => {
      console.log(`💬 [BFF] User is asking: "${args.question}" for doc: ${args.documentId}`);

      // 🛡️ Debug Log
      console.log(`🔑 [DEBUG] Token received in resolver: ${context.token ? 'YES (Present)' : 'NO (Empty)'}`);
      
      // 🛡️ [SECURITY]: Grab identity token from the GraphQL context[cite: 3, 6]
      const token = context.token;

      // 1. GENERATE UNIQUE CACHE KEY
      // We normalize the question to lowercase and hash it to create a unique ID for this specific Q&A pair.
      const questionHash = crypto.createHash('md5').update(args.question.toLowerCase().trim()).digest('hex');
      const cacheKey = `ai_cache:${args.documentId}:${questionHash}`;

      try {
        // 2. THE CACHE CHECK (The "Fast Path")
        const cachedAnswer = await redisClient.get(cacheKey);
        if (cachedAnswer) {
          console.log("🚀 [CACHE HIT] Returning stored answer from Redis memory.");
          return {
            ...JSON.parse(cachedAnswer),
            isCached: true // Tells the UI this was a lightning-fast cached response
          };
        }

        console.log("🐢 [CACHE MISS] No stored answer found. Requesting fresh inference...");

        // 3. THE LLM REQUEST (The "Slow Path")
        // [LEGACY CODE - PHASE 1]: We used 127.0.0.1 when everything ran on the Mac host
        /*
        const response = await fetch('http://127.0.0.1:8000/ask-copilot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            document_id: args.documentId,
            question: args.question
          })
        });
        */

        // [ENTERPRISE CODE - PHASE 2]: Use Docker internal DNS via Environment Variable
        const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://ai-engine:8000';
        const response = await fetch(`${AI_ENGINE_URL}/ask-copilot`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` // 👉 [NEW]: Injecting JWT for Layer 0 Security[cite: 3]
          },
          body: JSON.stringify({
            document_id: args.documentId,
            question: args.question
          })
        });

        if (!response.ok) {
          throw new Error(`AI Engine responded with status: ${response.status}`);
        }

        const data = await response.json();
        
        const finalResponse = {
          answer: data.answer,
          sources: data.sources,
          isCached: false,
        };

        // 4. SAVE TO CACHE
        // We store the result for 1 hour (3600 seconds) so future identical questions are instant.
        await redisClient.set(cacheKey, JSON.stringify(finalResponse), {
          EX: 3600 
        });

        return finalResponse;

      } catch (error) {
        console.error("❌ [BFF CHAT ERROR]:", error);
        return {
          answer: "I'm sorry, I'm having trouble connecting to my brain right now. Please ensure the Python service is running and you are logged in.",
          sources: [],
          isCached: false
        };
      }
    },

    /**
     * verifyAccess:
     * Demonstrates gRPC communication. We wrap the callback-based gRPC client 
     * in a Promise to allow clean async/await usage in GraphQL.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    verifyAccess: async (_parent: any, args: { userId: string, role: string }) => {
        console.log(`[BFF] UI requested access check. Forwarding to gRPC...`);
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

  // --- MUTATION SECTION (The 'Write' side) ---
  Mutation: {
    /**
     * uploadDocument:
     * Complex multi-stage ingestion pipeline:
     * 1. Decode Base64 binary
     * 2. Hash file for deduplication (SHA-256)
     * 3. Persist to local "S3-style" Storage Layer
     * 4. Trigger Python AI Orchestrator asynchronously via Event Mesh
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    uploadDocument: async (_parent: any, args: { filename: string; contentBase64: string }) => {
      try {
        // 1. Define storage directory
        const uploadDir = path.join(process.cwd(), "uploads");
        await fs.mkdir(uploadDir, { recursive: true });

        // 2. Decode the incoming Base64 string from the React frontend
        const fileBuffer = Buffer.from(args.contentBase64, "base64");

        // 3. CRYPTOGRAPHIC HASHING: 
        // We generate a fingerprint to ensure the same file isn't processed twice, saving compute $$.
        const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
        const documentId = `doc_${fileHash.substring(0, 16)}`;
        const filePath = path.join(uploadDir, `${documentId}.pdf`);

        // 4. THE DEDUPLICATION CHECK
        try {
          await fs.access(filePath); 
          console.log(`♻️ [DEDUPLICATION] Exact file already exists! Skipping AI processing for: ${documentId}`);
          
          return {
            id: documentId,
            filename: args.filename, 
            status: "ALREADY_PROCESSED", 
            uploadedAt: new Date().toISOString(),
          };
        } catch {
          // 5. NEW FILE DETECTED: Save to physical disk
          console.log(`🆕 [STORAGE LAYER] New file detected. Saving securely to: ${filePath}`);
          await fs.writeFile(filePath, fileBuffer);

          /**
           * 6. THE MICROSERVICE BRIDGE (React -> Node.js -> Python)
           * * [LEGACY CODE - DEPRECATED IN PHASE 8]
           * Previously, we used a synchronous REST call.
           */
          /*
          console.log(`🚀 [BFF] Notifying Python AI Engine to process: ${documentId}`);
          fetch('http://127.0.0.1:8000/process-document', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              document_id: documentId,
              filename: args.filename,
              file_path: filePath
            })
          }).then(async (aiResponse) => { ... }).catch((networkError) => { ... });
          */

          /**
           * [ENTERPRISE PATTERN - EVENT DRIVEN BACKBONE]
           * We now publish to RabbitMQ. The BFF guarantees the message is saved to the broker.
           * The Python Worker will consume this queue autonomously.
           */
          console.log(`⚡ [EVENT MESH] Publishing ingestion event for ${documentId} to RabbitMQ...`);
          
          const ingestionEvent = {
            eventId: crypto.randomUUID(),
            document_id: documentId, 
            filename: args.filename,
            file_path: filePath,
            timestamp: new Date().toISOString()
          };

          // Publish the event to the queue
          await publishEvent('document_ingestion_queue', ingestionEvent);

          // 7. Return initial success status to the React UI instantly
          return {
            id: documentId,
            filename: args.filename,
            status: "QUEUED_FOR_AI", // Updated status to reflect event-driven nature
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