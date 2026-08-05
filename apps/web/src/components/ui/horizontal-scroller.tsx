"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/**
 * Rolagem horizontal é inerente a certas metáforas visuais (grade de colunas
 * do Kanban, editor de grafo do Flow Builder) e não pode ser empilhada
 * verticalmente sem perder o sentido. Este wrapper melhora a experiência
 * dessa rolagem em mobile: scroll-snap, momentum de toque, e um desvanecido
 * nas bordas que só aparece quando há de fato mais conteúdo para rolar
 * naquela direção (calculado a partir de scrollLeft/scrollWidth).
 */
export function HorizontalScroller({
  children,
  className = "",
  contentClassName = "",
  contentStyle,
  snap = true,
}: {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  contentStyle?: CSSProperties;
  snap?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function update() {
      if (!el) return;
      setCanScrollLeft(el.scrollLeft > 4);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    }

    update();
    el.addEventListener("scroll", update, { passive: true });
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      resizeObserver.disconnect();
    };
  }, [children]);

  return (
    <div className={`relative ${className}`}>
      <div
        ref={ref}
        style={contentStyle}
        className={`overflow-x-auto [-webkit-overflow-scrolling:touch] ${snap ? "snap-x snap-proximity scroll-smooth" : ""} ${contentClassName}`}
      >
        {children}
      </div>
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-surface-alt to-transparent transition-opacity duration-200 sm:hidden ${
          canScrollLeft ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-surface-alt to-transparent transition-opacity duration-200 sm:hidden ${
          canScrollRight ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}
