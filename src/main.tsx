import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";

// Rede de segurança: captura promises rejeitadas não tratadas
window.addEventListener("unhandledrejection", (event) => {
  if (import.meta.env.DEV) console.error("Unhandled promise rejection:", event.reason);
});

const missingEnv =
  !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY;

if (missingEnv) {
  document.getElementById("root")!.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#F0F2F5;font-family:system-ui,sans-serif;padding:24px">
      <div style="background:#fff;border:1px solid #E2E6EC;border-radius:16px;padding:40px;max-width:480px;width:100%;text-align:center">
        <div style="width:56px;height:56px;background:#FEF2F2;border-radius:12px;display:flex;align-items:center;justify-content:center;margin:0 auto 20px">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E02424" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </div>
        <div style="font-size:20px;font-weight:800;color:#0F1C2E;margin-bottom:8px">Configuração ausente</div>
        <div style="font-size:13px;color:#64748B;line-height:1.6">
          Variáveis de ambiente obrigatórias não estão configuradas.<br/><br/>
          Contate o administrador do sistema para configurar o ambiente de implantação.
        </div>
      </div>
    </div>
  `;
} else {
  createRoot(document.getElementById("root")!).render(<App />);
}
