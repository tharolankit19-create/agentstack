/**
 * Real testimonials only.
 *
 * This file ships empty on purpose, and the testimonials section renders
 * nothing while it is empty. Do not seed it with plausible-sounding names —
 * an invented quote is a lie printed next to a Buy button, and the first
 * customer who checks the handle will say so publicly.
 *
 * Before launch: give the product to five people, ask what changed for them,
 * and paste what they actually said. Their words will beat anything written
 * here anyway — customers describe a product better than its founder does.
 *
 * Add entries like this, with the person's real permission:
 *
 *   {
 *     quote: "Woke up to 5 drafts. Posted 3 of them before coffee.",
 *     name:  "Jane Doe",
 *     handle: "janedoe",              // X handle, no @, optional
 *     role:  "Founder, Something.io", // optional
 *     avatarUrl: "https://…",         // optional
 *   }
 */

export interface Testimonial {
  quote: string;
  name: string;
  handle?: string;
  role?: string;
  avatarUrl?: string;
}

export const TESTIMONIALS: Testimonial[] = [];
