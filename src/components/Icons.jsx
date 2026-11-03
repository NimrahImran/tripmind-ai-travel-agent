import { useId } from 'react';

// Small inline icon set (stroke icons, currentColor).
const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  viewBox: '0 0 24 24',
  'aria-hidden': true,
};

/** TripMind "Mind Pin": a saffron map pin holding an AI circuit-brain, with a plane on its orbit. */
export function Logo(p) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" {...p}>
      <defs>
        <linearGradient id={`${id}sun`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffd27a" />
          <stop offset=".55" stopColor="#f4b13f" />
          <stop offset="1" stopColor="#d98a12" />
        </linearGradient>
      </defs>
      <path d="M8 40 C 2 26, 14 6, 34 5" fill="none" stroke="#4fc3b5" strokeWidth="2" strokeLinecap="round" strokeDasharray="2.5 3.5" />
      <path d="M32 4C19.8 4 10 13.6 10 25.6 10 41.5 32 60 32 60S54 41.5 54 25.6C54 13.6 44.2 4 32 4Z" fill={`url(#${id}sun)`} />
      <circle cx="32" cy="25.5" r="14" fill="#0f2e3a" />
      <g fill="none" stroke="#f4b13f" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M32 14.5V36.5" />
        <path d="M32 19.5H27V16.8" />
        <path d="M32 25.5H23.5" />
        <path d="M32 31H26.5V34" />
        <path d="M32 18H37.5V15.8" />
        <path d="M32 24H40.5" />
        <path d="M32 29.5H38V33.5" />
      </g>
      <g fill="#ffe1a1">
        <circle cx="27" cy="16.3" r="1.7" />
        <circle cx="23" cy="25.5" r="1.7" />
        <circle cx="26.5" cy="34.4" r="1.7" />
        <circle cx="37.5" cy="15.3" r="1.7" />
        <circle cx="41" cy="24" r="1.7" />
        <circle cx="38" cy="33.9" r="1.7" />
      </g>
      <path
        d="M0 3.6 L6.2 3.1 L9.6 0 L10.9 0 L9.4 3 L12.6 2.8 L13.8 1.3 L14.7 1.3 L14 3.8 L14.7 6.3 L13.8 6.3 L12.6 4.8 L9.4 4.6 L10.9 7.6 L9.6 7.6 L6.2 4.5 L0 4 Z"
        fill="#4fc3b5"
        transform="translate(37 0.5) rotate(-12) scale(1.15)"
      />
    </svg>
  );
}
export const ArrowLeft = (p) => (
  <svg {...base} {...p}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);
export const ArrowRight = (p) => (
  <svg {...base} {...p}>
    <path d="M9 5l7 7-7 7" />
  </svg>
);
export const Pin = (p) => (
  <svg {...base} {...p}>
    <path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </svg>
);
export const Sparkle = (p) => (
  <svg {...base} {...p}>
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
    <path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" />
  </svg>
);
export const Globe = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
  </svg>
);
export const Check = (p) => (
  <svg {...base} strokeWidth="2.4" {...p}>
    <path d="M5 12.5l4.2 4.2L19 7" />
  </svg>
);
export const Chevron = (p) => (
  <svg {...base} {...p}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);
export const Menu = (p) => (
  <svg {...base} {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);
export const Close = (p) => (
  <svg {...base} {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const Send = (p) => (
  <svg {...base} {...p}>
    <path d="M4 12l16-8-6 16-2.5-6.5z" />
  </svg>
);
export const Download = (p) => (
  <svg {...base} {...p}>
    <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
  </svg>
);
export const Bookmark = (p) => (
  <svg {...base} {...p}>
    <path d="M7 4h10v16l-5-3.5L7 20z" />
  </svg>
);
export const Trash = (p) => (
  <svg {...base} {...p}>
    <path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13" />
  </svg>
);
export const Swap = (p) => (
  <svg {...base} {...p}>
    <path d="M7 4L4 7l3 3M4 7h13M17 20l3-3-3-3M20 17H7" />
  </svg>
);
export const Github = (p) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}>
    <path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.4-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.6 2.4 1.1 3 .8.1-.6.3-1.1.6-1.3-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.8 1a9.6 9.6 0 0 1 5 0c1.9-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5A10 10 0 0 0 12 2z" />
  </svg>
);
export const Mail = (p) => (
  <svg {...base} {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3.5 6.5L12 13l8.5-6.5" />
  </svg>
);
export const Briefcase = (p) => (
  <svg {...base} {...p}>
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M9 7V5h6v2M3 13h18" />
  </svg>
);
export const Linkedin = (p) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}>
    <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.75h4v11H3zM9.5 9.75h3.8v1.5h.06c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.77 2.65 4.77 6.1v5.45h-4v-4.84c0-1.15-.02-2.64-1.6-2.64-1.62 0-1.86 1.26-1.86 2.56v4.92h-4z" />
  </svg>
);
