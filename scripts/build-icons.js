// node scripts/build-icons.js   (run from project root)  ->  writes css/icons.css
// ONE place for every icon in the app. Existing <i class="fa-solid fa-xxx"> markup renders as an inline SVG (CSS mask).
// To add an icon: add a line to P (path, 24x24 stroke style) and, if needed, an alias in AL. Then re-run this script.
// The script also scans public/ and js/ and PRINTS any fa-* class that has no icon (those would show as a dot).
const fs = require('fs'), path = require('path');

const o = (x, y, r) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`; // circle helper
const RING = 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z';

/* ── icon artwork (key = Font Awesome name without "fa-") ─────────────── */
const P = {
dot: o(12, 12, 1),

/* navigation / actions */
'house': 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
'bookmark': 'M6 3h12v18l-6-4-6 4z',
'border-all': 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
'clipboard-list': 'M9 3h6v3H9zM7 5H5v16h14V5h-2M9 11h6M9 15h6',
'user': 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
'users': 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M17 3.5a4 4 0 0 1 0 7M22 21a7 7 0 0 0-4-6',
'user-plus': 'M10 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a8 8 0 0 1 16 0M19 8v6M16 11h6',
'user-nurse': 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0M12 15v4M10 17h4',
'magnifying-glass': 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3',
'bell': 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21a2 2 0 0 0 4 0',
'right-from-bracket': 'M9 21H5V3h4M16 17l5-5-5-5M21 12H9',
'right-to-bracket': 'M15 3h4a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3',
'arrow-left': 'M19 12H5M12 19l-7-7 7-7',
'arrow-right': 'M5 12h14M12 5l7 7-7 7',
'arrow-up': 'M12 19V5M5 12l7-7 7 7',
'arrow-up-wide-short': 'M3 6h6M3 12h10M3 18h14M18 20V4M14 8l4-4 4 4',
'arrow-up-right-from-square': 'M14 4h6v6M20 4 10 14M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6',
'arrow-pointer': 'M5 3l14 8-6 2-2 6z',
'arrow-trend-up': 'M3 17l6-6 4 4 8-8M15 7h6v6',
'location-dot': 'M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
'crosshairs': 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 2v4M12 18v4M2 12h4M18 12h4',
'star': 'M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21 7 14.2l-5-4.9 6.9-1z',
'check': 'M20 6 9 17l-5-5',
'xmark': 'M18 6 6 18M6 6l12 12',
'plus': 'M12 5v14M5 12h14',
'chevron-right': 'M9 6l6 6-6 6',
'chevron-down': 'M6 9l6 6 6-6',
'chevron-up': 'M6 15l6-6 6 6',
'phone': 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
'mobile': 'M7 2h10v20H7zM11 18h2',
'comment': 'M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-5.4A8 8 0 1 1 21 12z',
'facebook-messenger': 'M21 12a9 9 0 0 1-13.3 7.9L3 21l1.2-4.6A9 9 0 1 1 21 12zM7 13.5l3.5-3.5 2 2 3.5-3.5',
'share-nodes': 'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4',
'flag': 'M5 22V4M5 4h12l-2 4 2 4H5',
'eye': 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
'eye-slash': 'M3 3l18 18M10.6 6.1A9.6 9.6 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3 3.5M6.6 6.6A17 17 0 0 0 2 12s4 7 10 7a9.7 9.7 0 0 0 4-.9',
'pen': 'M4 20h4L19 9l-4-4L4 16z',
'trash': 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
'lock': 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
'key': 'M7 20a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM10 13l11-11M17 6l3 3',
'copy': 'M9 9h11v11H9zM5 15H4V4h11v1',
'gift': 'M3 8h18v4H3zM5 12v9h14v-9M12 8v13M12 8c-2 0-4-1-4-3a2 2 0 0 1 4 0zM12 8c2 0 4-1 4-3a2 2 0 0 0-4 0z',
'crown': 'M3 18h18M4 18 3 7l5 4 4-7 4 7 5-4-1 11',
'paper-plane': 'M22 2 11 13M22 2l-7 20-4-9-9-4z',
'floppy-disk': 'M5 3h11l4 4v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM8 3v5h7V3M8 21v-7h8v7',
'spinner': 'M12 3a9 9 0 1 0 9 9',
'rotate-right': 'M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5',
'rotate-left': 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5',
'arrows-rotate': 'M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5',
'play': 'M6 4l14 8-14 8z',
'pause': 'M7 4h3v16H7zM14 4h3v16h-3z',

/* status / info */
'circle-info': RING + 'M12 11v6M12 7.5v.01',
'circle-question': RING + 'M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6M12 17v.01',
'circle-check': RING + 'M8 12l3 3 5-6',
'circle-xmark': RING + 'M9 9l6 6M15 9l-6 6',
'triangle-exclamation': 'M12 3 2 21h20zM12 10v5M12 18v.01',
'ban': RING + 'M5 5l14 14',
'octagon': 'M8 2h8l6 6v8l-6 6H8l-6-6V8z',
'bolt': 'M13 2 4 14h7l-1 8 9-12h-7z',
'clock': RING + 'M12 7v5l3 2',
'hourglass-half': 'M6 3h12M6 21h12M7 3v4l5 5-5 5v4M17 3v4l-5 5 5 5v4',
'calendar-check': 'M4 5h16v16H4zM4 10h16M8 3v4M16 3v4M9 15l2 2 4-4',
'calendar-days': 'M4 5h16v16H4zM4 10h16M8 3v4M16 3v4M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01',
'calendar-xmark': 'M4 5h16v16H4zM4 10h16M8 3v4M16 3v4M10 13l4 4M14 13l-4 4',
'shield': 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
'shield-check': 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4',
'circle': o(12, 12, 7),
'circle-dot': o(12, 12, 9) + o(12, 12, 3),

/* lists / data / admin */
'list': 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
'list-check': 'M9 6h12M9 12h12M9 18h12M3 6l1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17',
'rectangle-list': 'M3 4h18v16H3zM7 9h.01M10 9h7M7 13h.01M10 13h7M7 17h.01M10 17h7',
'rectangle-ad': 'M3 5h18v14H3zM6.5 15l2.5-6 2.5 6M7.5 13h3M14 9v6h1.5a3 3 0 0 0 0-6z',
'window-restore': 'M4 8h12v12H4zM8 8V4h12v12h-4',
'bullhorn': 'M3 11v2a2 2 0 0 0 2 2h1l3.5 5V4L6 9H5a2 2 0 0 0-2 2zM13 8.5v7a4 4 0 0 0 4-1v-5a4 4 0 0 0-4-1z',
'receipt': 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
'file-lines': 'M6 3h8l5 5v13H6zM14 3v5h5M9 13h7M9 17h7',
'file-excel': 'M6 3h8l5 5v13H6zM14 3v5h5M9.5 12l5 6M14.5 12l-5 6',
'file-pen': 'M14 3H6v18h6M14 3l5 5v3M14 3v5h5M14 20l6-6 2 2-6 6h-2z',
'note-sticky': 'M5 3h10l4 4v14H5zM15 3v4h4M8 12h8M8 16h8',
'chart-line': 'M3 3v18h18M7 15l4-4 3 3 6-7',
'chart-bar': 'M4 20V10M10 20V4M16 20v-8M22 20H2',
'qrcode': 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM20 14v7M14 20h3',
'box': 'M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
'sliders': 'M4 6h9M17 6h3M15 4v4M4 12h3M11 12h9M9 10v4M4 18h11M19 18h1M17 16v4',
'headset': 'M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v5H5a1 1 0 0 1-1-1zM20 14h-3v5h2a1 1 0 0 0 1-1zM20 19c0 1.5-2 2-5 2',
'inbox': 'M3 13l3-8h12l3 8v6H3zM3 13h5l1 3h6l1-3h5',
'envelope': 'M3 5h18v14H3zM3 6l9 7 9-7',
'tag': 'M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01',
'store': 'M3 9l1.5-5h15L21 9M3 9c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3M5 12v8h14v-8M10 20v-5h4v5',
'camera': 'M3 8h4l2-3h6l2 3h4v12H3zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
'rocket': 'M5 19c-1 0-2-1-2-2 0-2 2-3 3-3l3 3c0 1-1 3-3 3zM9 15l-3-3 6-8c3-2 7-2 9-2 0 2 0 6-2 9l-8 6zM15 9h.01',
'flask': 'M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2.2h12.4a1.5 1.5 0 0 0 1.3-2.2L14 9V3M7.5 15h9',
'wrench': 'M14.7 6.3a4 4 0 0 0-5 5L3 18l3 3 6.7-6.7a4 4 0 0 0 5-5l-2.7 2.7-2.3-.7-.7-2.3z',

/* browse.html sub-categories */
'snowflake': 'M12 2v20M3.3 7l17.4 10M20.7 7 3.3 17M9 4l3 2 3-2M9 20l3-2 3 2',
'paint-roller': 'M5 3h12a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM18 5h2a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-8v3M10 14h4v7h-4z',
'hammer': 'M14 4l6 6-2.5 2.5-6-6zM12 9 3 18l3 3 9-9',
'door-closed': 'M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M4 21h16M15 12h.01',
'fire': 'M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z',
'broom': 'M14 3l7 7M13 7l4 4-6 6H5v-6zM5 17l-2 4h5',
'gauge': 'M4 18a9 9 0 1 1 16 0M12 14l4-5M12 14h.01',
'car': 'M4 16v-4l2-5h12l2 5v4zM4 16v3M20 16v3M7 12h10',
'car-battery': 'M3 8h18v12H3zM7 8V5h3v3M14 8V5h3v3M7 14h4M15 14h4M17 12v4',
'soap': 'M5 12h14v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1zM7 12V9a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v3M9 5h.01M13 4h.01M16 6h.01',
'truck': 'M2 6h11v10H2zM13 9h5l3 3v4h-8' + o(6.5, 18, 2) + o(17.5, 18, 2),
'scissors': 'M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.1 7.9 20 20M8.1 16.1 20 4',
'tree': 'M12 22v-6M12 16c-4 0-7-3-7-6 0-2 1-3 2-4 0-2 2-4 5-4s5 2 5 4c1 1 2 2 2 4 0 3-3 6-7 6z',
'seedling': 'M12 21v-9M12 12C12 7 8 5 4 5c0 4 3 7 8 7zM12 14c0-4 3-6 8-6 0 4-3 6-8 6z',
'leaf': 'M5 19C5 10 11 4 20 4c0 9-6 15-15 15zM5 19l8-8',
'bug': 'M12 8a4 4 0 0 1 4 4v3a4 4 0 0 1-8 0v-3a4 4 0 0 1 4-4zM9 5l1.5 2M15 5l-1.5 2M4 12h4M16 12h4M4 18l4-2M20 18l-4-2M4 6l4 3M20 6l-4 3',
'droplet': 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
'water': 'M2 8c3-3 5 3 8 0s5 3 8 0 3 0 4 0M2 15c3-3 5 3 8 0s5 3 8 0 3 0 4 0',
'plug': 'M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4',
'solar-panel': 'M3 8h18l-2 9H5zM9 8l-1 9M15 8l1 9M4 12.5h16M12 17v4M8 21h8',
'lightbulb': 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z',
'video': 'M2 6h14v12H2zM16 10l6-3v10l-6-3z',
'wifi': 'M2 9a15 15 0 0 1 20 0M5 12.5a10.5 10.5 0 0 1 14 0M8.5 16a5.5 5.5 0 0 1 7 0M12 19.5h.01',
'hand': 'M8 12V5a1.5 1.5 0 0 1 3 0v6M11 11V4a1.5 1.5 0 0 1 3 0v7M14 11V6a1.5 1.5 0 0 1 3 0v8c0 4-2 7-6 7-3 0-5-2-6-5l-1-4a1.5 1.5 0 0 1 3 0z',
'spa': 'M12 21c-4 0-7-3-7-7 4 0 7 2 7 7zM12 21c4 0 7-3 7-7-4 0-7 2-7 7zM12 14c-2-2-2-6 0-9 2 3 2 7 0 9z',
'person-walking': 'M14 4h.01M11 8l-3 4M11 8l4 2 2 3M11 8l1 6-3 7M12 14l3 3 1 4',
'person-dancing': 'M12 4h.01M12 8v6M12 8l-5 3M12 8l5-3M12 14l-3 7M12 14l4 7',
'dumbbell': 'M6 8v8M3 10v4M18 8v8M21 10v4M6 12h12',
'brush': 'M18 3l3 3-9 9-3-3zM9 12c-3 0-4 2-4 4s-1 3-2 4c3 1 8 0 8-4',
'book': 'M4 5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2zM4 21V5M8 7h8',
'language': 'M4 5h10M9 3v2M6 5c1 4 4 7 8 8M12 5c-1 4-4 7-8 8M13 21l4-10 4 10M14.5 17.5h5',
'music': 'M9 18V5l11-2v13' + o(6, 18, 3) + o(17, 16, 3),
'laptop': 'M4 5h16v11H4zM2 20h20',
'computer': 'M3 4h18v12H3zM8 21h8M12 16v5',
'palette': 'M12 3a9 9 0 1 0 0 18c1.5 0 2-1 1.5-2-.6-1.2.2-2.5 1.5-2.5H17a4 4 0 0 0 4-4C21 6.5 17 3 12 3zM7.5 11h.01M10 7h.01M15 7h.01',
'syringe': 'M18 3l3 3M16 5l3 3M14 7l-9 9v3h3l9-9M14 7l3 3M9 12l3 3M3 21l3-3',
'wheelchair': 'M9 4h.01M10 7v6h5l3 6M10 10h4M7 11a5 5 0 1 0 6 7',
'baby': o(12, 9, 5) + 'M10 8.5h.01M14 8.5h.01M10.5 12c.8.6 2.2.6 3 0M5 21a7 7 0 0 1 14 0',
'pills': 'M10.5 20.5a4.9 4.9 0 0 1-7-7l10-10a4.9 4.9 0 0 1 7 7zM8.5 8.5l7 7',
'tooth': 'M7 3c-2 0-3 1.5-3 4 0 5 2 6 2 10 0 2 1 4 2 4s1-5 2-5h2c1 0 1 5 2 5s2-2 2-4c0-4 2-5 2-10 0-2.5-1-4-3-4-2 0-3 1-4 1S9 3 7 3z',
'print': 'M7 8V3h10v5M7 17H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-3M7 14h10v7H7z',
'database': 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6',
'ruler': 'M3 17 17 3l4 4L7 21zM8 12l2 2M11 9l2 2M14 6l2 2',
'drafting-compass': 'M12 3v3M12 6l-6 15M12 6l6 15M8 15h8',
'road': 'M8 3 4 21M16 3l4 18M12 4v3M12 10v4M12 17v3',
'building': 'M5 21V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v17M15 9h4a1 1 0 0 1 1 1v11M3 21h18M9 7h2M9 11h2M9 15h2',
'couch': 'M5 11V8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3M3 13a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v5H3zM6 18v2M18 18v2',
'shirt': 'M8 3 3 6l2 4 3-1v12h8V9l3 1 2-4-5-3a4 4 0 0 1-8 0z',
'paw': 'M7 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM10 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM14 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM12 12c-3 0-6 3-6 6 0 2 2 2 6 2s6 0 6-2c0-3-3-6-6-6z',
'stethoscope': 'M6 3v6a4 4 0 0 0 8 0V3M10 13v2a5 5 0 0 0 10 0v-2M20 11a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
'dog': 'M4 10l2-5 3 2h6l3-2 2 5v4a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM9 12h.01M15 12h.01M11 15h2',
'utensils': 'M7 3v6a2 2 0 0 0 4 0V3M9 3v18M17 21V3c-2 1-3 4-3 8h3',
'tent': 'M2 20 12 4l10 16zM12 12v8',
'cake-candles': 'M4 21h16v-7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2zM4 17c2 1.5 4 1.5 6 0s4-1.5 6 0c1 .8 2.5 .8 4 0M12 12V8M12 5h.01',

/* emoji replacements (see fx-boot.js) */
'credit-card': 'M2 6h20v12H2zM2 10h20M6 15h4',
'party-horn': 'M4 20l4-12 8 8zM14 4v2M19 9h2M18 5l1.5-1.5M10 4l.5 1.5',
'trophy': 'M8 4h8v6a4 4 0 0 1-8 0zM8 6H4v2a3 3 0 0 0 4 3M16 6h4v2a3 3 0 0 1-4 3M12 14v4M8 21h8M10 18h4',
'folder': 'M3 6h6l2 2h10v12H3z',
'face-frown': RING + 'M8 16c1-1.5 2.5-2 4-2s3 .5 4 2M9 9.5h.01M15 9.5h.01',
'helmet-safety': 'M4 17a8 8 0 0 1 16 0zM3 17h18v3H3zM12 6v5',
'id-card': 'M3 5h18v14H3zM13 9h5M13 13h5M5 16c.5-2 3.5-2 4 0',
'image': 'M3 4h18v16H3zM3 16l5-5 5 5 3-3 5 5M9 9h.01',
'globe': 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2c3 3 3 17 0 20M12 2c-3 3-3 17 0 20',
'coins': RING + 'M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.5 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1 2-2.5 2c-1 0-2-.5-2.5-1.5M12 6v2M12 16v2',
'sparkles': 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z',
'link': 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
'infinity': 'M12 12c-2-3-3-4-5-4a4 4 0 0 0 0 8c2 0 3-1 5-4s3-4 5-4a4 4 0 0 1 0 8c-2 0-3-1-5-4z',
};

/* ── aliases: several FA names share one drawing ─────────────────────── */
const AL = {
  'home': 'house', 'grid-2': 'border-all', 'bookmark-slash': 'bookmark', 'map-marker-alt': 'location-dot',
  'phone-volume': 'phone', 'comment-sms': 'comment', 'flag-checkered': 'flag', 'check-circle': 'circle-check',
  'shield-halved': 'shield', 'boxes-stacked': 'box', 'rotate': 'rotate-right', 'pen-to-square': 'pen',
  'pencil': 'pen', 'desktop': 'computer', 'screwdriver-wrench': 'wrench', 'hands-helping': 'hand',
  'hand-sparkles': 'hand',
};
const FILLED = ['circle'];                 // always drawn solid
const SOLID_ONLY = ['star', 'bookmark'];   // solid only when used as .fa-solid (outline otherwise)

/* ── css output ──────────────────────────────────────────────────────── */
const svg = (d, fill) => `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='${fill ? '%23000' : 'none'}' stroke='%23000' stroke-width='${fill ? 1.5 : 2}' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='${d}'/%3E%3C/svg%3E")`;
const draw = k => svg(P[k], FILLED.includes(k));

