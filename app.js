/**
 * app.js — Supabase-ready, single-file replacement
 * - Top-level ES module (no IIFE)
 * - fetchProperties() tries Supabase, then sheet CSV (CONFIG.SHEET_CSV_URL), then data.json
 * - Exports: fetchProperties, score, cardHTML, currency
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// === Replace with your project URL / anon key (or keep in config.js) ===
const supabase = createClient(
  "https://wedevtjjmdvngyshqdro.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlZGV2dGpqbWR2bmd5c2hxZHJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU0NzYwMzgsImV4cCI6MjA3MTA1MjAzOH0.Ex2c_sx358dFdygUGMVBohyTVto6fdEQ5nydDRh9m6M"
);

// currency formatter (top-level)
const currency = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

// Naive CSV parser kept for fallback (works if cells don't contain commas within quotes)
const parseCSV = (csv) => {
  if (!csv) return [];
  const lines = csv.trim().split(/\r?\n/);
  const headers = lines.shift().split(",").map((h) => h.trim());
  return lines.map((line) => {
    const cells = line.split(",").map((c) => c.trim());
    const obj = {};
    headers.forEach((h, i) => (obj[h] = cells[i] || ""));
    // Normalize similar to previous behavior
    obj.bhk = obj.bhk ? Number(obj.bhk) : undefined;
    obj.bathrooms = obj.bathrooms ? Number(obj.bathrooms) : undefined;
    obj.carpetAreaSqft = obj.carpetAreaSqft ? Number(obj.carpetAreaSqft) : undefined;
    obj.priceINR = obj.priceINR
      ? Number(String(obj.priceINR).replace(/[^\d]/g, ""))
      : undefined;
    obj.pricePerSqftINR = obj.pricePerSqftINR
      ? Number(String(obj.pricePerSqftINR).replace(/[^\d]/g, ""))
      : undefined;
    obj.lat = obj.lat ? Number(obj.lat) : undefined;
    obj.lng = obj.lng ? Number(obj.lng) : undefined;
    obj.images = obj.images ? obj.images.split(/\s*,\s*/).filter(Boolean) : [];
    obj.amenities = obj.amenities ? obj.amenities.split(/\s*,\s*/).filter(Boolean) : [];
    obj.owner = { name: obj.ownerName || "Owner", phone: obj.ownerPhone || "", whatsapp: obj.ownerWhatsapp || "" };
    return obj;
  });
};

/**
 * fetchProperties()
 *  - Primary: read from Supabase `properties` table
 *  - Fallback 1: CONFIG.SHEET_CSV_URL (if present)
 *  - Fallback 2: local ./data.json
 *
 * Returns { properties: [...] } — same shape your UI expects.
 */
