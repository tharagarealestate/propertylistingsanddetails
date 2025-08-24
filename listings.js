// listings.js — UI controller (ES module)
// Imports the data/util module (app.js) and runs the UI init.

import * as App from './app.js?v=20250823';

const PAGE_SIZE = 9;
let ALL = [];
let PAGE = 1;

function el(html){ const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }

/* -------------------- City / Locality helpers -------------------- */
function hydrateCityOptions(){
  const cities = Array.from(new Set(ALL.map(p=>p.city).filter(Boolean))).sort();
  const sel = document.querySelector('#city');
  if (!sel) return;
  sel.innerHTML = `<option value="">All cities</option>` + cities.map(c=>`<option value="${c}">${c}</option>`).join('');
  sel.addEventListener('change', ()=> {
    const selectedCities = sel.value ? [sel.value] : [];
    hydrateLocalityOptions(selectedCities);
    PAGE = 1; apply();
  });
}

function hydrateLocalityOptions(selectedCities){
  const localitySelect = document.querySelector('#locality');
  if(!localitySelect) return;
  if(!selectedCities || selectedCities.length === 0) {
    const localities = Array.from(new Set(ALL.map(p=>p.locality).filter(Boolean))).sort();
    localitySelect.innerHTML = `<option value="">All localities</option>` + localities.map(l=>`<option value="${l}">${l}</option>`).join('');
    return;
  }
  const localities = Array.from(new Set(
    ALL.filter(p=> selectedCities.includes(p.city))
       .map(p=>p.locality)
       .filter(Boolean)
  )).sort();
  localitySelect.innerHTML = `<option value="">All localities</option>` + localities.map(l=>`<option value="${l}">${l}</option>`).join('');
}

/* -------------------- Active badges -------------------- */
function activeFilterBadges(filters){
  const wrap = document.querySelector('#activeFilters');
  if(!wrap) return;
  const parts = [];
  Object.entries(filters).forEach(([k,v])=>{
    if(v && (Array.isArray(v) ? v.length : String(v).trim()!=='')){
      parts.push(`<span class="tag">${k}: ${Array.isArray(v)? v.join(', '): v}</span>`);
    }
  });
  wrap.innerHTML = parts.join(' ');
}

