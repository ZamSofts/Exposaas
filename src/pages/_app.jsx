import "@/styles/globals.css";
import { SessionProvider } from "next-auth/react";
import { ThemeContext, useThemeState } from "@/hooks/useTheme";

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
      <AppContent Component={Component} pageProps={pageProps} router={router} />
    </SessionProvider>
  );
}
