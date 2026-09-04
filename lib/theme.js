export const COLORS = {
  bg: "#0A1A1A",
  panel: "#132424",
  panelLight: "#1A2F2F",
  gold: "#D4AF37",
  goldDark: "#B8952E",
  goldSoft: "rgba(212,175,55,0.12)",
  text: "#E5E7EB",
  textDim: "#8A9A9A",
  border: "#1F2937",
  red: "#E05C5C",
  green: "#3EBD8C",
  gradGold: "linear-gradient(135deg, #E9C458 0%, #D4AF37 55%, #B8952E 100%)",
  gradPanel: "linear-gradient(180deg, #16302E 0%, #0F2321 100%)",
  chatUserBubble: "linear-gradient(135deg, #1F5C48 0%, #174A3A 100%)",
  chatBotBubble: "#182F2E",
  shadowGold: "0 6px 22px rgba(212,175,55,0.25)",
  shadowSoft: "0 4px 18px rgba(0,0,0,0.35)",
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

export function fmtDateTime(d) {
  if (!d) return "—";
  const date = new Date(d);
  const datePart = date.toLocaleDateString("en-GB");
  const timePart = date.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", hour12: true });
  return { date: datePart, time: timePart };
}
