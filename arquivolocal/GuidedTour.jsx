import { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────
//  TIPOS DE STEPS (defina nos seus componentes)
// ─────────────────────────────────────────────
// const TOUR_STEPS = [
//   { target: "#btn-novo-lancamento", title: "Novo Lançamento", desc: "Clique aqui para registrar um novo terceiro ou evento." },
//   { target: "#tabela-lancamentos",  title: "Tabela de Lançamentos", desc: "Todos os registros aparecem aqui. Use o filtro para buscar." },
//   { target: "#btn-exportar",        title: "Exportar CSV", desc: "Baixe os dados para Excel com um clique." },
// ];

// ─────────────────────────────────────────────
//  HOOK: useTour
// ─────────────────────────────────────────────
export function useTour(storageKey = "tour_done") {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);

  // Abre automaticamente no 1º acesso
  useEffect(() => {
    if (!localStorage.getItem(storageKey)) {
      const timer = setTimeout(() => setActive(true), 800);
      return () => clearTimeout(timer);
    }
  }, [storageKey]);

  const start = useCallback(() => {
    setStep(0);
    setActive(true);
  }, []);

  const finish = useCallback(() => {
    setActive(false);
    localStorage.setItem(storageKey, "1");
  }, [storageKey]);

  const next = useCallback((total) => {
    setStep((s) => {
      if (s + 1 >= total) { finish(); return s; }
      return s + 1;
    });
  }, [finish]);

  const prev = useCallback(() => setStep((s) => Math.max(0, s - 1)), []);

  return { active, step, start, finish, next, prev };
}

