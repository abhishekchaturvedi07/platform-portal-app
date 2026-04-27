"use client";

import { useState } from "react";
import { gql } from "@apollo/client";
import { useLazyQuery } from "@apollo/client/react";
// 👉 NEW: Import the uploader
import { FileUploader } from "@/components/FileUploader";

const VERIFY_ACCESS_QUERY = gql`
  query VerifyAccess($userId: String!, $role: String!) {
    verifyAccess(userId: $userId, role: $role) {
      isAuthorized
      message
    }
  }
`;

export default function Dashboard() {
  const [userId, setUserId] = useState("admin_999");
  const [role, setRole] = useState("Admin");

  const [verifyAccess, { data, loading, error }] = useLazyQuery<{
    verifyAccess: { isAuthorized: boolean; message: string };
  }>(VERIFY_ACCESS_QUERY);

  const handleCheckAccess = () => {
    verifyAccess({ variables: { userId, role } });
  };

  return (
    <main className="max-w-4xl mx-auto p-12">
      <header className="mb-12 border-b border-slate-800 pb-6">
        <h1 className="text-3xl font-bold text-white tracking-tight">
          AI Orchestrator Dashboard
        </h1>
        <p className="text-slate-400 mt-2">
          Connecting Next.js UI {`->`} GraphQL BFF {`->`} Microservices
        </p>
      </header>

      {/* IAM SECTION */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-xl">
        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
          <span className="bg-blue-500/10 text-blue-400 p-2 rounded text-sm">
            🔐
          </span>
          Identity & Access Testing
        </h2>

        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">
              User ID
            </label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            >
              <option value="Admin">Admin</option>
              <option value="User">Standard User</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleCheckAccess}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? "Authenticating via gRPC..." : "Verify Access"}
        </button>

        {(data || error) && (
          <div
            className={`mt-8 p-6 rounded-lg border ${data?.verifyAccess?.isAuthorized ? "bg-green-500/10 border-green-500/20" : "bg-red-500/10 border-red-500/20"}`}
          >
            <h3 className="text-sm font-medium text-slate-400 mb-2">
              Microservice Response:
            </h3>
            {error ? (
              <p className="text-red-400 font-mono text-sm">
                Error: {error.message}
              </p>
            ) : data?.verifyAccess ? (
              <div className="font-mono text-sm">
                <p
                  className={
                    data.verifyAccess.isAuthorized
                      ? "text-green-400"
                      : "text-red-400"
                  }
                >
                  Status:{" "}
                  {data.verifyAccess.isAuthorized ? "GRANTED" : "DENIED"}
                </p>
                <p className="text-slate-300 mt-1">
                  Message: {data.verifyAccess.message}
                </p>
              </div>
            ) : null}
          </div>
        )}
      </section>

      {/* 👉 NEW: FILE UPLOADER SECTION */}
      <FileUploader />
    </main>
  );
}
