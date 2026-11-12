import { useId, useState } from "react";

/**
 * Straight-razor mark (brand logo). Blade follows text colour; handle and edge use the brand colour.
 * `animated`: the handle swings open once, then a light glint crosses the blade (disabled for reduced motion).
 * `interactive`: also a button — tap to fold the razor, tap again to open it (implies `animated`).
 */
export function RazorMark({
  className,
  animated = false,
  interactive = false,
  buttonClassName,
}: {
  className?: string;
  animated?: boolean;
  interactive?: boolean;
  buttonClassName?: string;
}) {
  const clipId = useId();
  const [open, setOpen] = useState(true);
  const anim = animated || interactive;
  const blade = "M0 -10H96Q108 -10 112 0L104 11H0Z";
  const svg = (
    <svg
      viewBox="-74 -12 196 44"
      fill="none"
      aria-hidden="true"
      className={`${anim ? `razor-animated ${open ? "razor-is-open" : "razor-is-closed"}` : ""} ${className ?? ""}`}
    >
      <g transform="rotate(-16)" className="razor-handle">
        <path
          className="fill-primary"
          stroke="currentColor"
          strokeWidth="2.5"
          d="M-72 -8Q-72 -10 -69 -10H2V10H-69Q-72 10 -72 8Z"
        />
        <path fill="currentColor" d="M-72 -8Q-72 -10 -69 -10H-60V10H-69Q-72 10 -72 8Z" />
        <path fill="currentColor" d="M-12 -10H2V10H-12Z" />
      </g>
      <path fill="currentColor" d={blade} />
      <path className="fill-primary" d="M10 5.5H102L104 11H10Z" />
      {anim && (
        <>
          <clipPath id={clipId}>
            <path d={blade} />
          </clipPath>
          <g clipPath={`url(#${clipId})`}>
            <rect className="razor-glint" x="-30" y="-14" width="12" height="28" fill="#fff" transform="skewX(-20)" />
          </g>
        </>
      )}
      <circle r="8.5" fill="currentColor" />
      <circle r="3.4" className="fill-background" />
    </svg>
  );
  if (!interactive) return svg;
  return (
    <button
      type="button"
      aria-label={open ? "إغلاق الموس" : "فتح الموس"}
      aria-expanded={open}
      onClick={() => {
        setOpen((o) => !o);
        try {
          navigator.vibrate?.(10);
        } catch {
          /* vibration is optional */
        }
      }}
      className={`rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background active:scale-95 transition-transform ${buttonClassName ?? ""}`}
    >
      {svg}
    </button>
  );
}
