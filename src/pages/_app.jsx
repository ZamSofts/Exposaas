import "@/lib/validateEnv"; // Validate env vars at startup (server-side only)
import "@/styles/globals.css";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });
import App from "next/app";
import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import { LocaleProvider } from "@/i18n/LocaleProvider";
import { resolveLocaleFromCookieHeader, DEFAULT_LOCALE } from "@/i18n/resolveLocale";

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
  return (
    <div className={inter.className}>
      <Component {...pageProps} />
    </div>
  );
}

function MyApp({ Component, pageProps: { session, ...pageProps }, initialLocale }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider session={session}>
        <LocaleProvider initialLocale={initialLocale}>
          <ErrorBoundary>
            <AppContent Component={Component} pageProps={pageProps} />
          </ErrorBoundary>
        </LocaleProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}

MyApp.getInitialProps = async (appContext) => {
  const appProps = await App.getInitialProps(appContext);
  const cookieHeader = appContext?.ctx?.req?.headers?.cookie || "";
  const initialLocale = typeof window === "undefined"
    ? resolveLocaleFromCookieHeader(cookieHeader)
    : DEFAULT_LOCALE;
  return { ...appProps, initialLocale };
};

export default MyApp;
