/**
 * Data source: Google Sheets "Publish to the web" (CSV) OR fallback to local data.json.
 * 1) Make a Google Sheet with headers:
 *    id,title,project,builder,listingStatus,category,type,bhk,bathrooms,furnished,
 *    carpetAreaSqft,priceINR,priceDisplay,pricePerSqftINR,facing,floor,floorsTotal,
 *    city,locality,state,address,lat,lng,images,amenities,rera,docsLink,ownerName,ownerPhone,ownerWhatsapp,postedAt,summary
 * 2) File → Share → Publish to the web → Entire sheet → CSV → Copy link.
 * 3) Set SHEET_CSV_URL in config.js to that link.
 */

const App = (() => {
  const currency = (n) => new Intl.NumberFormat('en-IN', {style:'currency', currency:'INR', maximumFractionDigits:0}).format(n);

  const parseCSV = (csv) => {
    const lines = csv.trim().split(/\r?\n/);
    const headers = lines.shift().split(',').map(h => h.trim());
    return lines.map(line => {
      // Naive CSV parsing – ok if your cells don't contain commas within quotes.
      const cells = line.split(',').map(c => c.trim());
      const obj = {};
      headers.forEach((h, i) => obj[h] = cells[i] || '');
      // Normalize
      obj.bhk = obj.bhk ? Number(obj.bhk) : undefined;
      obj.bathrooms = obj.bathrooms ? Number(obj.bathrooms) : undefined;
      obj.carpetAreaSqft = obj.carpetAreaSqft ? Number(obj.carpetAreaSqft) : undefined;
      obj.priceINR = obj.priceINR ? Number(String(obj.priceINR).replace(/[^\d]/g,'')) : undefined;
      obj.pricePerSqftINR = obj.pricePerSqftINR ? Number(String(obj.pricePerSqftINR).replace(/[^\d]/g,'')) : undefined;
      obj.lat = obj.lat ? Number(obj.lat) : undefined;
      obj.lng = obj.lng ? Number(obj.lng) : undefined;
      obj.images = obj.images ? obj.images.split(/\s*,\s*/).filter(Boolean) : [];
      obj.amenities = obj.amenities ? obj.amenities.split(/\s*,\s*/).filter(Boolean) : [];
      obj.owner = { name: obj.ownerName || 'Owner', phone: obj.ownerPhone || '', whatsapp: obj.ownerWhatsapp || '' };
      return obj;
    });
  };

  async function fetchSheetOrLocal() {
    const url = (window.CONFIG && window.CONFIG.SHEET_CSV_URL) ? window.CONFIG.SHEET_CSV_URL : null;
    if (url) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error('Sheet fetch failed');
        const csv = await res.text();
        const properties = parseCSV(csv);
        return { properties };
      } catch(e) {
        console.warn('Sheet fetch failed, falling back to data.json', e);
      }
    }
    const res = await fetch('./data.json');
    return await res.json();
  }

  function score(p, q, amenity) {
    let s = 0;
    const text = (p.title + ' ' + p.project + ' ' + p.city + ' ' + p.locality).toLowerCase();
    if(q){ q.split(/\s+/).forEach(tok => { if(text.includes(tok.toLowerCase())) s += 8; }); }
    if(p.postedAt){ const days = (Date.now() - new Date(p.postedAt).getTime())/86400000; s += Math.max(0, 10 - Math.min(10, days/3)); }
    if(p.pricePerSqftINR){ const v = p.pricePerSqftINR; if(v>0){ s += 6 * (1/(1+Math.exp((v-6000)/800))); } }
    if(amenity && p.amenities){ const hit = p.amenities.some(a=>a.toLowerCase().includes(amenity.toLowerCase())); if(hit) s += 6; }
    return s;
  }

  function cardHTML(p, s) {
    const img = (p.images && p.images[0]) || '';
    const tags = [`${p.bhk||''} BHK`, `${p.carpetAreaSqft||'-'} sqft`, p.furnished||'', p.facing?`Facing ${p.facing}`:'' ]
      .filter(Boolean).map(t=>`<span class="tag">${t}</span>`).join(' ');
    const price = p.priceDisplay || (p.priceINR ? currency(p.priceINR) : 'Price on request');
    const pps = p.pricePerSqftINR ? `₹${p.pricePerSqftINR.toLocaleString('en-IN')}/sqft` : '';
    return `<article class="card" style="display:flex;flex-direction:column">
      <div class="card-img">
        <img src="${img}" alt="${p.title}">
        <div class="badge ribbon">Verified</div>
        <div class="tag score">Match ${Math.round((s/30)*100)}%</div>
      </div>
      <div style="padding:14px;display:flex;gap:12px;flex-direction:column">
        <div>
          <div style="font-weight:700;font-size:18px">${p.title}</div>
          <div style="color:var(--muted);font-size:13px">${(p.locality||'')}${p.city? ', '+p.city:''}</div>
        </div>
        <div class="row" style="justify-content:space-between">
          <div style="font-weight:800">${price}</div>
          <div style="color:var(--muted);font-size:12px">${pps}</div>
        </div>
        <div class="row" style="gap:8px;flex-wrap:wrap">${tags}</div>
        <div class="row">
          <a class="btn" href="./details.html?id=${encodeURIComponent(p.id)}">View details</a>
          <a class="btn secondary" href="./details.html?id=${encodeURIComponent(p.id)}#map">📍 View on Map</a>
          <a class="btn secondary" href="https://wa.me/${(p.owner&&p.owner.whatsapp)||''}?text=Hi%2C%20I%20saw%20${encodeURIComponent(p.title)}%20on%20Tharaga" target="_blank">WhatsApp</a>
        </div>

      </div>
    </article>`;
  }

  return { fetchSheetOrLocal, score, cardHTML, currency };
})();

