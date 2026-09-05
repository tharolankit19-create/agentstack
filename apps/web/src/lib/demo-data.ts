import { HEAD_AGENT, SQUADS } from "./army";

/**
 * The product, filled in, for someone who has not signed up.
 *
 * A landing page can only assert. This is the same interface the customer gets,
 * running on a fixed set of rows, so a visitor can open Mission Control and the
 * room and see what a working Tuesday looks like before deciding whether to
 * hand over an email address.
 *
 * Everything here is labelled as a sample and belongs to an invented company —
 * "Northbeam Dental", which does not exist. That is not caution for its own
 * sake: a demo carrying a real customer's leads would be a data leak, and one
 * carrying invented *results* attributed to a real company would be a lie on
 * the most-read page of the site. Invented company, real product, real shapes.
 *
 * Static rather than generated. A demo that calls a model is a demo that is
 * sometimes slow, sometimes off-message, and costs money every time a stranger
 * opens it.
 */

export const DEMO_COMPANY = {
  name: "Northbeam Dental Software",
  site: "northbeam.example",
  icp: "Practice owners with 2–10 chairs, UK and Ireland",
} as const;

export interface DemoMission {
  id: string;
  lane: "needs_you" | "in_flight" | "queued" | "done";
  title: string;
  detail: string;
  agent: string;
  templateId: string;
  ago: string;
  asks?: "approval" | "decision";
}

export const DEMO_MISSIONS: DemoMission[] = [
  {
    id: "d1",
    lane: "needs_you",
    title: "Cold email to Priya Raman · Elmwood Dental",
    detail: "Written and waiting. Practice owner, 6 chairs, hiring a treatment coordinator.",
    agent: "Bex",
    templateId: "outreach-agent",
    ago: "12m",
    asks: "approval",
  },
  {
    id: "d2",
    lane: "needs_you",
    title: "Your homepage answers the question four paragraphs in",
    detail: "The page ranking above you answers it in the first line. Replacement opener written.",
    agent: "Wren",
    templateId: "seo-agent",
    ago: "1h",
    asks: "approval",
  },
  {
    id: "d3",
    lane: "needs_you",
    title: "Dentally dropped their demo gate on Tuesday",
    detail: "Free trial straight from the homepage now. Worth matching, or worth ignoring?",
    agent: "Arya",
    templateId: "competitor-agent",
    ago: "3h",
    asks: "decision",
  },
  {
    id: "d4",
    lane: "in_flight",
    title: "Finding practice owners in Manchester and Leeds",
    detail: "41 found so far this morning",
    agent: "Rook",
    templateId: "lead-agent",
    ago: "now",
  },
  {
    id: "d5",
    lane: "in_flight",
    title: "Reading what changed on three competitor pricing pages",
    detail: "",
    agent: "Arya",
    templateId: "competitor-agent",
    ago: "2m",
  },
  {
    id: "d6",
    lane: "queued",
    title: "Write the launch post for the Thursday release",
    detail: "You asked for this at 5pm",
    agent: "Otis",
    templateId: "content-agent",
    ago: "in 6h",
  },
  {
    id: "d7",
    lane: "queued",
    title: "Weekly search audit",
    detail: "Every Monday morning",
    agent: "Wren",
    templateId: "seo-agent",
    ago: "in 2d",
  },
  {
    id: "d8",
    lane: "done",
    title: "18 cold emails written, one per person",
    detail: "None of them templates. Each names the trigger it opened on.",
    agent: "Bex",
    templateId: "outreach-agent",
    ago: "5h",
  },
  {
    id: "d9",
    lane: "done",
    title: "This week in practice management software",
    detail: "Two pricing moves, one funding round, one integration nobody noticed.",
    agent: "Ida",
    templateId: "research-agent",
    ago: "7h",
  },
];

export interface DemoRoomLine {
  id: string;
  who: string | null;
  templateId: string | null;
  body: string;
  at: string;
}

export const DEMO_ROOM: DemoRoomLine[] = [
  {
    id: "r1",
    who: "Arya",
    templateId: "competitor-agent",
    body: "Dentally removed their demo gate on Tuesday — free trial straight from the homepage. That is the third competitor to drop a gate this quarter.",
    at: "06:52",
  },
  {
    id: "r2",
    who: HEAD_AGENT.defaultName,
    templateId: HEAD_AGENT.id,
    body: "Noted. Wren, our pricing page still sends people to a form. Check whether it is costing us the click.",
    at: "06:54",
  },
  {
    id: "r3",
    who: "Wren",
    templateId: "seo-agent",
    body: "It is. The form sits above the plan comparison, so the page answers 'what does it cost' below the fold. Two pages ranking above us answer it in the first line. I have written the reordered version.",
    at: "07:01",
  },
  {
    id: "r4",
    who: null,
    templateId: null,
    body: "@Rook how many leads so far today?",
    at: "07:04",
  },
  {
    id: "r5",
    who: "Rook",
    templateId: "lead-agent",
    body: "41 found, 18 kept. The 23 I dropped were mostly associates rather than owners — they cannot sign anything. Still going; the target is 50.",
    at: "07:04",
  },
];

export interface DemoLead {
  name: string;
  title: string;
  company: string;
  stage: string;
  score: number;
  why: string;
}

export const DEMO_LEADS: DemoLead[] = [
  { name: "Priya Raman", title: "Practice Owner", company: "Elmwood Dental", stage: "written", score: 9, why: "6 chairs, hiring a treatment coordinator — growing" },
  { name: "Tom Whitfield", title: "Managing Partner", company: "Harbour Dental Care", stage: "written", score: 8, why: "Two sites, still on paper scheduling per their careers page" },
  { name: "Sinead Kelly", title: "Owner", company: "Rathmines Dental", stage: "enriched", score: 8, why: "Recently took over the practice; new owners change software" },
  { name: "David Osei", title: "Clinical Director", company: "Northgate Smiles", stage: "enriched", score: 7, why: "4 chairs, expanding to a second location" },
  { name: "Hannah Poole", title: "Practice Manager", company: "Lark Lane Dental", stage: "qualified", score: 6, why: "Manager not owner — can influence, cannot sign" },
];

/** The five specialists, for the demo sidebar. Real names, real jobs. */
export const DEMO_SQUAD = [
  { name: "Wren", role: "SEO & AEO", templateId: "seo-agent", status: "Rewriting your pricing page opener" },
  { name: "Ida", role: "Research", templateId: "research-agent", status: "Idle since 07:00" },
  { name: "Otis", role: "Content", templateId: "content-agent", status: "Idle — next run 09:00" },
  { name: "Rook", role: "Leads", templateId: "lead-agent", status: "Finding owners in Manchester" },
  { name: "Arya", role: "Competitor intel", templateId: "competitor-agent", status: "Reading three pricing pages" },
];

export const DEMO_SQUAD_COUNT = SQUADS.length;
