// Small texts of the start page. Pure – next to next-step.ts.

/** The label of the swipe button: "12 neue Ideen zum Swipen". */
export function teaserLabel(count: number): string {
  if (count <= 0) return "Neue Ideen holen";
  return `${count} ${count === 1 ? "neue Idee" : "neue Ideen"} zum Swipen`;
}
