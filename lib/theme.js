export const COLORS = {
  green: "#174A3A",
  greenLight: "#1F5C48",
  gold: "#D4A72C",
  silver: "#D9DEE1",
  bg: "#F6F7F5",
  text: "#263238",
  grey: "#68747A",
  red: "#B94A48",
  band: "#F3F5F6",
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
