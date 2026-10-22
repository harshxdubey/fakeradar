// Generated SVG product shots for demo data, so mock mode needs no external images.

export interface ShotSpec {
  brand: string;
  tagline?: string;
  body?: string;
  label?: string;
  cap?: string;
  ink?: string;
  /** Lower-quality look for re-photographed / edited copies. */
  faded?: boolean;
  sticker?: string;
  shape?: "bottle" | "box";
  background?: string;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function productShot(spec: ShotSpec): string {
  const {
    brand,
    tagline = "",
    body = "#2f6f4f",
    label = "#f4efe6",
    cap = "#c8a97e",
    ink = "#1f3d2c",
    faded = false,
    sticker,
    shape = "bottle",
    background = "#f6f7f9",
  } = spec;
  const filter = faded ? `filter="url(#f)"` : "";
  const fontSize = Math.max(16, Math.min(30, Math.floor(260 / Math.max(brand.length, 6))));

  const item =
    shape === "bottle"
      ? `<rect x="168" y="38" width="64" height="40" rx="10" fill="${cap}"/>
         <rect x="176" y="70" width="48" height="18" fill="${body}" opacity=".85"/>
         <rect x="128" y="84" width="144" height="276" rx="34" fill="${body}"/>
         <rect x="128" y="168" width="144" height="104" fill="${label}"/>
         <text x="200" y="${214 + fontSize / 3}" font-family="Helvetica,Arial,sans-serif" font-weight="700" font-size="${fontSize}" fill="${ink}" text-anchor="middle">${esc(brand)}</text>
         <text x="200" y="252" font-family="Helvetica,Arial,sans-serif" font-size="11" fill="${ink}" text-anchor="middle">${esc(tagline)}</text>
         <rect x="140" y="96" width="14" height="250" rx="7" fill="#fff" opacity=".18"/>`
      : `<rect x="100" y="80" width="200" height="250" rx="12" fill="${body}"/>
         <rect x="100" y="160" width="200" height="96" fill="${label}"/>
         <text x="200" y="${206 + fontSize / 3}" font-family="Helvetica,Arial,sans-serif" font-weight="700" font-size="${fontSize}" fill="${ink}" text-anchor="middle">${esc(brand)}</text>
         <text x="200" y="242" font-family="Helvetica,Arial,sans-serif" font-size="11" fill="${ink}" text-anchor="middle">${esc(tagline)}</text>
         <polygon points="100,80 140,50 340,50 300,80" fill="${cap}"/>
         <polygon points="300,80 340,50 340,300 300,330" fill="${body}" opacity=".75"/>`;

  const stickerSvg = sticker
    ? `<g transform="rotate(-12 318 92)"><circle cx="318" cy="92" r="44" fill="#e11d48"/>
       <text x="318" y="98" font-family="Helvetica,Arial,sans-serif" font-weight="800" font-size="15" fill="#fff" text-anchor="middle">${esc(sticker)}</text></g>`
    : "";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
    <defs><filter id="f"><feGaussianBlur stdDeviation="1.4"/><feColorMatrix type="saturate" values=".55"/></filter></defs>
    <rect width="400" height="400" fill="${background}"/>
    <ellipse cx="200" cy="368" rx="96" ry="10" fill="#000" opacity=".08"/>
    <g ${filter}>${item}</g>${stickerSvg}</svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

export interface BagSpec {
  brand: string;
  /** Leather colour; the fake is a shade off. */
  leather?: string;
  flap?: string;
  hardware?: string;
  /** Uneven stitching and a slightly skewed plate, as on a cheap copy. */
  sloppy?: boolean;
  sticker?: string;
  background?: string;
}

/** A structured top-handle luxury bag, drawn in SVG (used on the home page comparison). */
export function bagShot(spec: BagSpec): string {
  const {
    brand,
    leather = "#7a4a2e",
    flap = "#5e3620",
    hardware = "#d4af5a",
    sloppy = false,
    sticker,
    background = "#f5f5f7",
  } = spec;
  const stitch = sloppy ? "5 9 2 7" : "6 6";
  const plateTilt = sloppy ? "rotate(-3 200 236)" : "";
  const sticky = sticker
    ? `<g transform="rotate(-12 322 92)"><circle cx="322" cy="92" r="46" fill="#e11d48"/>
       <text x="322" y="99" font-family="Helvetica,Arial,sans-serif" font-weight="800" font-size="17" fill="#fff" text-anchor="middle">${esc(sticker)}</text></g>`
    : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
    <defs>
      <linearGradient id="leather" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${leather}"/><stop offset="1" stop-color="${flap}"/>
      </linearGradient>
      <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#f3dc95"/><stop offset="0.5" stop-color="${hardware}"/><stop offset="1" stop-color="#a8812e"/>
      </linearGradient>
    </defs>
    <rect width="400" height="400" fill="${background}"/>
    <ellipse cx="200" cy="338" rx="130" ry="12" fill="#000" opacity=".08"/>
    <path d="M138 138 C138 64 262 64 262 138" fill="none" stroke="${flap}" stroke-width="14" stroke-linecap="round"/>
    <rect x="126" y="128" width="20" height="18" rx="4" fill="url(#gold)"/>
    <rect x="254" y="128" width="20" height="18" rx="4" fill="url(#gold)"/>
    <path d="M86 150 Q86 138 98 138 H302 Q314 138 314 150 L328 314 Q330 330 314 330 H86 Q70 330 72 314 Z" fill="url(#leather)"/>
    <path d="M96 156 H304 L316 312 H84 Z" fill="none" stroke="#f1d9b5" stroke-opacity=".55" stroke-width="2" stroke-dasharray="${stitch}"/>
    <path d="M86 150 Q86 138 98 138 H302 Q314 138 314 150 L318 214 Q200 252 82 214 Z" fill="${flap}"/>
    <path d="M94 154 H306 L310 208 Q200 242 90 208 Z" fill="none" stroke="#f1d9b5" stroke-opacity=".5" stroke-width="2" stroke-dasharray="${stitch}"/>
    <g transform="${plateTilt}">
      <rect x="136" y="220" width="128" height="34" rx="6" fill="url(#gold)"/>
      <text x="200" y="242" font-family="Georgia,'Times New Roman',serif" font-size="13" letter-spacing="2" fill="#4a3412" text-anchor="middle">${esc(brand.toUpperCase())}</text>
    </g>
    <circle cx="200" cy="270" r="7" fill="url(#gold)"/>
    ${sticky}</svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}
