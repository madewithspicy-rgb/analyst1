exports.handler = async function (event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: "Method Not Allowed" };

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }) };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  const { url, knowledgeBase, manualContext } = body;
  if (!url) return { statusCode: 400, headers, body: JSON.stringify({ error: "URL is required" }) };

  const kbSection = knowledgeBase ? `\nKNOWLEDGE BASE:\n${knowledgeBase.slice(0, 2000)}` : "";
  const manualSection = manualContext ? `\nADDITIONAL CONTEXT:\n${manualContext}` : "";

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "web-search-2025-03-05",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{
        role: "user",
        content: `You are a senior CRO specialist at Spicy Media agency.

Use web_search to fetch the landing page: ${url}
${kbSection}
${manualSection}

Then respond with ONLY valid JSON, no markdown, no text outside the JSON object:
{
  "site_name": "detected business name",
  "url": "${url}",
  "detected_niche": "...",
  "detected_audience": "...",
  "detected_tone": "...",
  "detected_key_value": "...",
  "overall_assessment": "2-3 sentences in Russian about main conversion problems on this site",
  "conversion_score": 5,
  "recommendations": [
    {
      "id": 1,
      "section": "Первый экран",
      "priority": "high",
      "title": "title in Russian",
      "action": "exact instruction in Russian — specific enough for developer/designer to execute with zero clarification",
      "copy_en": "American English copy written from scratch as native speaker, or empty string"
    }
  ],
  "tasks": [
    { "who": "PM", "task": "..." },
    { "who": "Designer", "task": "..." },
    { "who": "Developer", "task": "..." }
  ]
}

Give 5-8 recommendations. Quick wins only (1-2 days, under $200). Focus on:
hero headline with specific benefit, lead magnets near every CTA, button copy with action verbs, removing exit points (nav/social links), urgency triggers, you-focused copy (not we/our), form simplification to 2-3 fields, testimonials with photos and real names, thank you page.`,
      }],
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    return { statusCode: 502, headers, body: JSON.stringify({ error: `API error ${resp.status}: ${errText}` }) };
  }

  const data = await resp.json();
  const recsText = data.content.filter(b => b.type === "text").map(b => b.text).join("\n");

  let parsed = null;
  try {
    const clean = recsText.replace(/```json|```/g, "").trim();
    const s = clean.indexOf("{"), e = clean.lastIndexOf("}");
    if (s !== -1 && e !== -1) parsed = JSON.parse(clean.slice(s, e + 1));
  } catch (_) {}

  return {
    statusCode: 200,
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ parsed, raw: recsText }),
  };
};
