import { useState, useEffect, useRef } from "react";
import { useTour } from "@/hooks/use-tour";

// Re-exporta o hook para uso externo (compatibilidade)
export { useTour } from "@/hooks/use-tour";

// ─────────────────────────────────────────────
//  TIPOS
// ─────────────────────────────────────────────
export interface TourStep {
  target: string;
  title: string;
  desc: string;
  icon?: string;
  /** Se definido, troca para esta aba antes de exibir o step. */
  tabBefore?: "dashboard" | "lancamentos" | "projecao" | "fechamento" | "configuracoes";
}

interface GuidedTourProps {
  steps:    TourStep[];
  active:   boolean;
  step:     number;
  onNext:   () => void;
  onPrev:   () => void;
  onFinish: () => void;
}

interface Pos { top: number; left: number; width: number; height: number; }
interface TooltipPos { top: number; left: number; placement: "top" | "bottom"; }

// ─────────────────────────────────────────────
//  COMPONENTE: GuidedTour
// ─────────────────────────────────────────────
export default function GuidedTour({ steps, active, step, onNext, onPrev, onFinish }: GuidedTourProps) {
  const [pos, setPos]               = useState<Pos>({ top: 0, left: 0, width: 0, height: 0 });
  const [tooltipPos, setTooltipPos] = useState<TooltipPos>({ top: 0, left: 0, placement: "bottom" });
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active || !steps[step]) return;

    const el = document.querySelector(steps[step].target);
    if (!el) return;

    el.scrollIntoView({ behavior: "smooth", block: "center" });

    const update = () => {
      const rect = el.getBoundingClientRect();
      const PADDING = 8;

      setPos({
        top:    rect.top  + window.scrollY - PADDING,
        left:   rect.left + window.scrollX - PADDING,
        width:  rect.width  + PADDING * 2,
        height: rect.height + PADDING * 2,
      });

      const ttHeight = 160;
      const ttWidth  = 300;
      const spaceBelow = window.innerHeight - rect.bottom;
      const placement: "top" | "bottom" = spaceBelow > ttHeight + 20 ? "bottom" : "top";

      let left = rect.left + rect.width / 2 - ttWidth / 2;
      left = Math.max(12, Math.min(left, window.innerWidth - ttWidth - 12));

      const top = placement === "bottom"
        ? rect.bottom + window.scrollY + PADDING + 8
        : rect.top    + window.scrollY - ttHeight - PADDING - 8;

      setTooltipPos({ top, left, placement });
    };

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [active, step, steps]);

  if (!active || !steps[step]) return null;

  const current = steps[step];
  const isLast  = step === steps.length - 1;
  const isFirst = step === 0;

  return (
    <>
      {/* Overlay com "buraco" no elemento alvo */}
      <div style={{ position: "fixed", inset: 0, zIndex: 9998, pointerEvents: "none" }}>
        <svg style={{ width: "100%", height: "100%", display: "block" }} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <mask id="tour-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect
                x={pos.left - window.scrollX}
                y={pos.top  - window.scrollY}
                width={pos.width}
                height={pos.height}
                rx="8"
                fill="black"
              />
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(15,23,42,0.65)" mask="url(#tour-mask)" />
        </svg>
      </div>

      {/* Borda de destaque no elemento */}
      <div style={{
        position: "absolute",
        top:    pos.top,
        left:   pos.left,
        width:  pos.width,
        height: pos.height,
        borderRadius: 8,
        boxShadow: "0 0 0 2px #F37E38, 0 0 0 4px rgba(243,126,56,0.25)",
        zIndex: 9999,
        pointerEvents: "none",
        transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
      }} />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        style={{
          position: "absolute",
          top:    tooltipPos.top,
          left:   tooltipPos.left,
          width:  300,
          zIndex: 10000,
          transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        {/* Seta */}
        <div style={{
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          ...(tooltipPos.placement === "bottom"
            ? { top: -7,    borderBottom: "7px solid #1e293b", borderLeft: "7px solid transparent", borderRight: "7px solid transparent" }
            : { bottom: -7, borderTop:    "7px solid #1e293b", borderLeft: "7px solid transparent", borderRight: "7px solid transparent" }),
        }} />

        {/* Card */}
        <div style={{ background: "#1e293b", borderRadius: 12, padding: "16px 18px", boxShadow: "0 8px 32px rgba(0,0,0,0.35)" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {current.icon && <span style={{ fontSize: 16 }}>{current.icon}</span>}
              <span style={{ fontWeight: 600, fontSize: 14, color: "#f8fafc" }}>{current.title}</span>
            </div>
            <button
              onClick={onFinish}
              aria-label="Fechar tour"
              style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 16, lineHeight: 1, padding: 2 }}
            >
              ✕
            </button>
          </div>

          {/* Descrição */}
          <p style={{ fontSize: 13, color: "#cbd5e1", margin: "0 0 14px", lineHeight: 1.55 }}>
            {current.desc}
          </p>

          {/* Footer: dots + botões */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {/* Dots de progresso */}
            <div style={{ display: "flex", gap: 5 }}>
              {steps.map((_, i) => (
                <div key={i} style={{
                  width:  i === step ? 18 : 6,
                  height: 6,
                  borderRadius: 3,
                  background: i === step ? "#F37E38" : "#334155",
                  transition: "width 0.25s ease",
                }} />
              ))}
            </div>

            {/* Botões */}
            <div style={{ display: "flex", gap: 8 }}>
              {!isFirst && (
                <button
                  onClick={onPrev}
                  style={{ background: "none", border: "1px solid #334155", color: "#94a3b8", borderRadius: 8, padding: "5px 14px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
                >
                  Voltar
                </button>
              )}
              <button
                onClick={() => isLast ? onFinish() : onNext()}
                style={{ background: "#F37E38", border: "none", color: "#fff", borderRadius: 8, padding: "5px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
              >
                {isLast ? "Concluir ✓" : "Próximo →"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
