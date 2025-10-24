/* PhynoraTime – Pure JS Countdown + Goals (fresh load, precise ms) */
(() => {
  // ====== CONFIG ======
  const PERSIST = false;         // <- set true if you want auto-load on refresh
  const STORAGE_KEY = 'phynoraCountdownV1_noLuxon';
  const GOALS_KEY   = 'phynoraGoalsV1';

  // ====== Elements ======
  const startInput   = document.getElementById('startInput');
  const endInput     = document.getElementById('endInput');
  const missionInput = document.getElementById('missionInput');
  const setBtn       = document.getElementById('setBtn');

  const summaryLine  = document.getElementById('summaryLine');
  const fillEl       = document.getElementById('fill');
  const progressText = document.getElementById('progressText');

  const values = {
    years:  document.querySelector('[data-unit="years"]'),
    months: document.querySelector('[data-unit="months"]'),
    weeks:  document.querySelector('[data-unit="weeks"]'),
    days:   document.querySelector('[data-unit="days"]'),
    hours:  document.querySelector('[data-unit="hours"]'),
    mins:   document.querySelector('[data-unit="minutes"]'),
    secs:   document.querySelector('[data-unit="seconds"]'),
    ms:     document.querySelector('[data-unit="millis"]'),
  };

  // Duration inputs
  const dur = {
    years:  document.getElementById('durYears'),
    months: document.getElementById('durMonths'),
    weeks:  document.getElementById('durWeeks'),
    days:   document.getElementById('durDays'),
    hours:  document.getElementById('durHours'),
    mins:   document.getElementById('durMins'),
    secs:   document.getElementById('durSecs'),
    ms:     document.getElementById('durMillis'),
  };

  // ====== State ======
  let startDate = null;    // JS Date
  let targetDate = null;   // JS Date
  let rafId = null;

  // ====== Helpers ======
  function toInputDate(d){
    const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }
  function toNice(d){
    const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0');
    const hh=String(d.getHours()).padStart(2,'0'), mm=String(d.getMinutes()).padStart(2,'0');
    return `${y}-${m}-${day} ${hh}:${mm}`;
  }
  function parseDateInput(el){
    if (!el || !el.value) return null;
    const [y,m,d] = el.value.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m-1, d, 0, 0, 0, 0);     // local midnight
  }
  function addDuration(base, add){
    const dt = new Date(base.getTime());
    if (add.years)  dt.setFullYear(dt.getFullYear() + add.years);
    if (add.months) dt.setMonth(dt.getMonth() + add.months);
    if (add.weeks)  dt.setDate(dt.getDate() + add.weeks*7);
    if (add.days)   dt.setDate(dt.getDate() + add.days);
    if (add.hours)  dt.setHours(dt.getHours() + add.hours);
    if (add.mins)   dt.setMinutes(dt.getMinutes() + add.mins);
    if (add.secs)   dt.setSeconds(dt.getSeconds() + add.secs);
    if (add.ms)     dt.setMilliseconds(dt.getMilliseconds() + add.ms);
    return dt;
  }
  function durationIsZero(){
    return ['years','months','weeks','days','hours','mins','secs','ms']
      .every(k => (+dur[k].value||0) === 0);
  }

  // Build from inputs:
  // - If End provided => Start = chosen Start, Target = End.
  // - Else => Start = NOW, Target = NOW + duration (so live values match exactly).
  function buildTargetFromInputs(){
    const sPicked = parseDateInput(startInput);
    if (!sPicked) return { ok:false, msg:'Please choose a valid Start date.' };

    const ePicked = parseDateInput(endInput);
    if (ePicked){
      if (ePicked <= sPicked) return { ok:false, msg:'End must be after Start.' };
      return { ok:true, start: sPicked, target: ePicked, mode: 'end' };
    }

    // Duration path → count from NOW so 5h shows 5h immediately
    const base = new Date();
    const add = durationIsZero()
      ? { years: 5 }
      : {
          years:+dur.years.value||0, months:+dur.months.value||0, weeks:+dur.weeks.value||0,
          days:+dur.days.value||0, hours:+dur.hours.value||0, mins:+dur.mins.value||0,
          secs:+dur.secs.value||0, ms:+dur.ms.value||0
        };
    const t = addDuration(base, add);
    if (t <= base) return { ok:false, msg:'Duration must be positive.' };
    return { ok:true, start: base, target: t, mode: 'duration' };
  }

  function formatSummary(){
    const name = (missionInput.value||'Mission').trim();
    if (!startDate || !targetDate){
      summaryLine.textContent = `${name}: choose Start and End (or duration) and press “Set Target & Start”.`;
      return;
    }
    const totalDays = Math.max(0, Math.floor((targetDate - startDate) / 86400000));
    summaryLine.textContent =
      `${name} → Start: ${toNice(startDate)} • Target: ${toNice(targetDate)} • Total days: ${totalDays}`;
  }

  function calendarDiff(now, target){
    let cursor = new Date(now.getTime());
    let y=0,m=0;

    while (true){
      const n = new Date(cursor.getTime()); n.setFullYear(n.getFullYear()+1);
      if (n <= target){ cursor = n; y++; } else break;
    }
    while (true){
      const n = new Date(cursor.getTime()); n.setMonth(n.getMonth()+1);
      if (n <= target){ cursor = n; m++; } else break;
    }

    let rem = target - cursor; if (rem < 0) rem = 0;
    const oneSec=1000, oneMin=60000, oneHour=3600000, oneDay=86400000;

    const daysTotal = Math.floor(rem / oneDay); rem -= daysTotal*oneDay;
    const w = Math.floor(daysTotal/7);
    const d = daysTotal%7;

    const h = Math.floor(rem / oneHour); rem -= h*oneHour;
    const i = Math.floor(rem / oneMin);  rem -= i*oneMin;
    const s = Math.floor(rem / oneSec);  rem -= s*oneSec;
    const ms = Math.floor(rem);

    return { y,m,w,d,h,i,s,ms };
  }

  function updateProgress(now){
    const total = Math.max(1, targetDate - startDate);
    const done  = Math.max(0, now - startDate);
    const pct   = Math.min(100, Math.max(0, (done/total)*100));
    fillEl.style.width = pct.toFixed(2) + '%';
    progressText.textContent = `${pct.toFixed(2)}% complete`;
  }

  function render(){
    if (!startDate || !targetDate) return;
    const now = new Date();

    if (now >= targetDate){
      for (const k of Object.keys(values)) values[k].textContent = (k==='ms'?'000':'0');
      updateProgress(targetDate);
      return;
    }

    const p = calendarDiff(now, targetDate);
    values.years.textContent  = String(p.y);
    values.months.textContent = String(p.m);
    values.weeks.textContent  = String(p.w);
    values.days.textContent   = String(p.d);
    values.hours.textContent  = String(p.h);
    values.mins.textContent   = String(p.i);
    values.secs.textContent   = String(p.s);
    values.ms.textContent     = String(p.ms).padStart(3,'0');

    updateProgress(now);
  }

  function tick(){
    if (!startDate || !targetDate) return;
    render();
    rafId = requestAnimationFrame(tick);
  }
  function stopTick(){ if (rafId) cancelAnimationFrame(rafId); rafId=null; }

  // ====== Persistence ======
  function save(){
    if (!PERSIST) return;
    if (!startDate || !targetDate) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      start: startDate.toISOString(),
      target: targetDate.toISOString(),
      mission: missionInput.value || ''
    }));
  }
  function load(){
    if (!PERSIST) return false;
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const obj = JSON.parse(raw);
      if (obj.mission)// missionInput.value = 'Mission Phoenix Begin';
      if (obj.start){  const d=new Date(obj.start);  if(!isNaN(d)) { startDate=d; startInput.value=toInputDate(d); } }
      if (obj.target){ const d=new Date(obj.target); if(!isNaN(d)) { targetDate=d; endInput.value=toInputDate(d); } }
      return !!(startDate && targetDate);
    }catch{ return false; }
  }
  function resetUI(){
    // zero the counters & progress
    for (const k of Object.keys(values)) values[k].textContent = (k==='ms'?'000':'0');
    fillEl.style.width = '0%';
    progressText.textContent = '0.00% complete';
    summaryLine.textContent = 'Mission: choose Start and End (or duration) and press “Set Target & Start”.';
  }

  // ====== Events ======
  setBtn.addEventListener('click', () => {
    const built = buildTargetFromInputs();
    if (!built.ok){ alert(built.msg); return; }
    startDate  = built.start;
    targetDate = built.target;
    save();
    formatSummary();
    stopTick(); tick();
  });

