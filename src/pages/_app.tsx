import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { SessionProvider } from "next-auth/react";
import { Session } from "next-auth";
import { ThemeContext, useThemeState } from "@/hooks/useTheme";

type AppPropsWithAuth = AppProps<{
  session?: Session;
}>;

function AppContent({ Component, pageProps }: AppProps) {
  const themeState = useThemeState();

  return (
    <ThemeContext.Provider value={themeState}>
      <Component {...pageProps} />
    </ThemeContext.Provider>
  );
}

export default function App({ Component, pageProps: { session, ...pageProps }, router }: AppPropsWithAuth) {
  return (
    <SessionProvider session={session}>
      <AppContent Component={Component} pageProps={pageProps} router={router} />
    </SessionProvider>
  );
}
