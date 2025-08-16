const PAGE_SIZE = 9;
let ALL = [];
let PAGE = 1;

function el(html){ 
  const t = document.createElement('template'); 
  t.innerHTML = html.trim(); 
  return t.content.firstChild; 
}

// 🔹 1. CHANGED — Added locality filter population
function hydrateCityOptions(){
  const cities = Array.from(new Set(ALL.map(p=>p.city).filter(Boolean))).sort();
  const sel = document.querySelector('#city');
  sel.innerHTML = cities.map(c=>`<option>${c}</option>`).join('');

  // Add event listener to update locality dynamically when city changes
  sel.addEventListener('change', ()=>{
    const selectedCities = Array.from(sel.selectedOptions).map(o=>o.value);
    hydrateLocalityOptions(selectedCities);
  });
}

// 🔹 2. NEW FUNCTION — Populates locality options based on selected cities
function hydrateLocalityOptions(selectedCities){
  const localitySelect = document.querySelector('#locality');
  if(!localitySelect) return; // in case HTML doesn't have locality dropdown

  if(selectedCities.length === 0){
    localitySelect.innerHTML = '';
    return;
  }

  const localities = Array.from(new Set(
    ALL.filter(p=> selectedCities.includes(p.city))
       .map(p=>p.locality)
       .filter(Boolean)
  )).sort();

  localitySelect.innerHTML = localities.map(l=>`<option>${l}</option>`).join('');
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
  const cityEl = document.querySelector('#city');
  const citySel = cityEl 
    ? Array.from(cityEl.selectedOptions).map(o=>o.value) 
    : [];

  // 🔹 3. CHANGED — Added locality filter usage
  const localitySel = document.querySelector('#locality') 
    ? Array.from(document.querySelector('#locality').selectedOptions).map(o=>o.value)
    : [];

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

  activeFilterBadges({
    q, 
    city: citySel, 
    locality: localitySel, // 🔹 4. NEW — Show locality in badges
    price:`${minP||''}-${maxP||''}`, 
    type: ptype, 
    bhk, 
    furnished, 
    facing, 
    area:`${minA||''}-${maxA||''}`, 
    amenity
  });

  let filtered = ALL.filter(p=>{
    if(q){
      const t = (p.title+' '+p.project+' '+p.city+' '+p.locality+' '+p.address).toLowerCase();
      const pass = q.toLowerCase().split(/\s+/).every(tok=>t.includes(tok));
      if(!pass) return false;
    }
    if(citySel.length && !citySel.includes(p.city)) return false;

    // 🔹 5. NEW — Locality filter condition
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

async function init() {
  const data = await App.fetchSheetOrLocal();
  ALL = (data.properties || []).filter(p => p && p.title && p.title.trim() !== "");


  // ✅ Hydrate city/locality dropdowns if present
  if (document.querySelector('#city')) {
    hydrateCityOptions();
    hydrateLocalityOptions([]); // start empty
  } else if (document.querySelector('#locality')) {
    // Populate all localities if city filter is not present
    const localities = Array.from(new Set(
      ALL.map(p => p.locality).filter(Boolean)
    )).sort();
    document.querySelector('#locality').innerHTML =
      localities.map(l => `<option>${l}</option>`).join('');
  }

  // 🌟 Read ?city=&q= from URL and prefill inputs
  (() => {
    const params = new URLSearchParams(location.search);
    const q = params.get("q") || "";
    const c = params.get("city") || "";

    const qBox = document.querySelector("#q");
    if (qBox) qBox.value = q;

    const citySel = document.querySelector("#city");
    if (citySel && c) {
      [...citySel.options].forEach(o => {
        o.selected = (o.value === c);
      });
      hydrateLocalityOptions([c]); // ✅ Load localities for preselected city
    }
  })();

  apply();

  // Apply button click
  document.querySelector('#apply')?.addEventListener('click', () => {
    PAGE = 1;
    apply();
  });

  // ✅ Pill buttons click
document.querySelectorAll('.filter-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    PAGE = 1;
    apply();
  });
});

  // Reset button click
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

  // Live search as user types
  document.querySelector('#q')?.addEventListener('input', () => {
    PAGE = 1;
    apply();
  });

  // ✅ Update map markers
if (window.map && window.mapMarkers) {
  window.mapMarkers.clearLayers();

  slice.forEach(({p}) => {
    if (p.lat && p.lng) {
      const marker = L.marker([p.lat, p.lng]).addTo(window.mapMarkers);
      marker.bindPopup(`
        <b>${p.title}</b><br>
        ${p.locality || ''}, ${p.city || ''}
        <br><a href="details.html?id=${p.id}" target="_blank">View Details</a>
      `);
    }
  });

  if (slice.some(({p}) => p.lat && p.lng)) {
    const bounds = window.mapMarkers.getBounds();
    window.map.fitBounds(bounds, { padding: [50, 50] });
  }
}

}

init();

// ✅ Initialize Leaflet map (global map)
window.map = L.map('map').setView([13.0827, 80.2707], 10); // default center: Chennai

// Add OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(window.map);

// Create a global marker layer group
window.mapMarkers = L.layerGroup().addTo(window.map);

// ✅ Function to focus on a property (lat/lng OR address → map)
async function focusOnMap(lat, lng, title, address) {
  // Case 1: Use lat/lng if available
  if (lat && lng && window.map) {
    window.map.setView([lat, lng], 16);
    L.popup()
      .setLatLng([lat, lng])
      .setContent(`<b>${title}</b><br>${address || ''}`)
      .openOn(window.map);
    return;
  }

  // Case 2: Geocode address if no lat/lng
  if (address && window.map) {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
      const data = await res.json();

      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        window.map.setView([lat, lon], 16);
        L.popup()
          .setLatLng([lat, lon])
          .setContent(`<b>${title}</b><br>${address}`)
          .openOn(window.map);
      } else {
        alert("Couldn't find this address on the map.");
      }
    } catch (err) {
      console.error(err);
      alert("Error finding location.");
    }
  } else {
    alert("No location info available.");
  }
}

