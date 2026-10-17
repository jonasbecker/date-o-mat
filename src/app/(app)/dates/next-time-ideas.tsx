"use client";

import { useRouter } from "next/navigation";
import { IdeaCard, type IdeaCardView } from "@/components/idea-card";

/** After reviewing: "Nächstes Mal?" – three ideas from the wishlist, one tap to plan. */
export function NextTimeIdeas({ ideas }: { ideas: IdeaCardView[] }) {
  const router = useRouter();
  if (ideas.length === 0) return null;
  return (
    <section aria-labelledby="next-time-heading" className="flex flex-col gap-2">
      <h2 id="next-time-heading" className="text-[17px] font-semibold">
        Nächstes Mal?
      </h2>
      <ul className="flex flex-col gap-2">
        {ideas.map((idea) => (
          <li key={idea.id}>
            <IdeaCard idea={idea} onOpen={() => router.push(`/plan?idea=${idea.id}`)} />
          </li>
        ))}
      </ul>
    </section>
  );
}
