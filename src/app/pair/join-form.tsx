"use client";

import { useActionState } from "react";
import { Button } from "@/components/button";
import { joinCoupleAction, type JoinState } from "./actions";

export function JoinForm({ defaultCode = "" }: { defaultCode?: string }) {
  const [state, formAction, pending] = useActionState<JoinState, FormData>(joinCoupleAction, { code: defaultCode });

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label htmlFor="invite-code" className="text-[13px] font-extrabold text-muted">
        Einladungscode
      </label>
      <input
        id="invite-code"
        name="code"
        defaultValue={state.code}
        placeholder="K7P-4QX"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={9}
        required
        aria-invalid={state.error ? true : undefined}
        aria-describedby={state.error ? "invite-code-error" : undefined}
        className="h-14 rounded-2xl border-[2.5px] border-line bg-surface px-4 text-center font-display text-2xl font-semibold tracking-[0.2em] uppercase placeholder:text-track focus:shadow-[0_0_0_4px_var(--color-himbeere-soft)] focus:outline-none"
      />
      {state.error && (
        <p id="invite-code-error" role="alert" className="text-sm font-bold text-ink">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Einen Moment …" : "Beitreten"}
      </Button>
    </form>
  );
}
