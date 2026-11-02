// The logo: three rings, the top right cut out like a G. One version, on both themes (tools/make_icons.py draws the same shapes for the icons).
import { cn } from "~/lib/util";

const BASE = import.meta.env.BASE_URL;

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={className}>
      {/* A soft shadow (--logo-line) around the shape: the shape grown by 1px (the spread), blurred by 1px, behind itself. The page logo is
          1.4em wide at 3.2rem (72px: 1.5px per unit) and at 1.6rem once a question is asked (36px: 0.75px per unit); the numbers are in
          units: spread 0.67 / 1.34, blur 0.67 / 1.34. styles/app.css picks one. */}
      <defs>
        {[
          ["logo-line-big", 0.67, 0.67],
          ["logo-line-small", 1.34, 1.34],
        ].map(([id, spread, blur]) => (
          <filter key={id} id={String(id)} x="-60%" y="-60%" width="220%" height="220%" colorInterpolationFilters="sRGB">
            <feMorphology in="SourceAlpha" operator="dilate" radius={Number(spread)} result="grown" />
            <feGaussianBlur in="grown" stdDeviation={Number(blur)} result="soft" />
            <feFlood style={{ floodColor: "var(--logo-line)" }} floodOpacity="0.5" result="colour" />
            <feComposite in="colour" in2="soft" operator="in" result="line" />
            <feMerge>
              <feMergeNode in="line" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        ))}
      </defs>
      <mask id="gcut">
        <rect width="48" height="48" fill="#fff" />
        <path d="M24 24 L48 8.5 V24.33 H24 Z" fill="#000" />
      </mask>
      <g fill="none" mask="url(#gcut)">
        <circle cx="24" cy="24" r="21.24" stroke="#4f8fcb" strokeWidth="5.52" />
        <circle cx="24" cy="24" r="16.05" stroke="#77c4cf" strokeWidth="4.86" />
        <circle cx="24" cy="24" r="10.1" stroke="#a3d6e7" strokeWidth="7.1" />
      </g>
      <rect x="23.1" y="24.33" width="8" height="3.02" fill="#a3d6e7" />
    </svg>
  );
}

/** The name with its logo; a click goes back to the empty page. */
export function Logo({ onClick, className }: { onClick?: () => void; className?: string }) {
  return (
    <h1 className={cn("logo", className)}>
      <a
        href={BASE}
        aria-label="Guru"
        onClick={(e) => {
          if (!onClick || e.metaKey || e.ctrlKey || e.shiftKey) return;
          e.preventDefault();
          onClick();
        }}
      >
        <LogoMark />
        <span className="logo-name">Guru</span>
      </a>
    </h1>
  );
}
