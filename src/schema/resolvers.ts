import { identityClient } from '../grpc/client';
// Native Node.js modules for file handling and cryptography
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

/**
 * ARCHITECTURAL NOTE:
 * This file serves as our "BFF" (Backend-for-Frontend) Gateway.
 * We follow the CQRS pattern: 
 * - Queries: Read-only operations that fetch data.
 * - Mutations: Write operations that modify state and trigger microservice events.
 */

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
     * askCopilot:
     * This is the bridge between the React Chat UI and the Python LLM Engine.
     * It handles the network hop to port 8000 where our AI Orchestrator lives.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    askCopilot: async (_parent: any, args: { documentId: string; question: string }) => {
      console.log(`💬 [BFF] User is asking: "${args.question}" for doc: ${args.documentId}`);

      try {
        // We use 127.0.0.1 to avoid IPv6 resolution issues in Node.js 18+
        const response = await fetch('http://127.0.0.1:8000/ask-copilot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            document_id: args.documentId,
            question: args.question
          })
        });

        if (!response.ok) {
          throw new Error(`AI Engine responded with status: ${response.status}`);
        }

        const data = await response.json();

        // Return the RAG-generated answer and source metadata to the React frontend
        return {
          answer: data.answer,
          sources: data.sources,
          isCached: false, // Future implementation: Add Redis caching layer here
        };

      } catch (error) {
        console.error("❌ [BFF CHAT ERROR]:", error);
        return {
          answer: "I'm sorry, I'm having trouble connecting to my brain right now. Please ensure the Python service is running.",
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
     * 4. Trigger Python AI Orchestrator asynchronously
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
           * We notify the Python AI Orchestrator to start chunking and embedding.
           * Note: We don't 'await' the fetch here because we want to return a 
           * success response to the UI immediately while the AI works in the background.
           */
          console.log(`🚀 [BFF] Notifying Python AI Engine to process: ${documentId}`);
          
          fetch('http://127.0.0.1:8000/process-document', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              document_id: documentId,
              filename: args.filename,
              file_path: filePath
            })
          }).then(async (aiResponse) => {
            if (!aiResponse.ok) {
              console.error("⚠️ [BFF] Python Engine returned an error:", await aiResponse.text());
            } else {
              console.log("✅ [BFF] Python Engine started processing successfully.");
            }
          }).catch((networkError) => {
            console.error("❌ [BFF] Could not reach Python. Check if FastAPI is on port 8000.", networkError);
          });

          // 7. Return initial success status to the React UI
          return {
            id: documentId,
            filename: args.filename,
            status: "PROCESSING_AI", 
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