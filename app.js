
const API_KEY  = "bd5e378503939ddaee76f12ad7a97608";
const BASE     = "https://api.openweathermap.org/data/2.5";
const GEO      = "https://api.openweathermap.org/geo/1.0";
const ICON     = c => `https://openweathermap.org/img/wn/${c}@2x.png`;

let unit = "metric", lastCity = "", acTimer = null;
const $ = id => document.getElementById(id);


document.addEventListener("DOMContentLoaded", () => {
  setNavDate();
  initParticles();
  geolocate();
  $("cityInput").addEventListener("keydown", e => e.key === "Enter" && doSearch());
  $("cityInput").addEventListener("input",  e => autocomplete(e.target.value));
  $("searchBtn").addEventListener("click",  doSearch);
  document.addEventListener("click", e => {
    if (!e.target.closest(".nav-center")) hideAC();
  });
});


function setNavDate() {
  const d = new Date();
  $("navDate").innerHTML = d.toLocaleDateString("en-US",{
    weekday:"short", month:"short", day:"numeric"
  }) + "<br/>" + d.getFullYear();
}

function initParticles() {
  const cvs = $("bgCanvas"), ctx = cvs.getContext("2d");
  let W, H, pts = [];
  const resize = () => { W = cvs.width = innerWidth; H = cvs.height = innerHeight; };
  function Pt() {
    this.x = Math.random()*W; this.y = Math.random()*H;
    this.r = Math.random()*1.6+.3;
    this.vx = (Math.random()-.5)*.25; this.vy = (Math.random()-.5)*.25;
    this.a = Math.random()*.4+.1;
  }
  Pt.prototype.step = function() {
    this.x+=this.vx; this.y+=this.vy;
    if(this.x<0)this.x=W; if(this.x>W)this.x=0;
    if(this.y<0)this.y=H; if(this.y>H)this.y=0;
  };
  const init = () => { pts = Array.from({length:70},()=>new Pt()); };
  const draw = () => {
    ctx.clearRect(0,0,W,H);
    pts.forEach(p=>{
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle=`rgba(200,220,255,${p.a})`; ctx.fill(); p.step();
    });
    requestAnimationFrame(draw);
  };
  window.addEventListener("resize",()=>{resize();init();});
  resize(); init(); draw();
}

function geolocate() {
  if(!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    p => fetchCoords(p.coords.latitude, p.coords.longitude),
    () => {}
  );
}

function doSearch() {
  const city = $("cityInput").value.trim();
  if(!city) return;
  hideAC();
  fetchCity(city);
}
function quickSearch(city) {
  $("cityInput").value = city;
  fetchCity(city);
}

function switchUnit(u) {
  if(u===unit) return;
  unit=u;
  $("btnC").classList.toggle("active", u==="metric");
  $("btnF").classList.toggle("active", u==="imperial");
  if(lastCity) fetchCity(lastCity);
}

async function fetchCity(city) {
  lastCity=city; showLoader(); clearAlert();
  try {
    const [wR,fR] = await Promise.all([
      fetch(`${BASE}/weather?q=${encodeURIComponent(city)}&units=${unit}&appid=${API_KEY}`),
      fetch(`${BASE}/forecast?q=${encodeURIComponent(city)}&units=${unit}&appid=${API_KEY}&cnt=40`)
    ]);
    if(!wR.ok) throw new Error(wR.status===404?"City not found. Please try another.":"Service unavailable, try again.");
    renderAll(await wR.json(), await fR.json());
  } catch(e) { showAlert(e.message); hideLoader(); showWelcome(); }
}

async function fetchCoords(lat,lon) {
  showLoader(); clearAlert();
  try {
    const [wR,fR] = await Promise.all([
      fetch(`${BASE}/weather?lat=${lat}&lon=${lon}&units=${unit}&appid=${API_KEY}`),
      fetch(`${BASE}/forecast?lat=${lat}&lon=${lon}&units=${unit}&appid=${API_KEY}&cnt=40`)
    ]);
    if(!wR.ok) throw new Error("Could not get local weather.");
    const w=await wR.json(), f=await fR.json();
    lastCity=w.name; $("cityInput").value=w.name;
    renderAll(w,f);
  } catch(e) { showAlert(e.message); hideLoader(); }
}

