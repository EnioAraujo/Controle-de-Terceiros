import { useCallback, useState } from "react";

export function useTabManager<T extends string>(initial: T) {
  const [openTabs, setOpenTabs] = useState<T[]>([initial]);
  const [activeTab, setActiveTab] = useState<T>(initial);

  const openTab = useCallback((id: T) => {
    setOpenTabs(prev => (prev.includes(id) ? prev : [...prev, id]));
    setActiveTab(id);
  }, []);

  const closeTab = useCallback((id: T) => {
    setOpenTabs(prev => {
      if (prev.length <= 1) return prev;
      const idx = prev.indexOf(id);
      if (idx === -1) return prev;
      const next = prev.filter(t => t !== id);
      setActiveTab(curr => {
        if (curr !== id) return curr;
        const neighbor = next[idx] ?? next[idx - 1] ?? next[0];
        return neighbor;
      });
      return next;
    });
  }, []);

  return { openTabs, activeTab, openTab, closeTab, setActiveTab };
}
