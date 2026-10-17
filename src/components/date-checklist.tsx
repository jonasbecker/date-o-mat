"use client";

import { useOptimistic, useState, useTransition } from "react";
import { addTaskAction, deleteTaskAction, toggleTaskAction } from "@/app/(app)/actions";
import { cn } from "@/lib/cn";

export type TaskView = { id: string; title: string; done: boolean };

/** "Vorbereitung": a small shared to-do list for the next date, with suggestions. */
export function DateChecklist({ dateId, tasks, suggestions, collapsed = false }: { dateId: string; tasks: TaskView[]; suggestions: string[]; /** Closed at first (start page). */ collapsed?: boolean }) {
  const [shown, setShown] = useOptimistic(tasks, (state, change: { id: string; done: boolean }) =>
    state.map((t) => (t.id === change.id ? { ...t, done: change.done } : t)),
  );
  const [title, setTitle] = useState("");
  const [pending, start] = useTransition();
  const open = shown.filter((t) => !t.done).length;

  function add(text: string) {
    if (!text.trim()) return;
    start(async () => {
      await addTaskAction(dateId, text);
      setTitle("");
    });
  }

  return (
    <details open={!collapsed && shown.length > 0 && open > 0} className="group rounded-2xl border-2 border-dashed border-track px-4 py-2">
      <summary className="flex cursor-pointer list-none items-center justify-between py-1 text-sm font-extrabold">
        📝 Vorbereitung {shown.length > 0 ? `(${shown.length - open}/${shown.length})` : ""}
        <span className="text-muted underline group-open:hidden">öffnen</span>
      </summary>
      <div className="flex flex-col gap-2 pb-2 pt-1">
        {shown.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {shown.map((task) => (
              <li key={task.id} className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={task.done}
                  aria-label={task.title}
                  onChange={(e) =>
                    start(async () => {
                      setShown({ id: task.id, done: e.target.checked });
                      await toggleTaskAction(task.id, e.target.checked);
                    })
                  }
                  className="size-5 shrink-0 accent-minze"
                />
                <span className={cn("grow font-bold", task.done && "text-muted line-through")}>{task.title}</span>
                <button type="button" aria-label={`${task.title} löschen`} onClick={() => start(() => deleteTaskAction(task.id))} className="text-muted">
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button key={s} type="button" disabled={pending} onClick={() => add(s)} className="rounded-full border-2 border-line px-2.5 py-0.5 text-[13px] font-extrabold">
                + {s}
              </button>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add(title);
          }}
          className="flex gap-2"
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            placeholder="z. B. Blumen besorgen"
            aria-label="Neuer Punkt"
            className="h-10 min-w-0 grow rounded-xl border-2 border-line bg-surface px-3 text-sm font-bold"
          />
          <button type="submit" disabled={pending || !title.trim()} className="rounded-xl border-2 border-line px-3 text-sm font-extrabold disabled:opacity-50">
            Dazu
          </button>
        </form>
        <p className="text-xs font-bold text-muted">Was am Vortag um 18 Uhr noch offen ist, gibt&apos;s als Erinnerung.</p>
      </div>
    </details>
  );
}
