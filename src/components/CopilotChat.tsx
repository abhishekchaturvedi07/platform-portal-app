"use client";

import { useState } from "react";
import { gql } from "@apollo/client";
import { useLazyQuery, useQuery } from "@apollo/client/react";

// 1. THE GRAPHQL CONTRACTS
const GET_DOCUMENTS = gql`
  query GetUploadedDocuments {
    getUploadedDocuments {
      id
      filename
    }
  }
`;

const ASK_COPILOT = gql`
  query AskCopilot($documentId: ID!, $question: String!) {
    askCopilot(documentId: $documentId, question: $question) {
      answer
      sources
    }
  }
`;

// 2. DATA TYPES
interface DocMetadata {
  id: string;
  filename: string;
}

interface CopilotData {
  askCopilot: {
    answer: string;
    sources: string[];
  };
}

export function CopilotChat() {
  const [selectedDoc, setSelectedDoc] = useState("");
  const [question, setQuestion] = useState("");

  // 3. HOOKS (Following your specific import pattern)
  const { data: listData, refetch: refetchDocs } = useQuery<{
    getUploadedDocuments: DocMetadata[];
  }>(GET_DOCUMENTS);

  const [askQuestion, { data, loading, error }] =
    useLazyQuery<CopilotData>(ASK_COPILOT);

  const handleAsk = () => {
    if (!selectedDoc || !question) return;
    askQuestion({ variables: { documentId: selectedDoc, question } });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-xl mt-8">
      <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
        <span className="bg-blue-500/10 text-blue-400 p-2 rounded text-sm">
          🤖
        </span>
        AI Copilot Chat
      </h2>

      <div className="space-y-4">
        {/* DOCUMENT SELECTION DROPDOWN */}
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1 flex justify-between">
            Knowledge Source
            <button
              onClick={() => refetchDocs()}
              className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors uppercase tracking-tighter"
            >
              🔄 Refresh Files
            </button>
          </label>

          <select
            value={selectedDoc}
            onChange={(e) => setSelectedDoc(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none cursor-pointer"
          >
            <option value="">-- Select an ingested document --</option>
            {listData?.getUploadedDocuments.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.id}
              </option>
            ))}
          </select>
        </div>

        {/* QUESTION INPUT */}
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">
            Your Question
          </label>
          <textarea
            placeholder="What is the main objective of this document?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors h-24 resize-none"
          />
        </div>

        {/* ACTION BUTTON */}
        <button
          onClick={handleAsk}
          disabled={loading || !question || !selectedDoc}
          className={`w-full py-3 rounded-lg font-semibold transition-all ${
            loading || !selectedDoc
              ? "bg-slate-800 text-slate-500 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg active:scale-[0.98]"
          }`}
        >
          {loading ? "RAG Engine Processing..." : "Consult AI Copilot"}
        </button>

        {/* AI RESPONSE AREA */}
        {data && (
          <div className="mt-6 p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              <p className="text-blue-400 text-xs font-bold uppercase tracking-wider">
                Verified Response
              </p>
            </div>

            <p className="text-slate-200 leading-relaxed italic">
              "{data.askCopilot.answer}"
            </p>

            <div className="mt-4 pt-4 border-t border-slate-800 text-[10px] text-slate-500 flex gap-2">
              <span className="uppercase font-bold">Vector Source:</span>
              <span className="font-mono text-blue-300/70">
                {data.askCopilot.sources.join(", ")}
              </span>
            </div>
          </div>
        )}

        {error && (
          <p className="text-red-400 text-sm mt-4 text-center bg-red-500/10 py-2 rounded">
            ⚠️ Network Error: {error.message}
          </p>
        )}
      </div>
    </div>
  );
}
