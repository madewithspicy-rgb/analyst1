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

  var prompt = "You are a senior CRO specialist at Spicy Media agency.\n\nAnalyze this landing page and produce conversion optimization recommendations.\n" + siteSection + kbSection + manualSection + "\n\nIMPORTANT: Respond with ONLY valid JSON, no markdown fences, no text outside JSON.\n\nThe recommendations must be organized BY BLOCKS/SECTIONS of the website (like Block 1: Hero, Block 2: Benefits, Block 3: Services, etc). For each block describe exactly what text to change, what to add, what to remove. Include the exact new copy in American English written from scratch as a native speaker.\n\n{\n  \"site_name\": \"detected business name\",\n  \"url\": \"" + url + "\",\n  \"detected_niche\": \"niche in Russian\",\n  \"detected_audience\": \"target audience in Russian\",\n  \"detected_tone\": \"tone in Russian\",\n  \"detected_key_value\": \"key value in Russian\",\n  \"overall_assessment\": \"2-3 sentences in Russian about main conversion problems\",\n  \"conversion_score\": 5,\n  \"blocks\": [\n    {\n      \"number\": 1,\n      \"name\": \"Первый экран (Hero)\",\n      \"priority\": \"high\",\n      \"current_problem\": \"what is wrong now in Russian\",\n      \"changes\": [\n        {\n          \"element\": \"Заголовок\",\n          \"action\": \"exact instruction in Russian\",\n          \"copy_en\": \"new American English text or empty string\"\n        }\n      ]\n    }\n  ],\n  \"new_blocks\": [\n    {\n      \"number\": 4,\n      \"name\": \"Название нового блока\",\n      \"reason\": \"why add this block in Russian\",\n      \"content\": [\n        {\n          \"element\": \"Заголовок\",\n          \"copy_en\": \"American English text\"\n        }\n      ]\n    }\n  ],\n  \"tasks\": [\n    { \"who\": \"PM\", \"task\": \"task in Russian\" },\n    { \"who\": \"Designer\", \"task\": \"task in Russian\" },\n    { \"who\": \"Developer\", \"task\": \"task in Russian\" }\n  ]\n}\n\nAnalyze 4-7 existing blocks and suggest 1-3 new blocks if needed. Quick wins only (1-2 days, under $200). Apply Spicy Media framework: strong benefit headline, lead magnets, action CTAs, remove exit points, urgency triggers, you-focused copy, simple forms, real testimonials, thank you page.";

  var resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2500,
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
