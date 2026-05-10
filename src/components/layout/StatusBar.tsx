import { useEffect, useState } from "react";
import { Icon } from "@/components/atoms";

type StatusBarProps = {
  loading?: boolean;
  saved?: boolean;
  hojeCount: number;
  mesCount: number;
  hojeLabel: string;
  mesLabel: string;
  loadingLabel: string;
  savedLabel: string;
  connectedLabel: string;
  lang: string;
};

export function StatusBar({
  loading, saved,
  hojeCount, mesCount,
  hojeLabel, mesLabel, loadingLabel, savedLabel, connectedLabel,
  lang,
}: StatusBarProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        background: "#111820",
        borderTop: "1px solid #2E3B4A",
        color: "#9898B0",
        fontSize: 11,
        display: "flex",
        alignItems: "center",
        padding: "0 12px",
        gap: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#0E9F6E", boxShadow: "0 0 0 2px #0E9F6E30" }} />
        <span>{connectedLabel}</span>
        {loading && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginLeft: 8, color: "#F37E38", fontWeight: 600 }}>
            <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{ animation: "spin 1s linear infinite" }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
            {loadingLabel}
          </span>
        )}
        {saved && !loading && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginLeft: 8, color: "#0E9F6E", fontWeight: 600 }}>
            <Icon d="M5 13l4 4L19 7" size={11} /> {savedLabel}
          </span>
        )}
      </div>

      <div style={{ display: "flex", gap: 14, marginLeft: "auto" }}>
        <span>{hojeLabel} <strong style={{ color: "#F8FAFC" }}>{hojeCount}</strong></span>
        <span>{mesLabel} <strong style={{ color: "#F8FAFC" }}>{mesCount}</strong></span>
      </div>

      <div style={{ fontFamily: "'DM Mono',monospace", color: "#CBD5E1" }}>
        {now.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" })}
      </div>
    </div>
  );
}
