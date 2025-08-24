// app.js — data + utilities (ES module)
// Exports: fetchProperties, fetchSheetOrLocal, fetchMatchesById, score, cardHTML, currency, normalizeRow

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ------------------- Configuration & Supabase ------------------- */
const CFG = (typeof window !== "undefined" && window.CONFIG) || {};
const isValid = v => typeof v === "string" && v.trim() && !/YOUR_ANON_KEY|YOUR_PROJECT_ID/i.test(v);

export const SUPABASE_URL = isValid(CFG.SUPABASE_URL) ? CFG.SUPABASE_URL : "https://wedevtjjmdvngyshqdro.supabase.co";
export const SUPABASE_ANON_KEY = isValid(CFG.SUPABASE_ANON_KEY) ? CFG.SUPABASE_ANON_KEY : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlZGV2dGpqbWR2bmd5c2hxZHJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU0NzYwMzgsImV4cCI6MjA3MTA1MjAzOH0.Ex2c_sx358dFdygUGMVBohyTVto6fdEQ5nydDRh9m6M";

if (!SUPABASE_ANON_KEY) {
  console.warn("Supabase anon key missing or placeholder. Set window.CONFIG.SUPABASE_ANON_KEY in config.js");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* -------------------------- Utilities --------------------------- */
export const currency = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

export function toNumber(v) {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(String(v).toString().replace(/[^\d.-]/g, "").trim());
  return Number.isFinite(n) ? n : undefined;
}

export function toArray(val) {
  if (Array.isArray(val)) return val.filter(Boolean);
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch (e) { /* ignore */ }
  return String(val).split(",").map((s) => s.trim()).filter(Boolean);
}

/* ------------------------- Normalizer --------------------------- */
export function normalizeRow(row = {}) {
  const r = (k) => row[k] ?? row[camelToSnake(k)] ?? row[snakeToCamel(k)];

  function camelToSnake(s) { return s.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase()); }
  function snakeToCamel(s) { return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase()); }

  const price_inr = toNumber(r("priceINR")) ?? toNumber(r("price_inr"));
  const sqft = toNumber(r("carpetAreaSqft")) ?? toNumber(r("sqft"));
  const pricePerSqft =
    toNumber(r("pricePerSqftINR")) ?? toNumber(r("price_per_sqft")) ??
    (price_inr && sqft ? Math.round(price_inr / Math.max(1, sqft)) : undefined);

  return {
    id: r("id") || undefined,
    title: r("title") || r("property_title") || "",
    project: r("project") || "",
    builder: r("builder") || "",
    listingStatus: r("listingStatus") || r("listing_status") || (r("is_verified") ? "Verified" : ""),
    category: r("category") || "",
    type: r("type") || r("property_type") || "",
    bhk: toNumber(r("bhk")) ?? toNumber(r("bedrooms")),
    bathrooms: toNumber(r("bathrooms")),
    furnished: r("furnished") || "",
    carpetAreaSqft: sqft,
    priceINR: price_inr,
    priceDisplay: r("priceDisplay") || r("price_display") || (price_inr ? currency(price_inr) : ""),
    pricePerSqftINR: pricePerSqft,
    facing: r("facing") || "",
    floor: toNumber(r("floor")) ?? undefined,
    floorsTotal: toNumber(r("floorsTotal")) ?? toNumber(r("floors_total")),
    city: r("city") || "",
    locality: r("locality") || "",
    state: r("state") || "",
    address: r("address") || "",
    lat: toNumber(r("lat")) ?? toNumber(r("latitude")),
    lng: toNumber(r("lng")) ?? toNumber(r("longitude")),
    images: toArray(r("images") || r("images_json") || r("images_array")),
    amenities: toArray(r("amenities") || r("amenities_array")),
    rera: r("rera") || "",
    docsLink: r("docsLink") || r("docs_link") || "",
    owner: {
      name: r("ownerName") || r("owner_name") || r("owner") || "Owner",
      phone: r("ownerPhone") || r("owner_phone") || "",
      whatsapp: r("ownerWhatsapp") || r("owner_whatsapp") || ""
    },
    postedAt: r("postedAt") || r("listed_at") || r("listedAt") || undefined,
    summary: r("summary") || r("description") || ""
  };
}

