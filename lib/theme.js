export const COLORS = {
  bg: "#0A1A1A",
  panel: "#132424",
  panelLight: "#1A2F2F",
  gold: "#D4AF37",
  goldDark: "#B8952E",
  text: "#E5E7EB",
  textDim: "#8A9A9A",
  border: "#1F2937",
  red: "#E05C5C",
  green: "#3EBD8C",
};

export function money(n) {
  const v = Number(n) || 0;
  return v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + " ريال";
}

export function num(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

export function fmtDate(d) {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleDateString("en-GB");
}
