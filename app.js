/* Mobile-first viewer. Original data and map by MrCheeze. */
(() => {
'use strict';
const DATASETS = new Set(['map_locations','dungeons','hyrule_castle','trial']);
const MAX_DRAWN = 700, MAX_TYPES = 60, PAGE_SIZE = 65;
const PALETTE = ['#e7c883','#78dbbe','#eb9a8d','#a5c3fc','#d5adf8','#eaa3c5','#b5db86'];
const PRESETS = [
 ['All',()=>true],
 ['Attack Up',s=>/Animal_Insect_G|Item_Plant_G|Item_Fruit_H|Item_Mushroom_L|Animal_Fish_E|Item_FishGet_E|Animal_Insect_K|Animal_Fish_F|Item_FishGet_F/.test(s)],
 ['Speed',s=>/Animal_Insect_S|Item_MushroomGet_D|Item_Mushroom_D|Item_PlantGet_M|Item_Plant_M|Animal_Insect_A|Item_Plant_O|Item_Fruit_E|Item_PlantGet_O/.test(s)],
 ['Fireproof',s=>s.includes('Animal_Insect_X')],
 ['Cooking',s=>s.includes('Item_CookSet')],
 ['Horses',s=>/WildHorseCreateTag|GameRomHorse/.test(s)],
 ['Bosses',s=>/Enemy_Giant_|Enemy_Golem_|Enemy_Lynel_|Enemy_Sandworm|Enemy_Assassin_Senior/.test(s)],
 ['Chests',s=>s.includes('TBox')],
 ['DLC',s=>/Aoc|HARD:/.test(s)]
];
const $ = id=>document.getElementById(id);
const ui = {sheet:$('sheet'),body:$('sheet-body'),toggle:$('sheet-toggle'),active:$('active-count'),list:$('result-list'),search:$('search'),count:$('result-count'),more:$('load-more'),select:$('select-visible'),clear:$('clear-selected'),searchClear:$('search-clear'),toast:$('status-toast')};
if(!window.L){ui.count.textContent='Map engine unavailable';ui.list.textContent='Could not load the map library. Check your connection and refresh.';return;}
const storageGet=k=>{try{return localStorage.getItem(k)}catch(_){return null}};
let dataset=new URLSearchParams(location.search).get('list')||storageGet('botw-mobile-dataset')||'map_locations';
if(!DATASETS.has(dataset))dataset='map_locations';
let locations={},names=[],filtered=[],selected=new Set(),presetIndex=0,shown=PAGE_SIZE;
let ready=false,sheetPosition='peek',overlay=null,highDefinition=false,imageRequest=0,renderTimer=0,renderFrame=0,toastTimer=0;
const map=L.map('map',{crs:L.CRS.Simple,preferCanvas:true,center:[0,0],zoom:-5,minZoom:-6,maxZoom:3,zoomControl:false,attributionControl:false,tap:false});
const bounds=L.latLngBounds(map.unproject([-6000,5000],0),map.unproject([6000,-5000],0));
const markerLayer=L.layerGroup().addTo(map);
map.fitBounds(bounds,{padding:[8,8]});map.setMaxBounds(bounds);
function imageURL(hd){return 'https://wsrv.nl/?url='+encodeURIComponent(new URL('BotW-Map-Grid.png',location.href).href)+'&w='+(hd?4096:2560)+'&output=webp&q='+(hd?83:74)}
function setImage(hd){
 const request=++imageRequest;
 const candidate=L.imageOverlay(imageURL(hd),bounds).addTo(map),img=candidate.getElement();
 if(!img)return;
 img.style.zIndex='-1';
 img.addEventListener('load',()=>{if(request!==imageRequest){map.removeLayer(candidate);return;}if(overlay&&overlay!==candidate)map.removeLayer(overlay);overlay=candidate;if(hd)notice('HD map loaded.');},{once:true});
 img.addEventListener('error',()=>{map.removeLayer(candidate);if(request!==imageRequest)return;if(overlay){highDefinition=false;$('map-style').classList.remove('active');$('map-style').setAttribute('aria-pressed','false');notice('Optimized map unavailable; keeping previous image.');return;}
 const fallback=L.imageOverlay('BotW-Map-Grid.png',bounds).addTo(map);overlay=fallback;const original=fallback.getElement();if(original){original.style.zIndex='-1';original.addEventListener('error',()=>notice('Map image failed to load. Check your connection.'),{once:true});}notice('Using original map image; first load may be slow.');},{once:true});
}
setImage(false);
function notice(msg,duration=3200){clearTimeout(toastTimer);ui.toast.textContent=msg;ui.toast.hidden=false;toastTimer=setTimeout(()=>ui.toast.hidden=true,duration)}
function setSheet(position){sheetPosition=position;ui.sheet.className='sheet sheet-'+position;const open=position!=='peek';ui.body.inert=!open;ui.toggle.setAttribute('aria-expanded',String(open));ui.sheet.querySelector('.chevron').textContent=open?'⌄':'⌃';setTimeout(()=>map.invalidateSize({pan:false}),280)}
function persist(){try{localStorage.setItem('botw-mobile-selected-'+dataset,JSON.stringify([...selected]));}catch(_){}ui.active.textContent=selected.size+' active';ui.clear.disabled=selected.size===0}
function displayName(name){const entry=locations[name];return entry&&typeof entry.display_name==='string'&&entry.display_name?entry.display_name:name}
function loadData(){
 ready=false;ui.count.textContent='Loading object data…';ui.list.replaceChildren();ui.select.disabled=true;ui.clear.disabled=true;ui.more.hidden=true;
 const script=document.createElement('script');script.src=dataset+'.js';script.async=true;
 script.onload=()=>{if(!window.locations||typeof window.locations!=='object'){loadError();return;}locations=window.locations;names=Object.keys(locations).filter(n=>locations[n]&&Array.isArray(locations[n].locations)).sort((a,b)=>displayName(a).localeCompare(displayName(b)));
 try{const saved=JSON.parse(storageGet('botw-mobile-selected-'+dataset)||'[]');selected=new Set(Array.isArray(saved)?saved.filter(n=>typeof n==='string'&&locations[n]).slice(0,MAX_TYPES):[])}catch(_){selected=new Set()}
 ready=true;persist();applyFilters();scheduleRender();notice('Loaded '+names.length.toLocaleString()+' object types.');};
 script.onerror=loadError;document.head.append(script);
}
function loadError(){ready=false;ui.count.textContent='Could not load object data';const message=document.createElement('div');message.className='empty';message.textContent='Could not load the object database. Check your connection and refresh.';ui.list.replaceChildren(message);notice('Object database unavailable.')}
function applyFilters(){if(!ready)return;const term=ui.search.value.trim().toLocaleLowerCase(),accepts=PRESETS[presetIndex][1];filtered=names.filter(n=>accepts(n)&&(!term||n.toLocaleLowerCase().includes(term)||displayName(n).toLocaleLowerCase().includes(term)));shown=PAGE_SIZE;updateResults()}
function updateResults(){if(!ready)return;ui.list.replaceChildren();const fragment=document.createDocumentFragment();
 for(const name of filtered.slice(0,shown)){
 const row=document.createElement('div');row.className='result-row';row.setAttribute('role','listitem');const label=document.createElement('label');const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=selected.has(name);checkbox.setAttribute('aria-label','Show '+displayName(name)+' on map');checkbox.addEventListener('change',()=>selectName(name,checkbox.checked));
 const texts=document.createElement('span');texts.className='result-label';const title=document.createElement('span');title.className='display-name';title.textContent=displayName(name);texts.append(title);
 if(name!==displayName(name)){const detail=document.createElement('span');detail.className='internal-name';detail.textContent=name;texts.append(detail)}label.append(checkbox,texts);
 const count=document.createElement('span');count.className='point-count';count.textContent=locations[name].locations.length.toLocaleString();count.title='Object locations';
 const jump=document.createElement('button');jump.type='button';jump.className='jump';jump.textContent='⌖';jump.title='Jump to first '+displayName(name)+' location';jump.setAttribute('aria-label',jump.title);jump.addEventListener('click',()=>jumpTo(name));row.append(label,count,jump);fragment.append(row);
 }
 if(!filtered.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='No matching objects. Try a different search or category.';fragment.append(empty)}
 ui.list.append(fragment);ui.count.textContent=filtered.length.toLocaleString()+' matching types';ui.more.hidden=shown>=filtered.length;ui.select.disabled=filtered.length===0;persist();
}
function selectName(name,on){if(on&&selected.size>=MAX_TYPES&&!selected.has(name)){notice('Limit: '+MAX_TYPES+' categories. Clear one first.');updateResults();return;}if(on)selected.add(name);else selected.delete(name);persist();scheduleRender()}
function jumpTo(name){const pos=locations[name]?.locations?.[0];if(!pos){notice('No location recorded for this object.');return;}if(!selected.has(name))selectName(name,true);map.setView(map.unproject(pos,0),Math.max(map.getZoom(),-1),{animate:false});setSheet('peek');scheduleRender()}
function scheduleRender(){if(!ready)return;clearTimeout(renderTimer);renderTimer=setTimeout(drawVisible,90)}
function drawVisible(){if(!ready)return;cancelAnimationFrame(renderFrame);renderFrame=requestAnimationFrame(()=>{
 markerLayer.clearLayers();if(!selected.size)return;
 const view=map.getBounds(),sw=map.project(view.getSouthWest(),0),ne=map.project(view.getNorthEast(),0);const minX=Math.min(sw.x,ne.x),maxX=Math.max(sw.x,ne.x),minY=Math.min(sw.y,ne.y),maxY=Math.max(sw.y,ne.y);
 const zoom=map.getZoom(),useBuckets=zoom<1,cell=zoom<-3?48:zoom<-1?36:28,buckets=new Map();let matching=0;
 for(const [index,name] of [...selected].entries()){
 for(const pos of locations[name]?.locations||[]){if(!Array.isArray(pos)||pos.length<2)continue;const [x,y]=pos;if(x<minX||x>maxX||y<minY||y>maxY)continue;matching++;
 const ll=map.unproject(pos,0),screen=map.latLngToContainerPoint(ll),key=useBuckets?Math.floor(screen.x/cell)+':'+Math.floor(screen.y/cell):name+':'+x+':'+y;
 let bucket=buckets.get(key);if(!bucket){if(buckets.size>=MAX_DRAWN)continue;bucket={latlng:ll,position:pos,names:[name],total:0,color:PALETTE[index%PALETTE.length]};buckets.set(key,bucket)}bucket.total++;if(bucket.names.length<3&&!bucket.names.includes(name))bucket.names.push(name);
 }}
 for(const bucket of buckets.values()){
 const multi=bucket.total>1;const marker=L.circleMarker(bucket.latlng,{radius:multi?Math.min(13,7+Math.log2(bucket.total)*1.4):6,color:'#11291d',weight:2,fillColor:bucket.color,fillOpacity:.91,interactive:true});
 const popup=document.createElement('div'),title=document.createElement('strong');title.textContent=multi?bucket.total.toLocaleString()+' objects nearby':displayName(bucket.names[0]);popup.append(title);
 const detail=document.createElement('div');detail.className='popup-sub';detail.textContent=multi?bucket.names.map(displayName).join(', '):'X: '+bucket.position[0].toFixed(1)+' · Z: '+bucket.position[1].toFixed(1);popup.append(detail);
 if(multi){const focus=document.createElement('button');focus.type='button';focus.className='popup-focus';focus.textContent='Zoom into cluster';focus.addEventListener('click',()=>{map.setView(bucket.latlng,Math.min(3,map.getZoom()+2));map.closePopup()});popup.append(focus)}marker.bindPopup(popup);markerLayer.addLayer(marker);
 }
 if(matching>MAX_DRAWN&&buckets.size>=MAX_DRAWN)notice('Dense area: showing up to '+MAX_DRAWN+' markers. Zoom in for more.',2600);
 })}
function setPreset(i){presetIndex=i;document.querySelectorAll('.chip').forEach((chip,n)=>{chip.classList.toggle('active',n===i);chip.setAttribute('aria-pressed',String(n===i))});applyFilters()}
PRESETS.forEach(([label],i)=>{const chip=document.createElement('button');chip.type='button';chip.className='chip';chip.textContent=label;chip.addEventListener('click',()=>setPreset(i));$('preset-chips').append(chip)});setPreset(0);
ui.toggle.addEventListener('click',()=>setSheet(sheetPosition==='peek'?'half':'peek'));
$('sheet-close').addEventListener('click',()=>setSheet('peek'));
let startY=0;ui.sheet.querySelector('.sheet-handle-row').addEventListener('touchstart',e=>{startY=e.touches[0].clientY},{passive:true});ui.sheet.querySelector('.sheet-handle-row').addEventListener('touchend',e=>{const dy=e.changedTouches[0].clientY-startY;if(Math.abs(dy)<48)return;setSheet(dy<0?(sheetPosition==='peek'?'half':'full'):(sheetPosition==='full'?'half':'peek'))},{passive:true});
ui.search.addEventListener('input',()=>{ui.searchClear.hidden=!ui.search.value;applyFilters()});ui.search.addEventListener('focus',()=>{if(sheetPosition==='peek')setSheet('half')});ui.searchClear.addEventListener('click',()=>{ui.search.value='';ui.searchClear.hidden=true;applyFilters();ui.search.focus()});
ui.more.addEventListener('click',()=>{shown+=PAGE_SIZE;updateResults()});
ui.clear.addEventListener('click',()=>{selected.clear();persist();markerLayer.clearLayers();updateResults();notice('Map selections cleared.')});
ui.select.addEventListener('click',()=>{const missing=filtered.filter(n=>!selected.has(n)),capacity=MAX_TYPES-selected.size;if(missing.length>capacity&&!window.confirm('Show the first '+capacity+' matching types? The phone limit is '+MAX_TYPES+' categories.'))return;for(const n of missing.slice(0,capacity))selected.add(n);persist();updateResults();scheduleRender();notice('Selected '+Math.min(missing.length,capacity)+' additional types.')});
$('zoom-in').addEventListener('click',()=>map.zoomIn());$('zoom-out').addEventListener('click',()=>map.zoomOut());$('reset-view').addEventListener('click',()=>map.fitBounds(bounds,{padding:[8,8]}));
$('map-style').addEventListener('click',()=>{highDefinition=!highDefinition;$('map-style').classList.toggle('active',highDefinition);$('map-style').setAttribute('aria-pressed',String(highDefinition));setImage(highDefinition)});
const dialog=$('about-dialog');$('about-open').addEventListener('click',()=>dialog.showModal());const dropdown=$('dataset');dropdown.value=dataset;dropdown.addEventListener('change',()=>{const next=dropdown.value;if(!DATASETS.has(next)||next===dataset)return;try{localStorage.setItem('botw-mobile-dataset',next)}catch(_){}const url=new URL(location.href);url.searchParams.set('list',next);location.assign(url.toString())});
map.on('moveend zoomend',scheduleRender);window.addEventListener('resize',()=>map.invalidateSize({pan:false}));persist();loadData();
if('serviceWorker'in navigator&&location.protocol==='https:')window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
window.__botwMobile={getState:()=>({dataset,ready,types:names.length,selected:selected.size,rendered:markerLayer.getLayers().length,sheet:sheetPosition})};
})();