/* -------------------- Main apply() -------------------- */
function apply(){
  const q = (document.querySelector('#q')?.value || "").trim();

  const activePill = document.querySelector('.filter-pill.active');
  const mode = activePill ? (activePill.dataset.type || '').toLowerCase() : '';

  const cityEl = document.querySelector('#city');
  const citySel = cityEl && cityEl.value ? [cityEl.value] : [];

  const localitySel = document.querySelector('#locality') && document.querySelector('#locality').value ? [document.querySelector('#locality').value] : [];

  const minP = Number(document.querySelector('#minPrice')?.value || 0);
  const maxP = Number(document.querySelector('#maxPrice')?.value || 0);
  const ptype = document.querySelector('#ptype')?.value;
  const bhk = document.querySelector('#bhk')?.value;
  const furnished = document.querySelector('#furnished')?.value;
  const facing = document.querySelector('#facing')?.value;
  const minA = Number(document.querySelector('#minArea')?.value || 0);
  const maxA = Number(document.querySelector('#maxArea')?.value || 0);
  const amenity = (document.querySelector('#amenity')?.value || "").trim();
  const sort = document.querySelector('#sort')?.value || 'relevance';

  activeFilterBadges({
    q, city: citySel, locality: localitySel,
    price:`${minP||''}-${maxP||''}`, type: ptype, bhk, furnished, facing, area:`${minA||''}-${maxA||''}`, amenity
  });

  const filtered = ALL.filter(p=>{
    if (mode) {
      const pc = String(p.propertyCategory || p.category || '').toLowerCase();
      if (pc !== mode) return false;
    }

    if(q){
      const hay = ( (p.title||'') + ' ' + (p.project||'') + ' ' + (p.city||'') + ' ' + (p.locality||'') + ' ' + (p.address||'') + ' ' + (p.summary||'') ).toLowerCase();
      const pass = q.toLowerCase().split(/\s+/).every(tok=>hay.includes(tok));
      if(!pass) return false;
    }
    if(citySel.length && !citySel.includes(p.city)) return false;
    if(localitySel.length && !localitySel.includes(p.locality)) return false;
    if(minP && (p.priceINR||0) < minP) return false;
    if(maxP && (p.priceINR||0) > maxP) return false;
    if(ptype && p.type !== ptype) return false;
    if(bhk && String(p.bhk)!==String(bhk)) return false;
    if(furnished && p.furnished !== furnished) return false;
    if(facing && p.facing !== facing) return false;
    if(minA && (p.carpetAreaSqft||0) < minA) return false;
    if(maxA && (p.carpetAreaSqft||0) > maxA) return false;
    if(amenity && !(p.amenities||[]).some(a=>a.toLowerCase().includes(amenity.toLowerCase()))) return false;
    return true;
  }).map(p=>({ p, s: App.score(p, q, amenity) }));

  // Sorting
  if(sort==='relevance'){ filtered.sort((a,b)=> b.s - a.s); }
  if(sort==='newest'){ filtered.sort((a,b)=> new Date(b.p.postedAt) - new Date(a.p.postedAt)); }
  if(sort==='priceLow'){ filtered.sort((a,b)=> (a.p.priceINR||0) - (b.p.priceINR||0)); }
  if(sort==='priceHigh'){ filtered.sort((a,b)=> (b.p.priceINR||0) - (a.p.priceINR||0)); }
  if(sort==='areaHigh'){ filtered.sort((a,b)=> (b.p.carpetAreaSqft||0) - (a.p.carpetAreaSqft||0)); }

  const total = filtered.length;
  const countEl = document.querySelector('#count');
  if (countEl) countEl.textContent = `${total} result${total!==1?'s':''}`;

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  PAGE = Math.min(PAGE, pages);
  const start = (PAGE-1)*PAGE_SIZE;
  const slice = filtered.slice(start, start+PAGE_SIZE);

  const res = document.querySelector('#results');
  if (res) {
    res.innerHTML = slice.map(({p,s})=> App.cardHTML(p, s)).join('') || `<div class="empty">No properties found</div>`;
  }

  const pager = document.querySelector('#pager');
  if (pager) {
    pager.innerHTML = Array.from({length: pages}, (_,i)=>{
      const n = i+1; const cls = n===PAGE ? 'page active' : 'page';
      return `<button class="${cls}" onclick="goto(${n})">${n}</button>`;
    }).join('');
  }
}

/* expose goto to global for inline onclicks */
window.goto = function(n){ PAGE = n; apply(); };

/* -------------------- Initialization -------------------- */
async function init() {
  // 1) Try buyer form sessionStorage (if buyer form wrote matches)
  try {
    const stored = sessionStorage.getItem('tharaga_matches_v1');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed.results) && parsed.results.length) {
        console.log("Loaded matches from buyer form:", parsed.results.length);
        ALL = parsed.results.map(r => App.normalizeRow(r));
      }
    }
  } catch(e) {
    console.error("Error parsing buyer matches:", e);
  }

  // 2) try URL param matchId (AI matches)
  if (!ALL.length) {
    const params = new URLSearchParams(location.search);
    const matchId = params.get("matchId");
    if (matchId) {
      const row = await App.fetchMatchesById(matchId);
      if (row && Array.isArray(row.results)) {
        console.log("Loaded matches via ID:", matchId, row.results.length);
        ALL = row.results.map(r => App.normalizeRow(r));
      }
    }
  }

  // 3) fallback to Supabase / sheet / local
  if (!ALL.length) {
    try {
      const props = await App.fetchProperties();
      if (props && props.length) {
        ALL = props;
        console.log("Loaded properties from Supabase / fallback:", ALL.length);
      } else {
        const maybe = await App.fetchSheetOrLocal();
        ALL = (maybe && maybe.properties) ? maybe.properties : [];
        console.log("Loaded properties from sheet/local:", ALL.length);
      }
    } catch (e) {
      console.error("Error loading properties:", e);
      const maybe = await App.fetchSheetOrLocal();
      ALL = (maybe && maybe.properties) ? maybe.properties : [];
    }
  }

  // Hydrate UI selects (if present)
  if (document.querySelector('#city')) {
    hydrateCityOptions();
    hydrateLocalityOptions([]);
  } else if (document.querySelector('#locality')) {
    const localities = Array.from(new Set(ALL.map(p => p.locality).filter(Boolean))).sort();
    document.querySelector('#locality').innerHTML = `<option value="">All localities</option>` + localities.map(l => `<option value="${l}">${l}</option>`).join('');
  }

  // Prefill from URL query params
  (function prefill() {
    const params = new URLSearchParams(location.search);
    const q = params.get("q") || "";
    const c = params.get("city") || "";
    const qBox = document.querySelector("#q");
    if (qBox) qBox.value = q;
    const citySel = document.querySelector("#city");
    if (citySel && c) {
      citySel.value = c;
      hydrateLocalityOptions([c]);
    }
  })();

  // initialize slider and wire UI after DOM ready
  initSlider(); // guarded inside
  apply();
  wireUI();
}

