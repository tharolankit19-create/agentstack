import { PLANS } from "@/lib/plans";
import { SIGNUP_CREDITS, MIN_TOPUP_USD } from "@/lib/credits-public";
// Packaging is data; billing IDs, prices and subscription truth remain owned by Dodo.
export const workspacePackaging = {
  trial: {
    name: "Explore",
    signupCredits: SIGNUP_CREDITS,
    computer: "limited",
  },
  payg: { name: "Work capacity", minimumTopupUsd: MIN_TOPUP_USD },
  subscriptions: Object.values(PLANS).map((p) => ({
    billingTier: p.tier,
    name: p.tier === "starter" ? "Builder" : p.tier === "pro" ? "Pro" : "Scale",
    priceUsd: p.priceUsd,
    productId: p.productId,
    legacy: true,
  })),
};
