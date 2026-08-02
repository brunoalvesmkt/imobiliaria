"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type MenuLayout = "vertical" | "horizontal";

interface MenuLayoutContextValue {
  layout: MenuLayout;
  setLayout: (layout: MenuLayout) => void;
}

const MenuLayoutContext = createContext<MenuLayoutContextValue | null>(null);

const STORAGE_KEY = "menuLayout";

/** Preferência de layout do menu (lateral/topo) — por navegador, igual ao tema (ver lib/theme.tsx), não é um dado de negócio que precise ir pro backend. */
export function MenuLayoutProvider({ children }: { children: React.ReactNode }) {
  const [layout, setLayoutState] = useState<MenuLayout>("vertical");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "vertical" || stored === "horizontal") setLayoutState(stored);
  }, []);

  function setLayout(next: MenuLayout) {
    setLayoutState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }

  return <MenuLayoutContext.Provider value={{ layout, setLayout }}>{children}</MenuLayoutContext.Provider>;
}

export function useMenuLayout(): MenuLayoutContextValue {
  const ctx = useContext(MenuLayoutContext);
  if (!ctx) throw new Error("useMenuLayout deve ser usado dentro de <MenuLayoutProvider>.");
  return ctx;
}