let css = `/* generated by scripts/build-icons.js — do not edit by hand */
.fa-solid,.fa-regular,.fa-brands{--ic:${svg(P.dot)};display:inline-block;width:1em;height:1em;vertical-align:-.125em;background-color:currentColor;-webkit-mask:var(--ic) center/contain no-repeat;mask:var(--ic) center/contain no-repeat;font-style:normal;flex-shrink:0}
.fa-spin{animation:fxspin .8s linear infinite}@keyframes fxspin{to{transform:rotate(360deg)}}
.fa-fw{width:1.25em}
/* emoji replaced by fx-boot.js become <i class="fa-solid fa-xxx fxi fxi-color"> */
.fxi{width:1.1em;height:1.1em;vertical-align:-.18em}
.fxi-amber{color:#F59E0B}.fxi-green{color:#10B981}.fxi-red{color:#DC3545}.fxi-blue{color:#3B82F6}.fxi-orange{color:#FF5A1F}.fxi-purple{color:#7C3AED}
`;
const groups = {};
for (const k of Object.keys(P)) if (k !== 'dot') groups[k] = ['fa-' + k];
for (const [a, t] of Object.entries(AL)) groups[t].push('fa-' + a);
for (const [k, names] of Object.entries(groups)) css += `.${names.join(',.')}{--ic:${draw(k)}}\n`;
css += SOLID_ONLY.map(k => `.fa-solid.fa-${k}`).join(',') + `{--ic:__}\n`; // placeholder, replaced below
css = css.replace(/^\.fa-solid\.fa-star,\.fa-solid\.fa-bookmark\{--ic:__\}\n/m,
  SOLID_ONLY.map(k => `.fa-solid.fa-${k}{--ic:${svg(P[k], true)}}\n`).join(''));

