// Template takedown draft: used in mock mode and as a fallback if the AI call fails.
// Uses only stored listing fields + AI evidence, same constraint as the AI prompt.
import { inr, VIOLATION_TYPE } from "./format";
import type { Listing, Product, Verdict } from "./types";

export const TRADEMARK_PLACEHOLDER = "[TRADEMARK NUMBER]";

export function takedownData(product: Pick<Product, "brand" | "name">, listing: Listing, verdict: Verdict) {
  return {
    brand: product.brand,
    product: product.name,
    trademark_number: TRADEMARK_PLACEHOLDER,
    listing_url: listing.url,
    asin: listing.asin,
    seller: listing.seller,
    listing_title: listing.title,
    listing_price: inr(listing.price),
    violation_type: VIOLATION_TYPE[verdict.label],
    evidence: verdict.evidence,
  };
}

export function draftTakedownTemplate(product: Pick<Product, "brand" | "name">, listing: Listing, verdict: Verdict) {
  const isCopycat = verdict.label === "copycat";
  return [
    `Subject: ${isCopycat ? "Copied design and listing content" : "Counterfeit"} of ${product.brand} ${product.name} — ASIN ${listing.asin}`,
    "",
    "Listing details",
    `- URL: ${listing.url}`,
    `- ASIN: ${listing.asin}`,
    `- Seller: ${listing.seller}`,
    `- Price: ${inr(listing.price)}`,
    "",
    `Violation type: ${VIOLATION_TYPE[verdict.label]}`,
    "",
    "Description",
    isCopycat
      ? `I am the owner of the ${product.brand} brand (trademark ${TRADEMARK_PLACEHOLDER}). This listing, "${listing.title}", copies the design and listing content of my product "${product.name}". I have reviewed the listing and confirm it is not associated with my brand.`
      : `I am the owner of the ${product.brand} brand (trademark ${TRADEMARK_PLACEHOLDER}). This listing, "${listing.title}", is offered as or resembles my product "${product.name}", but it is not sold or authorised by me. I have reviewed the listing and believe the product is counterfeit.`,
    "",
    "Evidence",
    ...verdict.evidence.map((e) => `- ${e}`),
    "",
    "Request",
    "Please review this listing and remove it from Amazon.in.",
  ].join("\n");
}
