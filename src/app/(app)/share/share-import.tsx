"use client";

import { useRouter } from "next/navigation";
import { createIdeaAction } from "@/app/(app)/ideas/actions";
import { Card } from "@/components/card";
import { IdeaForm } from "@/components/idea-form";

export function ShareImport({ link, fallbackTitle }: { link: string | null; fallbackTitle: string }) {
  const router = useRouter();
  return (
    <Card>
      <IdeaForm
        action={createIdeaAction}
        initialLink={link ?? undefined}
        idea={link ? undefined : { title: fallbackTitle, size: "small", note: null, url: null, costEur: null, location: null }}
        onSaved={() => router.replace("/ideas")}
        footnote="Landet auf eurer Wunschliste"
      />
    </Card>
  );
}