/* -------------------------- Fetchers ---------------------------- */
async function fetchFromSupabase({ limit = 1000 } = {}) {
  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .limit(limit);

  if (error) {
    console.warn("Supabase fetch error:", error);
    throw error;
  }
  if (!Array.isArray(data)) return [];
  return data.map(normalizeRow);
}

async function fetchFromSheetCSV() {
  if (!SHEET_CSV_URL) return [];
  try {
    const res = await fetch(SHEET_CSV_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("CSV fetch failed");
    const csv = await res.text();
    const lines = csv.trim().split(/\r?\n/);
    const headers = lines.shift().split(",").map(h => h.trim());
    const rows = lines.map(line => {
      const cells = line.split(",").map(c => c.trim());
      const obj = {};
      headers.forEach((h, i) => obj[h] = cells[i] || "");
      return normalizeRow(obj);
    });
    return rows;
  } catch (e) {
    console.warn("Sheet CSV fallback failed:", e);
    return [];
  }
}

async function fetchFromLocalJSON() {
  try {
    const res = await fetch("./data.json");
    if (!res.ok) throw new Error("data.json fetch failed");
    const json = await res.json();
    const arr = Array.isArray(json) ? json : (Array.isArray(json.properties) ? json.properties : []);
    return arr.map(normalizeRow);
  } catch (e) {
    console.warn("Local JSON fallback failed:", e);
    return [];
  }
}

/** wrapper used by listings when no DB available — returns object with properties[] */
export async function fetchSheetOrLocal() {
  const sheet = await fetchFromSheetCSV();
  if (sheet && sheet.length) return { properties: sheet };
  const local = await fetchFromLocalJSON();
  return { properties: local };
}

/** Try to fetch matches by id from /api endpoints OR from a possible ai_matches table */
export async function fetchMatchesById(matchId) {
  if (!matchId) return null;
  try {
    // try api endpoint first (you can implement this server-side)
    const r1 = await fetch(`/api/matches/${encodeURIComponent(matchId)}`);
    if (r1.ok) {
      const j = await r1.json();
      return j;
    }
  } catch (e) { /* ignore */ }

  try {
    const r2 = await fetch(`/api/matches?id=${encodeURIComponent(matchId)}`);
    if (r2.ok) return await r2.json();
  } catch (e) { /* ignore */ }

  // fallback: read from a hypothetical 'ai_matches' table in Supabase
  try {
    const { data, error } = await supabase.from("ai_matches").select("results").eq("id", matchId).limit(1);
    if (error) { console.warn("ai_matches table lookup error:", error); return null; }
    if (Array.isArray(data) && data.length) return data[0];
  } catch (e) {
    console.warn("fetchMatchesById supabase fallback error:", e);
  }
  return null;
}

/** Primary exported fetch for the app */
export async function fetchProperties() {
  try {
    const supa = await fetchFromSupabase();
    if (supa && supa.length) return supa;
  } catch (e) {
    // continue to fallback
  }

  const sheet = await fetchFromSheetCSV();
  if (sheet && sheet.length) return sheet;

  return await fetchFromLocalJSON();
}

/* --------------------------- Scoring ----------------------------- */
/** lightweight text overlap + recency + pricePSQ scoring (client preview) */
export function score(p, q = "", amenity = "") {
  let s = 0;
  const text = ((p.title || "") + " " + (p.project || "") + " " + (p.city || "") + " " + (p.locality || "")).toLowerCase();
  if (q) {
    q.split(/\s+/).forEach((tok) => { if (tok && text.includes(tok.toLowerCase())) s += 8; });
  }
  if (p.postedAt) {
    const days = (Date.now() - new Date(p.postedAt).getTime())/86400000;
    s += Math.max(0, 10 - Math.min(10, days/3));
  }
  if (p.pricePerSqftINR) {
    const v = p.pricePerSqftINR;
    if (v > 0) s += 6 * (1/(1 + Math.exp((v - 6000)/800)));
  }
  if (amenity && p.amenities) {
    const hit = p.amenities.some(a => a.toLowerCase().includes(amenity.toLowerCase()));
    if (hit) s += 6;
  }
  return s;
}

/* --------------------------- Card HTML --------------------------- */
export function escapeHtml(s) {
  if (!s && s !== 0) return "";
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function cardHTML(p, s) {
  const img = (p.images && p.images[0]) || "";
  const tags = [`${p.bhk||''} BHK`, `${p.carpetAreaSqft||'-'} sqft`, p.furnished||'', p.facing?`Facing ${p.facing}`:'' ]
    .filter(Boolean).map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join(' ');
  const price = p.priceDisplay || (p.priceINR ? currency(p.priceINR) : 'Price on request');
  const pps = p.pricePerSqftINR ? `₹${Number(p.pricePerSqftINR).toLocaleString('en-IN')}/sqft` : '';
  return `<article class="card" data-id="${escapeHtml(p.id)}" style="display:flex;flex-direction:column">
    <div class="card-img">
      <img src="${escapeHtml(img)}" alt="${escapeHtml(p.title)}">
      <div class="badge ribbon">${escapeHtml(p.listingStatus || "Verified")}</div>
      <div class="tag score">Match ${Math.round((s/30)*100)}%</div>
    </div>
    <div style="padding:14px;display:flex;gap:12px;flex-direction:column">
      <div>
        <div style="font-weight:700;font-size:18px">${escapeHtml(p.title)}</div>
        <div style="color:var(--muted);font-size:13px">${escapeHtml((p.locality||'') + (p.city ? ', ' + p.city : ''))}</div>
      </div>
      <div class="row" style="justify-content:space-between">
        <div style="font-weight:800">${escapeHtml(price)}</div>
        <div style="color:var(--muted);font-size:12px">${escapeHtml(pps)}</div>
      </div>
      <div class="row" style="gap:8px;flex-wrap:wrap">${tags}</div>
      <div class="row">
        <a class="btn" href="./details.html?id=${encodeURIComponent(p.id)}">View details</a>
        <a class="btn secondary" href="./details.html?id=${encodeURIComponent(p.id)}#map">📍 View on Map</a>
        <a class="btn secondary" href="https://wa.me/${encodeURIComponent((p.owner && p.owner.whatsapp) || '')}?text=Hi%2C%20I%20saw%20${encodeURIComponent(p.title)}%20on%20Tharaga" target="_blank">WhatsApp</a>
      </div>
    </div>
  </article>`;
}

/** Render listing array into given container selector */
function renderListings(listings = [], containerSelector = "#results") {
  const container = document.querySelector(containerSelector);
  if (!container) {
    console.warn("renderListings: container not found:", containerSelector);
    return;
  }
  // Build HTML
  const html = listings.map(p => {
    const s = score(p, (document.getElementById('q')?.value || ""), "");
    return cardHTML(p, s);
  }).join("\n");
  container.innerHTML = html || `<div class="empty">No properties found</div>`;
}
// === PRICE RANGE SLIDER HANDLER ===
// === PRICE RANGE SLIDER – full functionality ===
document.addEventListener('DOMContentLoaded', () => {
  const root = document.querySelector('.price-range');
  if (!root || root.dataset.initialized === '1') return;
  root.dataset.initialized = '1';

  const RANGE_MIN = Number(root.dataset.min ?? 0);
  const RANGE_MAX = Number(root.dataset.max ?? 20000000);
  const STEP      = Number(root.dataset.step ?? 100000);
  const GAP       = Number(root.dataset.gap ?? 200000);

  const minSlider = document.getElementById('priceMinSlider');
  const maxSlider = document.getElementById('priceMaxSlider');
  const progress  = root.querySelector('.range-progress');

  const minValueDisplay = document.getElementById('minPriceValue');
  const maxValueDisplay = document.getElementById('maxPriceValue');

  const minHidden = document.getElementById('minPrice');
  const maxHidden = document.getElementById('maxPrice');

  [minSlider, maxSlider].forEach(sl => {
    sl.min = RANGE_MIN;
    sl.max = RANGE_MAX;
    sl.step = STEP;
  });

  const startMin = Number(minHidden?.value || RANGE_MIN);
  const startMax = Number(maxHidden?.value || RANGE_MAX);
  minSlider.value = Math.max(RANGE_MIN, Math.min(startMin, RANGE_MAX));
  maxSlider.value = Math.max(RANGE_MIN, Math.min(startMax, RANGE_MAX));

  function formatINRShort(num) {
    if (num >= 10000000) return `₹${Math.round((num/10000000)*10)/10}Cr`;
    if (num >= 100000)   return `₹${Math.round(num/100000)}L`;
    return `₹${num.toLocaleString('en-IN')}`;
  }

  function clampWithGap(which) {
    let a = Number(minSlider.value);
    let b = Number(maxSlider.value);
    if (b - a < GAP) {
      if (which === 'min') {
        a = Math.min(a, RANGE_MAX - GAP);
        b = a + GAP;
        maxSlider.value = b;
      } else {
        b = Math.max(b, RANGE_MIN + GAP);
        a = b - GAP;
        minSlider.value = a;
      }
    }
  }

  function updateUI() {
    const a = Number(minSlider.value);
    const b = Number(maxSlider.value);

    const leftPct  = ((a - RANGE_MIN) / (RANGE_MAX - RANGE_MIN)) * 100;
    const rightPct = 100 - ((b - RANGE_MIN) / (RANGE_MAX - RANGE_MIN)) * 100;
    if (progress) {
      progress.style.left  = `${leftPct}%`;
      progress.style.right = `${rightPct}%`;
    }

    if (minValueDisplay) minValueDisplay.textContent = formatINRShort(a);
    if (maxValueDisplay) maxValueDisplay.textContent = formatINRShort(b);

    if (minHidden) minHidden.value = a;
    if (maxHidden) maxHidden.value = b;

    // notify filters listening on input/change
    minHidden?.dispatchEvent(new Event('input',  { bubbles: true }));
    maxHidden?.dispatchEvent(new Event('input',  { bubbles: true }));
    minHidden?.dispatchEvent(new Event('change', { bubbles: true }));
    maxHidden?.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function onMinSlide() { clampWithGap('min'); updateUI(); }
  function onMaxSlide() { clampWithGap('max'); updateUI(); }

  minSlider.addEventListener('input', onMinSlide);
  maxSlider.addEventListener('input', onMaxSlide);

  clampWithGap('max');
  updateUI();
});

/* -------------------------- Filtering logic ------------------------ */
/**
 * Apply filters based on UI controls:
 * - price range (hidden inputs with ids: minPrice, maxPrice)
 * - search text (input#searchInput)
 * - city/locality filters (optional)
 */
function applyFiltersAndRender() {
  const minHidden = document.getElementById("minPrice");
  const maxHidden = document.getElementById("maxPrice");
  const searchInput = document.getElementById('q');
  const min = toNumber(minHidden?.value) ?? 0;
  const max = toNumber(maxHidden?.value) ?? Number.POSITIVE_INFINITY;
  const q = (searchInput?.value || "").trim().toLowerCase();

  const filtered = PROPERTIES_CACHE.filter(p => {
    const price = p.priceINR ?? 0;
    if (price < min || price > max) return false;
    if (q) {
      const hay = (p.title + " " + p.project + " " + p.locality + " " + p.city + " " + (p.summary || "")).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // sort by score descending
  filtered.sort((a, b) => score(b, q) - score(a, q));

  renderListings(filtered);
}

/* Debounce helper */
function debounce(fn, wait = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

/* -------------------------- Bootstrapping -------------------------- */
async function initAndRender() {
  try {
  const test = await supabase.from("properties").select("id, title").limit(1);
  console.log("TEST select:", test);
} catch (e) {
  console.error("TEST select error:", e);
}
  try {
    // Load data once and cache
    PROPERTIES_CACHE = await fetchProperties();
  } catch (e) {
    console.error("Failed to load properties:", e);
    PROPERTIES_CACHE = [];
  }

  // initial render
  applyFiltersAndRender();

  // Hook UI events for live updates:
  const minHidden = document.getElementById("minPrice");
  const maxHidden = document.getElementById("maxPrice");
  const searchInput = document.getElementById("q");

  // The price slider logic dispatches 'input' events on minHidden/maxHidden already.
  if (minHidden) minHidden.addEventListener("input", debounce(applyFiltersAndRender, 50));
  if (maxHidden) maxHidden.addEventListener("input", debounce(applyFiltersAndRender, 50));
  if (searchInput) searchInput.addEventListener("input", debounce(applyFiltersAndRender, 200));
}

/* Init on DOM ready */
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    // safe init
    initAndRender().catch(err => console.error("init error:", err));
  });
}

/* -------------------------- Exports ------------------------------- */
export { fetchProperties, score, cardHTML, currency, normalizeRow };

