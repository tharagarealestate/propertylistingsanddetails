// listings.js — the only renderer
import * as App from './app.js?v=20250825';

const PAGE_SIZE = 9;
let ALL = [];
let PAGE = 1;

function debounceLocal(fn, wait = 150){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), wait); }; }

function hydrateCityOptions(){
  const sel = document.querySelector('#city');
  if (!sel) return;
  const cities = Array.from(new Set(ALL.map(p=>p.city).filter(Boolean))).sort();
  sel.innerHTML = cities.map(c=>`<option value="${c}">${c}</option>`).join('');
  sel.addEventListener('change', ()=>{
    const selectedCities = Array.from(sel.selectedOptions).map(o=>o.value);
    hydrateLocalityOptions(selectedCities);
    PAGE=1; apply();
  });
}
function hydrateLocalityOptions(selectedCities){
  const localitySelect = document.querySelector('#locality');
  if (!localitySelect) return;
  const scope = (!selectedCities || selectedCities.length===0) ? ALL : ALL.filter(p=> selectedCities.includes(p.city));
  const localities = Array.from(new Set(scope.map(p=>p.locality).filter(Boolean))).sort();
  localitySelect.innerHTML = `<option value="All" selected>All</option>` + localities.map(l=>`<option value="${l}">${l}</option>`).join('');
}

function activeFilterBadges(filters){
  const wrap = document.querySelector('#activeFilters'); if(!wrap) return;
  const parts = [];
  Object.entries(filters).forEach(([k,v])=>{
    if(v && (Array.isArray(v) ? v.length : String(v).trim()!==''))
      parts.push(`<span class="tag">${k}: ${Array.isArray(v)? v.join(', '): v}</span>`);
  });
  wrap.innerHTML = parts.join(' ');
}

function apply(){
  const q = (document.querySelector('#q')?.value || "").trim();

  const activePill = document.querySelector('.filter-pill.active');
  const mode = activePill && activePill.dataset.type?.toLowerCase() !== 'all'
    ? (activePill.dataset.type || '').toLowerCase()
    : '';

  const cityEl = document.querySelector('#city');
  const citySel = cityEl ? Array.from(cityEl.selectedOptions).map(o=>o.value) : [];

  const localitySel = document.querySelector('#locality')
    ? Array.from(document.querySelector('#locality').selectedOptions).map(o=>o.value)
    : [];

  const minP = parseInt(document.querySelector('#minPrice')?.value||0) || 0;
  const maxP = parseInt(document.querySelector('#maxPrice')?.value||0) || 0;
  const ptype = document.querySelector('#ptype')?.value || '';
  const bhk = document.querySelector('#bhk')?.value || '';
  const furnished = document.querySelector('#furnished')?.value || '';
  const facing = document.querySelector('#facing')?.value || '';
  const minA = parseInt(document.querySelector('#minArea')?.value||0) || 0;
  const maxA = parseInt(document.querySelector('#maxArea')?.value||0) || 0;
  const amenity = (document.querySelector('#amenity')?.value || "").trim();
  const sort = document.querySelector('#sort')?.value || 'relevance';

  activeFilterBadges({ q, city: citySel, locality: localitySel, price:`${minP||''}-${maxP||''}`, type: ptype, bhk, furnished, facing, area:`${minA||''}-${maxA||''}`, amenity });

  let filtered = ALL.filter(p=>{
    if (mode) {
      const pc = String(p.category || p.propertyCategory || '').toLowerCase();
      if (pc !== mode) return false;
    }
    if (q) {
      const t = (p.title+' '+p.project+' '+p.city+' '+p.locality+' '+(p.address||'')).toLowerCase();
      const toks = q.toLowerCase().split(/\s+/).filter(Boolean);
      if (!toks.every(tok => t.includes(tok))) return false;
    }
    if (citySel.length && !citySel.includes(p.city)) return false;
    if (localitySel.length && !(localitySel.includes("All") || localitySel.includes(p.locality))) return false;
    if (minP && (p.priceINR||0) < minP) return false;
    if (maxP && (p.priceINR||0) > maxP) return false;
    if (ptype && p.type !== ptype) return false;
    if (bhk && String(p.bhk)!==String(bhk)) return false;
    if (furnished && p.furnished !== furnished) return false;
    if (facing && p.facing !== facing) return false;
    if (minA && (p.carpetAreaSqft||0) < minA) return false;
    if (maxA && (p.carpetAreaSqft||0) > maxA) return false;
    if (amenity && !(p.amenities||[]).some(a=>a.toLowerCase().includes(amenity.toLowerCase()))) return false;
    return true;
  }).map(p=>({ p, s: App.score(p, q, amenity) }));

  if(sort==='relevance'){ filtered.sort((a,b)=> b.s - a.s); }
  if(sort==='newest'){ filtered.sort((a,b)=> new Date(b.p.postedAt) - new Date(a.p.postedAt)); }
  if(sort==='priceLow'){ filtered.sort((a,b)=> (a.p.priceINR||0) - (b.p.priceINR||0)); }
  if(sort==='priceHigh'){ filtered.sort((a,b)=> (b.p.priceINR||0) - (a.p.priceINR||0)); }
  if(sort==='areaHigh'){ filtered.sort((a,b)=> (b.p.carpetAreaSqft||0) - (a.p.carpetAreaSqft||0)); }

  const total = filtered.length;
  const countEl = document.querySelector('#count'); if (countEl) countEl.textContent = `${total} result${total!==1?'s':''}`;

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  PAGE = Math.min(PAGE, pages);
  const start = (PAGE-1)*PAGE_SIZE;
  const slice = filtered.slice(start, start+PAGE_SIZE);

  const res = document.querySelector('#results');
  if (res) res.innerHTML = slice.map(({p,s})=> App.cardHTML(p, s)).join('') || `<div class="empty">No properties found</div>`;

  const pager = document.querySelector('#pager');
  if (pager) {
    pager.innerHTML = Array.from({length: pages}, (_,i)=>{
      const n = i+1; const cls = n===PAGE ? 'page active' : 'page';
      return `<button class="${cls}" data-page="${n}">${n}</button>`;
    }).join('');
  }
}

