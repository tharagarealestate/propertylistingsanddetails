/* app.js — pure lib (no auto-render) */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CFG = (typeof window !== "undefined" && window.CONFIG) || {};
const SUPABASE_URL = CFG.SUPABASE_URL || "https://wedevtjjmdvngyshqdro.supabase.co";
const SUPABASE_ANON_KEY = CFG.SUPABASE_ANON_KEY || ""; // <-- set via window.CONFIG on prod
const SHEET_CSV_URL = CFG.SHEET_CSV_URL || null;

const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

/* ---------- utils ---------- */
export const currency = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

function toNumber(v){ if(v===null||v===undefined||v==="") return undefined; const n=Number(String(v).replace(/[^\d.-]/g,"").trim()); return Number.isFinite(n)?n:undefined; }
function toArray(val){
  if (Array.isArray(val)) return val.filter(Boolean);
  if (!val) return [];
  try { const p = JSON.parse(val); if (Array.isArray(p)) return p.filter(Boolean); } catch {}
  return String(val).split(",").map(s=>s.trim()).filter(Boolean);
}

/* ---------- normalizer ---------- */
export function normalizeRow(row = {}) {
  const r = (k) => row[k] ?? row[k.replace(/[A-Z]/g, m => "_"+m.toLowerCase())] ?? row[k.replace(/_([a-z])/g,(_,c)=>c.toUpperCase())];

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
    is_verified: r("is_verified") === true,
    listingStatus: r("listing_status") || "",
    category: r("category") || "",
    type: r("property_type") || r("type") || "",
    bhk: toNumber(r("bedrooms")) ?? toNumber(r("bhk")),
    bathrooms: toNumber(r("bathrooms")),
    furnished: r("furnished") || "",
    carpetAreaSqft: sqft,
    priceINR: price_inr,
    priceDisplay: r("price_display") || (price_inr ? currency(price_inr) : ""),
    pricePerSqftINR: pricePerSqft,
    facing: r("facing") || "",
    floor: toNumber(r("floor")) ?? undefined,
    floorsTotal: toNumber(r("floors_total")) ?? toNumber(r("floorsTotal")),
    city: r("city") || "",
    locality: r("locality") || "",
    state: r("state") || "",
    address: r("address") || "",
    lat: toNumber(r("lat")) ?? toNumber(r("latitude")),
    lng: toNumber(r("lng")) ?? toNumber(r("longitude")),
    images: toArray(r("images") || r("images_json") || r("images_array")),
    amenities: toArray(r("amenities") || r("amenities_array")),
    rera: r("rera") || "",
    docsLink: r("docs_link") || r("docsLink") || "",
    owner: {
      name: r("owner_name") || r("ownerName") || r("owner") || "Owner",
      phone: r("owner_phone") || r("ownerPhone") || "",
      whatsapp: "" // force hide
    },
    postedAt: r("listed_at") || r("postedAt") || r("listedAt") || undefined,
    summary: r("description") || r("summary") || ""
  };
}

/* ---------- fetchers ---------- */
async function fetchFromSupabase({ limit = 1000 } = {}) {
  if (!supabase) return [];
  const { data, error } = await supabase.from("properties").select("*").limit(limit);
  if (error) { console.warn("Supabase fetch error:", error); return []; }
  return (data || []).map(normalizeRow);
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
      const obj = {}; headers.forEach((h, i) => obj[h] = cells[i] || "");
      return normalizeRow(obj);
    });
    return rows;
  } catch(e){ console.warn("Sheet CSV fallback failed:", e); return []; }
}
async function fetchFromLocalJSON() {
  try {
    const res = await fetch("./data.json");
    if (!res.ok) throw new Error("data.json fetch failed");
    const json = await res.json();
    const arr = Array.isArray(json) ? json : (Array.isArray(json.properties) ? json.properties : []);
    return arr.map(normalizeRow);
  } catch(e){ console.warn("Local JSON fallback failed:", e); return []; }
}

/** Primary loader for listings.js */
export async function fetchProperties(){
  const supa = await fetchFromSupabase(); if (supa.length) return supa;
  const sheet = await fetchFromSheetCSV(); if (sheet.length) return sheet;
  return await fetchFromLocalJSON();
}

/* ---------- score + card ---------- */
export function score(p, q = "", amenity = "") {
  let s = 0;
  const text = ((p.title||"")+" "+(p.project||"")+" "+(p.city||"")+" "+(p.locality||"")).toLowerCase();
  if (q) q.toLowerCase().split(/\s+/).filter(Boolean).forEach(tok => { if (text.includes(tok)) s += 8; });
  if (p.postedAt) { const days=(Date.now()-new Date(p.postedAt).getTime())/86400000; s += Math.max(0, 10 - Math.min(10, days/3)); }
  if (p.pricePerSqftINR) { const v=p.pricePerSqftINR; if (v>0) s += 6*(1/(1+Math.exp((v-6000)/800))); }
  if (amenity && p.amenities?.some(a=>a.toLowerCase().includes(amenity.toLowerCase()))) s += 6;
  return s;
}
function escapeHtml(s){ if(!s && s!==0) return ""; return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;"); }

export function cardHTML(p, s) {
  const img = (p.images && p.images[0]) || "";
  const tags = [`${p.bhk||''} BHK`, `${p.carpetAreaSqft||'-'} sqft`, p.furnished||'', p.facing?`Facing ${p.facing}`:'' ].filter(Boolean).map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join(' ');
  const price = p.priceDisplay || (p.priceINR ? currency(p.priceINR) : 'Price on request');
  const pps = p.pricePerSqftINR ? `₹${Number(p.pricePerSqftINR).toLocaleString('en-IN')}/sqft` : '';

  // show a badge only if it's meaningful (e.g., Verified)
  const badge = p.is_verified ? 'Verified' : (p.listingStatus && p.listingStatus.toLowerCase() !== 'changed' ? p.listingStatus : '');

  return `<article class="card" data-id="${escapeHtml(p.id)}" style="display:flex;flex-direction:column">
    <div class="card-img">
      <img src="${escapeHtml(img)}" alt="${escapeHtml(p.title)}">
      ${badge ? `<div class="badge ribbon">${escapeHtml(badge)}</div>` : ''}
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
      </div>
    </div>
  </article>`;
}
