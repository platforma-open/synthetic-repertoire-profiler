// Parent FASTA parsing, used by the model's `.args` and by the region-scheme editor.

export type ParsedParent = { id: string; sequence: string };

/** Parse FASTA text into parents. The id is the first whitespace-delimited token
 *  of the header; the body is concatenated and upper-cased. */
export function parseParentFasta(text: string | undefined): ParsedParent[] {
  if (!text) return [];
  const parents: ParsedParent[] = [];
  let id: string | undefined;
  let body: string[] = [];
  const flush = () => {
    if (id !== undefined) parents.push({ id, sequence: body.join("").toUpperCase() });
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "") continue;
    if (line.startsWith(">")) {
      flush();
      // mitool parses the same FASTA independently and must derive the same id: the region
      // scheme is keyed by these values and matched against mitool's output, so a mismatch
      // silently drops the whole scheme. Changing this convention requires the same change
      // in mitool.
      id = line.slice(1).trim().split(/\s+/)[0] ?? "";
      body = [];
    } else if (id !== undefined) {
      body.push(line);
    }
  }
  flush();
  return parents;
}
