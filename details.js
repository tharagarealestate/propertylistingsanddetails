function qs(n){ return document.querySelector(n); }
function el(html){ const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }

function row(k,v){ return `<div class="spec-row"><div style="color:var(--muted)">${k}</div><div>${v||'—'}</div></div>`; }

function smartSummary(p){
  const bits = [];
  if(p.city) bits.push(`Located in ${p.locality? p.locality+', ':''}${p.city}.`);
  if(p.bhk) bits.push(`${p.bhk} BHK ${p.type||'home'} with ${p.carpetAreaSqft||'-'} sqft.`);
  if(p.furnished) bits.push(`${p.furnished}.`);
  if(p.facing) bits.push(`Vaastu: ${p.facing}-facing.`);
  if(p.amenities && p.amenities.length) bits.push(`Key amenities: ${p.amenities.slice(0,5).join(', ')}.`);
  return bits.join(' ');
}

function cardMini(p){
  const img = (p.images&&p.images[0]) || '';
  const price = p.priceDisplay || (p.priceINR? App.currency(p.priceINR) : '—');
  return `<a class="card" href="./details.html?id=${encodeURIComponent(p.id)}" style="overflow:hidden">
    <div class="card-img"><img src="${img}" alt="${p.title}"></div>
    <div style="padding:10px">
      <div style="font-weight:600">${p.title}</div>
      <div style="color:var(--muted);font-size:12px">${(p.locality||'')}${p.city? ', '+p.city:''}</div>
      <div style="margin-top:6px;font-weight:700">${price}</div>
    </div>
  </a>`;
}

