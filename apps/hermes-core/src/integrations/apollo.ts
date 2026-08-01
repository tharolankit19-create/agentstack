import { requireSecret } from "@/core/secrets";

/**
 * Apollo.io — people search and enrichment for the lead agent.
 */

const BASE_URL = "https://api.apollo.io/api/v1";

export interface Lead {
  name: string;
  title: string;
  company: string;
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
  page?: number;
  perPage?: number;
}

export async function searchLeads(
  params: LeadSearchParams,
  signal?: AbortSignal,
): Promise<Lead[]> {
  const body: Record<string, unknown> = {
    page: params.page ?? 1,
    per_page: Math.min(params.perPage ?? 10, 25),
  };
  if (params.titles?.length) body.person_titles = params.titles;
  if (params.locations?.length) body.person_locations = params.locations;
  if (params.industries?.length) body.q_organization_keyword_tags = params.industries;
  if (params.employeeRanges?.length) {
    body.organization_num_employees_ranges = params.employeeRanges;
  }
  if (params.keywords) body.q_keywords = params.keywords;

  const payload = await apollo<{ people?: ApolloPerson[] }>(
    "/mixed_people/search",
    body,
    signal,
  );
  return (payload.people ?? []).map(toLead);
}

export async function enrichPerson(
  input: { email?: string; linkedinUrl?: string; name?: string; domain?: string },
  signal?: AbortSignal,
): Promise<Lead | null> {
  const body: Record<string, unknown> = {};
  if (input.email) body.email = input.email;
  if (input.linkedinUrl) body.linkedin_url = input.linkedinUrl;
  if (input.name) body.name = input.name;
  if (input.domain) body.domain = input.domain;

  const payload = await apollo<{ person?: ApolloPerson }>(
    "/people/match",
    body,
    signal,
  );
  return payload.person ? toLead(payload.person) : null;
}

async function apollo<T>(
  path: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "x-api-key": requireSecret("APOLLO_API_KEY"),
    },
    body: JSON.stringify(body),
    signal: signal ?? AbortSignal.timeout(30_000),
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error("Apollo rejected the API key. Check it in your dashboard.");
  }
  if (response.status === 429) {
    throw new Error("Apollo rate limit reached. Try again later.");
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Apollo API ${response.status}: ${detail.slice(0, 300)}`);
  }

  return (await response.json()) as T;
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
    person.name ??
    [person.first_name, person.last_name].filter(Boolean).join(" ").trim();

  return {
    name: name || "Unknown",
    title: person.title ?? "",
    company: person.organization?.name ?? "",
    // Apollo returns this placeholder until an export credit is spent.
    email: person.email && person.email !== "email_not_unlocked@domain.com"
      ? person.email
      : null,
    linkedinUrl: person.linkedin_url ?? null,
    location: [person.city, person.state, person.country].filter(Boolean).join(", "),
    companyDomain: person.organization?.primary_domain ?? null,
    employeeCount: person.organization?.estimated_num_employees ?? null,
    industry: person.organization?.industry ?? null,
  };
}
