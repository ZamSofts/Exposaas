import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[ErrorBoundary] Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          padding: "2rem",
          fontFamily: "system-ui, sans-serif",
        }}>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
            Something went wrong
          </h1>
          <p style={{ color: "#666", marginBottom: "1.5rem", textAlign: "center" }}>
            An unexpected error occurred. Please refresh the page.
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false });
              window.location.reload();
            }}
            style={{
              padding: "0.5rem 1.5rem",
              borderRadius: "0.5rem",
              border: "1px solid #ccc",
              cursor: "pointer",
              backgroundColor: "#f5f5f5",
            }}
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
