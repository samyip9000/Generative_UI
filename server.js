import express from "express";
import "dotenv/config";

const app = express();
app.use(express.json({ limit: "32kb" }));
app.use(express.static("."));

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL  = process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-4.5";
const PORT           = process.env.PORT || 3000;

const SYSTEM_PROMPT = `You are a creative front-end designer. You generate a SINGLE self-contained HTML document for a full-page weather-aware greeting card.

Hard requirements:
- Output ONLY raw HTML. No markdown fences, no prose, no commentary.
- One document, with all CSS inline inside <style> in <head>.
- NO <script> tags. NO external resources (no fonts, images, CDNs, fetch, links).
- <body> fills the viewport (margin:0; height:100vh; width:100vw; overflow:hidden).
- Use system fonts (-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif).
- Include at least one CSS @keyframes animation that fits the weather (drifting clouds, falling rain/snow, twinkling stars, swaying rays, lightning flashes, rolling fog, etc.).
- Use emoji or pure CSS shapes for illustration. Do not link to any image.
- Composition: full-bleed atmospheric background + a centered glassy/contrasting card containing a greeting headline, a short weather-aware message (one sentence), and the temperature, conditions, and location.
- Visual mood must match the weather AND the time of day (warm sunset oranges, stormy indigos, snowy pastels, deep night with stars, etc.).
- Be bold and design-forward. Treat each generation as a one-off poster.`;

function userPrompt({ tempC, description, weatherCode, isDay, timeOfDay, localTime, location }) {
  return `Generate the greeting page for these conditions:

- Weather: ${description} (WMO code ${weatherCode})
- Temperature: ${tempC}°C
- Day or night: ${isDay ? "day" : "night"}
- Time of day: ${timeOfDay}
- Local time: ${localTime}
- Location: ${location}

Write a greeting headline appropriate to the time of day, and a one-sentence message that gently acknowledges the weather. Then design the page around it.`;
}

function stripFences(text) {
  // Models occasionally wrap output in ```html ... ``` despite instructions.
  const fence = /^\s*```(?:html)?\s*([\s\S]*?)\s*```\s*$/i;
  const m = text.match(fence);
  return m ? m[1] : text;
}

app.post("/api/generate", async (req, res) => {
  if (!process.env.OPENROUTER_API_KEY) {
    return res.status(500).json({ error: "OPENROUTER_API_KEY is not set on the server." });
  }
  try {
    const ctx = req.body || {};
    const r = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type":  "application/json",
        "HTTP-Referer":  "http://localhost:" + PORT,
        "X-Title":       "Generative UI Weather Greeting",
      },
      body: JSON.stringify({
        model: ctx.model || DEFAULT_MODEL,
        max_tokens: 4000,
        temperature: 0.9,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user",   content: userPrompt(ctx) },
        ],
      }),
    });

    if (!r.ok) {
      const detail = await r.text();
      console.error("OpenRouter error:", r.status, detail);
      return res.status(502).json({ error: "OpenRouter request failed", status: r.status, detail });
    }

    const data = await r.json();
    const raw  = data?.choices?.[0]?.message?.content || "";
    const html = stripFences(raw).trim();

    if (!html.toLowerCase().includes("<html") && !html.toLowerCase().includes("<body")) {
      return res.status(502).json({ error: "Model did not return HTML.", raw });
    }

    res.json({ html, model: data.model || DEFAULT_MODEL });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`Generative UI server: http://localhost:${PORT}`);
  if (!process.env.OPENROUTER_API_KEY) {
    console.warn("⚠  OPENROUTER_API_KEY not set — /api/generate will fail. Copy .env.example → .env and add your key.");
  }
});
