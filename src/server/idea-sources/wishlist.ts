import "server-only";
import { listIdeas } from "@/server/ideas";
import type { IdeaSourceProvider } from "./index";

/** The couple's own wishlist. */
export const wishlistSource: IdeaSourceProvider = {
  source: "wishlist",
  async candidates({ coupleId, size }) {
    const ideas = await listIdeas(coupleId);
    return ideas
      .filter((idea) => !size || idea.size === size)
      .map((idea) => ({
        ideaId: idea.id,
        title: idea.title,
        size: idea.size,
        note: idea.note,
        url: idea.url,
        costEur: idea.costEur,
        location: idea.location,
        setting: idea.setting,
        source: "wishlist" as const,
        addedAt: idea.createdAt,
      }));
  },
};
