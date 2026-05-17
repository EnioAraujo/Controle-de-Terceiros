import GuidedTour, { useTour, type TourStep } from "@/components/GuidedTour";

interface Props {
  steps: TourStep[];
  storageKey?: string;
  /** Se fornecido, chama antes do start para garantir que a tab certa esteja ativa. */
  onBeforeStart?: (step: TourStep) => void;
}

/**
 * Botão flutuante "?" no canto inferior direito que dispara o tour guiado.
 * Auto-inicia em primeira visita (controlado por `useTour` via localStorage).
 */
export function TourButton({ steps, storageKey = "tour_lancamentos_done", onBeforeStart }: Props) {
  const { active, step, start, finish, next, prev } = useTour(storageKey);

  const handleStart = () => {
    if (steps[0] && onBeforeStart) onBeforeStart(steps[0]);
    start();
  };

  return (
    <>
      <button
        onClick={handleStart}
        title="Tour guiado"
        aria-label="Iniciar tour guiado"
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          width: 44,
          height: 44,
          borderRadius: 22,
          background: "#F37E38",
          color: "#fff",
          border: "none",
          boxShadow: "0 4px 12px rgba(243,126,56,0.45)",
          cursor: "pointer",
          fontSize: 22,
          fontWeight: 700,
          zIndex: 9000,
          display: active ? "none" : "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        ?
      </button>
      <GuidedTour
        steps={steps}
        active={active}
        step={step}
        onNext={() => next(steps.length)}
        onPrev={prev}
        onFinish={finish}
      />
    </>
  );
}
