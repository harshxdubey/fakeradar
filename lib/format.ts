import type { SellerRisk, VerdictLabel } from "./types";

export const inr = (n: number) =>
  "₹" + Math.round(n).toLocaleString("en-IN");

export const LABELS: Record<VerdictLabel, { text: string; className: string }> = {
  counterfeit: { text: "Counterfeit", className: "bg-red-50 text-red-700 ring-red-200" },
  copycat: { text: "Copycat", className: "bg-amber-50 text-amber-800 ring-amber-200" },
  possible_genuine_reseller: {
    text: "Possible genuine reseller",
    className: "bg-sky-50 text-sky-700 ring-sky-200",
  },
  unrelated: { text: "Unrelated", className: "bg-slate-100 text-slate-600 ring-slate-200" },
};

export const RISK: Record<SellerRisk, { text: string; className: string }> = {
  high: { text: "High", className: "text-red-700" },
  medium: { text: "Med", className: "text-amber-700" },
  low: { text: "Low", className: "text-emerald-700" },
};

export const VIOLATION_TYPE: Record<VerdictLabel, string> = {
  counterfeit: "Counterfeit — product is a fake of my trademarked brand",
  copycat: "Copyright / trademark — listing copies my images, design or brand",
  possible_genuine_reseller: "Needs verification — possible unauthorised reseller",
  unrelated: "Not applicable",
};
