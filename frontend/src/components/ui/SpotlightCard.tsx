"use client";

import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/cn";

type Props = {
  children: ReactNode;
  className?: string;
  /** Extra class on inner content wrapper */
  contentClassName?: string;
};

/**
 * Card with mouse-tracking radial spotlight (accent @ ~15% opacity).
 * Multi-layer shadow + gradient surface per design system.
 */
export function SpotlightCard({
  children,
  className,
  contentClassName,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [glow, setGlow] = useState({ x: 50, y: 50, active: false });

  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    setGlow({ x, y, active: true });
  }, []);

  const onLeave = useCallback(() => {
    setGlow((s) => ({ ...s, active: false }));
  }, []);

  const style = {
    "--spot-x": `${glow.x}%`,
    "--spot-y": `${glow.y}%`,
  } as CSSProperties;

  return (
    <div
      ref={ref}
      role="presentation"
      style={style}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.08] to-white/[0.02] shadow-card transition-[box-shadow,transform] duration-300 ease-expo",
        "hover:-translate-y-1 hover:shadow-card-hover",
        "motion-reduce:transform-none motion-reduce:transition-none",
        className
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 ease-expo group-hover:opacity-100",
          glow.active && "opacity-100"
        )}
        style={{
          background: `radial-gradient(300px circle at var(--spot-x) var(--spot-y), rgba(94,106,210,0.15), transparent 65%)`,
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent"
        aria-hidden
      />
      <div className={cn("relative z-[1]", contentClassName)}>{children}</div>
    </div>
  );
}