/* ---------------------- init ---------------------- */
const hasState = load();
if (!hasState){
  // sensible defaults so the UI is ready to run
  const today = new Date();
  startInput.value = toInputDate(today);
  missionInput.value = ''; // ✅ keep empty on load
  missionInput.placeholder = 'Enter your mission name e.g., Phoenix';
  if (dur.years) dur.years.value = 5;
}
formatSummary();
if (hasState) tick();

  // ====== Goals ======
  const goalsEl   = document.getElementById('goals');
  const statsEl   = document.getElementById('stats');
  const newGoalEl = document.getElementById('newGoal');
  const addBtn    = document.getElementById('add');

  const loadGoals = () => { try{ return JSON.parse(localStorage.getItem(GOALS_KEY))||[]; }catch{ return []; } };
  const saveGoals = (arr) => localStorage.setItem(GOALS_KEY, JSON.stringify(arr));

  function renderGoals(){
    if (!goalsEl || !statsEl) return;
    const items = loadGoals();
    goalsEl.innerHTML = '';
    let done = 0;

    items.forEach((g, idx) => {
      if (g.done) done++;
      const row = document.createElement('div'); row.className = 'g' + (g.done?' done':'');
      const name = document.createElement('div'); name.className='name'; name.textContent=g.text;

      const tools = document.createElement('div'); tools.className='tools';
      const cb = document.createElement('input'); cb.type='checkbox'; cb.checked=!!g.done;
      cb.addEventListener('change', () => { const arr=loadGoals(); arr[idx].done = cb.checked; saveGoals(arr); renderGoals(); });

      const edit = document.createElement('button'); edit.className='btn edit'; edit.textContent='Edit';
      edit.addEventListener('click', () => {
        if (row.querySelector('input.edit-field')) return;
        const input = document.createElement('input');
        input.type='text'; input.value=g.text; input.className='edit-field'; input.maxLength=120;
        row.replaceChild(input, name); input.focus(); input.select();
        const commit=()=>{ const v=input.value.trim(); if(v){ const arr=loadGoals(); arr[idx].text=v; saveGoals(arr); } renderGoals(); };
        const cancel=()=>renderGoals();
        input.addEventListener('keydown', e=>{ if(e.key==='Enter') commit(); if(e.key==='Escape') cancel(); });
        input.addEventListener('blur', commit);
      });

      const del = document.createElement('button'); del.className='btn delete'; del.textContent='Delete';
      del.addEventListener('click', () => { const arr = loadGoals().filter((_,i)=>i!==idx); saveGoals(arr); renderGoals(); });

      tools.append(cb, edit, del);
      row.append(name, tools);
      goalsEl.appendChild(row);
    });

    statsEl.textContent = `${done} / ${items.length} completed`;
  }

  if (goalsEl && addBtn && newGoalEl){
    addBtn.addEventListener('click', () => {
      const txt = (newGoalEl.value||'').trim(); if(!txt) return;
      const arr = loadGoals(); arr.push({ text: txt, done:false }); saveGoals(arr);
      newGoalEl.value=''; renderGoals();
    });
    renderGoals();
  }
})();
