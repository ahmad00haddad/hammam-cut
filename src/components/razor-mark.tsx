import { useId } from "react";

/**
 * Straight-razor mark (brand logo). Blade follows text colour; handle and edge use the brand colour.
 * `animated`: the handle swings open once, then a light glint crosses the blade (disabled for reduced motion).
 */
export function RazorMark({ className, animated = false }: { className?: string; animated?: boolean }) {
  const clipId = useId();
  const blade = "M0 -10H96Q108 -10 112 0L104 11H0Z";
  return (
    <svg viewBox="-74 -12 196 44" fill="none" aria-hidden="true" className={`${animated ? "razor-animated" : ""} ${className ?? ""}`}>
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
      {animated && (
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
}
