// Short explanations behind the ⓘ buttons. One or two sentences each, in "ihr".

export const GLOSSARY = {
  runde: {
    title: "Runde",
    text: "Eine Runde ist der Zeitraum für ein Date – je nach Rhythmus eine Woche, zwei Wochen, eine Monatshälfte oder ein Monat. Danach startet automatisch die nächste.",
  },
  frist: {
    title: "Plan bis …",
    text: "Bis dahin sollte euer Date feststehen, damit genug Vorlauf bleibt. Verpasst? Kein Drama – planen geht trotzdem bis zum Ende der Woche (bzw. des Zeitraums).",
  },
  abwechselnd: {
    title: "Ihr wechselt euch ab",
    text: "Jedes Mal ist eine Person dran: Sie sucht Idee und Termin aus, die andere sagt „Passt!“. Beim nächsten Mal ist es umgekehrt. Abgeben oder übernehmen geht jederzeit.",
  },
  vorschlag: {
    title: "Der Date-O-Mat schlägt vor",
    text: "Der Date-O-Mat sucht selbst eine freie Zeit und eine Idee von eurer Wunschliste aus. Wer zuerst auf „Übernehmen“ tippt, plant das Date.",
  },
  dauer: {
    title: "Kurz oder lang?",
    text: "☕ Kurz: ungefähr zwei Stunden, z. B. abends. 🎡 Lang: ein halber Tag oder mehr, eher am Wochenende. Die genauen Zeitfenster stellt ihr in den Einstellungen ein.",
  },
  frei: {
    title: "Ihr seid beide frei",
    text: "Eure Kalender zeigen zu der Zeit nichts – mit etwas Puffer davor und danach. Der Date-O-Mat sieht dabei nur „frei“ oder „belegt“, nie eure Termine.",
  },
  swipen: {
    title: "Swipen",
    text: "💚 legt die Idee auf eure Wunschliste. Findet ihr beide dieselbe Idee gut, ist es ein Match 💞. ✕ blendet sie für dich aus, ↩️ nimmt es zurück.",
  },
  passt: {
    title: "„Passt!“",
    text: "Wer das Date nicht geplant hat, bestätigt es mit „Passt!“. Danach steht es – ändern oder absagen geht trotzdem noch.",
  },
  verdeckt: {
    title: "Verdeckte Herzen",
    text: "Die Bewertung der anderen Person siehst du erst, wenn du selbst bewertet hast. So richtet sich niemand nach dem anderen.",
  },
  puffer: {
    title: "Puffer",
    text: "So viel Luft bleibt vor und nach euren Terminen frei – für den Weg oder zum Durchatmen.",
  },
} as const;

export type GlossaryKey = keyof typeof GLOSSARY;