async function init(){
  const id = new URLSearchParams(location.search).get('id');
  const data = await App.fetchSheetOrLocal();
  const all = data.properties || [];
  const p = all.find(x=>x.id===id) || all[0];
  if(!p){ document.body.innerHTML = '<p style="padding:24px">Property not found.</p>'; return; }

  // Gallery
  const imgs = (p.images||[]);
  const main = imgs[0] || '';
  const thumbs = imgs.slice(1,5).map(u=>`<img src="${u}" class="details-thumb">`).join('');
  qs('#gallery').innerHTML = `<div><img src="${main}" alt="${p.title}" style="width:100%;height:100%;object-fit:cover;border-radius:16px"></div>
                              <div class="grid" style="grid-template-columns:1fr;gap:10px">${thumbs}</div>`;

  // Headline
  qs('#title').textContent = `${p.id} — ${p.title}`;
  qs('#meta').textContent = `${p.type||''} • ${p.category||''} • ${(p.locality||'')}${p.city?', '+p.city:''}`;
  qs('#price').textContent = p.priceDisplay || (p.priceINR? App.currency(p.priceINR) : 'Price on request');
  qs('#pps').textContent = p.pricePerSqftINR? `₹${p.pricePerSqftINR.toLocaleString('en-IN')}/sqft` : '';
  qs('#match').textContent = `Match ${Math.round(Math.random()*20+80)}%`;

  // Tags
  const tags = [`${p.bhk||''} BHK`, `${p.carpetAreaSqft||'-'} sqft`, p.furnished||'', p.facing?`Facing ${p.facing}`:'', p.floor&&p.floorsTotal?`Floor ${p.floor}/${p.floorsTotal}`:'' ]
    .filter(Boolean).map(t=> `<span class="tag">${t}</span>`).join(' ');
  qs('#tags').innerHTML = tags;

  // Overview
  const ov = qs('#overview');
  ov.innerHTML = [
    row('Address', p.address),
    row('RERA', p.rera),
    row('Listing Status', p.listingStatus),
    row('Bathrooms', p.bathrooms),
    row('Project', p.project),
    row('Builder', p.builder),
  ].join('');

  // Summary + Smart Summary
  qs('#summary').textContent = p.summary || '';
  qs('#smartSummary').textContent = smartSummary(p);

  // Docs
  if(p.docsLink){
    qs('#docs').innerHTML = `<p><a class="btn secondary" href="${p.docsLink}" target="_blank">View Documents</a></p>`;
  }

  // Map (Address first → fallback to lat/lng → else hide)
  const mapWrap = qs('#map');
  const gmap = qs('#gmap');
  const openMaps = qs('#openMaps');

  if (p.address && p.address.trim()) {
    const q = encodeURIComponent(p.address);
    gmap.src = `https://www.google.com/maps?q=${q}&hl=en&z=15&output=embed`;
    if (openMaps) openMaps.href = `https://www.google.com/maps/search/?api=1&query=${q}`;
  } else if (p.lat && p.lng) {
    const q = `${p.lat},${p.lng}`;
    gmap.src = `https://www.google.com/maps?q=${q}&hl=en&z=15&output=embed`;
    if (openMaps) openMaps.href = `https://www.google.com/maps/search/?api=1&query=${q}`;
  } else {
    mapWrap.style.display = 'none';
  }


  // Owner
  const wa = (p.owner&&p.owner.whatsapp) || p.ownerWhatsapp || '';
  qs('#ownerName').textContent = (p.owner&&p.owner.name) || p.ownerName || 'Owner';
  qs('#waBtn').href = `https://wa.me/${wa}?text=Hi%2C%20I%20am%20interested%20in%20${encodeURIComponent(p.title)}%20(${encodeURIComponent(p.id)})`;

  // Enquiry Modal
  const modal = document.querySelector('#modal');
  document.querySelector('#contactBtn').addEventListener('click', ()=>{
    document.querySelector('#propIdField').value = p.id;
    modal.classList.remove('hidden');
  });
  document.querySelector('#closeModal').addEventListener('click', ()=> modal.classList.add('hidden'));

  // EMI calc
  const calc = ()=>{
    const P = parseFloat(document.querySelector('#loan').value||0);
    const r = parseFloat(document.querySelector('#rate').value||0)/1200;
    const n = parseInt(document.querySelector('#tenure').value||0)*12;
    if(P>0 && r>0 && n>0){
      const emi = (P*r*Math.pow(1+r,n))/(Math.pow(1+r,n)-1);
      document.querySelector('#emi').textContent = 'Estimated EMI: ' + App.currency(Math.round(emi));
    } else {
      document.querySelector('#emi').textContent = '';
    }
  };
  ['loan','rate','tenure'].forEach(id=> document.querySelector('#'+id).addEventListener('input', calc));

  // Similar (same city & type; else same city; else any 3)
  const pool = all.filter(x=> x.id!==p.id);
  let sim = pool.filter(x=> x.city===p.city && x.type===p.type);
  if(sim.length<3) sim = pool.filter(x=> x.city===p.city);
  if(sim.length<3) sim = pool.slice(0,3);
  qs('#similar').innerHTML = sim.slice(0,6).map(cardMini).join('');

  // "AI-style" enhance (client-side rewrite)
  document.querySelector('#enhanceBtn').addEventListener('click', ()=>{
    const base = p.summary || smartSummary(p);
    const enhanced = base
      .replace(/\s+/g,' ')
      .replace(/(^\w|\.\s+\w)/g, m => m.toUpperCase())
      .concat(' Ideal for end-use and investment. Schedule a visit today.');
    qs('#summary').textContent = enhanced;
  });

  // SEO JSON-LD
  const ld = {
    "@context":"https://schema.org",
    "@type": p.type || "Apartment",
    "name": p.title,
    "address": p.address,
    "geo": (p.lat && p.lng) ? { "@type":"GeoCoordinates", "latitude":p.lat, "longitude":p.lng } : undefined,
    "numberOfRooms": p.bhk,
    "floorSize": { "@type":"QuantitativeValue", "value": p.carpetAreaSqft, "unitCode":"FTK" },
    "offers": { "@type":"Offer", "price": p.priceINR, "priceCurrency":"INR", "availability":"https://schema.org/InStock" },
    "seller": { "@type":"Person", "name": (p.owner&&p.owner.name) || "Owner" }
  };
  const s = document.createElement('script'); s.type='application/ld+json'; s.textContent = JSON.stringify(ld); document.head.appendChild(s);

  // 🔹 Highlight map section if user clicked "View on Map"
  if (location.hash === "#map") {
    const mapEl = document.querySelector("#map");
    if (mapEl) {
      mapEl.scrollIntoView({ behavior: "smooth", block: "center" });
      mapEl.classList.add("highlight");
      setTimeout(() => mapEl.classList.remove("highlight"), 2000);
    }
  }

}
init();
