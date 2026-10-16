import { describe, expect, it } from "vitest";
import { buildPickPrompt, cleanPicked, pageLabel } from "./source-pages";

const links = [
  { url: "https://rausgegangen.de/cologne/konzerte", label: "Konzerte" },
  { url: "https://rausgegangen.de/cologne/party", label: "Party" },
  { url: "https://rausgegangen.de/cologne/wochenende", label: "Dieses Wochenende" },
];

describe("source pages", () => {
  it("prompt lists the links with numbers", () => {
    const prompt = buildPickPrompt({ url: "https://rausgegangen.de/cologne/", kind: "calendar", links, max: 2 });
    expect(prompt).toContain("at most 2");
    expect(prompt).toContain("2. https://rausgegangen.de/cologne/party – Party");
  });
  it("keeps only listed links, once each, at most max", () => {
    const picked = [
      { url: "https://rausgegangen.de/cologne/party", label: "Partys" },
      { url: "https://evil.example/cologne/party" },
      { url: "https://rausgegangen.de/cologne/erfunden" },
      { url: "https://rausgegangen.de/cologne/party" },
      { url: "https://rausgegangen.de/cologne/konzerte", label: "" },
      { url: "https://rausgegangen.de/cologne/wochenende" },
    ];
    expect(cleanPicked(picked, links, "https://rausgegangen.de/cologne/", 2)).toEqual([
      { url: "https://rausgegangen.de/cologne/party", label: "Partys" },
      { url: "https://rausgegangen.de/cologne/konzerte", label: "Konzerte" },
    ]);
  });
  it("labels from the path", () => {
    expect(pageLabel("https://koeln.de/veranstaltungen/kunst-und-kultur/")).toBe("kunst und kultur");
    expect(pageLabel("https://koeln.de/")).toBe("Startseite");
  });
});