// ─────────────────────────────────────────────
//  COMPONENTE: GuidedTour
// ─────────────────────────────────────────────
export default function GuidedTour({ steps, active, step, onNext, onPrev, onFinish }) {
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0, placement: "bottom" });
  const tooltipRef = useRef(null);

  useEffect(() => {
    if (!active || !steps[step]) return;

    const el = document.querySelector(steps[step].target);
    if (!el) return;

    el.scrollIntoView({ behavior: "smooth", block: "center" });

    const update = () => {
      const rect = el.getBoundingClientRect();
      const PADDING = 8;

      setPos({
        top: rect.top + window.scrollY - PADDING,
        left: rect.left + window.scrollX - PADDING,
        width: rect.width + PADDING * 2,
        height: rect.height + PADDING * 2,
      });

      // Posiciona tooltip: tenta abaixo, senão acima
      const ttHeight = 160;
      const ttWidth = 300;
      const spaceBelow = window.innerHeight - rect.bottom;
      const placement = spaceBelow > ttHeight + 20 ? "bottom" : "top";

      let left = rect.left + rect.width / 2 - ttWidth / 2;
      left = Math.max(12, Math.min(left, window.innerWidth - ttWidth - 12));

      const top = placement === "bottom"
        ? rect.bottom + window.scrollY + PADDING + 8
        : rect.top + window.scrollY - ttHeight - PADDING - 8;

      setTooltipPos({ top, left, placement });
    };

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [active, step, steps]);

  if (!active || !steps[step]) return null;

  const current = steps[step];
  const isLast = step === steps.length - 1;
  const isFirst = step === 0;

  return (
    <>
      {/* Overlay com "buraco" no elemento alvo */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9998,
          pointerEvents: "none",
        }}
      >
        <svg
          style={{ width: "100%", height: "100%", display: "block" }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <mask id="tour-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect
                x={pos.left - window.scrollX}
                y={pos.top - window.scrollY}
                width={pos.width}
                height={pos.height}
                rx="8"
                fill="black"
              />
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="rgba(15,23,42,0.65)"
            mask="url(#tour-mask)"
          />
        </svg>
      </div>

      {/* Borda de destaque no elemento */}
      <div
        style={{
          position: "absolute",
          top: pos.top,
          left: pos.left,
          width: pos.width,
          height: pos.height,
          borderRadius: 8,
          boxShadow: "0 0 0 2px #F15A22, 0 0 0 4px rgba(241,90,34,0.25)",
          zIndex: 9999,
          pointerEvents: "none",
          transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
        }}
      />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        style={{
          position: "absolute",
          top: tooltipPos.top,
          left: tooltipPos.left,
          width: 300,
          zIndex: 10000,
          transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        {/* Seta */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            ...(tooltipPos.placement === "bottom"
              ? { top: -7, borderBottom: "7px solid #1e293b", borderLeft: "7px solid transparent", borderRight: "7px solid transparent" }
              : { bottom: -7, borderTop: "7px solid #1e293b", borderLeft: "7px solid transparent", borderRight: "7px solid transparent" }),
          }}
        />

        {/* Card */}
        <div
          style={{
            background: "#1e293b",
            borderRadius: 12,
            padding: "16px 18px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {current.icon && (
                <span style={{ fontSize: 16 }}>{current.icon}</span>
              )}
              <span style={{ fontWeight: 600, fontSize: 14, color: "#f8fafc" }}>
                {current.title}
              </span>
            </div>
            <button
              onClick={onFinish}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "#94a3b8", fontSize: 16, lineHeight: 1, padding: 2,
              }}
              aria-label="Fechar tour"
            >
              ✕
            </button>
          </div>

          {/* Descrição */}
          <p style={{ fontSize: 13, color: "#cbd5e1", margin: "0 0 14px", lineHeight: 1.55 }}>
            {current.desc}
          </p>

          {/* Footer: progresso + botões */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {/* Dots */}
            <div style={{ display: "flex", gap: 5 }}>
              {steps.map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: i === step ? 18 : 6,
                    height: 6,
                    borderRadius: 3,
                    background: i === step ? "#F15A22" : "#334155",
                    transition: "width 0.25s ease",
                  }}
                />
              ))}
            </div>

            {/* Botões */}
            <div style={{ display: "flex", gap: 8 }}>
              {!isFirst && (
                <button
                  onClick={onPrev}
                  style={{
                    background: "none",
                    border: "1px solid #334155",
                    color: "#94a3b8",
                    borderRadius: 8,
                    padding: "5px 14px",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  Voltar
                </button>
              )}
              <button
                onClick={() => isLast ? onFinish() : onNext(steps.length)}
                style={{
                  background: "#F15A22",
                  border: "none",
                  color: "#fff",
                  borderRadius: 8,
                  padding: "5px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
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

// ─────────────────────────────────────────────
//  BOTÃO: Reabrir tour manualmente
// ─────────────────────────────────────────────
export function TourButton({ onStart }) {
  return (
    <button
      onClick={onStart}
      title="Ver tutorial do sistema"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: "none",
        border: "1px solid #334155",
        color: "#94a3b8",
        borderRadius: 8,
        padding: "5px 12px",
        fontSize: 13,
        cursor: "pointer",
      }}
    >
      <span style={{ fontSize: 15 }}>?</span>
      Tutorial
    </button>
  );
}

// ─────────────────────────────────────────────
//  EXEMPLO DE USO COMPLETO
// ─────────────────────────────────────────────
//
// import GuidedTour, { useTour, TourButton } from "./GuidedTour";
//
// const STEPS = [
//   {
//     target: "#btn-novo",
//     icon: "➕",
//     title: "Criar novo registro",
//     desc: "Clique aqui para abrir o formulário e registrar uma nova entrada no sistema.",
//   },
//   {
//     target: "#input-busca",
//     icon: "🔍",
//     title: "Buscar registros",
//     desc: "Digite o nome, código ou data para filtrar os registros da tabela abaixo.",
//   },
//   {
//     target: "#tabela-dados",
//     icon: "📋",
//     title: "Tabela de dados",
//     desc: "Todos os registros aparecem aqui. Clique em uma linha para ver detalhes ou editar.",
//   },
//   {
//     target: "#btn-exportar",
//     icon: "📥",
//     title: "Exportar para Excel",
//     desc: "Baixe todos os dados filtrados em formato CSV compatível com Excel.",
//   },
// ];
//
// export default function App() {
//   const { active, step, start, finish, next, prev } = useTour("meuapp_tour");
//
//   return (
//     <div>
//       <header>
//         <h1>Meu App</h1>
//         <TourButton onStart={start} />
//       </header>
//
//       <main>
//         <button id="btn-novo">+ Novo</button>
//         <input id="input-busca" placeholder="Buscar..." />
//         <table id="tabela-dados">...</table>
//         <button id="btn-exportar">Exportar CSV</button>
//       </main>
//
//       <GuidedTour
//         steps={STEPS}
//         active={active}
//         step={step}
//         onNext={next}
//         onPrev={prev}
//         onFinish={finish}
//       />
//     </div>
//   );
// }