function autocomplete(v) {
  clearTimeout(acTimer);
  if(v.length<2){hideAC();return;}
  acTimer=setTimeout(async()=>{
    try{
      const r=await fetch(`${GEO}/direct?q=${encodeURIComponent(v)}&limit=5&appid=${API_KEY}`);
      renderAC(await r.json());
    } catch{hideAC();}
  },340);
}
function renderAC(cities) {
  const ul=$("acDrop"); ul.innerHTML="";
  if(!cities||!cities.length){hideAC();return;}
  ul.classList.remove("hidden");
  cities.forEach(c=>{
    const li=document.createElement("li");
    li.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>${c.name}${c.state?", "+c.state:""}, ${c.country}`;
    li.addEventListener("click",()=>{ $("cityInput").value=c.name; hideAC(); fetchCity(c.name); });
    ul.appendChild(li);
  });
}
function hideAC(){const u=$("acDrop");u.innerHTML="";u.classList.add("hidden");}

function renderAll(w, fc) {
  const sym = unit==="metric"?"°C":"°F";
  const windSpd = unit==="metric"
    ? Math.round(w.wind.speed*3.6)
    : Math.round(w.wind.speed);
  const windUnit = unit==="metric"?"km/h":"mph";

  applyTheme(w.weather[0].id, w.weather[0].icon);

  
  setText("curCity",    w.name);
  setText("curCountry", flag(w.sys?.country)+"  "+(w.sys?.country||""));
  attr("curIcon","src",ICON(w.weather[0].icon));
  attr("curIcon","alt",w.weather[0].description);
  setText("curTemp",  Math.round(w.main.temp));
  setText("curSym",   sym);
  setText("curDesc",  w.weather[0].description);
  setText("curFeels", "Feels like "+Math.round(w.main.feels_like)+sym);

  setText("sHum",   w.main.humidity+"%");
  setText("sWind",  windSpd+" "+windUnit);
  setText("sVis",   w.visibility?(w.visibility/1000).toFixed(1)+" km":"N/A");
  setText("sPress", w.main.pressure+" hPa");

  setText("sunRise", fmtTime(w.sys.sunrise, w.timezone));
  setText("sunSet",  fmtTime(w.sys.sunset,  w.timezone));

  const deg = w.wind?.deg ?? 0;
  setText("windSpeed2", windSpd);
  setText("windUnit2",  windUnit);
  setText("windDeg",    deg+"°");
  setText("windDir2",   degToDir(deg));
  rotateCompass(deg);

  setText("exCloud",  (w.clouds?.all??0)+"%");
  setText("exMinMax", Math.round(w.main.temp_min)+sym+" / "+Math.round(w.main.temp_max)+sym);
  const dew = Math.round(w.main.temp - ((100-w.main.humidity)/5));
  setText("exDew", dew+sym);

  renderHourly(fc, sym);

  renderDaily(fc, sym);

  $("loader").classList.add("hidden");
  $("welcome").classList.add("hidden");
  $("contentGrid").classList.remove("hidden");
}
function rotateCompass(deg) {
  const needle = document.getElementById("compassNeedle");
  if(needle) {
    needle.style.transform = `rotate(${deg}deg)`;
  }
}

function renderHourly(fc, sym) {
  const wrap = $("hScroll"); wrap.innerHTML="";
  fc.list.slice(0,12).forEach((item,i)=>{
    const div=document.createElement("div");
    div.className="h-item"+(i===0?" now":"");
    const pop=item.pop>0.05?`<span class="h-pop">&#128167; ${Math.round(item.pop*100)}%</span>`:"";
    div.innerHTML=`
      <span class="h-time">${i===0?"Now":fmtHour(item.dt)}</span>
      <img class="h-icon" src="${ICON(item.weather[0].icon)}" alt="${item.weather[0].description}"/>
      <span class="h-temp">${Math.round(item.main.temp)}${sym}</span>
      ${pop}
    `;
    wrap.appendChild(div);
  });
}

function renderDaily(fc, sym) {
  const wrap=$("dList"); wrap.innerHTML="";
  const days={};
  fc.list.forEach(item=>{
    const k=new Date(item.dt*1000).toDateString();
    if(!days[k]) days[k]=[];
    days[k].push(item);
  });
  Object.keys(days).slice(0,5).forEach((k,i)=>{
    const items=days[k];
    const temps=items.map(d=>d.main.temp);
    const maxT=Math.round(Math.max(...temps));
    const minT=Math.round(Math.min(...temps));
    const mid=items[Math.floor(items.length/2)];
    const pop=Math.round(Math.max(...items.map(d=>d.pop))*100);
    const lbl=i===0?"Today":new Date(k).toLocaleDateString("en-US",{weekday:"short"});
    const row=document.createElement("div");
    row.className="d-row";
    row.innerHTML=`
      <span class="d-day">${lbl}</span>
      <img class="d-icon" src="${ICON(mid.weather[0].icon)}" alt="${mid.weather[0].description}"/>
      <span class="d-desc">${mid.weather[0].description}</span>
      ${pop>5?`<span class="d-pop">&#128167; ${pop}%</span>`:"<span></span>"}
      <div class="d-temps"><span class="d-max">${maxT}${sym}</span><span class="d-min">${minT}${sym}</span></div>
    `;
    wrap.appendChild(row);
  });
}

function applyTheme(id, icon) {
  const n=icon?.endsWith("n");
  let c="th-cloudy";
  if(id>=200&&id<300) c="th-storm";
  else if(id>=300&&id<600) c="th-rain";
  else if(id>=600&&id<700) c="th-snow";
  else if(id>=700&&id<800) c="th-mist";
  else if(id===800) c=n?"th-night":"th-sunny";
  $("appBody").className=c;
}

function setText(id,v){ const e=$(id); if(e) e.textContent=v; }
function attr(id,a,v){ const e=$(id); if(e) e.setAttribute(a,v); }

function fmtTime(unix,tz) {
  const d=new Date((unix+tz)*1000);
  let h=d.getUTCHours(), m=d.getUTCMinutes();
  const ap=h>=12?"PM":"AM"; h=h%12||12;
  return `${h}:${String(m).padStart(2,"0")} ${ap}`;
}
function fmtHour(unix) {
  const d=new Date(unix*1000); let h=d.getHours();
  const ap=h>=12?"PM":"AM"; h=h%12||12;
  return `${h} ${ap}`;
}
function flag(cc) {
  if(!cc) return "🌍";
  return cc.toUpperCase().split("").map(c=>String.fromCodePoint(0x1F1E6+c.charCodeAt(0)-65)).join("");
}
function degToDir(d) {
  return ["N","NE","E","SE","S","SW","W","NW"][Math.round(d/45)%8];
}


function showLoader() {
  $("loader").classList.remove("hidden");
  $("contentGrid").classList.add("hidden");
  $("welcome").classList.add("hidden");
}
function hideLoader() { $("loader").classList.add("hidden"); }
function showWelcome() { $("welcome").classList.remove("hidden"); }
function showAlert(msg) {
  $("alertMsg").textContent=msg;
  $("alert").classList.remove("hidden");
  setTimeout(()=>$("alert").classList.add("hidden"),5000);
}
function clearAlert() { $("alert").classList.add("hidden"); }
