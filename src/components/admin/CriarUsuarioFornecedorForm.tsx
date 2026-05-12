import { useState } from "react";
import { callAdminFn } from "@/lib/admin-api";

interface Props {
  fornecedores: string[];
  onCreated: () => void;
}

const card: React.CSSProperties = {
  background: "#FFFFFF",
  borderRadius: 12,
  boxShadow: "0 20px 40px rgba(26,28,29,0.06)",
  padding: 20,
};

const label: React.CSSProperties = {
  fontSize: 11,
  color: "#9898B0",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontWeight: 600,
  marginBottom: 6,
  display: "block",
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #E5E7EB",
  borderRadius: 8,
  fontSize: 14,
  fontFamily: "inherit",
  background: "#FFFFFF",
};

export function CriarUsuarioFornecedorForm({ fornecedores, onCreated }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!email || !password || !fornecedor) {
      setMsg({ ok: false, text: "Preencha todos os campos." });
      return;
    }
    setBusy(true);
    try {
      await callAdminFn("create", { email, password, is_admin: false, fornecedor });
      setEmail("");
      setPassword("");
      setFornecedor("");
      setMsg({ ok: true, text: "Usuário fornecedor criado." });
      onCreated();
    } catch (err) {
      const text = err instanceof Error ? err.message : "Erro ao criar usuário.";
      setMsg({ ok: false, text });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={card}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: "#212B36", marginBottom: 16 }}>
        Criar usuário fornecedor
      </h2>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr" }}>
        <div>
          <label style={label}>E-mail</label>
          <input style={input} type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="off" disabled={busy} />
        </div>
        <div>
          <label style={label}>Senha</label>
          <input style={input} type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" disabled={busy} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={label}>Fornecedor</label>
          <select style={input} value={fornecedor} onChange={e => setFornecedor(e.target.value)} disabled={busy || fornecedores.length === 0}>
            <option value="">— selecione —</option>
            {fornecedores.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span style={{ fontSize: 12, color: msg?.ok ? "#0E9F6E" : "#EF4444" }}>{msg?.text ?? ""}</span>
          <button
            type="submit"
            disabled={busy}
            style={{
              padding: "10px 18px",
              background: busy ? "#9CA3AF" : "#212B36",
              color: "#FFFFFF",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: busy ? "default" : "pointer",
            }}
          >
            {busy ? "Criando…" : "Criar usuário"}
          </button>
        </div>
      </form>
      <p style={{ fontSize: 11, color: "#9898B0", marginTop: 12 }}>
        A senha precisa ter no mínimo 8 caracteres, 1 maiúscula, 1 número e 1 símbolo.
      </p>
    </div>
  );
}
