/** Server-owned rollout flags; changing pricing never rewrites legacy entitlements. */
export function jobFlags() {
  return {
    jobs: process.env.KRYX_V2_JOBS === "true",
    verification: process.env.KRYX_VERIFICATION === "true",
    refunds: process.env.KRYX_FAILURE_REFUNDS === "true",
    watch: process.env.KRYX_BROWSER_WATCH === "true",
    landing: process.env.KRYX_NEW_LANDING === "true",
  };
}
