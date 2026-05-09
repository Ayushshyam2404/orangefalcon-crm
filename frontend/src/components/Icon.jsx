export function Icon({ name, size = 16, color = 'currentColor', style = {} }) {
  const icons = {
    falcon: (
      <path d="M10 2L13.5 7L18 5L15 10L18 15L13 12.5L10 18L7 12.5L2 15L5 10L2 5L6.5 7Z" fill="white" />
    ),
    grid: (
      <>
        <rect x="2" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <rect x="11" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <rect x="2" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <rect x="11" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </>
    ),
    doc: (
      <>
        <path d="M4 4a2 2 0 012-2h6l4 4v10a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path d="M12 2v4h4M7 9h6M7 12h4" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </>
    ),
    phone: (
      <path d="M3 5a2 2 0 012-2h1.5l2 4-1.5 1.5a10 10 0 004.5 4.5L13 11.5l4 2V15a2 2 0 01-2 2C7.163 17 3 12.837 3 7.5V5z" stroke="currentColor" strokeWidth="1.5" fill="none" />
    ),
    users: (
      <>
        <circle cx="8" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path d="M2 17c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path d="M14 5c1.657 0 3 1.343 3 3s-1.343 3-3 3M18 17c0-2.21-1.343-4-4-4" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </>
    ),
    bell: (
      <>
        <path d="M10 2a6 6 0 016 6v3l2 2H2l2-2V8a6 6 0 016-6z" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path d="M8 17a2 2 0 004 0" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </>
    ),
    logout: (
      <>
        <path d="M7 3H4a1 1 0 00-1 1v12a1 1 0 001 1h3" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path d="M13 14l4-4-4-4M17 10H7" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </>
    ),
    plus: <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" fill="none" />,
    search: (
      <>
        <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path d="M17 17l-3.5-3.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </>
    ),
    pen: <path d="M13.5 3.5l3 3L7 16H4v-3L13.5 3.5z" stroke="currentColor" strokeWidth="1.5" fill="none" />,
    trash: (
      <>
        <path d="M3 6h14M8 6V4h4v2M5 6l1 11h8l1-11" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </>
    ),
    trophy: (
      <>
        <path d="M6 2h8v7a4 4 0 01-8 0V2z" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path d="M4 4H2v3a4 4 0 004 4M16 4h2v3a4 4 0 01-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path d="M10 13v4M7 17h6" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </>
    ),
    star: <path d="M10 2l2.4 5.2L18 8.1l-4 3.9 1 5.5L10 15l-5 2.5 1-5.5L2 8.1l5.6-.9L10 2z" stroke="currentColor" strokeWidth="1.5" fill="none" />,
    starFill: <path d="M10 2l2.4 5.2L18 8.1l-4 3.9 1 5.5L10 15l-5 2.5 1-5.5L2 8.1l5.6-.9L10 2z" fill="currentColor" />,
    dollar: (
      <>
        <path d="M10 2v16M6 5.5a4 4 0 018 0c0 2-2 3-4 3s-4 1-4 3a4 4 0 008 0" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </>
    ),
    check: (
      <>
        <rect x="3" y="2" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path d="M6.5 7h7M6.5 10h7M6.5 13h4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </>
    ),
    warn: (
      <>
        <path d="M10 2L2 17h16L10 2z" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path d="M10 8v4M10 14v1" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </>
    ),
    info: (
      <>
        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path d="M10 9v5M10 7v1" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </>
    ),
    arrowIn: (
      <>
        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path d="M10 7v6M7 10l3 3 3-3" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </>
    ),
    useradd: (
      <>
        <circle cx="8" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path d="M2 17c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path d="M15 8v6M12 11h6" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </>
    ),
    settings: (
      <>
        <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path d="M10 2v2.5M10 15.5v2.5M18 10h-2.5M4.5 10H2M15.64 4.36l1.77-1.77M2.59 17.41l1.77-1.77M15.64 15.64l1.77 1.77M2.59 2.59l1.77 1.77" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </>
    ),
    clipboard: (
      <>
        <path d="M4 4a2 2 0 012-2h6l4 4v10a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path d="M12 2v4h4M7 10l2 2 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    funnel: (
      <>
        <path d="M2 4h16l-6 7v5l-4-2V11L2 4z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
      </>
    ),
    building: (
      <>
        <rect x="2" y="3" width="16" height="14" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path d="M6 7h2M6 11h2M12 7h2M12 11h2M8 17v-4h4v4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </>
    ),
    calendar: (
      <>
        <rect x="2" y="3" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path d="M2 8h16" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path d="M6 2v3M14 2v3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <circle cx="7" cy="13" r="1" fill="currentColor" />
        <circle cx="10" cy="13" r="1" fill="currentColor" />
        <circle cx="13" cy="13" r="1" fill="currentColor" />
      </>
    ),
    megaphone: (
      <>
        <path d="M3 8v4h3l5 4V4L6 8H3z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
        <path d="M16 7a4 4 0 010 6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <path d="M6 12l1 5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </>
    ),
    clock: (
      <>
        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path d="M10 6v4l3 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      style={{ display: 'inline-flex', flexShrink: 0, color, ...style }}
    >
      {icons[name] || null}
    </svg>
  )
}
