"use client";

import { useEffect, useRef, useState } from "react";

export interface DropdownMenuItem {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

/** Botão + lista suspensa simples (sem dependência externa) — fecha ao clicar fora ou em Escape. */
export function DropdownMenu({
  label,
  items,
  align = "left",
  buttonClassName,
}: {
  label: string;
  items: DropdownMenuItem[];
  align?: "left" | "right";
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={
          buttonClassName ??
          "inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-surface-alt"
        }
      >
        {label}
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute z-20 mt-1 w-56 rounded-md border border-line bg-surface py-1 shadow-lg ${align === "right" ? "right-0" : "left-0"}`}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className="block w-full px-3 py-2 text-left text-sm text-ink hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-50"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