async function fetchProperties() {
  // 1) Try Supabase
  try {
    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .order("listed_at", { ascending: false });

    if (!error && Array.isArray(data)) {
      const properties = data.map((obj) => ({
        id: obj.id,
        title: obj.title,
        project: obj.project || "",
        builder: obj.builder || "",
        listingStatus: obj.listing_status || (obj.is_verified ? "Verified" : "Unverified"),
        category: obj.category || "",
        type: obj.property_type || "",
        bhk: obj.bedrooms ?? undefined,
        bathrooms: obj.bathrooms ?? undefined,
        furnished: obj.furnished || "",
        carpetAreaSqft: obj.sqft ?? undefined,
        priceINR: obj.price_inr ?? undefined,
        priceDisplay: obj.price_display || (obj.price_inr ? `₹${Number(obj.price_inr).toLocaleString("en-IN")}` : "Price on request"),
        pricePerSqftINR: obj.price_per_sqft ?? (obj.price_inr && obj.sqft ? Math.round(Number(obj.price_inr) / obj.sqft) : undefined),
        facing: obj.facing || "",
        floor: obj.floor ?? undefined,
        floorsTotal: obj.floors_total ?? undefined,
        city: obj.city || "",
        locality: obj.locality || "",
        state: obj.state || "",
        address: obj.address || "",
        lat: obj.lat ?? undefined,
        lng: obj.lng ?? undefined,
        images: Array.isArray(obj.images) ? obj.images : (obj.images ? obj.images : []),
        amenities: Array.isArray(obj.amenities) ? obj.amenities : (obj.amenities ? obj.amenities : []),
        rera: obj.rera || "",
        docsLink: obj.docs_link || "",
        owner: {
          name: obj.owner_name || "Owner",
          phone: obj.owner_phone || "",
          whatsapp: obj.owner_whatsapp || ""
        },
        postedAt: obj.listed_at,
        summary: obj.description || ""
      }));

      return { properties };
    } else {
      console.warn("Supabase fetch returned error or no data:", error);
    }
  } catch (err) {
    console.warn("Supabase fetch exception:", err);
  }

  // 2) Fallback: Google Sheet CSV (if provided)
  const sheetUrl = (window.CONFIG && window.CONFIG.SHEET_CSV_URL) ? window.CONFIG.SHEET_CSV_URL : null;
  if (sheetUrl) {
    try {
      const res = await fetch(sheetUrl, { cache: "no-store" });
      if (res.ok) {
        const csv = await res.text();
        const properties = parseCSV(csv);
        return { properties };
      }
    } catch (e) {
      console.warn("Sheet CSV fetch failed:", e);
    }
  }

  // 3) Final fallback: local data.json
  try {
    const res = await fetch("./data.json");
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn("Local data.json fetch failed:", e);
  }

  // No data available
  return { properties: [] };
}

// scoring and card HTML (copied and kept intact but top-level)
function score(p, q, amenity) {
  let s = 0;
  const text = (p.title + " " + p.project + " " + p.city + " " + p.locality).toLowerCase();
  if (q) {
    q.split(/\s+/).forEach((tok) => {
      if (text.includes(tok.toLowerCase())) s += 8;
    });
  }
  if (p.postedAt) {
    const days = (Date.now() - new Date(p.postedAt).getTime()) / 86400000;
    s += Math.max(0, 10 - Math.min(10, days / 3));
  }
  if (p.pricePerSqftINR) {
    const v = p.pricePerSqftINR;
    if (v > 0) {
      s += 6 * (1 / (1 + Math.exp((v - 6000) / 800)));
    }
  }
  if (amenity && p.amenities) {
    const hit = p.amenities.some((a) => a.toLowerCase().includes(amenity.toLowerCase()));
    if (hit) s += 6;
  }
  return s;
}

function cardHTML(p, s) {
  const img = (p.images && p.images[0]) || "";
  const tags = [`${p.bhk || ""} BHK`, `${p.carpetAreaSqft || "-"} sqft`, p.furnished || "", p.facing ? `Facing ${p.facing}` : ""]
    .filter(Boolean)
    .map((t) => `<span class="tag">${t}</span>`)
    .join(" ");
  const price = p.priceDisplay || (p.priceINR ? currency(p.priceINR) : "Price on request");
  const pps = p.pricePerSqftINR ? `₹${p.pricePerSqftINR.toLocaleString("en-IN")}/sqft` : "";
  return `<article class="card" style="display:flex;flex-direction:column">
    <div class="card-img">
      <img src="${img}" alt="${p.title}">
      <div class="badge ribbon">Verified</div>
      <div class="tag score">Match ${Math.round((s / 30) * 100)}%</div>
    </div>
    <div style="padding:14px;display:flex;gap:12px;flex-direction:column">
      <div>
        <div style="font-weight:700;font-size:18px">${p.title}</div>
        <div style="color:var(--muted);font-size:13px">${(p.locality || "")}${p.city ? ", " + p.city : ""}</div>
      </div>
      <div class="row" style="justify-content:space-between">
        <div style="font-weight:800">${price}</div>
        <div style="color:var(--muted);font-size:12px">${pps}</div>
      </div>
      <div class="row" style="gap:8px;flex-wrap:wrap">${tags}</div>
      <div class="row">
        <a class="btn" href="./details.html?id=${encodeURIComponent(p.id)}">View details</a>
        <a class="btn secondary" href="./details.html?id=${encodeURIComponent(p.id)}#map">📍 View on Map</a>
        <a class="btn secondary" href="https://wa.me/${(p.owner && p.owner.whatsapp) || ""}?text=Hi%2C%20I%20saw%20${encodeURIComponent(p.title)}%20on%20Tharaga" target="_blank">WhatsApp</a>
      </div>
    </div>
  </article>`;
}

