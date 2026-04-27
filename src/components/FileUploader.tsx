"use client";

import { useState, useRef } from "react";
import { gql } from "@apollo/client";
import { useMutation } from "@apollo/client/react";
// 1. THE GRAPHQL CONTRACT
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
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Apollo Hook for the Network Call
  const [uploadDocument, { data, loading, error }] = useMutation<{
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
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  // --- FILE PROCESSING LOGIC ---
  const handleUpload = async () => {
    if (!file) return;

    // Convert file to Base64 to send over GraphQL
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result?.toString().split(",")[1]; // Strip the data URL prefix

      if (base64String) {
        await uploadDocument({
          variables: {
            filename: file.name,
            contentBase64: base64String,
          },
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const resetUploader = () => {
    setFile(null);
  };

  // --- UI RENDER ---
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-xl mt-8">
      <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
        <span className="bg-purple-500/10 text-purple-400 p-2 rounded text-sm">
          📄
        </span>
        AI Document Ingestion
      </h2>

      {/* Success State */}
      {data && data.uploadDocument ? (
        <div className="bg-green-500/10 border border-green-500/20 p-6 rounded-lg text-center">
          <div className="text-green-400 text-4xl mb-4">✅</div>
          <h3 className="text-lg font-medium text-white mb-2">
            Upload Successful
          </h3>
          <p className="text-slate-400 text-sm mb-4">
            Document ID:{" "}
            <span className="font-mono text-slate-300">
              {data.uploadDocument.id}
            </span>
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-slate-400 mb-6">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
            </span>
            Sent to AI Orchestrator Queue
          </div>
          <button
            onClick={resetUploader}
            className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
          >
            Upload another document
          </button>
        </div>
      ) : (
        /* Upload State */
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
