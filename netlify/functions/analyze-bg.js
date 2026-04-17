const { getStore } = require("@netlify/blobs");

exports.handler = async function (event) {
  var headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: headers, body: "Method Not Allowed" };

  var ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) return { statusCode: 500, headers: headers, body: JSON.stringify({ error: "No API key" }) };

  var body;
  try { body = JSON.parse(event.body); }
  catch (e) { return { statusCode: 400, headers: headers, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  var url = body.url;
  var siteText = body.siteText || "";
  var knowledgeBase = body.knowledgeBase || "";
  var manualContext = body.manualContext || "";
  if (!url) return { statusCode: 400, headers: headers, body: JSON.stringify({ error: "URL required" }) };

  // Generate job ID
  var jobId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // Store job as pending in Blobs
  var store = getStore({ name: "jobs", consistency: "strong" });
  await store.setJSON(jobId, { status: "pending", createdAt: Date.now() });

  // Build prompt
  var context = "";
  if (siteText) context += "\nSITE TEXT:\n" + siteText.slice(0, 3500);
  if (knowledgeBase) context += "\nKNOWLEDGE BASE:\n" + knowledgeBase.slice(0, 2000);
  if (manualContext) context += "\nEXTRA CONTEXT:\n" + manualContext;

  var prompt = "You are a senior CRO specialist at Spicy Media agency (7+ years performance marketing).\n\nAnalyze this landing page and produce detailed conversion optimization recommendations.\n\nURL: " + url + context + "\n\nRespond with ONLY valid JSON, no markdown fences, no text outside JSON:\n{\n  \"site_name\": \"detected business name\",\n  \"url\": \"" + url + "\",\n  \"detected_niche\": \"niche in Russian\",\n  \"detected_audience\": \"target audience in Russian\",\n  \"detected_tone\": \"tone in Russian\",\n  \"detected_key_value\": \"key value proposition in Russian\",\n  \"overall_assessment\": \"2-3 sentences in Russian about main conversion problems\",\n  \"conversion_score\": 5,\n  \"blocks\": [\n    {\n      \"number\": 1,\n      \"name\": \"Первый экран (Hero)\",\n      \"priority\": \"high\",\n      \"current_problem\": \"what is wrong now in Russian\",\n      \"changes\": [\n        {\n          \"element\": \"Заголовок\",\n          \"action\": \"exact instruction in Russian for developer or designer\",\n          \"copy_en\": \"New American English text written from scratch as native speaker, or empty string\"\n        }\n      ]\n    }\n  ],\n  \"new_blocks\": [\n    {\n      \"number\": 5,\n      \"name\": \"Block name in Russian\",\n      \"reason\": \"why add this block in Russian\",\n      \"content\": [\n        {\n          \"element\": \"Заголовок\",\n          \"copy_en\": \"American English text\"\n        }\n      ]\n    }\n  ],\n  \"tasks\": [\n    { \"who\": \"PM\", \"task\": \"task in Russian\" },\n    { \"who\": \"Designer\", \"task\": \"task in Russian\" },\n    { \"who\": \"Developer\", \"task\": \"task in Russian\" }\n  ]\n}\n\nAnalyze 4-6 existing blocks with 2-4 changes each. Suggest 1-2 new blocks if needed.\nApply Spicy Media framework:\n- Hero: strong specific benefit headline with number or timeframe\n- Lead magnet near every CTA (Free Estimate / Instant Quote / Guide / Coupon)\n- CTA buttons: action verb + specificity (Get My Free Estimate not Submit)\n- Remove exit points: unnecessary nav links, WhatsApp (rare in USA), social links\n- Urgency triggers: respond in 15 min, limited time offers\n- Rewrite all we/our to you/your\n- Lead form: 2-3 fields max for max conversions\n- Testimonials: real photo + full name + specific measurable result\n- Thank You page with warmup content";

  // Call Claude API
  try {
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

    var data = await resp.json();
    var text = data.content.filter(function(b){ return b.type === "text"; }).map(function(b){ return b.text; }).join("\n");

    var parsed = null;
    try {
      var clean = text.replace(/```json|```/g, "").trim();
      var s = clean.indexOf("{"), e = clean.lastIndexOf("}");
      if (s !== -1 && e !== -1) parsed = JSON.parse(clean.slice(s, e + 1));
    } catch(_) {}

    await store.setJSON(jobId, { status: "done", parsed: parsed, raw: text, createdAt: Date.now() });
  } catch(err) {
    await store.setJSON(jobId, { status: "error", error: err.message, createdAt: Date.now() });
  }

  return {
    statusCode: 202,
    headers: Object.assign({}, headers, { "Content-Type": "application/json" }),
    body: JSON.stringify({ jobId: jobId }),
  };
};

exports.config = { type: "experimental-background" };
