import type { Marketplace, SellerRisk, VerdictLabel } from "./types";

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

export const MARKETS: Record<Marketplace, { label: string; idName: string; reportVia: string; className: string }> = {
  amazon_in: {
    label: "Amazon.in",
    idName: "ASIN",
    reportVia: "Amazon's Report a Violation form (Brand Registry)",
    className: "bg-orange-50 text-orange-800 ring-orange-200",
  },
  flipkart: {
    label: "Flipkart",
    idName: "Product ID (PID)",
    reportVia: "Flipkart's intellectual property / brand protection complaint process",
    className: "bg-blue-50 text-blue-800 ring-blue-200",
  },
  myntra: {
    label: "Myntra",
    idName: "Style ID",
    reportVia: "Myntra's intellectual property grievance process",
    className: "bg-pink-50 text-pink-800 ring-pink-200",
  },
  meesho: { label: "Meesho", idName: "Product ID", reportVia: "Meesho's IP complaint process", className: "bg-purple-50 text-purple-800 ring-purple-200" },
};

export const market = (m?: Marketplace) => MARKETS[m ?? "amazon_in"] ?? MARKETS.amazon_in;
