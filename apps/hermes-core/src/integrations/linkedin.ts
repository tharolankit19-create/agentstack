import { getSecret, requireSecret } from "@/core/secrets";

/**
 * LinkedIn publishing via the UGC Posts API.
 *
 * Needs a member access token with `w_member_social` and the author's person
 * URN (`urn:li:person:xxxx`), both collected in the dashboard.
 */

const UGC_URL = "https://api.linkedin.com/v2/ugcPosts";

export function linkedinConfigured(): boolean {
  return Boolean(getSecret("LINKEDIN_ACCESS_TOKEN") && getSecret("LINKEDIN_AUTHOR_URN"));
}

export interface LinkedInPostResult {
  id: string;
  url: string;
}

export async function postToLinkedIn(
  text: string,
  options: { visibility?: "PUBLIC" | "CONNECTIONS"; signal?: AbortSignal } = {},
): Promise<LinkedInPostResult> {
  if (text.trim().length === 0) throw new Error("LinkedIn post text is empty.");
  if (text.length > 3000) {
    throw new Error(`Post is ${text.length} characters; the limit is 3000.`);
  }

  const author = requireSecret("LINKEDIN_AUTHOR_URN");
  const token = requireSecret("LINKEDIN_ACCESS_TOKEN");

  const response = await fetch(UGC_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-restli-protocol-version": "2.0.0",
    },
    body: JSON.stringify({
      author,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text },
          shareMediaCategory: "NONE",
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": options.visibility ?? "PUBLIC",
      },
    }),
    signal: options.signal ?? AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`LinkedIn API ${response.status}: ${detail.slice(0, 300)}`);
  }

  const id = response.headers.get("x-restli-id") ?? "";
  return {
    id,
    url: id ? `https://www.linkedin.com/feed/update/${id}` : "",
  };
}
