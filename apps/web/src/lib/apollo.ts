import "server-only";

/**
 * Apollo people search, on the platform side.
 *
 * The lead agent has been running every weekday and handing back prose about
 * leads rather than leads. It had no way to do anything else: the cron path
 * gives an agent live research and a model, and nothing else, so an agent whose
 * job is "find twenty five people worth emailing" could only describe the sort
 * of people that would be. A founder reading that gets a plausible paragraph and
 * no one to email, which is the exact failure the product exists to fix.
 *
 * This is the platform half of `hermes-core/src/integrations/apollo.ts`, which a
 * *deployed* agent has always had. Same endpoint, same field mapping, same
 * treatment of the locked-email placeholder — the difference is only where the
 * key comes from: a deployed agent reads its own environment, and here it is the
 * founder's connector, so a founder who has connected Apollo gets real people
 * without deploying anything.
 *
 * Deliberately search only. Enrichment spends export credits, and an agent that
 * quietly spends a founder's credits on a schedule is not something to ship
 * without them asking for it.
 */

const BASE_URL = "https://api.apollo.io/api/v1";

export interface Lead {
  name: string;
  title: string;
  company: string;
  /** Null whenever Apollo has not unlocked it — never a placeholder string. */
  email: string | null;
  linkedinUrl: string | null;
  location: string;
  companyDomain: string | null;
  employeeCount: number | null;
  industry: string | null;
}

export interface LeadSearchParams {
  titles?: string[];
  locations?: string[];
  industries?: string[];
  employeeRanges?: string[];
  keywords?: string;
  perPage?: number;
}

interface ApolloPerson {
  name?: string;
  first_name?: string;
  last_name?: string;
  title?: string;
  email?: string | null;
  linkedin_url?: string | null;
  city?: string;
  state?: string;
  country?: string;
  organization?: {
    name?: string;
    primary_domain?: string | null;
    estimated_num_employees?: number | null;
    industry?: string | null;
  } | null;
}

function toLead(person: ApolloPerson): Lead {
  const name =
    person.name ?? [person.first_name, person.last_name].filter(Boolean).join(" ").trim();

  return {
    name: name || "Unknown",
    title: person.title ?? "",
    company: person.organization?.name ?? "",
    // Apollo returns this literal placeholder until an export credit is spent.
    // Passed through, it reaches the founder as a real-looking address that
    // bounces — so it becomes null, and the agent says the address is locked.
    email:
      person.email && person.email !== "email_not_unlocked@domain.com"
        ? person.email
        : null,
    linkedinUrl: person.linkedin_url ?? null,
    location: [person.city, person.state, person.country].filter(Boolean).join(", "),
    companyDomain: person.organization?.primary_domain ?? null,
    employeeCount: person.organization?.estimated_num_employees ?? null,
    industry: person.organization?.industry ?? null,
  };
}

/**
 * Find people matching a set of filters. Returns [] rather than throwing.
 *
 * A cron run must not die because Apollo is rate-limited — the agent still has
 * a job to do and can say plainly that the search did not come back, which is
 * an honest answer. Real problems are logged for the operator.
 */
export async function searchLeads(
  apiKey: string,
  params: LeadSearchParams,
): Promise<Lead[]> {
  const body: Record<string, unknown> = {
    page: 1,
    per_page: Math.min(Math.max(params.perPage ?? 10, 1), 25),
  };
  if (params.titles?.length) body.person_titles = params.titles;
  if (params.locations?.length) body.person_locations = params.locations;
  if (params.industries?.length) body.q_organization_keyword_tags = params.industries;
  if (params.employeeRanges?.length) {
    body.organization_num_employees_ranges = params.employeeRanges;
  }
  if (params.keywords) body.q_keywords = params.keywords;

  try {
    const response = await fetch(`${BASE_URL}/mixed_people/search`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      console.error(`[apollo] search failed with ${response.status}`);
      return [];
    }

    const payload = (await response.json()) as { people?: ApolloPerson[] };
    return (payload.people ?? []).map(toLead);
  } catch {
    return [];
  }
}

/**
 * Turn a founder's plain-English customer description into Apollo filters.
 *
 * Deterministic, not a model call. A model asked for filters returns a different
 * shape every run, and a search that silently changes shape is one whose results
 * cannot be compared week to week. This reads what the founder actually wrote on
 * the connectors and agent forms and keeps the filters stable.
 */
export function filtersFrom(config: Record<string, string>): LeadSearchParams {
  const icp = config.icp || config.audience || config.customer || config.targetAudience || "";
  const titles = splitList(config.jobTitles || config.titles || "");
  const locations = splitList(config.locations || config.location || config.geography || "");

  return {
    // Titles are the filter that decides whether a list is workable at all, so
    // when the founder has not named any, the ICP text carries the search as
    // keywords rather than the search running unfiltered across everyone.
    titles: titles.length ? titles : undefined,
    locations: locations.length ? locations : undefined,
    keywords: titles.length ? undefined : icp || undefined,
    perPage: 10,
  };
}

function splitList(value: string): string[] {
  return value
    .split(/[\n,;]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8);
}

/** The found people, as a block the model can write from. */
export function leadsBlock(leads: Lead[]): string {
  return leads
    .map((lead) => {
      const bits = [
        `${lead.name} — ${lead.title || "title unknown"} at ${lead.company || "unknown company"}`,
        lead.location ? `  location: ${lead.location}` : null,
        lead.companyDomain ? `  site: ${lead.companyDomain}` : null,
        lead.employeeCount ? `  headcount: ~${lead.employeeCount}` : null,
        lead.industry ? `  industry: ${lead.industry}` : null,
        lead.linkedinUrl ? `  linkedin: ${lead.linkedinUrl}` : null,
        lead.email ? `  email: ${lead.email}` : `  email: locked in Apollo — say so, do not guess one`,
      ];
      return bits.filter(Boolean).join("\n");
    })
    .join("\n\n");
}
