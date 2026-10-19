// Idea sources: where date ideas come from. V1 only has the shared wishlist.
//
// To add a source later (curated ideas for Köln, AI suggestions, …):
//   1. implement IdeaSourceProvider in a new file next to wishlist.ts
//   2. add it to PROVIDERS below
// Everything that suggests or picks ideas goes through ideaCandidates(),
// so no other code has to change. `ideas.source`/`external_ref` in the
// schema are already prepared for storing such ideas.
import "server-only";
import type { IdeaSize, IdeaSource, PlaceSetting } from "@/lib/domain";
import { wishlistSource } from "./wishlist";

export type IdeaCandidate = {
  /** Row in `ideas`, or null for ideas that only exist in an external source. */
  ideaId: string | null;
  title: string;
  size: IdeaSize;
  note: string | null;
  url: string | null;
  costEur: number | null;
  location: string | null;
  setting: PlaceSetting | null;
  source: IdeaSource;
  addedAt: Date;
};

export interface IdeaSourceProvider {
  readonly source: IdeaSource;
  candidates(query: { coupleId: string; size?: IdeaSize }): Promise<IdeaCandidate[]>;
}

const PROVIDERS: IdeaSourceProvider[] = [wishlistSource];

export async function ideaCandidates(query: { coupleId: string; size?: IdeaSize }): Promise<IdeaCandidate[]> {
  const lists = await Promise.all(PROVIDERS.map((provider) => provider.candidates(query)));
  return lists.flat();
}
