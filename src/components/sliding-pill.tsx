import { useCallback, useLayoutEffect, useState, type RefObject } from "react";

type Box = { x: number; y: number; w: number; h: number };

/**
 * Renders an elastic sliding highlight behind whichever child inside `containerRef`
 * has `data-active="true"`. Works in RTL, LTR, horizontal scrollers, and 2D grids.
 */
export function SlidingPill({
  containerRef,
  activeKey,
  className = "rounded-xl bg-primary",
}: {
  containerRef: RefObject<HTMLElement | null>;
  activeKey: string | number | null | undefined;
  className?: string;
}) {
  const [box, setBox] = useState<Box | null>(null);
  const [animate, setAnimate] = useState(false);

  const measure = useCallback(() => {
    const root = containerRef.current;
    if (!root) return;
    const el = root.querySelector<HTMLElement>('[data-active="true"]');
    if (!el) {
      setBox(null);
      return;
    }
    setBox({ x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight });
  }, [containerRef]);

  useLayoutEffect(() => {
    measure();
    const id = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(id);
  }, [measure, activeKey]);

  useLayoutEffect(() => {
    const root = containerRef.current;
    if (!root || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    return () => ro.disconnect();
  }, [containerRef, measure]);

  if (!box) return null;

  return (
    <span
      aria-hidden="true"
      className={`elastic-pill z-[1] ${className}`}
      style={{
        translate: `${box.x}px ${box.y}px`,
        width: `${box.w}px`,
        height: `${box.h}px`,
        transition: animate ? undefined : "none",
      }}
    />
  );
}