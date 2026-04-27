import { identityClient } from '../grpc/client';
// Native Node modules for Storage and Cryptography
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

// We define the shape of our resolvers to ensure strict TypeScript compilation
export const resolvers = {
  // The 'Query' object handles all data fetching operations (The 'Read' side of CQRS)
  Query: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getDocumentStatus: async (_parent: any, args: { documentId: string }) => {
      return {
        id: args.documentId,
        filename: "enterprise-architecture.pdf",
        status: "PROCESSING",
        uploadedAt: new Date().toISOString(),
      };
    },

    // Resolver for 'askCopilot', demonstrating the Redis caching strategy
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    askCopilot: async (_parent: any, args: { documentId: string; question: string }) => {
      return {
        answer: "Based on the provided document, the system uses an API Gateway.",
        sources: [args.documentId],
        isCached: false,
      };
    },

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

  // The 'Mutation' object handles all data modifications (The 'Write' side of CQRS)
  Mutation: {
    // Resolver for 'uploadDocument', handling secure storage, deduplication, and triggering the AI
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    uploadDocument: async (_parent: any, args: { filename: string; contentBase64: string }) => {
      try {
        // 1. Define our local path (simulating an AWS S3 Bucket)
        const uploadDir = path.join(process.cwd(), "uploads");
        await fs.mkdir(uploadDir, { recursive: true });

        // 2. Decode the incoming Base64 string back into a raw binary buffer
        const fileBuffer = Buffer.from(args.contentBase64, "base64");

        // 3. CRYPTOGRAPHIC HASHING: Generate a SHA-256 fingerprint of the binary data
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
          // If the file DOES NOT exist, we save it and trigger the AI.
          console.log(`🆕 [STORAGE LAYER] New file detected. Saving securely to: ${filePath}`);
          
          // 5. Write the physical file to the hard drive
          await fs.writeFile(filePath, fileBuffer);

          // ====================================================================
          // 6. THE MICROSERVICE BRIDGE (React -> Node.js -> Python)
          // ====================================================================
          // We make a secure server-to-server call to the Python Engine. 
          // React never sees this, preventing users from exposing our AI ports.
          console.log(`🚀 [BFF] Notifying Python AI Engine to process: ${documentId}`);
          
          // We don't 'await' this fetch so we don't block the UI from showing success instantly.
          // In a real enterprise app, this would be a Kafka or RabbitMQ event.
          fetch('http://127.0.0.1:8000/process-document', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              document_id: documentId,
              filename: args.filename,
              file_path: filePath // Passing the absolute path so Python can find the file
            })
          }).then(async (aiResponse) => {
            if (!aiResponse.ok) {
              console.error("⚠️ [BFF] Python Engine returned an error:", await aiResponse.text());
            } else {
              const aiData = await aiResponse.json();
              console.log("✅ [BFF] Python Engine Success:", aiData);
            }
          }).catch((networkError) => {
            console.error("❌ [BFF] Could not reach Python. Is FastAPI running on port 8000?", networkError);
          });
          // ====================================================================

          // 7. Return success to the Next.js UI immediately
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