// === PRICE RANGE SLIDER HANDLER ===
// === PRICE RANGE SLIDER – full functionality ===
document.addEventListener('DOMContentLoaded', () => {
  const root = document.querySelector('.price-range');
  if (!root) return;

  // Config via data-attributes
  const RANGE_MIN = Number(root.dataset.min ?? 0);
  const RANGE_MAX = Number(root.dataset.max ?? 20000000);   // 2 Cr
  const STEP      = Number(root.dataset.step ?? 100000);     // 1 L
  const GAP       = Number(root.dataset.gap ?? 200000);      // 2 L min gap

  const minSlider = document.getElementById('priceMinSlider');
  const maxSlider = document.getElementById('priceMaxSlider');
  const progress  = root.querySelector('.range-progress');

  const minValueDisplay = document.getElementById('minPriceValue');
  const maxValueDisplay = document.getElementById('maxPriceValue');

  // Hidden inputs (keeps your existing filter/apply logic working)
  const minHidden = document.getElementById('minPrice');
  const maxHidden = document.getElementById('maxPrice');

  // Init sliders
  [minSlider, maxSlider].forEach(sl => {
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
    if (num >= 10000000) { // Crore
      const v = (num / 10000000);
      return `₹${(Math.round(v * 10) / 10).toString()}Cr`;
    }
    if (num >= 100000) {   // Lakh
      const v = (num / 100000);
      return `₹${Math.round(v)}L`;
    }
    return `₹${num.toLocaleString('en-IN')}`;
  }

  function clampWithGap() {
    let a = Number(minSlider.value);
    let b = Number(maxSlider.value);

    // keep thumbs at least GAP apart
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

    // progress bar left/right via percentages
    const leftPct  = ((a - RANGE_MIN) / (RANGE_MAX - RANGE_MIN)) * 100;
    const rightPct = 100 - ((b - RANGE_MIN) / (RANGE_MAX - RANGE_MIN)) * 100;
    progress.style.left  = `${leftPct}%`;
    progress.style.right = `${rightPct}%`;

    // labels
    minValueDisplay.textContent = formatINRShort(a);
    maxValueDisplay.textContent = formatINRShort(b);

    // hidden fields for your existing filters
    if (minHidden) minHidden.value = a;
    if (maxHidden) maxHidden.value = b;

    // If your filter listens to 'input' or 'change', emit one:
    minHidden?.dispatchEvent(new Event('input', { bubbles: true }));
    maxHidden?.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function onSlide() {
    clampWithGap.call(this);
    updateUI();
  }

  minSlider.addEventListener('input', onSlide);
  maxSlider.addEventListener('input', onSlide);

  // Initialize once
  clampWithGap.call(maxSlider);
  updateUI();
});
