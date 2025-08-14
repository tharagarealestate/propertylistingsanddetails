# Tharaga Properties (Single Site, Google Sheets Powered)

- `index.html` → Listings with advanced filters
- `details.html` → Property details (gallery, map, EMI, contact modal, similar)
- `Google Sheets` backend via "Publish to web → CSV" (no server)
- **Durable embed** via iframe

## 1) Connect Google Sheets (live data)
Headers:
Publish to web → CSV. Paste the link in `config.js` → `SHEET_CSV_URL`.

## 2) Netlify
- Build command: none
- Publish directory: repo root
- Forms: `details.html` has Netlify form (enquiry).

## 3) Durable embed
```html
<iframe src="https://YOUR-SITE.netlify.app"
        width="100%"
        height="1100px"
        style="border:none;"></iframe>


---

### What’s “AI” here?
- **AI-style relevance**: weighted score on text match, recency, and price-per-sqft sanity (in `App.score`).
- **Match %** per card.
- **“AI enhance”** button to rewrite the description client-side (polish for marketing text).
- **Similar properties** logic (semantic-ish by city/type, quick fallback).

If you want true generative AI (server-side: lead scoring, comp-based pricing suggestions, copywriting with OpenAI, etc.), we can add a tiny Netlify function later. For now this is 100% static, free, and Durable-embed ready.
::contentReference[oaicite:0]{index=0}