/* -------------------- Slider (guarded) -------------------- */
function initSlider(){
  try {
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

    if (!minSlider || !maxSlider) return;

    [minSlider, maxSlider].forEach(sl => {
      sl.min = RANGE_MIN; sl.max = RANGE_MAX; sl.step = STEP;
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
      if (progress) { progress.style.left  = `${leftPct}%`; progress.style.right = `${rightPct}%`; }
      if (minValueDisplay) minValueDisplay.textContent = formatINRShort(a);
      if (maxValueDisplay) maxValueDisplay.textContent = formatINRShort(b);
      if (minHidden) minHidden.value = a;
      if (maxHidden) maxHidden.value = b;
      // emit input/change so apply() reacts
      minHidden?.dispatchEvent(new Event('input', {bubbles:true}));
      maxHidden?.dispatchEvent(new Event('input', {bubbles:true}));
    }

    function onMinSlide() { clampWithGap('min'); updateUI(); }
    function onMaxSlide() { clampWithGap('max'); updateUI(); }

    minSlider.addEventListener('input', onMinSlide);
    maxSlider.addEventListener('input', onMaxSlide);
    clampWithGap('max');
    updateUI();
  } catch (err) {
    console.error("Slider init error:", err);
  }
}

/* -------------------- UI wiring -------------------- */
function wireUI(){
  document.querySelectorAll('.filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      PAGE = 1; apply();
    });
  });

  document.querySelector('#reset')?.addEventListener('click', () => {
    ['q','minPrice','maxPrice','ptype','bhk','furnished','facing','minArea','maxArea','amenity']
      .forEach(id => { const el = document.querySelector('#' + id); if (el) el.value = ''; });
    const cityEl = document.querySelector('#city'); if (cityEl) cityEl.value = '';
    const localityEl = document.querySelector('#locality'); if (localityEl) localityEl.value = '';
    PAGE = 1; apply();
  });

  document.querySelector('#apply')?.addEventListener('click', () => { PAGE = 1; apply(); });
  document.querySelector('#q')?.addEventListener('input', () => { PAGE = 1; apply(); });

  ['#sort','#ptype','#bhk','#furnished','#facing','#locality','#city','#minArea','#maxArea','#amenity']
    .forEach(sel => { const el = document.querySelector(sel); if (el) el.addEventListener('change', () => { PAGE = 1; apply(); }); });
}

/* -------------------- Map focus helper -------------------- */
async function focusOnMap(lat, lng, title, address) {
  if (lat && lng && window.map) {
    window.map.setView([lat, lng], 16);
    L.popup().setLatLng([lat, lng]).setContent(`<b>${title}</b><br>${address || ''}`).openOn(window.map);
    return;
  }
  if (address && window.map) {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
      const data = await res.json();
      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        window.map.setView([lat, lon], 16);
        L.popup().setLatLng([lat, lon]).setContent(`<b>${title}</b><br>${address}`).openOn(window.map);
      } else {
        // no results
      }
    } catch (err) {
      console.error(err);
    }
  }
}

/* -------------------- Card click map centering -------------------- */
document.addEventListener('click', (ev) => {
  const card = ev.target.closest('.card');
  if (!card) return;
  const id = card.dataset.id;
  if (id) {
    const p = ALL.find(x => String(x.id) === String(id));
    if (p) {
      focusOnMap(p.lat, p.lng, p.title, p.address);
    }
  }
});

/* -------------------- Boot -------------------- */
document.addEventListener('DOMContentLoaded', () => {
  init().catch(e => console.error("Init error:", e));
});
