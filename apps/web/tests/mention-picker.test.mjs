// The room@ picker's filtering + insertion logic, exercised directly.
const names = ["Seamus", "Wren", "Ida", "Otis", "Rook", "Arya", "Bex", "Sana"];

function syncPicker(value, cursor) {
  const upto = value.slice(0, cursor);
  const at = upto.lastIndexOf("@");
  if (at === -1 || (at > 0 && !/\s/.test(upto[at - 1]))) return null;
  const fragment = upto.slice(at + 1);
  if (/\s/.test(fragment)) return null;
  return { at, query: fragment };
}
function matchesFor(query) {
  const q = query.toLowerCase();
  const starts = names.filter((n) => n.toLowerCase().startsWith(q));
  if (q.length < 2) return starts.slice(0, 8);
  const rest = names.filter((n) => !n.toLowerCase().startsWith(q) && n.toLowerCase().includes(q));
  return [...starts, ...rest].slice(0, 8);
}
function choose(text, at, cursor, name) {
  const after = text.slice(cursor);
  const gap = after.startsWith(" ") ? "" : " ";
  return `${text.slice(0, at)}@${name}${gap}${after}`;
}

let bad = 0;
const t = (label, cond, got) => { console.log((cond ? "PASS  " : "FAIL  ") + label + (cond ? "" : "  <- " + got)); if (!cond) bad++; };

let p = syncPicker("@", 1);
t("bare @ opens the picker", p !== null && p.query === "");
t("bare @ offers every agent", matchesFor("").length === names.length, String(matchesFor("").length));

p = syncPicker("@s", 2);
t("@s offers only names starting with s", matchesFor(p.query).join(",") === "Seamus,Sana", matchesFor(p.query).join(","));

p = syncPicker("@wr", 3);
t("@wr finds Wren", matchesFor(p.query)[0] === "Wren", String(matchesFor(p.query)[0]));

t("a space closes it", syncPicker("@Wren why", 10) === null);
t("mid-word @ is not a mention", syncPicker("email me@acme", 13) === null);
t("@ after a space is", syncPicker("hey @o", 6) !== null);

p = syncPicker("hey @o", 6);
t("insertion keeps the prefix and adds a space",
  choose("hey @o", p.at, 6, "Otis") === "hey @Otis ", JSON.stringify(choose("hey @o", p.at, 6, "Otis")));

// mid-sentence edit: cursor inside, tail preserved
const text = "can @w take a look";
p = syncPicker(text, 6);
t("mid-sentence insertion preserves the tail",
  choose(text, p.at, 6, "Wren") === "can @Wren take a look",
  JSON.stringify(choose(text, p.at, 6, "Wren")));

console.log(bad === 0 ? "\nALL PASS" : `\n${bad} FAILED`);
process.exit(bad ? 1 : 0);
