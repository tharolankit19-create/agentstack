/**
 * The free option, named honestly.
 *
 * Telling someone to cancel a tool without saying what else exists is a sales
 * pitch with a gap in it. So each page names the genuinely free way to do the
 * same job — usually something open-source you host yourself, sometimes a free
 * tier that is actually usable — and says what it costs you instead, because
 * "free" software is paid for in evenings.
 *
 * Two rules kept this from turning into filler:
 *
 *   1. **Curated, not generated.** There are 800+ tools in the directory and
 *      most of them have no honest free equivalent. Inventing one for every
 *      row would be the exact thing that makes a directory worthless. Where we
 *      have nothing real to name, the section does not render.
 *   2. **Every entry is a thing you can go and use today.** Named product,
 *      real domain, and a note about the catch.
 *
 * The agent still matters after this list, and the page says so plainly:
 * swapping a paid tool for a free one you have to run yourself does not do the
 * work either. Nobody's queue was empty because the scheduler cost money.
 */

export interface FreeAlternative {
  name: string;
  domain: string;
  /**
   * `open-source` — you can run it yourself for nothing, forever, and the
   * price is your time. `free-tier` — a hosted product with a plan that costs
   * nothing and a ceiling you will eventually hit.
   */
  kind: "open-source" | "free-tier";
  /** The catch, in one line. Always present — a free tool with no catch is a lie. */
  note: string;
}

/**
 * The pool.
 *
 * Defined once and referenced by slug below, because roughly twenty scheduling
 * tools share the same honest answer and repeating it twenty times is how a
 * data file rots out of sync with itself.
 */
