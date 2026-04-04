import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", background: "#F0F2F5", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans',system-ui,sans-serif" }}>
          <div style={{ textAlign: "center" }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1E293B", marginBottom: 8 }}>Algo deu errado</h1>
            <p style={{ fontSize: 14, color: "#64748B", marginBottom: 16 }}>Ocorreu um erro inesperado.</p>
            <button
              onClick={() => window.location.reload()}
              style={{ padding: "8px 20px", background: "#2563EB", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 14, fontWeight: 600 }}
            >
              Recarregar página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
