import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { SessionProvider } from "next-auth/react";
import { Session } from "next-auth";

type AppPropsWithAuth = AppProps<{
  session: Session;
}>;

export default function App({ Component, pageProps: { session, ...pageProps } }: AppPropsWithAuth) {
  return (
    <SessionProvider session={session}>
      <Component {...pageProps} />
    </SessionProvider>
  );
}
