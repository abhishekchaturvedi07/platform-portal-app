"use client";

import { useState, useRef } from "react";
import { gql } from "@apollo/client";
import { useMutation } from "@apollo/client/react";

// 1. THE GRAPHQL CONTRACT
// This mutation defines exactly what data we are sending to the BFF and what we expect back.
const UPLOAD_DOCUMENT = gql`
  mutation UploadDocument($filename: String!, $contentBase64: String!) {
    uploadDocument(filename: $filename, contentBase64: $contentBase64) {
      id
      filename
      status
      uploadedAt
    }
  }
`;

export function FileUploader() {
  // --- UI STATE MANAGEMENT ---
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- NETWORK STATE MANAGEMENT ---
  // Apollo Hook for the Network Call. We destructure 'reset' to clear the cache for subsequent uploads.
  const [uploadDocument, { data, loading, error, reset }] = useMutation<{
    uploadDocument: {
      id: string;
      filename: string;
      status: string;
      uploadedAt: string;
    };
  }>(UPLOAD_DOCUMENT);

  // --- DRAG AND DROP LOGIC ---
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    // Safely extract the physical file from the drop event array using [0]
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      setFile(droppedFile);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Safely extract the physical file from the input selection array using [0]
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  // --- FILE PROCESSING & NETWORK LOGIC ---
  const handleUpload = async () => {
    if (!file) return;

    // 1. Convert the physical File object into a Base64 string.
    // GraphQL requires text/string payloads, so we cannot send raw binary blobs directly.
    const reader = new FileReader();

    reader.onloadend = async () => {
      // 2. The FileReader returns a "Data URL" (e.g., "data:application/pdf;base64,JVBERi0...").
      // We split on the comma and take the second half [1] to isolate the pure Base64 data.
      const base64String = reader.result?.toString().split(",")[1];

      if (base64String) {
        // 3. Fire the GraphQL Mutation to our Next.js BFF Gateway
        await uploadDocument({
          variables: {
            filename: file.name,
            contentBase64: base64String,
          },
        });
      }
    };

    // Trigger the file reading process
    reader.readAsDataURL(file);
  };

  // Resets the component so the user can upload a new file
  const resetUploader = () => {
    setFile(null); // Clear the local React state
    reset(); // Clear the Apollo Client cache to hide the success/duplicate screen
  };

  // Helper variable to check if the backend caught a duplicate file using Cryptographic Hashing
  const isDuplicate = data?.uploadDocument?.status === "ALREADY_PROCESSED";

  // --- UI RENDER ---
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-xl mt-8">
      <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
        <span className="bg-purple-500/10 text-purple-400 p-2 rounded text-sm">
          📄
        </span>
        AI Document Ingestion
      </h2>

      {/* Network Response State (Success or Duplicate) */}
      {data && data.uploadDocument ? (
        <div
          className={`p-6 rounded-lg text-center border ${isDuplicate ? "bg-yellow-500/10 border-yellow-500/20" : "bg-green-500/10 border-green-500/20"}`}
        >
          {/* Dynamic Icon & Title based on Status */}
          <div className="text-4xl mb-4">{isDuplicate ? "⚠️" : "✅"}</div>
          <h3 className="text-lg font-medium text-white mb-2">
            {isDuplicate ? "Document Already Exists" : "Upload Successful"}
          </h3>

          <p className="text-slate-400 text-sm mb-4">
            Document ID:{" "}
            <span className="font-mono text-slate-300">
              {data.uploadDocument.id}
            </span>
          </p>

          <div className="flex items-center justify-center gap-2 text-sm text-slate-400 mb-6">
            {!isDuplicate && (
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
              </span>
            )}
            <span>
              {isDuplicate
                ? "Skipped AI processing to save compute costs."
                : "Sent to AI Orchestrator Queue."}
            </span>
          </div>

          <button
            onClick={resetUploader}
            className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
          >
            Upload another document
          </button>
        </div>
      ) : (
        /* Upload State (Ready to receive files) */
        <>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200 
              ${isDragging ? "border-blue-500 bg-blue-500/5" : "border-slate-700 hover:border-slate-600 hover:bg-slate-800/50"}
              ${file ? "border-green-500/50 bg-green-500/5" : ""}
            `}
          >
            {/* CRITICAL: Ensure onChange points to handleFileSelect.
              Do not bind it directly to setFile, as it expects a physical File object, not a React Event!
            */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              accept=".pdf,.txt,.md"
            />

            {file ? (
              <div>
                <p className="text-green-400 font-medium mb-1">
                  File ready: {file.name}
                </p>
                <p className="text-slate-500 text-sm">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            ) : (
              <div>
                <div className="text-slate-400 mb-3 flex justify-center">
                  <svg
                    className="w-10 h-10"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    ></path>
                  </svg>
                </div>
                <p className="text-slate-300 font-medium">
                  Click to upload or drag and drop
                </p>
                <p className="text-slate-500 text-sm mt-1">
                  PDF, TXT, or Markdown (Max 10MB)
                </p>
              </div>
            )}
          </div>

          <button
            onClick={handleUpload}
            disabled={!file || loading}
            className={`w-full mt-6 font-semibold py-3 rounded-lg transition-colors 
              ${!file || loading ? "bg-slate-800 text-slate-500 cursor-not-allowed" : "bg-purple-600 hover:bg-purple-500 text-white shadow-lg"}
            `}
          >
            {loading ? "Encrypting & Uploading..." : "Upload to System"}
          </button>

          {error && (
            <p className="text-red-400 text-sm mt-4 text-center">
              Failed to upload: {error.message}
            </p>
          )}
        </>
      )}
    </div>
  );
}
