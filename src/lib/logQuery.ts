import { LogEntry } from "@/mock/logs";

// A small query language for the Logs Explorer's search bar, in the spirit
// of LogQL/Splunk-style search without pulling in a real grammar/parser:
//
//   service="api-gateway"        exact match on a known field
//   level!=INFO                  negated exact match
//   timeout                      bare word -> substring match on the message
//   "connection refused"         quoted phrase -> substring match, spaces allowed
//   |= "timeout"                 explicit "message contains" (same as a bare phrase)
//   != "healthy"                 explicit "message does not contain"
//
// Terms are combined with AND. Field matches are case-insensitive and exact
// (real query languages treat `=` as exact and reserve substring/regex for a
// separate operator); free text is a case-insensitive substring match against
// the message. An unrecognized "word=value" (not one of the known fields)
// degrades gracefully to a plain text search on the whole token rather than
// erroring, since this is meant to be forgiving to type into.

const FIELDS = ["service", "namespace", "level", "pod", "container"] as const;
type Field = (typeof FIELDS)[number];

interface FieldFilter {
  field: Field;
  op: "=" | "!=";
  value: string;
}

export interface ParsedLogQuery {
  fields: FieldFilter[];
  includes: string[];
  excludes: string[];
}

function unquote(raw: string): string {
  return raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw;
}

/** Splits on whitespace, but keeps a "quoted phrase" (even mid-token, e.g. service="a b") intact. */
function tokenize(query: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  const n = query.length;
  while (i < n) {
    if (/\s/.test(query[i])) {
      i++;
      continue;
    }
    const start = i;
    while (i < n && !/\s/.test(query[i])) {
      if (query[i] === '"') {
        i++;
        while (i < n && query[i] !== '"') i++;
      }
      i++;
    }
    tokens.push(query.slice(start, i));
  }
  return tokens;
}

export function parseLogQuery(query: string): ParsedLogQuery {
  const parsed: ParsedLogQuery = { fields: [], includes: [], excludes: [] };

  for (const token of tokenize(query)) {
    if (token.startsWith("|=")) {
      parsed.includes.push(unquote(token.slice(2).trim()).toLowerCase());
      continue;
    }
    if (token.startsWith("!=")) {
      parsed.excludes.push(unquote(token.slice(2).trim()).toLowerCase());
      continue;
    }

    const fieldMatch = token.match(/^([A-Za-z]+)(!=|=)([\s\S]*)$/);
    if (fieldMatch) {
      const [, rawField, op, rawValue] = fieldMatch;
      const field = rawField.toLowerCase() as Field;
      if (FIELDS.includes(field)) {
        parsed.fields.push({ field, op: op as "=" | "!=", value: unquote(rawValue).toLowerCase() });
        continue;
      }
    }

    parsed.includes.push(unquote(token).toLowerCase());
  }

  return parsed;
}

export function matchesLogQuery(log: LogEntry, parsed: ParsedLogQuery): boolean {
  for (const f of parsed.fields) {
    const actual = String(log[f.field] ?? "").toLowerCase();
    const isMatch = actual === f.value;
    if (f.op === "=" && !isMatch) return false;
    if (f.op === "!=" && isMatch) return false;
  }

  if (parsed.includes.length > 0 || parsed.excludes.length > 0) {
    const haystack = `${log.message} ${log.service}`.toLowerCase();
    if (parsed.includes.some((term) => term && !haystack.includes(term))) return false;
    if (parsed.excludes.some((term) => term && haystack.includes(term))) return false;
  }

  return true;
}

export function filterLogsByQuery(logs: LogEntry[], query: string): LogEntry[] {
  if (!query.trim()) return logs;
  const parsed = parseLogQuery(query);
  return logs.filter((log) => matchesLogQuery(log, parsed));
}
