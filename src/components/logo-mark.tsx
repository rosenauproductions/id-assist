// Custom mark for ID Assist: a compiled outline. Three bars of decreasing
// length (an outline being distilled) capped with a checkmark badge (the
// Bloom/ADDIE gate passing). Deliberately drawn in the same thin-stroke
// language as the Heroicons used elsewhere in the app so it reads as one
// icon family, not a bolted-on logo.
export function LogoMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="1.5"
        y="1.5"
        width="21"
        height="21"
        rx="6"
        className="fill-accent/10 stroke-accent"
        strokeWidth="1.5"
      />
      <path
        d="M6.5 8.5H15.5"
        className="stroke-accent"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M6.5 12H13"
        className="stroke-accent"
        strokeWidth="1.75"
        strokeLinecap="round"
        opacity="0.75"
      />
      <path
        d="M6.5 15.5H10.5"
        className="stroke-accent"
        strokeWidth="1.75"
        strokeLinecap="round"
        opacity="0.55"
      />
      <path
        d="M14.75 14.25L16.5 16L19 12.75"
        className="stroke-accent"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
