const DOT_PALETTE = [
  "var(--dot-blue)",
  "var(--dot-green)",
  "var(--dot-yellow)",
  "var(--dot-pink)",
  "var(--dot-indigo)",
  "var(--dot-orange)",
  "var(--dot-emerald)",
  "var(--dot-purple)",
  "var(--dot-red)",
  "var(--dot-teal)",
  "var(--dot-sky)",
  "var(--dot-fuchsia)",
  "var(--dot-stone)",
  "var(--dot-amber)",
  "var(--dot-lime)",
  "var(--dot-cyan)",
];

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getColorForValue(value) {
  if (!value) return null;
  const str = String(value).trim();
  if (!str || str === "-") return null;
  const index = hashString(str) % DOT_PALETTE.length;
  return DOT_PALETTE[index];
}
