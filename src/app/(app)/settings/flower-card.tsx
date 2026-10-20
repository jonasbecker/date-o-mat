"use client";

// Setup card 3 (ThSetup.html): "Eure Blume heißt Rosi" with "umbenennen", and the pots – the chosen
// one framed, the ones still to earn pale ("neue Töpfe ab 10 & 25 Dates").
import { useOptimistic, useState, useTransition } from "react";
import { POT_COLORS, POT_LABEL, POT_UNLOCK, FLOWER_POTS, type FlowerPot } from "@/core/bloom";
import { FLOWER_NAME_MAX } from "@/lib/domain";
import { cn } from "@/lib/cn";
import { choosePotAction, renameFlowerAction } from "./actions";

const POT_SHAPE = "polygon(0 0, 100% 0, 85% 100%, 15% 100%)";

export function FlowerCard({ name, pot, lived }: { name: string; pot: FlowerPot; lived: number }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [, start] = useTransition();
  const [shownName, setShownName] = useOptimistic(name);
  const [shownPot, setShownPot] = useOptimistic(pot);
  const locked = FLOWER_POTS.filter((p) => lived < POT_UNLOCK[p]);

  function save() {
    const next = draft.trim();
    setEditing(false);
    if (!next || next === name) return setDraft(name);
    start(async () => {
      setShownName(next);
      await renameFlowerAction(next);
    });
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3">
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
            className="flex min-w-0 flex-1 items-center gap-2"
          >
            <label htmlFor="flower-name" className="sr-only">
              Name der Blume
            </label>
            <input
              id="flower-name"
              autoFocus
              value={draft}
              maxLength={FLOWER_NAME_MAX}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={save}
              className="h-11 min-w-0 flex-1 px-4 font-hand text-2xl font-bold"
            />
            <button type="submit" className="text-[13px] font-semibold underline underline-offset-[3px]">
              fertig
            </button>
          </form>
        ) : (
          <>
            <span className="flex flex-col">
              <span className="text-[13px] text-muted">Eure Blume heißt</span>
              <span data-flower-name className="font-hand text-[26px] font-bold leading-none">
                {shownName}
              </span>
            </span>
            <button type="button" onClick={() => setEditing(true)} className="text-[13px] text-muted underline underline-offset-[3px]">
              umbenennen
            </button>
          </>
        )}
      </div>
      <div role="radiogroup" aria-label="Topf" className="flex items-end gap-2">
        {FLOWER_POTS.map((p) => {
          const open = lived >= POT_UNLOCK[p];
          const chosen = shownPot === p;
          return (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={chosen}
              aria-disabled={!open}
              aria-label={open ? `Topf ${POT_LABEL[p]}` : `Topf ${POT_LABEL[p]} – ab ${POT_UNLOCK[p]} Dates`}
              onClick={() => {
                if (!open || chosen) return;
                start(async () => {
                  setShownPot(p);
                  await choosePotAction(p);
                });
              }}
              className={cn("rounded-[4px] p-[3px]", chosen && "ring-2 ring-ink", !open && "cursor-not-allowed opacity-35")}
            >
              <span aria-hidden="true" className="block h-[30px] w-11" style={{ background: POT_COLORS[p].body, clipPath: POT_SHAPE }} />
            </button>
          );
        })}
        {locked.length > 0 && <span className="pb-1 pl-1 text-xs text-muted">neue Töpfe ab {locked.map((p) => POT_UNLOCK[p]).join(" & ")} Dates</span>}
      </div>
    </div>
  );
}