const ALT = {
  /* ---- content, social, email ---- */
  postiz: {
    name: "Postiz",
    domain: "postiz.com",
    kind: "open-source",
    note: "Self-host it and social scheduling costs nothing. You still write every post.",
  },
  mixpost: {
    name: "Mixpost",
    domain: "mixpost.app",
    kind: "open-source",
    note: "Runs on your own server. One-time licence for the pro build, no monthly fee.",
  },
  listmonk: {
    name: "Listmonk",
    domain: "listmonk.app",
    kind: "open-source",
    note: "Handles lists and sending; you bring an SMTP provider and own the deliverability.",
  },
  ghost: {
    name: "Ghost (self-hosted)",
    domain: "ghost.org",
    kind: "open-source",
    note: "Free if you run it. The hosted version is the thing you were paying for.",
  },
  languagetool: {
    name: "LanguageTool",
    domain: "languagetool.org",
    kind: "open-source",
    note: "Grammar and style, self-hostable. Weaker at rewriting than the paid AI tools.",
  },

  /* ---- SEO and marketing ---- */
  searchConsole: {
    name: "Google Search Console",
    domain: "search.google.com",
    kind: "free-tier",
    note: "Real queries, real positions, for your own site only — no competitor data.",
  },
  bingWebmaster: {
    name: "Bing Webmaster Tools",
    domain: "bing.com",
    kind: "free-tier",
    note: "Includes keyword research Google's console does not. Smaller index.",
  },
  lighthouse: {
    name: "Lighthouse / PageSpeed",
    domain: "pagespeed.web.dev",
    kind: "free-tier",
    note: "Technical audit of one page at a time. No crawl, no rank tracking.",
  },

  /* ---- analytics ---- */
  umami: {
    name: "Umami",
    domain: "umami.is",
    kind: "open-source",
    note: "Privacy-friendly web analytics you host. Free tier on their cloud too.",
  },
  plausibleCe: {
    name: "Plausible CE",
    domain: "plausible.io",
    kind: "open-source",
    note: "The same product, self-hosted, under AGPL. You run the database.",
  },
  matomo: {
    name: "Matomo (self-hosted)",
    domain: "matomo.org",
    kind: "open-source",
    note: "Full-fat analytics on your own box. Heavier to run than the small ones.",
  },
  posthogFree: {
    name: "PostHog",
    domain: "posthog.com",
    kind: "free-tier",
    note: "Generous free tier, and open-source if you outgrow it. Steeper to learn.",
  },
  openreplay: {
    name: "OpenReplay",
    domain: "openreplay.com",
    kind: "open-source",
    note: "Session replay you host yourself. Storage is on you, and it adds up.",
  },
  dub: {
    name: "Dub",
    domain: "dub.co",
    kind: "open-source",
    note: "Link shortening and click analytics, self-hostable, with a free tier.",
  },

  /* ---- CRM and sales ---- */
  twenty: {
    name: "Twenty",
    domain: "twenty.com",
    kind: "open-source",
    note: "Modern open-source CRM. Younger than the paid ones — fewer integrations.",
  },
  espocrm: {
    name: "EspoCRM",
    domain: "espocrm.com",
    kind: "open-source",
    note: "Mature, self-hosted, and looks it. Does the job without charging per seat.",
  },
  hunterFree: {
    name: "Hunter free tier",
    domain: "hunter.io",
    kind: "free-tier",
    note: "25 searches a month. Fine for founder-led sales, not for a pipeline.",
  },

  /* ---- support ---- */
  chatwoot: {
    name: "Chatwoot",
    domain: "chatwoot.com",
    kind: "open-source",
    note: "Live chat and shared inbox, self-hosted. The closest free thing to Intercom.",
  },
  freescout: {
    name: "FreeScout",
    domain: "freescout.net",
    kind: "open-source",
    note: "Help Scout's shape, self-hosted, PHP. Modules cost a one-off fee.",
  },
  fider: {
    name: "Fider",
    domain: "fider.io",
    kind: "open-source",
    note: "Public feedback board with voting. Small, focused, and free to run.",
  },

  /* ---- docs, notes, PDFs ---- */
  outline: {
    name: "Outline",
    domain: "getoutline.com",
    kind: "open-source",
    note: "Team wiki you host. Needs S3-compatible storage and an auth provider.",
  },
  appflowy: {
    name: "AppFlowy",
    domain: "appflowy.io",
    kind: "open-source",
    note: "Notion-shaped, local-first, open-source. Sync is the rough edge.",
  },
  logseq: {
    name: "Logseq",
    domain: "logseq.com",
    kind: "open-source",
    note: "Outliner with backlinks, files on your disk. You arrange your own sync.",
  },
  joplin: {
    name: "Joplin",
    domain: "joplinapp.org",
    kind: "open-source",
    note: "Notes with end-to-end encrypted sync to storage you already pay for.",
  },
  obsidianFree: {
    name: "Obsidian + Git",
    domain: "obsidian.md",
    kind: "free-tier",
    note: "The app is free; a git repo replaces the paid sync for a bit of setup.",
  },
  documenso: {
    name: "Documenso",
    domain: "documenso.com",
    kind: "open-source",
    note: "Open-source e-signing. Check it meets your jurisdiction before you rely on it.",
  },
  stirlingPdf: {
    name: "Stirling PDF",
    domain: "stirlingpdf.com",
    kind: "open-source",
    note: "Merge, split, sign, OCR — a whole PDF suite in one container.",
  },

  /* ---- project management, tasks, scheduling ---- */
  plane: {
    name: "Plane",
    domain: "plane.so",
    kind: "open-source",
    note: "Issues, cycles and roadmaps, self-hosted. Linear's shape without the seat price.",
  },
  vikunja: {
    name: "Vikunja",
    domain: "vikunja.io",
    kind: "open-source",
    note: "Tasks, lists, kanban and Gantt. Lightweight to run.",
  },
  focalboard: {
    name: "Focalboard",
    domain: "focalboard.com",
    kind: "open-source",
    note: "Boards and cards, self-hosted. Development is quiet these days.",
  },
  calcom: {
    name: "Cal.com (self-hosted)",
    domain: "cal.com",
    kind: "open-source",
    note: "The whole booking product, free if you run it. Free hosted tier as well.",
  },
  kimai: {
    name: "Kimai",
    domain: "kimai.org",
    kind: "open-source",
    note: "Time tracking and invoicing exports. Plain, and it does not nag you.",
  },
  nocodb: {
    name: "NocoDB",
    domain: "nocodb.com",
    kind: "open-source",
    note: "Spreadsheet UI over a real Postgres or MySQL database you own.",
  },
  baserow: {
    name: "Baserow",
    domain: "baserow.io",
    kind: "open-source",
    note: "Airtable's shape, self-hosted, with a free hosted tier too.",
  },
  n8n: {
    name: "n8n (self-hosted)",
    domain: "n8n.io",
    kind: "open-source",
    note: "Free for your own use on your own server. Unlimited runs, your electricity.",
  },
  activepieces: {
    name: "Activepieces",
    domain: "activepieces.com",
    kind: "open-source",
    note: "Simpler than n8n, fewer integrations, MIT-licensed core.",
  },

  /* ---- design and building ---- */
  penpot: {
    name: "Penpot",
    domain: "penpot.app",
    kind: "open-source",
    note: "Genuinely good open-source design tool. Free hosted, or run it yourself.",
  },
  excalidraw: {
    name: "Excalidraw",
    domain: "excalidraw.com",
    kind: "open-source",
    note: "Whiteboarding and diagrams, free in the browser, self-hostable.",
  },
  drawio: {
    name: "draw.io",
    domain: "drawio.com",
    kind: "open-source",
    note: "Diagrams, free forever, saves straight to your own Drive or disk.",
  },
  gimp: {
    name: "GIMP / Photopea",
    domain: "gimp.org",
    kind: "open-source",
    note: "Full raster editing for nothing. Photopea runs in a tab if you want Photoshop's layout.",
  },
  darktable: {
    name: "Darktable",
    domain: "darktable.org",
    kind: "open-source",
    note: "Raw processing and cataloguing. Steeper than Lightroom, and free.",
  },
  comfyui: {
    name: "ComfyUI + Stable Diffusion",
    domain: "comfy.org",
    kind: "open-source",
    note: "Unlimited image generation on your own GPU. You need the GPU.",
  },
  cloudflarePages: {
    name: "Cloudflare Pages",
    domain: "pages.cloudflare.com",
    kind: "free-tier",
    note: "Free static hosting with no bandwidth bill. You bring the site.",
  },
  wordpress: {
    name: "WordPress",
    domain: "wordpress.org",
    kind: "open-source",
    note: "Still the cheapest way to own a site outright. You handle the updates.",
  },
  budibase: {
    name: "Budibase",
    domain: "budibase.com",
    kind: "open-source",
    note: "Internal tools over your own data, self-hosted, no per-app pricing.",
  },
  appsmith: {
    name: "Appsmith",
    domain: "appsmith.com",
    kind: "open-source",
    note: "Drag-and-drop internal apps. Heavier to host than Budibase.",
  },
  marp: {
    name: "Marp / Google Slides",
    domain: "marp.app",
    kind: "free-tier",
    note: "Slides from markdown, or just use Slides. Neither costs anything.",
  },

  /* ---- infrastructure ---- */
  coolify: {
    name: "Coolify",
    domain: "coolify.io",
    kind: "open-source",
    note: "Heroku on a $5 VPS. You own the server, and the pager.",
  },
  glitchtip: {
    name: "GlitchTip",
    domain: "glitchtip.com",
    kind: "open-source",
    note: "Sentry-compatible error tracking, far lighter to self-host than Sentry itself.",
  },
  grafana: {
    name: "Grafana + Prometheus",
    domain: "grafana.com",
    kind: "open-source",
    note: "The standard free observability stack. It is a project, not an afternoon.",
  },
  signoz: {
    name: "SigNoz",
    domain: "signoz.io",
    kind: "open-source",
    note: "Traces, metrics and logs in one open-source app. Hungry for disk.",
  },
  uptimeKuma: {
    name: "Uptime Kuma",
    domain: "uptimekuma.org",
    kind: "open-source",
    note: "Uptime monitoring in one container. Host it somewhere your app is not.",
  },
  vaultwarden: {
    name: "Vaultwarden",
    domain: "github.com",
    kind: "open-source",
    note: "Bitwarden-compatible server. Bitwarden's own free tier is unlimited for one person.",
  },
  nextcloud: {
    name: "Nextcloud",
    domain: "nextcloud.com",
    kind: "open-source",
    note: "Files, calendar and contacts on your own storage. Syncthing if you only need files.",
  },
  restic: {
    name: "restic",
    domain: "restic.net",
    kind: "open-source",
    note: "Encrypted, deduplicated backups to cheap object storage. Test your restores.",
  },
  tailscale: {
    name: "Tailscale / WireGuard",
    domain: "tailscale.com",
    kind: "free-tier",
    note: "Free for personal use, and WireGuard itself is free. Not the same as a commercial VPN.",
  },
  continueDev: {
    name: "Continue",
    domain: "continue.dev",
    kind: "open-source",
    note: "Open-source coding assistant in your editor. You supply a model or run one locally.",
  },
  supabaseFree: {
    name: "Supabase free tier",
    domain: "supabase.com",
    kind: "free-tier",
    note: "Postgres, auth and storage for nothing until you have real traffic. Self-hostable too.",
  },
  pocketbase: {
    name: "PocketBase",
    domain: "pocketbase.io",
    kind: "open-source",
    note: "One binary: database, auth and file storage. Perfect until you need to scale out.",
  },
  postgres: {
    name: "PostgreSQL",
    domain: "postgresql.org",
    kind: "open-source",
    note: "The database under most of these products, free on any box you rent.",
  },

  /* ---- calls, recording, media ---- */
  jitsi: {
    name: "Jitsi Meet",
    domain: "meet.jit.si",
    kind: "open-source",
    note: "Video calls with no account and no time limit. Self-host for a private one.",
  },
  obs: {
    name: "OBS Studio",
    domain: "obsproject.com",
    kind: "open-source",
    note: "Records and streams anything on your screen. No editing built in.",
  },
  cap: {
    name: "Cap",
    domain: "cap.so",
    kind: "open-source",
    note: "Loom's shape, open-source, with shareable links. Self-host for unlimited.",
  },
  davinci: {
    name: "DaVinci Resolve / Kdenlive",
    domain: "blackmagicdesign.com",
    kind: "free-tier",
    note: "Professional editing at no cost. Kdenlive if you want fully open-source.",
  },
  whispercpp: {
    name: "whisper.cpp",
    domain: "github.com",
    kind: "open-source",
    note: "Transcription that runs on your laptop, free and private. No speaker labels out of the box.",
  },
  piper: {
    name: "Piper TTS",
    domain: "github.com",
    kind: "open-source",
    note: "Fast local text-to-speech. Nowhere near the paid voices in quality.",
  },
  peertube: {
    name: "PeerTube / YouTube",
    domain: "joinpeertube.org",
    kind: "open-source",
    note: "Free hosting for video. Neither gives you the private-client-review workflow.",
  },

  /* ---- money ---- */
  actualBudget: {
    name: "Actual Budget",
    domain: "actualbudget.org",
    kind: "open-source",
    note: "Envelope budgeting, local-first, free. Bank sync needs a bit of wiring.",
  },
  fireflyIii: {
    name: "Firefly III",
    domain: "firefly-iii.org",
    kind: "open-source",
    note: "Serious self-hosted personal finance. Manual until you set up importers.",
  },
  invoiceNinja: {
    name: "Invoice Ninja (self-hosted)",
    domain: "invoiceninja.com",
    kind: "open-source",
    note: "Invoicing, quotes and payments, free when you run it yourself.",
  },
  akaunting: {
    name: "Akaunting",
    domain: "akaunting.com",
    kind: "open-source",
    note: "Open-source books. Your accountant may still want the file in their format.",
  },
  gnucash: {
    name: "GnuCash",
    domain: "gnucash.org",
    kind: "open-source",
    note: "Double-entry accounting, desktop, free. Dated interface, correct numbers.",
  },
  stripeDirect: {
    name: "Stripe directly",
    domain: "stripe.com",
    kind: "free-tier",
    note: "No monthly fee, just the transaction cut. You build the checkout page.",
  },

  /* ---- commerce, courses, community ---- */
  medusa: {
    name: "Medusa",
    domain: "medusajs.com",
    kind: "open-source",
    note: "Headless commerce, free to run. You build the storefront.",
  },
  woocommerce: {
    name: "WooCommerce",
    domain: "woocommerce.com",
    kind: "open-source",
    note: "Free plugin on free WordPress. Extensions are where it starts costing.",
  },
  moodle: {
    name: "Moodle",
    domain: "moodle.org",
    kind: "open-source",
    note: "Course hosting used by universities. Ugly, capable, free.",
  },
  discourse: {
    name: "Discourse",
    domain: "discourse.org",
    kind: "open-source",
    note: "The best open-source forum. Self-host it or pay them; the software is free.",
  },
  discordFree: {
    name: "Discord",
    domain: "discord.com",
    kind: "free-tier",
    note: "Free for any size community. You do not own the data or the relationship.",
  },
  mattermost: {
    name: "Mattermost",
    domain: "mattermost.com",
    kind: "open-source",
    note: "Slack's shape, self-hosted, no message-history limit.",
  },
  zulip: {
    name: "Zulip",
    domain: "zulip.com",
    kind: "open-source",
    note: "Threaded team chat, free to self-host, free hosted tier for open projects.",
  },

  /* ---- people ---- */
  reactiveResume: {
    name: "Reactive Resume",
    domain: "rxresu.me",
    kind: "open-source",
    note: "Free résumé builder with no watermark and no export paywall.",
  },
  orangehrm: {
    name: "OrangeHRM",
    domain: "orangehrm.com",
    kind: "open-source",
    note: "HR records and leave, self-hosted. Payroll is not part of the free edition.",
  },
} as const satisfies Record<string, FreeAlternative>;