function goto(n){ PAGE = n; apply(); }
window.goto = goto; // if you need inline onclick, but we also delegate below.

function wireUI(){
  document.querySelector('#apply')?.addEventListener('click', ()=>{ PAGE=1; apply(); });
  const debApply = debounceLocal(()=>{ PAGE=1; apply(); }, 120);
  ['#minPrice','#maxPrice','#minArea','#maxArea','#amenity'].forEach(sel=> document.querySelector(sel)?.addEventListener('input', debApply));
  ['#sort','#ptype','#bhk','#furnished','#facing','#city','#locality'].forEach(sel=> document.querySelector(sel)?.addEventListener('change', ()=>{ PAGE=1; apply(); }));
  document.querySelector('#pager')?.addEventListener('click', (e)=>{ const b=e.target.closest('button'); if(!b) return; const n=Number(b.dataset.page||b.textContent); if(n) goto(n); });
  document.querySelector('#q')?.addEventListener('input', ()=>{ PAGE=1; apply(); });
  document.querySelectorAll('.filter-pill').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('.filter-pill').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active'); PAGE=1; apply();
    });
  });
  document.querySelector('#reset')?.addEventListener('click', ()=>{
    ['q','minPrice','maxPrice','ptype','bhk','furnished','facing','minArea','maxArea','amenity'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
    if (document.querySelector('#city')) Array.from(document.querySelector('#city').options).forEach(o=> o.selected=false);
    if (document.querySelector('#locality')) document.querySelector('#locality').value = "All";
    PAGE=1; apply();
  });
}

async function init(){
  ALL = await App.fetchProperties(); // single source of truth
  if (document.querySelector('#city')) { hydrateCityOptions(); hydrateLocalityOptions([]); }
  wireUI();
  apply();
}

init();
