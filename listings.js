// listings.js — UI controller (uses app.js utilities)
import * as App from './app.js?v=20250823'; // small, safe import so App.* calls work

const PAGE_SIZE = 9;
let ALL = [];
let PAGE = 1;

function el(html){
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstChild;
}

/* ------------------ Local debounce (used by wireUI) ------------------ */
function debounceLocal(fn, wait = 150) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

/* ---------- hydrate city/locality helpers (keeps your logic) ---------- */
function hydrateCityOptions(){
  const cities = Array.from(new Set(ALL.map(p=>p.city).filter(Boolean))).sort();
  const sel = document.querySelector('#city');
  if (!sel) return;
  sel.innerHTML = cities.map(c=>`<option value="${c}">${c}</option>`).join('');
  sel.addEventListener('change', ()=> {
    const selectedCities = Array.from(sel.selectedOptions).map(o=>o.value);
    hydrateLocalityOptions(selectedCities);
    PAGE = 1; apply();
  });
}

function hydrateLocalityOptions(selectedCities){
  const localitySelect = document.querySelector('#locality');
  if(!localitySelect) return;
  if(!selectedCities || selectedCities.length === 0){
    localitySelect.innerHTML = '';
    return;
  }
  const localities = Array.from(new Set(
    ALL.filter(p=> selectedCities.includes(p.city))
       .map(p=>p.locality)
       .filter(Boolean)
  )).sort();
  localitySelect.innerHTML = localities.map(l=>`<option value="${l}">${l}</option>`).join('');
}

/* ---------- active filter badges ---------- */
function activeFilterBadges(filters){
  const wrap = document.querySelector('#activeFilters');
  if (!wrap) return;
  const parts = [];
  Object.entries(filters).forEach(([k,v])=>{
    if(v && (Array.isArray(v) ? v.length : String(v).trim()!==''))
      parts.push(`<span class="tag">${k}: ${Array.isArray(v)? v.join(', '): v}</span>`);
  });
  wrap.innerHTML = parts.join(' ');
}

