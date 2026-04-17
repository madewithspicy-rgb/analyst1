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

  var context = "";
  if (siteText) context += "\nSITE TEXT:\n" + siteText.slice(0, 3000);
  if (knowledgeBase) context += "\nKNOWLEDGE BASE:\n" + knowledgeBase.slice(0, 1500);
  if (manualContext) context += "\nEXTRA CONTEXT:\n" + manualContext;

  var prompt = "CRO specialist at Spicy Media agency. Analyze landing page and return JSON only.\n\nURL: " + url + context + "\n\nReturn ONLY this JSON structure (no markdown):\n{\"site_name\":\"name\",\"url\":\"" + url + "\",\"detected_niche\":\"...\",\"detected_audience\":\"...\",\"detected_tone\":\"...\",\"detected_key_value\":\"...\",\"overall_assessment\":\"2-3 sentences in Russian\",\"conversion_score\":5,\"blocks\":[{\"number\":1,\"name\":\"Первый экран\",\"priority\":\"high\",\"current_problem\":\"in Russian\",\"changes\":[{\"element\":\"Заголовок\",\"action\":\"in Russian\",\"copy_en\":\"American English copy or empty\"}]}],\"new_blocks\":[{\"number\":5,\"name\":\"Block name\",\"reason\":\"in Russian\",\"content\":[{\"element\":\"Headline\",\"copy_en\":\"American English\"}]}],\"tasks\":[{\"who\":\"PM\",\"task\":\"in Russian\"},{\"who\":\"Designer\",\"task\":\"in Russian\"},{\"who\":\"Developer\",\"task\":\"in Russian\"}]}\n\nRules: 4-6 existing blocks, 1-2 new blocks. Each block has 1-3 specific changes. Focus: benefit headline, lead magnets, action CTAs, remove exit points, urgency, you-copy, simple forms, real testimonials, thank you page. All actions in Russian, all copy_en in American English written from scratch.";

  var resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!resp.ok) {
    var err = await resp.text();
    return { statusCode: 502, headers: headers, body: JSON.stringify({ error: "API " + resp.status + ": " + err }) };
  }

  var data = await resp.json();
  var text = data.content.filter(function(b){ return b.type==="text"; }).map(function(b){ return b.text; }).join("\n");

  var parsed = null;
  try {
    var clean = text.replace(/```json|```/g, "").trim();
    var s = clean.indexOf("{"), e = clean.lastIndexOf("}");
    if (s !== -1 && e !== -1) parsed = JSON.parse(clean.slice(s, e + 1));
  } catch(_) {}

  return {
    statusCode: 200,
    headers: Object.assign({}, headers, { "Content-Type": "application/json" }),
    body: JSON.stringify({ parsed: parsed, raw: text }),
  };
};