fs.mkdirSync('css', { recursive: true });
fs.writeFileSync('css/icons.css', css);

/* ── safety net: find fa-* classes used in the app that have no icon ─── */
const defined = new Set([...Object.keys(P), ...Object.keys(AL)]);
const IGN = new Set(['solid', 'regular', 'brands', 'spin', 'fw', 'lg', 'xs', 'sm', '2x', '3x']);
const walk = d => !fs.existsSync(d) ? [] : fs.readdirSync(d, { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const used = new Map();
for (const f of [...walk('public'), ...walk('js')].filter(f => /\.(html|js)$/.test(f))) {
  const s = fs.readFileSync(f, 'utf8'); const rx = /\bfa-([a-z0-9]+(?:-[a-z0-9]+)*)/g; let m;
  while ((m = rx.exec(s))) { if (IGN.has(m[1])) continue; if (!used.has(m[1])) used.set(m[1], new Set()); used.get(m[1]).add(path.basename(f)); }
}
const missing = [...used.keys()].filter(k => !defined.has(k));
const unused = [...defined].filter(k => !used.has(k));
console.log(`icons: ${Object.keys(P).length - 1} drawings, ${Object.keys(AL).length} aliases -> css/icons.css`);
if (used.size) {
  if (missing.length) { console.log('\nMISSING (these render as a dot):'); missing.forEach(k => console.log('  fa-' + k, '  in', [...used.get(k)].join(', '))); }
  else console.log('OK: every fa-* class used in public/ and js/ has an icon.');
  if (unused.length) console.log('\nDefined but not referenced (safe to delete from P if you want a smaller file):\n  ' + unused.join(', '));
}
