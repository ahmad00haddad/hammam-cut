/** Straight-razor mark (brand logo). Blade follows text colour; handle and edge use the brand colour. */
export function RazorMark({ className }: { className?: string }) {
  return (
    <svg viewBox="-74 -12 196 44" fill="none" aria-hidden="true" className={className}>
      <g transform="rotate(-16)">
        <path
          className="fill-primary"
          stroke="currentColor"
          strokeWidth="2.5"
          d="M-72 -8Q-72 -10 -69 -10H2V10H-69Q-72 10 -72 8Z"
        />
        <path fill="currentColor" d="M-72 -8Q-72 -10 -69 -10H-60V10H-69Q-72 10 -72 8Z" />
        <path fill="currentColor" d="M-12 -10H2V10H-12Z" />
      </g>
      <path fill="currentColor" d="M0 -10H96Q108 -10 112 0L104 11H0Z" />
      <path className="fill-primary" d="M10 5.5H102L104 11H10Z" />
      <circle r="8.5" fill="currentColor" />
      <circle r="3.4" className="fill-background" />
    </svg>
  );
}