/* ---------- the core apply() — uses App.cardHTML & App.score ---------- */
function apply(){
  const q = (document.querySelector('#q')?.value || "").trim();

  const activePill = document.querySelector('.filter-pill.active');
  const mode = activePill ? (activePill.dataset.type || '').toLowerCase() : '';
  const cityEl = document.querySelector('#city');
  const citySel = cityEl ? Array.from(cityEl.selectedOptions).map(o=>o.value) : [];

  const localitySel = document.querySelector('#locality')
    ? Array.from(document.querySelector('#locality').selectedOptions).map(o=>o.value)
    : [];

  const minP = parseInt(document.querySelector('#minPrice')?.value||0);
  const maxP = parseInt(document.querySelector('#maxPrice')?.value||0);
  const ptype = document.querySelector('#ptype')?.value || '';
  const bhk = document.querySelector('#bhk')?.value || '';
  const furnished = document.querySelector('#furnished')?.value || '';
  const facing = document.querySelector('#facing')?.value || '';
  const minA = parseInt(document.querySelector('#minArea')?.value||0);
  const maxA = parseInt(document.querySelector('#maxArea')?.value||0);
  const amenity = (document.querySelector('#amenity')?.value || "").trim();
  const sort = document.querySelector('#sort')?.value || 'relevance';

  activeFilterBadges({
    q,
    city: citySel,
    locality: localitySel,
    price:`${minP||''}-${maxP||''}`,
    type: ptype,
    bhk,
    furnished,
    facing,
    area:`${minA||''}-${maxA||''}`,
    amenity
  });

  let filtered = ALL.filter(p=>{
    if (mode) {
      const pc = String(p.propertyCategory || p.category || '').toLowerCase();
      if (pc !== mode) return false;
    }
    if(q){
      const t = (p.title+' '+p.project+' '+p.city+' '+p.locality+' '+(p.address||'')).toLowerCase();
      const pass = q.toLowerCase().split(/\s+/).every(tok=>t.includes(tok));
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

function goto(n){ PAGE = n; apply(); }

/* ------------------- wireUI: attach listeners for apply/reset/inputs ------------------- */
function wireUI(){
  // Apply button
  document.querySelector('#apply')?.addEventListener('click', () => { PAGE = 1; apply(); });

  // Reset button already wired lower in file; but ensure slider inputs trigger apply
  const minHidden = document.getElementById('minPrice');
  const maxHidden = document.getElementById('maxPrice');
  const debApply = debounceLocal(()=>{ PAGE=1; apply(); }, 120);
  minHidden?.addEventListener('input', debApply);
  maxHidden?.addEventListener('input', debApply);

  // generic selects & inputs
  ['#sort','#ptype','#bhk','#furnished','#facing','#city','#locality'].forEach(sel => {
    document.querySelector(sel)?.addEventListener('change', () => { PAGE = 1; apply(); });
  });
  document.querySelector('#minArea')?.addEventListener('input', debApply);
  document.querySelector('#maxArea')?.addEventListener('input', debApply);
  document.querySelector('#amenity')?.addEventListener('input', debApply);

  // pager delegation
  document.querySelector('#pager')?.addEventListener('click', (e)=>{
    const b = e.target.closest('button');
    if (!b) return;
    const n = Number(b.textContent);
    if (n) goto(n);
  });
}

/* -------------------------- init() — load data in the order buyer->matchId->supabase->sheet/local -------------------------- */
async function init() {
  // 1) Try sessionStorage matches (from buyer form)
  try {
    const stored = sessionStorage.getItem('tharaga_matches_v1');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed.results) && parsed.results.length) {
        console.log("Loaded matches from buyer form:", parsed.results.length);
        ALL = parsed.results.map(r => App.normalizeRow ? App.normalizeRow(r) : (normalizeRowFallback(r)));
      }
    }
  } catch(e) {
    console.error("Error parsing buyer matches:", e);
  }

  // 2) Try URL param matchId (AI matches)
  if (!ALL.length) {
    const params = new URLSearchParams(location.search);
    const matchId = params.get("matchId");
    if (matchId && typeof App.fetchMatchesById === 'function') {
      try {
        const row = await App.fetchMatchesById(matchId);
        if (row && Array.isArray(row.results)) {
          console.log("Loaded matches via ID:", matchId, row.results.length);
          ALL = row.results.map(r => App.normalizeRow ? App.normalizeRow(r) : normalizeRowFallback(r));
        }
      } catch (e) {
        console.error("fetchMatchesById error:", e);
      }
    }
  }

  // 3) Try Supabase (primary)
  if (!ALL.length) {
    try {
      if (typeof App.fetchProperties === 'function') {
        const supa = await App.fetchProperties();
        if (Array.isArray(supa) && supa.length) {
          ALL = supa; // already normalized in app.js
          console.log("Loaded properties from Supabase:", ALL.length);
        }
      }
    } catch (e) {
      console.warn("Supabase fetch failed, will try sheet/local:", e);
    }
  }

  // 4) Fallback: sheet/local
  if (!ALL.length) {
    try {
      const data = (typeof App.fetchSheetOrLocal === 'function') ? await App.fetchSheetOrLocal() : { properties: [] };
      ALL = (data.properties || []).filter(p => p && (p.title || p.property_title));
      console.log("Loaded properties from sheet/local:", ALL.length);
    } catch (e) {
      console.error("Error loading sheet/local fallback:", e);
      ALL = [];
    }
  }

  // Hydrate dropdowns
  if (document.querySelector('#city')) {
    hydrateCityOptions();
    hydrateLocalityOptions([]); // start empty
  } else if (document.querySelector('#locality')) {
    const localities = Array.from(new Set(ALL.map(p => p.locality).filter(Boolean))).sort();
    const locEl = document.querySelector('#locality');
    if (locEl) locEl.innerHTML = localities.map(l => `<option value="${l}">${l}</option>`).join('');
  }

  // Pre-fill from URL query
  (() => {
    const params = new URLSearchParams(location.search);
    const q = params.get("q") || "";
    const c = params.get("city") || "";
    const qBox = document.querySelector("#q"); if (qBox) qBox.value = q;
    const citySel = document.querySelector("#city");
    if (citySel && c) {
      [...citySel.options].forEach(o => { o.selected = (o.value === c); });
      hydrateLocalityOptions([c]);
    }
  })();

  // Wire UI and render
  wireUI();
  apply();
}

/* small fallback normalizer if App.normalizeRow missing */
function normalizeRowFallback(r){
  return {
    id: r.id || r._id || r.ID || '',
    title: r.title || r.property_title || 'Property',
    project: r.project || '',
    city: r.city || '',
    locality: r.locality || '',
    priceINR: r.price_inr || r.priceINR || 0,
    bhk: r.bhk || r.bedrooms || '',
    type: r.property_type || r.type || '',
    carpetAreaSqft: r.area_sqft || r.carpetAreaSqft || 0,
    furnished: r.furnished || '',
    facing: r.facing || '',
    amenities: r.amenities || r.amenities_array || []
  };
}

/* ------------------ DOM event handlers already present in original file (kept) ------------------ */
// Pill buttons
document.querySelectorAll('.filter-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    PAGE = 1;
    apply();
  });
});

// Reset button (kept)
document.querySelector('#reset')?.addEventListener('click', () => {
  ['q', 'minPrice', 'maxPrice', 'ptype', 'bhk', 'furnished', 'facing', 'minArea', 'maxArea', 'amenity']
    .forEach(id => {
      const el = document.querySelector('#' + id);
      if (el) el.value = '';
    });
  if (document.querySelector('#city')) {
    Array.from(document.querySelector('#city').options).forEach(o => o.selected = false);
  }
  if (document.querySelector('#locality')) {
    Array.from(document.querySelector('#locality').options).forEach(o => o.selected = false);
  }
  PAGE = 1;
  apply();
});

// Live search on q
document.querySelector('#q')?.addEventListener('input', () => {
  PAGE = 1;
  apply();
});

init();
