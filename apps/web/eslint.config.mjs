import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

/**
 * ESLint, flat config.
 *
 * `next lint` was removed in Next 16, and the `lint` script had been pointing
 * at it with no ESLint config and no ESLint installed — so it failed on every
 * invocation with "Invalid project directory provided, no such directory:
 * apps/web/lint". A check that cannot run is worse than no check: it teaches
 * whoever hits it that the lint step is broken rather than that their code is.
 *
 * eslint-config-next 16 ships flat configs directly, so they are imported
 * rather than passed through FlatCompat — the compat shim cannot serialise the
 * React plugin's self-referencing config object and dies on a circular
 * structure before it lints anything.
 *
 * `core-web-vitals` is the ruleset Next ships for apps that care about the
 * metrics Google actually measures — unoptimised images, blocking scripts,
 * missing font display strategies. On a product sold on search visibility that
 * is the right set to be held to.
 */
const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      // Written by `npm run bundle` from the templates; linting generated
      // output only ever reports on the generator.
      "src/generated/**",
    ],
  },
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      /*
       * The React-compiler-era hook rules, as warnings rather than errors.
       *
       * Every one of them currently fires on code that is correct, and each
       * for the same underlying reason — the rules assume a client component
       * re-rendering, and these call sites are neither:
       *
       *   set-state-in-effect  Reading localStorage or starting an
       *     IntersectionObserver on mount. A browser-only value cannot be read
       *     during render without breaking hydration, so setting it from an
       *     effect is the correct pattern, not a workaround for one.
       *
       *   purity  `Date.now()` inside `dashboard/usage/page.tsx`, which is an
       *     async server component. It renders once, per request, on the
       *     server. There is no re-render for an unstable value to disagree
       *     with.
       *
       *   refs / immutability  Assigning `window.location.href` to send the
       *     customer to checkout. Navigating the browser is the entire point
       *     of the call; there is no React state that could express it.
       *
       * Warnings rather than `off` on purpose. These rules do catch real bugs
       * in ordinary client components, and silencing them repo-wide would mean
       * never hearing about those. Left visible, so a genuine one stands out
       * against a known and explained baseline — and if a fix lands upstream
       * that narrows them, the noise disappears on its own.
       */
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
    },
  },
];

export default config;
