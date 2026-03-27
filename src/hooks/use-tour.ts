import { useState, useEffect, useCallback } from "react";

export function useTour(storageKey = "tour_done") {
  const [active, setActive] = useState(false);
  const [step, setStep]     = useState(0);

  useEffect(() => {
    if (!localStorage.getItem(storageKey)) {
      const timer = setTimeout(() => setActive(true), 800);
      return () => clearTimeout(timer);
    }
  }, [storageKey]);

  const start = useCallback((initialStep = 0) => {
    setStep(initialStep);
    setActive(true);
  }, []);

  const finish = useCallback(() => {
    setActive(false);
    localStorage.setItem(storageKey, "1");
  }, [storageKey]);

  const next = useCallback((total: number) => {
    setStep(s => {
      if (s + 1 >= total) { finish(); return s; }
      return s + 1;
    });
  }, [finish]);

  const prev = useCallback(() => setStep(s => Math.max(0, s - 1)), []);

  return { active, step, start, finish, next, prev };
}
