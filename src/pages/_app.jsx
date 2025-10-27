import "@/styles/globals.css";
import React, { useEffect } from "react";
import { SessionProvider, useSession } from "next-auth/react";
import { ThemeContext, useThemeState } from "@/hooks/useTheme";
import wsClient from "@/lib/wsClient";

function WebSocketConnector() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      // ✅ Connect websocket immediately when session is ready
      wsClient.connect({
        id: session.user.id,
        username: session.user.name || session.user.username,
        companyId: session.user.companyId,
      });
    } else if (status === "unauthenticated") {
      // ✅ Disconnect if user logs out
      wsClient.disconnect();
    }
  }, [status, session]);

  return null; // This component doesn’t render anything visible
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
    <SessionProvider session={session}>
      {/* Mount the connector so it can react to session changes and send a `join` on connect */}
      <WebSocketConnector />
      <AppContent Component={Component} pageProps={pageProps} router={router} />
    </SessionProvider>
  );
}
