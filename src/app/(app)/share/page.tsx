import { AppHeader } from "@/components/app-header";
import { PageTitle } from "@/components/page-title";
import { extractUrl } from "@/core/link-idea";
import { requireCouple } from "@/server/auth/dal";
import { ShareImport } from "./share-import";

// Android's share sheet opens this page (manifest share_target): link → idea.
export const maxDuration = 60;

export default function SharePage({ searchParams }: PageProps<"/share">) {
  return (
    <div className="flex flex-col gap-4">
      <AppHeader />
      <PageTitle title="neue idee." back="/ideas" />
      <Share searchParams={searchParams} />
    </div>
  );
}

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

async function Share({ searchParams }: { searchParams: PageProps<"/share">["searchParams"] }) {
  await requireCouple();
  const params = await searchParams;
  const title = first(params.title).slice(0, 500);
  const text = first(params.text).slice(0, 2000);
  const url = first(params.url).slice(0, 2000);
  // Apps put the link in "url", "text" or both – sometimes after a sentence.
  const link = extractUrl(url) ?? extractUrl(text) ?? extractUrl(title);
  const fallbackTitle = link ? "" : (text || title).trim().slice(0, 120);
  return <ShareImport link={link} fallbackTitle={fallbackTitle} />;
}
