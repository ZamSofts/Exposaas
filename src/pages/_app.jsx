import "@/styles/globals.css";
import React from "react";
import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeContext, useThemeState } from "@/hooks/useTheme";
import ErrorBoundary from "@/components/ui/ErrorBoundary";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

if (typeof window !== "undefined") {
  window.goodDateTime = d => {
    const date = new Date(d);
    if (date.toString() === "Invalid Date") return null;
    const day = date.getDate().toString().padStart(2, "0");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    const time = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return `${day}-${month}-${year} ${time}`;
  };
  window.goodDate = d => {
    const date = new Date(d);
    if (date.toString() === "Invalid Date") return null;
    const day = date.getDate().toString().padStart(2, "0");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    const time = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return `${month} ${day}, ${year}`;
  };
}

function AppContent({ Component, pageProps }) {
  const themeState = useThemeState();

  return (
    <ThemeContext.Provider value={themeState}>
      <Component {...pageProps} />
    </ThemeContext.Provider>
  );
}

export default function App({ Component, pageProps: { session, ...pageProps }, router }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider session={session}>
        <ErrorBoundary>
          <AppContent Component={Component} pageProps={pageProps} router={router} />
        </ErrorBoundary>
      </SessionProvider>
    </QueryClientProvider>
  );
}
