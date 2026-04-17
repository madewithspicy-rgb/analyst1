Give 5-8 recommendations. Quick wins only (1-2 days, under $200). Apply:
- Hero: specific benefit headline with number/timeframe
- Lead magnet near every CTA (Free Estimate / Instant Quote / Guide / Coupon)
- CTA buttons: action verb + specificity ("Get My Free Estimate" not "Submit")
- Remove exit points: unnecessary nav, WhatsApp, social links from CTA zones
- Urgency: "We respond in 15 min", timers, limited offers
- Rewrite we/our to you/your throughout
- Lead form: 2-3 fields max
- Testimonials: real photo + full name + specific result
- Thank You page with warmup content`,
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