// Export top-level bindings (must be top-level — fixes ts1474)
export { fetchProperties, score, cardHTML, currency };

// === PRICE RANGE SLIDER HANDLER === (unchanged logic)
document.addEventListener("DOMContentLoaded", () => {
  const root = document.querySelector(".price-range");
  if (!root) return;

  // Config via data-attributes
  const RANGE_MIN = Number(root.dataset.min ?? 0);
  const RANGE_MAX = Number(root.dataset.max ?? 20000000); // 2 Cr
  const STEP = Number(root.dataset.step ?? 100000); // 1 L
  const GAP = Number(root.dataset.gap ?? 200000); // 2 L min gap

  const minSlider = document.getElementById("priceMinSlider");
  const maxSlider = document.getElementById("priceMaxSlider");
  const progress = root.querySelector(".range-progress");

  const minValueDisplay = document.getElementById("minPriceValue");
  const maxValueDisplay = document.getElementById("maxPriceValue");

  // Hidden inputs (keeps your existing filter/apply logic working)
  const minHidden = document.getElementById("minPrice");
  const maxHidden = document.getElementById("maxPrice");

  // Init sliders
  [minSlider, maxSlider].forEach((sl) => {
    sl.min = RANGE_MIN;
    sl.max = RANGE_MAX;
    sl.step = STEP;
  });

  // Default values (use existing values if present)
  const startMin = Number(minHidden?.value || RANGE_MIN);
  const startMax = Number(maxHidden?.value || RANGE_MAX);

  minSlider.value = Math.max(RANGE_MIN, Math.min(startMin, RANGE_MAX));
  maxSlider.value = Math.max(RANGE_MIN, Math.min(startMax, RANGE_MAX));

  function formatINRShort(num) {
    if (num >= 10000000) {
      const v = num / 10000000;
      return `₹${(Math.round(v * 10) / 10).toString()}Cr`;
    }
    if (num >= 100000) {
      const v = num / 100000;
      return `₹${Math.round(v)}L`;
    }
    return `₹${num.toLocaleString("en-IN")}`;
  }

  function clampWithGap() {
    let a = Number(minSlider.value);
    let b = Number(maxSlider.value);
    if (b - a < GAP) {
      if (this === minSlider) {
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

    const leftPct = ((a - RANGE_MIN) / (RANGE_MAX - RANGE_MIN)) * 100;
    const rightPct = 100 - ((b - RANGE_MIN) / (RANGE_MAX - RANGE_MIN)) * 100;
    progress.style.left = `${leftPct}%`;
    progress.style.right = `${rightPct}%`;

    minValueDisplay.textContent = formatINRShort(a);
    maxValueDisplay.textContent = formatINRShort(b);

    if (minHidden) minHidden.value = a;
    if (maxHidden) maxHidden.value = b;

    minHidden?.dispatchEvent(new Event("input", { bubbles: true }));
    maxHidden?.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function onSlide() {
    clampWithGap.call(this);
    updateUI();
  }

  minSlider.addEventListener("input", onSlide);
  maxSlider.addEventListener("input", onSlide);

  clampWithGap.call(maxSlider);
  updateUI();
});
