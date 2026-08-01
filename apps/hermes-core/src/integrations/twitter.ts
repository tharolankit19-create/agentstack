import { createHmac, randomBytes } from "node:crypto";
import { getSecret, requireSecret } from "@/core/secrets";

/**
 * X/Twitter posting via API v2 with OAuth 1.0a user context.
 *
 * OAuth 1.0a rather than a bearer token because posting is a user-context
 * action: app-only auth cannot write a tweet.
 */

const POST_URL = "https://api.twitter.com/2/tweets";

export function twitterConfigured(): boolean {
  return Boolean(
    getSecret("TWITTER_API_KEY") &&
      getSecret("TWITTER_API_SECRET") &&
      getSecret("TWITTER_ACCESS_TOKEN") &&
      getSecret("TWITTER_ACCESS_SECRET"),
  );
}

export interface TweetResult {
  id: string;
  url: string;
}

export async function postTweet(
  text: string,
  options: { replyTo?: string; signal?: AbortSignal } = {},
): Promise<TweetResult> {
  if (text.trim().length === 0) throw new Error("Tweet text is empty.");
  if (text.length > 280) {
    throw new Error(`Tweet is ${text.length} characters; the limit is 280.`);
  }

  const body: Record<string, unknown> = { text };
  if (options.replyTo) body.reply = { in_reply_to_tweet_id: options.replyTo };

  const response = await fetch(POST_URL, {
    method: "POST",
    headers: {
      authorization: oauthHeader("POST", POST_URL),
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    signal: options.signal ?? AbortSignal.timeout(20_000),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    data?: { id?: string };
    detail?: string;
    title?: string;
  };

  if (!response.ok) {
    throw new Error(
      `X API ${response.status}: ${payload.detail ?? payload.title ?? "request failed"}`,
    );
  }

  const id = payload.data?.id ?? "";
  return { id, url: id ? `https://x.com/i/web/status/${id}` : "" };
}

/**
 * OAuth 1.0a HMAC-SHA1 signature. Implemented here rather than pulled from a
 * dependency: it is 40 lines, and every extra package is weight in a cold
 * start that runs on every scheduled agent tick.
 */
function oauthHeader(
  method: string,
  url: string,
  extraParams: Record<string, string> = {},
): string {
  const consumerKey = requireSecret("TWITTER_API_KEY");
  const consumerSecret = requireSecret("TWITTER_API_SECRET");
  const token = requireSecret("TWITTER_ACCESS_TOKEN");
  const tokenSecret = requireSecret("TWITTER_ACCESS_SECRET");

  const oauth: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: token,
    oauth_version: "1.0",
  };

  const signatureParams = { ...oauth, ...extraParams };
  const parameterString = Object.keys(signatureParams)
    .sort()
    .map((key) => `${encodeRfc3986(key)}=${encodeRfc3986(signatureParams[key])}`)
    .join("&");

  const baseString = [
    method.toUpperCase(),
    encodeRfc3986(url),
    encodeRfc3986(parameterString),
  ].join("&");

  const signingKey = `${encodeRfc3986(consumerSecret)}&${encodeRfc3986(tokenSecret)}`;
  oauth.oauth_signature = createHmac("sha1", signingKey)
    .update(baseString)
    .digest("base64");

  const header = Object.keys(oauth)
    .sort()
    .map((key) => `${encodeRfc3986(key)}="${encodeRfc3986(oauth[key])}"`)
    .join(", ");

  return `OAuth ${header}`;
}

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}
