const PAGE_SIZE = 9;
let ALL = [];
let PAGE = 1;

function el(html){ const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }

function hydrateCityOptions(){
  const cities = Array.from(new Set(ALL.map(p=>p.city).filter(Boolean))).sort();
  const sel = document.querySelector('#city');
  sel.innerHTML = cities.map(c=>`<option>${c}</option>`).join('');
}

function activeFilterBadges(filters){
  const wrap = document.querySelector('#activeFilters');
  const parts = [];
  Object.entries(filters).forEach(([k,v])=>{
    if(v && (Array.isArray(v) ? v.length : String(v).trim()!=='')){
      parts.push(`<span class="tag">${k}: ${Array.isArray(v)? v.join(', '): v}</span>`);
    }
  });
  wrap.innerHTML = parts.join(' ');
}

function apply(){
  const q = document.querySelector('#q').value.trim();
  const citySel = Array.from(document.querySelector('#city').selectedOptions).map(o=>o.value);
  const minP = parseInt(document.querySelector('#minPrice').value||0);
  const maxP = parseInt(document.querySelector('#maxPrice').value||0);
  const ptype = document.querySelector('#ptype').value;
  const bhk = document.querySelector('#bhk').value;
  const furnished = document.querySelector('#furnished').value;
  const facing = document.querySelector('#facing').value;
  const minA = parseInt(document.querySelector('#minArea').value||0);
  const maxA = parseInt(document.querySelector('#maxArea').value||0);
  const amenity = document.querySelector('#amenity').value.trim();
  const sort = document.querySelector('#sort').value;

  activeFilterBadges({q, city: citySel, price:`${minP||''}-${maxP||''}`, type: ptype, bhk, furnished, facing, area:`${minA||''}-${maxA||''}`, amenity});

  let filtered = ALL.filter(p=>{
    if(q){
      const t = (p.title+' '+p.project+' '+p.city+' '+p.locality+' '+p.address).toLowerCase();
      const pass = q.toLowerCase().split(/\s+/).every(tok=>t.includes(tok));
      if(!pass) return false;
    }
    if(citySel.length && !citySel.includes(p.city)) return false;
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
  document.querySelector('#count').textContent = `${total} result${total!==1?'s':''}`;

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  PAGE = Math.min(PAGE, pages);
  const start = (PAGE-1)*PAGE_SIZE;
  const slice = filtered.slice(start, start+PAGE_SIZE);

  const res = document.querySelector('#results');
  res.innerHTML = slice.map(({p,s})=> App.cardHTML(p, s)).join('');

  const pager = document.querySelector('#pager');
  pager.innerHTML = Array.from({length: pages}, (_,i)=>{
    const n = i+1; const cls = n===PAGE ? 'page active' : 'page';
    return `<button class="${cls}" onclick="goto(${n})">${n}</button>`;
  }).join('');
}

function goto(n){ PAGE = n; apply(); }

async function init(){
  const data = await App.fetchSheetOrLocal();
  ALL = data.properties || [];
  hydrateCityOptions();
  apply();
  document.querySelector('#apply').addEventListener('click', ()=>{ PAGE=1; apply(); });
  document.querySelector('#reset').addEventListener('click', ()=>{
    ['q','minPrice','maxPrice','ptype','bhk','furnished','facing','minArea','maxArea','amenity']
      .forEach(id=> document.querySelector('#'+id).value='');
    Array.from(document.querySelector('#city').options).forEach(o=>o.selected=false);
    PAGE=1; apply();
  });
  document.querySelector('#q').addEventListener('input', ()=>{ PAGE=1; apply(); });
}
init();
