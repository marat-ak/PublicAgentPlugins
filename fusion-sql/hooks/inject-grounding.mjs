#!/usr/bin/env node
// UserPromptSubmit hook: retrieve the closest REAL Fusion report SQLs from the fusion-schema MCP
// (findSimilarQueries) for the user's prompt and inject them as additionalContext. This FORCES
// grounding for every request so weaker models can't skip the corpus and default to a wrong
// domain (e.g. HR "department" vs chart-of-accounts "department"). Non-fatal on any error.

let raw = "";
for await (const chunk of process.stdin) raw += chunk;

const done = (obj) => { process.stdout.write(JSON.stringify(obj)); process.exit(0); };

let prompt = "";
try { prompt = String(JSON.parse(raw).prompt ?? "").trim(); } catch {}
if (!prompt) done({});

const MCP = process.env.FUSION_MCP_URL || "http://fusion-schema-mcp:8979/mcp";

try {
  const body = JSON.stringify({
    jsonrpc: "2.0", id: 1, method: "tools/call",
    params: { name: "findSimilarQueries", arguments: { intent: prompt, limit: 4 } },
  });
  const res = await fetch(MCP, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body,
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();

  // Streamable-HTTP responses come back as SSE ("data: {json}") or plain JSON.
  let payload = null;
  for (const line of text.split(/\r?\n/)) {
    const s = line.startsWith("data:") ? line.slice(5).trim() : (line.trim().startsWith("{") ? line.trim() : "");
    if (s) { try { payload = JSON.parse(s); } catch {} }
  }
  const inner = payload?.result?.content?.[0]?.text;
  const items = inner ? JSON.parse(inner) : [];
  if (!Array.isArray(items) || items.length === 0) done({});

  let ctx =
    "## Grounding — real Fusion report queries closest to this request\n" +
    "The blocks below are ACTUAL Fusion report/OTBI/view SQLs, retrieved from a corpus of ~100k real " +
    "reports as the nearest semantic matches to the user's request. Treat them as GROUND TRUTH for the " +
    "correct **subject area / domain** and the **real tables**. If they contradict your first instinct " +
    "(a classic trap: an HR reading of a word like \"department\" vs a chart-of-accounts / financials " +
    "reading), TRUST THESE and adapt the closest one — do not fall back to remembered EBS tables. " +
    "Still validate exact names/columns with the schema tools before emitting SQL.\n\n";
  for (const it of items.slice(0, 4)) {
    const sql = String(it.cleanSql ?? "").replace(/\s+/g, " ").slice(0, 900);
    ctx += `### ${it.title}  (score ${Number(it.score).toFixed(2)}, ${it.source})\n`;
    ctx += `what it does: ${it.description}\n`;
    ctx += `tables: ${JSON.stringify(it.tablesUsed)}\n`;
    ctx += "```sql\n" + sql + "\n```\n\n";
  }
  done({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: ctx } });
} catch {
  done({});
}
