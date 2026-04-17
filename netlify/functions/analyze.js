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
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "ANTHROPIC_API_KEY not configured in Netlify environment variables" }),
    };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  const { url, knowledgeBase, manualContext } = body;
  if (!url) return { statusCode: 400, headers, body: JSON.stringify({ error: "URL is required" }) };

  const callClaude = async (payload) => {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "web-search-2025-03-05",
      },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Anthropic API error ${resp.status}: ${err}`);
    }
    return resp.json();
  };

  // Step 1: Crawl the landing page via web_search
  const crawlData = await callClaude({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    tools: [{ type: "web_search_20250305", name: "web_search" }],
    messages: [{
      role: "user",
      content: `Search and retrieve the full content of this landing page: ${url}

Return ONLY a structured content dump, no commentary:
HEADLINES: all h1/h2/h3 text found
HERO: main headline, subline, CTA button text
SECTIONS: each section in order with key content
FORMS: what fields are present
TRUST: reviews, testimonials, logos, guarantees, stats
OFFERS: pricing, discounts, bonuses
NAVIGATION: all links in nav and footer
TONE: your assessment (formal/friendly/expert/creative)
LANGUAGE: site language`,
    }],
  });

  const siteContent = crawlData.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .slice(0, 4000);

  const kbSection = knowledgeBase
    ? `\nKNOWLEDGE BASE (uploaded by team — client brief, CRM data, past results, notes):\n${knowledgeBase.slice(0, 3000)}`
    : "";

  const manualSection = manualContext
    ? `\nADDITIONAL CONTEXT FROM TEAM:\n${manualContext}`
    : "";

  // Step 2: Generate full recommendations doc
  const recsData = await callClaude({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    messages: [{
      role: "user",
      content: `You are a senior CRO specialist at Spicy Media, a performance marketing agency with 7+ years experience. Analyze this landing page and produce a recommendations document for a designer/developer.

SITE CONTENT:
${siteContent}
${kbSection}
${manualSection}

INSTRUCTIONS:
1. AUTO-DETECT all context from the site: niche, target audience, tone of voice, key customer value proposition, market positioning.
2. If a knowledge base was provided, use it to deeply understand the client's product, audience pain points, past campaign results, and positioning.
3. Write 5–10 direct, specific, actionable recommendations — exact instructions a developer/designer can execute without guessing.
4. For any recommendation needing new copy: write fluent American English from scratch as a native speaker (do NOT translate).
5. Prioritize quick wins: implementable in 1–2 days, under $200.

MANDATORY CONVERSION CHECKLIST (apply these principles):
- Hero headline: specific benefit + timeframe or number ("Kitchen remodeled in 3 weeks, no surprises")
- Lead magnet on hero + near every form: Free Estimate / Instant Quote / Guide / Coupon
- Every CTA: action verb + specificity ("Get My Free Estimate" not "Submit")
- Remove exit points: unnecessary nav, WhatsApp (rarely used in USA), social links from main CTA zones
- Urgency triggers: "Answer in 15 min", limited-time offers, counters
- Rewrite "we"-copy to "you"-copy throughout
- Short punchy sentences, zero filler, zero corporate speak
- Lead form optimization: max 2–3 fields for max conversions (name + phone, or name + email)
- Thank You page: add warmup content (video, guide, founder story) so client remembers they applied
- Testimonials: must have real photo + full name + specific result (not generic "great service!")
- If comparison niche: add a simple 3–5 criteria comparison table vs alternatives

RESPOND WITH ONLY VALID JSON — no markdown fences, no text before or after:
{
  "site_name": "business name detected",
  "url": "${url}",
  "detected_niche": "...",
  "detected_audience": "...",
  "detected_tone": "...",
  "detected_key_value": "...",
  "overall_assessment": "2-3 sentences in Russian summarizing main conversion problems",
  "conversion_score": 5,
  "recommendations": [
    {
      "id": 1,
      "section": "Первый экран",
      "priority": "high",
      "title": "Короткое название правки",
      "action": "Detailed instruction in Russian — tell exactly what to change, remove, add. Be specific enough that a developer needs zero clarification.",
      "copy_en": "If new American English copy is needed, write the full text here. Otherwise empty string."
    }
  ],
  "tasks": [
    { "who": "PM", "task": "Specific task in Russian" },
    { "who": "Designer", "task": "..." },
    { "who": "Developer", "task": "..." }
  ]
}`,
    }],
  });

  const recsText = recsData.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  let parsed = null;
  try {
    const clean = recsText.replace(/```json|```/g, "").trim();
    const s = clean.indexOf("{");
    const e = clean.lastIndexOf("}");
    if (s !== -1 && e !== -1) parsed = JSON.parse(clean.slice(s, e + 1));
  } catch (_) {}

  return {
    statusCode: 200,
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ parsed, raw: recsText }),
  };
};
