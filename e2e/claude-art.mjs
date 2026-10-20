// The small Claude call after an idea is saved (server/card-art.ts): every fake Claude answers it here,
// outside its own call list, so suites that count calls stay exact. Returns true when it answered.
export const artCalls = [];

export function answerArt(request, res) {
  if (!String(request.system ?? "").includes("give a date idea of a young couple")) return false;
  artCalls.push(request);
  const title = /^Idea: (.*)$/m.exec(request.messages?.[0]?.content ?? "")?.[1] ?? "";
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({
    id: "msg_art", type: "message", role: "assistant", model: request.model,
    content: [{ type: "text", text: JSON.stringify({ color: "lilac", illustrations: ["rahmen", "einhorn"], quips: { neutral: [`${title.toLowerCase().slice(0, 20)}? ich komm mit.`], like: ["ab ins beet!"], nope: ["kompost, na gut."] } }) }],
    stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 300, output_tokens: 60 },
  }));
  return true;
}
