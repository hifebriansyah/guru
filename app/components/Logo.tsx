// The logo: three rings, the top right cut out like a G. One version, on both themes (tools/make_icons.py draws the same shapes for the icons).
import { cn } from "~/lib/util";

const BASE = import.meta.env.BASE_URL;

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={className}>
      <mask id="gcut">
        <rect width="48" height="48" fill="#fff" />
        <path d="M24 24 L48 8.5 V24.33 H24 Z" fill="#000" />
      </mask>
      <g fill="none" mask="url(#gcut)">
        <circle cx="24" cy="24" r="21.24" stroke="#4f8fcb" strokeWidth="5.52" />
        <circle cx="24" cy="24" r="16.05" stroke="#77c4cf" strokeWidth="4.86" />
        <circle cx="24" cy="24" r="10.1" stroke="#cfeaf3" strokeWidth="7.1" />
      </g>
      <rect x="23.1" y="24.33" width="8" height="3.02" fill="#aad9e9" />
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
        Guru
      </a>
    </h1>
  );
}
