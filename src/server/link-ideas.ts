// "Link → Idee": reads what a shared link says about itself (oEmbed for TikTok
// and YouTube, OpenGraph for everything else), looks at the preview picture and
// lets Claude turn it into a wishlist idea. Nothing is stored here – the person
// checks the draft and saves it like any other idea.
import "server-only";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { htmlToText } from "@/core/events";
import {
  cleanLinkIdea,
  detectPlatform,
  extractUrl,
  fallbackIdea,
  LINK_SYSTEM_PROMPT,
  linkPrompt,
  parseOpenGraph,
  type LinkIdeaDraft,
  type LinkMeta,
  type Platform,
} from "@/core/link-idea";
import { sniffImageType, type ImageType } from "@/core/photos";
import { parseSourceUrl } from "@/lib/url-safety";
import type { CoupleContext } from "@/server/auth/dal";
import { AI_LIMITS, aiRequestsToday, anthropic, recordAiUsage, reserveAiRequest } from "@/server/anthropic";
import { env } from "@/server/env";
import { fetchPage, fetchPublic } from "@/server/events/fetch-page";

export const LINK_MODEL = "claude-haiku-5-5";

/** Claude accepts up to 5 MB per image (base64); previews are far smaller. */
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_PAGE_TEXT = 3000;

const OEmbedSchema = z.object({
  title: z.string().nullish(),
  author_name: z.string().nullish(),
  author_unique_id: z.string().nullish(),
  thumbnail_url: z.string().nullish(),
});

const ResultSchema = z.object({
  title: z.string(),
  size: z.enum(["small", "large"]),
  note: z.string().nullable(),
  cost_eur: z.number().nullable(),
  location: z.string().nullable(),
});

export type LinkIdeaResult =
  | {
      ok: true;
      draft: LinkIdeaDraft;
      platform: Platform;
      /** "plain": made without Claude (not set up, limit reached or failed). */
      via: "ai" | "plain";
      reason?: "off" | "limit" | "failed";
      left: number | null;
    }
  | { ok: false; error: "invalid" | "unreadable"; url: string | null };

async function oembed(endpoint: string, url: string, platform: Platform): Promise<LinkMeta | null> {
  try {
    const response = await fetchPublic(`${endpoint}?format=json&url=${encodeURIComponent(url)}`, {
      accept: "application/json",
      types: /json/i,
      maxBytes: 256 * 1024,
      whole: true,
    });
    const data = OEmbedSchema.safeParse(JSON.parse(response.body.toString("utf8")));
    if (!data.success || !data.data.title?.trim()) return null;
    const o = data.data;
    return {
      platform,
      title: o.title ?? null,
      description: null,
      author: o.author_unique_id ? `@${o.author_unique_id}` : (o.author_name ?? null),
      siteName: null,
      image: o.thumbnail_url ?? null,
      text: null,
    };
  } catch {
    return null;
  }
}

/** What the link says about itself. Null if it cannot be read at all. */
async function readLink(url: string): Promise<{ meta: LinkMeta; url: string } | null> {
  const endpoints = env().oembed;
  const endpointFor = (platform: Platform) => (platform === "tiktok" ? endpoints.tiktok : platform === "youtube" ? endpoints.youtube : null);
  const platform = detectPlatform(url);
  const endpoint = endpointFor(platform);
  if (endpoint) {
    const meta = await oembed(endpoint, url, platform);
    if (meta) return { meta, url };
  }

  let page: { html: string; url: string };
  try {
    page = await fetchPage(url);
  } catch {
    return null;
  }
  // Short links (vm.tiktok.com, youtu.be …) only reveal the real video after the redirect.
  const finalPlatform = detectPlatform(page.url);
  const finalEndpoint = endpointFor(finalPlatform);
  if (finalEndpoint && page.url !== url) {
    const meta = await oembed(finalEndpoint, page.url, finalPlatform);
    if (meta) return { meta, url };
  }
  const og = parseOpenGraph(page.html, page.url);
  const text = finalPlatform === "web" ? htmlToText(page.html, page.url).slice(0, MAX_PAGE_TEXT) || null : null;
  if (!og.title && !og.description && !text) return null;
  return { meta: { ...og, platform: finalPlatform, author: null, text }, url };
}

/** The preview picture as base64 for Claude – best effort. */
async function previewImage(imageUrl: string | null): Promise<{ type: ImageType; data: string } | null> {
  if (!imageUrl) return null;
  try {
    const response = await fetchPublic(imageUrl, { accept: "image/jpeg,image/png,image/webp", types: /^image\//i, maxBytes: MAX_IMAGE_BYTES, whole: true });
    const type = sniffImageType(response.body);
    return type ? { type, data: response.body.toString("base64") } : null;
  } catch {
    return null;
  }
}

async function askClaude(ctx: CoupleContext, meta: LinkMeta, url: string, requestId: string): Promise<LinkIdeaDraft | null> {
  const image = await previewImage(meta.image);
  try {
    const response = await anthropic().messages.parse({
      model: LINK_MODEL,
      max_tokens: 1500,
      output_config: { effort: "low", format: zodOutputFormat(ResultSchema) },
      system: LINK_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            ...(image ? [{ type: "image" as const, source: { type: "base64" as const, media_type: image.type, data: image.data } }] : []),
            { type: "text" as const, text: linkPrompt({ ...meta, image: image ? meta.image : null }, url) },
          ],
        },
      ],
    });
    await recordAiUsage(requestId, response.usage);
    if (response.stop_reason === "refusal" || !response.parsed_output) return null;
    return cleanLinkIdea(response.parsed_output, meta, url);
  } catch (error) {
    console.error(`[links] analysis failed for couple ${ctx.coupleId}`, error instanceof Error ? error.message : error);
    return null;
  }
}

export async function linkToIdea(ctx: CoupleContext, input: string, now: Date): Promise<LinkIdeaResult> {
  const found = extractUrl(input) ?? input.trim();
  const parsed = parseSourceUrl(found, env().allowPrivateEventUrls);
  if (!parsed) return { ok: false, error: "invalid", url: null };
  const url = parsed.toString();

  const read = await readLink(url);
  if (!read) return { ok: false, error: "unreadable", url };
  const { meta } = read;
  const plain = (reason: "off" | "limit" | "failed", left: number | null): LinkIdeaResult => ({
    ok: true,
    draft: fallbackIdea(meta, url),
    platform: meta.platform,
    via: "plain",
    reason,
    left,
  });

  if (!env().ai) return plain("off", null);
  const requestId = await reserveAiRequest({ coupleId: ctx.coupleId, userId: ctx.user.id, kind: "links", model: LINK_MODEL, now });
  if (!requestId) return plain("limit", 0);
  const draft = await askClaude(ctx, meta, url, requestId);
  const left = Math.max(0, AI_LIMITS.links - (await aiRequestsToday(ctx.coupleId, "links", now)));
  if (!draft) return plain("failed", left);
  return { ok: true, draft, platform: meta.platform, via: "ai", left };
}
