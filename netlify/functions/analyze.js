exports.handler = async function (event) {
  var headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: headers, body: "Method Not Allowed" };

  var ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    return { statusCode: 500, headers: headers, body: JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }) };
  }

  var body;
  try { body = JSON.parse(event.body); }
  catch (e) { return { statusCode: 400, headers: headers, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  var url = body.url;
  var knowledgeBase = body.knowledgeBase || "";
  var manualContext = body.manualContext || "";
  var siteText = body.siteText || "";

  if (!url) return { statusCode: 400, headers: headers, body: JSON.stringify({ error: "URL is required" }) };

  var kbSection = knowledgeBase ? "\nKNOWLEDGE BASE:\n" + knowledgeBase.slice(0, 2000) : "";
  var manualSection = manualContext ? "\nADDITIONAL CONTEXT:\n" + manualContext : "";
  var siteSection = siteText ? "\nSITE CONTENT:\n" + siteText.slice(0, 4000) : "\nSITE URL: " + url;

  var prompt = "You are a senior CRO specialist at Spicy Media agency.\n\nAnalyze this landing page and produce conversion optimization recommendations.\n" + siteSection + kbSection + manualSection + "\n\nRespond with ONLY valid JSON, no markdown fences, no text outside JSON:\n{\n  \"site_name\": \"detected business name\",\n  \"url\": \"" + url + "\",\n  \"detected_niche\": \"niche in Russian\",\n  \"detected_audience\": \"target audience in Russian\",\n  \"detected_tone\": \"tone in Russian\",\n  \"detected_key_value\": \"key value in Russian\",\n  \"overall_assessment\": \"2-3 sentences in Russian about main conversion problems\",\n  \"conversion_score\": 5,\n  \"recommendations\": [\n    {\n      \"id\": 1,\n      \"section\": \"Первый экран\",\n      \"priority\": \"high\",\n      \"title\": \"title in Russian\",\n      \"action\": \"exact instruction in Russian for developer/designer\",\n      \"copy_en\": \"American English copy from scratch, or empty string\"\n    }\n  ],\n  \"tasks\": [\n    { \"who\": \"PM\", \"task\": \"task in Russian\" },\n    { \"who\": \"Designer\", \"task\": \"task in Russian\" },\n    { \"who\": \"Developer\", \"task\": \"task in Russian\" }\n  ]\n}\n\nGive 5-8 recommendations. Quick wins only (1-2 days, under $200). Focus on: hero headline with specific benefit, lead magnets near every CTA, CTA button copy with action verbs, removing exit points, urgency triggers, you-focused copy, form 2-3 fields max, testimonials with photos and names, thank you page.";

  var resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!resp.ok) {
    var errText = await resp.text();
    return { statusCode: 502, headers: headers, body: JSON.stringify({ error: "API error " + resp.status + ": " + errText }) };
  }

  var data = await resp.json();
  var recsText = data.content.filter(function(b) { return b.type === "text"; }).map(function(b) { return b.text; }).join("\n");

  var parsed = null;
  try {
    var clean = recsText.replace(/```json|```/g, "").trim();
    var s = clean.indexOf("{");
    var e = clean.lastIndexOf("}");
    if (s !== -1 && e !== -1) parsed = JSON.parse(clean.slice(s, e + 1));
  } catch (err) {}

  return {
    statusCode: 200,
    headers: Object.assign({}, headers, { "Content-Type": "application/json" }),
    body: JSON.stringify({ parsed: parsed, raw: recsText }),
  };
};
