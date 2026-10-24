/** Pure subtitle preview/editing utilities. No AI calls and no timestamp rewriting. */
export type StudioFormat = "srt" | "ass";
export type StudioCue = {
  number: string;
  start: string;
  end: string;
  time: string;
  text: string;
};

const SRT_BREAK = /\r?\n[\t ]*\r?\n/;

export function parseSrtStudio(text: string): StudioCue[] {
  if (!text.trim()) return [];
  return text.replace(/^\uFEFF/, "").split(SRT_BREAK).flatMap(block => {
    const lines = block.split(/\r?\n/);
    const idx = lines.findIndex(line => line.includes("-->"));
    if (idx < 0 || idx >= lines.length - 1) return [];
    const times = lines[idx].split(/\s*-->\s*/);
    if (times.length !== 2) return [];
    const number = idx ? lines[0].trim() : String(1);
    return [{ number, start: times[0], end: times[1], time: `${times[0]} → ${times[1]}`, text: lines.slice(idx + 1).join("\n").trimEnd() }];
  });
}

function splitAssFields(value: string, fields: number): string[] {
  const output: string[] = [];
  let rest = value;
  for (let i = 0; i < fields - 1; i++) {
    const cut = rest.indexOf(",");
    if (cut < 0) return [];
    output.push(rest.slice(0, cut));
    rest = rest.slice(cut + 1);
  }
  output.push(rest);
  return output;
}

export function parseAssStudio(text: string): StudioCue[] {
  const cues: StudioCue[] = [];
  let inEvents = false;
  let fields = ["Layer", "Start", "End", "Style", "Name", "MarginL", "MarginR", "MarginV", "Effect", "Text"];
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*\[/.test(line)) inEvents = /^\s*\[Events\]/i.test(line);
    if (!inEvents) continue;
    if (/^Format:\s*/i.test(line)) fields = line.replace(/^Format:\s*/i, "").split(",").map(x => x.trim());
    if (!/^Dialogue:\s*/i.test(line)) continue;
    const parts = splitAssFields(line.replace(/^Dialogue:\s*/i, ""), fields.length);
    if (parts.length !== fields.length) continue;
    const start = parts[fields.indexOf("Start")]?.trim() ?? "";
    const end = parts[fields.indexOf("End")]?.trim() ?? "";
    const raw = parts[fields.indexOf("Text")] ?? "";
    if (!start || !end) continue;
    cues.push({ number: String(cues.length + 1), start, end, time: `${start} → ${end}`,
      text: raw.replace(/\{[^}]*\}/g, "").replace(/\\[Nn]/g, "\n").replace(/\\h/g, " ") });
  }
  return cues;
}

export function parseStudioCues(text: string, format: StudioFormat): StudioCue[] {
  return format === "ass" ? parseAssStudio(text) : parseSrtStudio(text);
}

/** A formatted timestamp key for matching source cues to translated cues. */
export function timeKey(time: string): number | null {
  const match = time.trim().match(/^(\d+):(\d\d):(\d\d)[.,](\d{1,3})$/);
  if (!match) return null;
  const [, h, m, s, frac] = match;
  return ((Number(h) * 60 + Number(m)) * 60 + Number(s)) * 1000 + Number(frac.padEnd(3, "0"));
}

export function findSourceMatch(cue: StudioCue, sources: StudioCue[]): StudioCue | undefined {
  const start = timeKey(cue.start);
  const end = timeKey(cue.end);
  if (start === null || end === null) return undefined;
  return sources.find(src => {
    const srcStart = timeKey(src.start);
    const srcEnd = timeKey(src.end);
    return srcStart !== null && srcEnd !== null && Math.abs(srcStart - start) <= 10 && Math.abs(srcEnd - end) <= 10;
  });
}

export function replaceStudioCue(content: string, format: StudioFormat, cueIndex: number, replacement: string): string {
  if (!Number.isInteger(cueIndex) || cueIndex < 0) throw new Error("Invalid subtitle number.");
  const edited = replacement.replace(/\r\n?/g, "\n").trim();
  if (!edited || edited.length > 600 || /\n\s*\n|-->/.test(edited)) {
    throw new Error("Enter subtitle text (up to 600 characters) without blank lines or timestamps.");
  }
  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  if (format === "srt") {
    const separator = /\r?\n[\t ]*\r?\n/;
    const blocks = content.split(separator);
    let ordinal = 0;
    let found = false;
    const output = blocks.map(block => {
      const lines = block.split(/\r?\n/);
      const t = lines.findIndex(line => line.includes("-->"));
      if (t < 0 || t === lines.length - 1) return block;
      if (ordinal++ !== cueIndex) return block;
      found = true;
      return [...lines.slice(0, t + 1), ...edited.split("\n")].join(newline);
    });
    if (!found) throw new Error("Subtitle line was not found.");
    return output.join(newline + newline);
  }
  let inEvents = false;
  let ordinal = 0;
  let found = false;
  let fields = ["Layer", "Start", "End", "Style", "Name", "MarginL", "MarginR", "MarginV", "Effect", "Text"];
  const output = content.split(/\r?\n/).map(line => {
    if (/^\s*\[/.test(line)) inEvents = /^\s*\[Events\]/i.test(line);
    if (!inEvents) return line;
    if (/^Format:\s*/i.test(line)) {
      fields = line.replace(/^Format:\s*/i, "").split(",").map(x => x.trim());
      return line;
    }
    if (!/^Dialogue:\s*/i.test(line)) return line;
    const prefix = line.match(/^Dialogue:\s*/i)?.[0] ?? "Dialogue: ";
    const parts = splitAssFields(line.slice(prefix.length), fields.length);
    if (parts.length !== fields.length) return line;
    if (ordinal++ !== cueIndex) return line;
    const textIndex = fields.indexOf("Text");
    if (textIndex < 0) throw new Error("ASS text field was not found.");
    found = true;
    // Edited dialogue is plain text; preserve existing styles and every other event line.
    parts[textIndex] = edited.replace(/[{}]/g, "").replace(/\\[Nnh]/g, " ").replace(/\n/g, "\\N");
    return prefix + parts.join(",");
  });
  if (!found) throw new Error("Subtitle line was not found.");
  return output.join(newline);
}

export function studioSearch(text: string, cues: StudioCue[], sources: StudioCue[], format: StudioFormat): number[] {
  const q = text.trim().toLocaleLowerCase();
  return cues.flatMap((cue, index) => {
    if (!q) return [index];
    const source = format === "srt" || format === "ass" ? findSourceMatch(cue, sources) : undefined;
    const combined = `${cue.number} ${cue.time} ${cue.text} ${source?.text ?? ""}`.toLocaleLowerCase();
    return combined.includes(q) ? [index] : [];
  });
}
