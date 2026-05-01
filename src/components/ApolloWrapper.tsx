"use client";

import { ApolloClient, InMemoryCache, createHttpLink } from "@apollo/client";

//  Import ApolloProvider from the specific /react subpath
import { ApolloProvider } from "@apollo/client/react";
import { setContext } from "@apollo/client/link/context";
// Create a standard HTTP link to our BFF Gateway
const httpLink = createHttpLink({
  uri: "/api/graphql",
});

/**
 * ARCHITECTURAL NOTE:
 * We use an authLink to intercept every GraphQL request.
 * It pulls the 'id_token' from local storage and injects it into the
 * Authorization header so the BFF and AI Engine can verify identity.
 */
// const authLink = setContext((_, { headers }) => {
//   // Pull the token (In a real app, this might come from a cookie or Auth provider)
//   const token =
//     typeof window !== "undefined" ? localStorage.getItem("id_token") : null;

//   return {
//     headers: {
//       ...headers,
//       authorization: token ? `Bearer ${token}` : "",
//     },
//   };
// });

// platform-portal-app/src/components/ApolloWrapper.tsx

const authLink = setContext((_, { headers }) => {
  // 🎯 THE FIX: Changed from 'id_token' to 'accessToken'
  const token =
    typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;

  if (token) {
    console.log("🛡️ [APOLLO] accessToken found! Injecting into headers...");
  }

  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : "",
    },
  };
});

//  Combine the Auth Link with the HTTP Link[cite: 5]
const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
});

export function ApolloWrapper({ children }: { children: React.ReactNode }) {
  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}
