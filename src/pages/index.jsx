import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { signIn, getSession } from "next-auth/react";
import { Geist } from "next/font/google";
import { Error,Loader } from "@/hooks/wrapper";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check if user is already authenticated
    getSession().then((session) => {
      if (session) {
        router.push("/dashboard");
      } else {
        setIsCheckingSession(false);
      }
    });
  }, [router]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password");
      return;
    }

    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        username: username.trim(),
        password,
        redirect: false,
      });
    console.log("SignIn result:", result);

      if (result?.error) {
        setError("Invalid username or password");
      } else if (result?.ok) {
        router.push("/dashboard");
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
      console.error("Login error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingSession) {
    return (
      
        <Loader />
      
    );
  }

  return (
    <div className={`${geistSans.variable} font-sans min-h-screen flex flex-col`} style={{ background: "var(--background)" }}>
      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-4 -right-4 w-72 h-72 rounded-full opacity-5" style={{ background: "var(--primary)" }}></div>
        <div className="absolute top-1/2 -left-8 w-48 h-48 rounded-full opacity-5" style={{ background: "var(--secondary)" }}></div>
        <div className="absolute bottom-1/4 right-1/4 w-32 h-32 rounded-full opacity-5" style={{ background: "var(--accent)" }}></div>
      </div>

      {/* Header */}
      <header className="relative z-10 px-6 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center space-x-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg"
              style={{ background: "var(--primary)" }}>
              E
            </div>
            <div>
              <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>
                ExpoSaaS
              </h1>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Document Management System
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-md">
          {/* Login Card */}
          <div
            className="rounded-2xl p-8 shadow-sm border"
            style={{
              background: "var(--surface-elevated)",
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-lg)",
            }}>
            {/* Login Header */}
            <div className="text-center mb-8">
              <div
                className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-white text-2xl font-bold"
                style={{ background: "var(--primary)" }}>
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold mb-2" style={{ color: "var(--foreground)" }}>
                Welcome back
              </h2>
              <p style={{ color: "var(--text-secondary)" }}>Sign in to access your vehicle documents</p>
            </div>

            <Error message={error} />

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label htmlFor="username" className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2"
                  style={{
                    backgroundColor: "var(--surface)",
                    borderColor: "var(--border)",
                    color: "var(--foreground)",
                    focusRingColor: "var(--primary)",
                  }}
                  placeholder="Enter your username"
                  disabled={isLoading}
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2"
                  style={{
                    backgroundColor: "var(--surface)",
                    borderColor: "var(--border)",
                    color: "var(--foreground)",
                    focusRingColor: "var(--primary)",
                  }}
                  placeholder="Enter your password"
                  disabled={isLoading}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || !username.trim() || !password.trim()}
                className="w-full py-3 px-4 rounded-xl text-white font-medium text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md"
                style={{
                  backgroundColor: "var(--primary)",
                  focusRingColor: "var(--primary)",
                }}>
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Signing in...
                  </div>
                ) : (
                  "Sign in"
                )}
              </button>
            </form>

            {/* Additional Links */}
            <div className="mt-6 text-center">
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Need help? Contact your system administrator
              </p>
            </div>
          </div>

          {/* Security Notice */}
          <div className="mt-6 text-center">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Protected by enterprise-grade security
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-6">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            © {new Date().getFullYear()} ExpoSaaS. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