type AltKey = keyof typeof ALT;

/**
 * Slug → the free options worth naming.
 *
 * Absence is meaningful. Cold-email sending platforms, payroll, registered
 * agents and most legal products are not here because there is no free version
 * of them that we would put our name next to.
 */
const FOR_SLUG: Partial<Record<string, readonly AltKey[]>> = {
  /* social scheduling */
  buffer: ["postiz", "mixpost"],
  hootsuite: ["postiz", "mixpost"],
  later: ["postiz", "mixpost"],
  publer: ["postiz", "mixpost"],
  planable: ["postiz"],
  metricool: ["postiz"],
  "sprout-social": ["postiz", "mixpost"],
  typefully: ["postiz"],
  hypefury: ["postiz"],
  taplio: ["postiz"],
  "post-bridge": ["postiz"],
  postfast: ["postiz"],
  superx: ["postiz"],

  /* writing */
  grammarly: ["languagetool"],
  languagetool: ["languagetool"],
  quillbot: ["languagetool"],
  prowritingaid: ["languagetool"],
  "hemingway-editor-plus": ["languagetool"],
  wordtune: ["languagetool"],
  ulysses: ["obsidianFree", "joplin"],
  "drafts-pro": ["obsidianFree"],

  /* email + newsletter */
  mailchimp: ["listmonk"],
  mailerlite: ["listmonk"],
  kit: ["listmonk"],
  beehiiv: ["listmonk", "ghost"],
  substack: ["ghost", "listmonk"],
  buttondown: ["listmonk"],
  brevo: ["listmonk"],
  activecampaign: ["listmonk"],
  "constant-contact": ["listmonk"],
  drip: ["listmonk"],

  /* SEO */
  ahrefs: ["searchConsole", "bingWebmaster"],
  semrush: ["searchConsole", "bingWebmaster"],
  "moz-pro": ["searchConsole", "bingWebmaster"],
  ubersuggest: ["searchConsole", "bingWebmaster"],
  mangools: ["searchConsole", "bingWebmaster"],
  "se-ranking": ["searchConsole"],
  "surfer-seo": ["searchConsole"],
  clearscope: ["searchConsole"],
  marketmuse: ["searchConsole"],
  frase: ["searchConsole"],
  spyfu: ["searchConsole", "bingWebmaster"],
  accuranker: ["searchConsole"],
  lowfruits: ["searchConsole", "bingWebmaster"],
  "screaming-frog-seo-spider": ["lighthouse"],
  sitebulb: ["lighthouse"],
  contentking: ["lighthouse", "searchConsole"],

  /* analytics */
  plausible: ["plausibleCe", "umami"],
  "fathom-analytics": ["umami", "plausibleCe"],
  "simple-analytics": ["umami"],
  "umami-cloud": ["umami"],
  "matomo-cloud": ["matomo"],
  posthog: ["posthogFree", "umami"],
  mixpanel: ["posthogFree"],
  amplitude: ["posthogFree"],
  heap: ["posthogFree"],
  fullstory: ["openreplay"],
  logrocket: ["openreplay", "glitchtip"],
  mouseflow: ["openreplay"],
  "lucky-orange": ["openreplay"],
  bitly: ["dub"],

  /* CRM */
  pipedrive: ["twenty", "espocrm"],
  "zoho-crm": ["twenty", "espocrm"],
  close: ["twenty", "espocrm"],
  attio: ["twenty"],
  copper: ["twenty", "espocrm"],
  capsule: ["espocrm"],
  folk: ["twenty"],
  streak: ["twenty"],
  "less-annoying-crm": ["espocrm"],
  hunter: ["hunterFree"],
  apollo: ["hunterFree"],

  /* support */
  intercom: ["chatwoot"],
  zendesk: ["chatwoot", "freescout"],
  "help-scout": ["freescout", "chatwoot"],
  front: ["freescout"],
  freshdesk: ["chatwoot", "freescout"],
  crisp: ["chatwoot"],
  tidio: ["chatwoot"],
  livechat: ["chatwoot"],
  gorgias: ["chatwoot"],
  "chatwoot-cloud": ["chatwoot"],
  chatbase: ["chatwoot"],
  canny: ["fider"],
  nolt: ["fider"],
  featurebase: ["fider"],
  productboard: ["fider"],
  savio: ["fider"],
  productlane: ["fider"],

  /* docs and notes */
  notion: ["appflowy", "outline"],
  slite: ["outline"],
  nuclino: ["outline"],
  anytype: ["appflowy", "logseq"],
  capacities: ["logseq", "appflowy"],
  mem: ["logseq"],
  "roam-research": ["logseq"],
  evernote: ["joplin"],
  "bear-pro": ["joplin", "obsidianFree"],
  "obsidian-sync": ["obsidianFree"],
  craft: ["obsidianFree", "appflowy"],

  /* PDFs and signing */
  docusign: ["documenso"],
  pandadoc: ["documenso", "stirlingPdf"],
  dochub: ["stirlingPdf", "documenso"],
  "adobe-acrobat-pro": ["stirlingPdf"],
  "smallpdf-pro": ["stirlingPdf"],
  "ilovepdf-premium": ["stirlingPdf"],
  "pdf-expert": ["stirlingPdf"],
  "foxit-pdf-editor": ["stirlingPdf"],
  "nitro-pdf-pro": ["stirlingPdf"],

  /* project and task management */
  asana: ["plane", "vikunja"],
  "monday-com": ["plane", "focalboard"],
  clickup: ["plane", "vikunja"],
  wrike: ["plane"],
  teamwork: ["plane"],
  smartsheet: ["nocodb", "baserow"],
  basecamp: ["plane"],
  trello: ["focalboard", "vikunja"],
  linear: ["plane"],
  shortcut: ["plane"],
  todoist: ["vikunja"],
  ticktick: ["vikunja"],
  "things-3": ["vikunja"],
  akiflow: ["vikunja"],
  "amazing-marvin": ["vikunja"],
  airtable: ["nocodb", "baserow"],
  "baserow-cloud": ["baserow"],
  "nocodb-cloud": ["nocodb"],
  grist: ["nocodb"],
  rows: ["nocodb"],
  equals: ["nocodb"],

  /* scheduling and time */
  calendly: ["calcom"],
  "cal-com-teams": ["calcom"],
  tidycal: ["calcom"],
  youcanbookme: ["calcom"],
  doodle: ["calcom"],
  meetergo: ["calcom"],
  "toggl-track": ["kimai"],
  clockify: ["kimai"],
  harvest: ["kimai"],
  timing: ["kimai"],
  timely: ["kimai"],
  hubstaff: ["kimai"],
  "time-doctor": ["kimai"],
  clockwise: ["calcom"],

  /* automation */
  zapier: ["n8n", "activepieces"],
  make: ["n8n", "activepieces"],
  ifttt: ["n8n", "activepieces"],
  "n8n-cloud": ["n8n"],
  pipedream: ["n8n"],
  bardeen: ["n8n"],
  gumloop: ["n8n"],
  workato: ["n8n"],
  "relay-app": ["n8n", "activepieces"],

  /* design */
  figma: ["penpot"],
  sketch: ["penpot"],
  canva: ["penpot", "gimp"],
  miro: ["excalidraw", "drawio"],
  lucidchart: ["drawio", "excalidraw"],
  whimsical: ["excalidraw", "drawio"],
  "adobe-lightroom": ["darktable"],
  "capture-one": ["darktable"],
  photoroom: ["gimp"],
  pixelcut: ["gimp"],
  clipdrop: ["gimp"],
  picsart: ["gimp"],
  photoleap: ["gimp"],
  midjourney: ["comfyui"],
  ideogram: ["comfyui"],
  "leonardo-ai": ["comfyui"],
  recraft: ["comfyui"],
  krea: ["comfyui"],
  "getimg-ai": ["comfyui"],
  nightcafe: ["comfyui"],
  openart: ["comfyui"],
  dreamstudio: ["comfyui"],
  "magnific-ai": ["comfyui"],
  gamma: ["marp"],
  pitch: ["marp"],
  "beautiful-ai": ["marp"],

  /* site building */
  webflow: ["cloudflarePages", "wordpress"],
  wix: ["wordpress", "cloudflarePages"],
  squarespace: ["wordpress", "cloudflarePages"],
  carrd: ["cloudflarePages"],
  tilda: ["cloudflarePages", "wordpress"],
  typedream: ["cloudflarePages"],
  duda: ["wordpress"],
  framer: ["cloudflarePages"],
  unbounce: ["cloudflarePages"],
  leadpages: ["cloudflarePages"],
  bubble: ["budibase", "appsmith"],
  adalo: ["budibase"],
  glide: ["budibase", "nocodb"],
  softr: ["budibase", "nocodb"],
  appsheet: ["budibase"],
  flutterflow: ["budibase"],
  weweb: ["appsmith"],
  retool: ["budibase", "appsmith"],

  /* infrastructure */
  vercel: ["cloudflarePages", "coolify"],
  netlify: ["cloudflarePages"],
  heroku: ["coolify"],
  railway: ["coolify"],
  render: ["coolify"],
  "fly-io": ["coolify"],
  "digitalocean-app-platform": ["coolify"],
  sentry: ["glitchtip"],
  datadog: ["grafana", "signoz"],
  "new-relic": ["grafana", "signoz"],
  honeycomb: ["signoz", "grafana"],
  "grafana-cloud": ["grafana"],
  "better-stack-uptimerobot-paid": ["uptimeKuma"],
  cronitor: ["uptimeKuma"],
  pingdom: ["uptimeKuma"],
  checkly: ["uptimeKuma"],
  "1password": ["vaultwarden"],
  dashlane: ["vaultwarden"],
  bitwarden: ["vaultwarden"],
  "proton-pass-plus": ["vaultwarden"],
  "dropbox-plus": ["nextcloud"],
  "google-one": ["nextcloud"],
  "icloud-plus": ["nextcloud"],
  "box-personal-pro": ["nextcloud"],
  pcloud: ["nextcloud"],
  "mega-pro-i": ["nextcloud"],
  "sync-com": ["nextcloud"],
  tresorit: ["nextcloud"],
  idrive: ["restic", "nextcloud"],
  "proton-drive-plus": ["nextcloud"],
  "backblaze-personal-backup": ["restic"],
  "arq-premium": ["restic"],
  nordvpn: ["tailscale"],
  expressvpn: ["tailscale"],
  surfshark: ["tailscale"],
  mullvad: ["tailscale"],
  "github-copilot": ["continueDev"],
  cursor: ["continueDev"],
  windsurf: ["continueDev"],
  "jetbrains-ai-pro": ["continueDev"],
  "supabase-pro": ["supabaseFree", "postgres"],
  "firebase-blaze": ["supabaseFree", "pocketbase"],
  planetscale: ["postgres", "supabaseFree"],
  neon: ["postgres", "supabaseFree"],
  turso: ["pocketbase", "postgres"],
  "mongodb-atlas": ["postgres"],
  convex: ["supabaseFree", "pocketbase"],
  replit: ["coolify", "cloudflarePages"],
  "bolt-new": ["cloudflarePages"],
  lovable: ["cloudflarePages"],
  v0: ["cloudflarePages"],

  /* calls and recording */
  "zoom-workplace-pro": ["jitsi"],
  "webex-meet": ["jitsi"],
  "microsoft-teams-essentials": ["jitsi"],
  whereby: ["jitsi"],
  livestorm: ["jitsi"],
  demio: ["jitsi"],
  loom: ["cap", "obs"],
  "screen-studio": ["obs", "cap"],
  "cleanshot-x": ["obs"],
  tella: ["cap", "obs"],
  guidde: ["obs"],
  supademo: ["obs"],
  arcade: ["obs"],
  scribe: ["obs"],
  descript: ["davinci", "whispercpp"],
  capcut: ["davinci"],
  veed: ["davinci"],
  vidyard: ["peertube"],
  vimeo: ["peertube"],
  riverside: ["obs", "davinci"],
  elevenlabs: ["piper"],
  playht: ["piper"],
  murf: ["piper"],
  "resemble-ai": ["piper"],
  speechify: ["piper"],
  "otter-ai": ["whispercpp"],
  "fireflies-ai": ["whispercpp"],
  notta: ["whispercpp"],
  tactiq: ["whispercpp"],
  meetgeek: ["whispercpp"],
  "read-ai": ["whispercpp"],
  granola: ["whispercpp"],
  avoma: ["whispercpp"],
  fathom: ["whispercpp"],
  superwhisper: ["whispercpp"],
  "wispr-flow": ["whispercpp"],

  /* money */
  "quickbooks-online": ["akaunting", "gnucash"],
  xero: ["akaunting", "gnucash"],
  freshbooks: ["invoiceNinja", "akaunting"],
  wave: ["akaunting"],
  "invoice-ninja": ["invoiceNinja"],
  honeybook: ["invoiceNinja"],
  ynab: ["actualBudget", "fireflyIii"],
  "monarch-money": ["actualBudget"],
  "copilot-money": ["actualBudget"],
  "rocket-money": ["actualBudget"],
  "lunch-money": ["actualBudget", "fireflyIii"],
  pocketsmith: ["fireflyIii"],
  "quicken-classic-deluxe": ["gnucash", "actualBudget"],
  "quicken-simplifi": ["actualBudget"],
  tiller: ["actualBudget"],
  "lemon-squeezy": ["stripeDirect"],
  paddle: ["stripeDirect"],
  gumroad: ["stripeDirect"],
  memberful: ["stripeDirect"],
  outseta: ["stripeDirect"],
  whop: ["stripeDirect"],

  /* commerce and courses */
  shopify: ["medusa", "woocommerce"],
  bigcommerce: ["medusa", "woocommerce"],
  sellfy: ["woocommerce", "stripeDirect"],
  payhip: ["stripeDirect"],
  podia: ["moodle", "stripeDirect"],
  kajabi: ["moodle", "wordpress"],
  teachable: ["moodle"],
  thinkific: ["moodle"],
  learnworlds: ["moodle"],
  "buy-me-a-coffee": ["stripeDirect"],
  "ko-fi": ["stripeDirect"],
  patreon: ["stripeDirect", "discourse"],

  /* community and chat */
  circle: ["discourse", "discordFree"],
  "mighty-networks": ["discourse", "discordFree"],
  skool: ["discourse", "discordFree"],
  heartbeat: ["discordFree", "discourse"],
  gather: ["discordFree"],
  "slack-pro": ["mattermost", "zulip", "discordFree"],
  "mattermost-professional": ["mattermost"],
  "discord-nitro": ["discordFree"],

  /* people */
  rezi: ["reactiveResume"],
  kickresume: ["reactiveResume"],
  enhancv: ["reactiveResume"],
  novoresume: ["reactiveResume"],
  "resume-worded": ["reactiveResume"],
  "teal-plus": ["reactiveResume"],
  huntr: ["reactiveResume"],
  jobscan: ["reactiveResume"],
  bamboohr: ["orangehrm"],
  personio: ["orangehrm"],
  hibob: ["orangehrm"],
  factorial: ["orangehrm"],

  /* the five hand-written "no" pages */
  slack: ["mattermost", "zulip", "discordFree"],
  supabase: ["supabaseFree", "postgres"],
  quickbooks: ["akaunting", "gnucash"],
};

/** The free options for a tool, or an empty array when we have nothing honest to name. */
export function freeAlternativesFor(slug: string): FreeAlternative[] {
  return (FOR_SLUG[slug] ?? []).map((key) => ALT[key]);
}

/** How many directory entries we can name a free option for. Used in copy. */
export function coveredCount(): number {
  return Object.keys(FOR_SLUG).length;
}
