/* =========================================================
   THEME CUSTOMIZATION
   ========================================================= */
const DEFAULT_THEME = { ink:'#12141c', paper:'#eedd95', gold:'#b4b9f3', rose:'#fd9f1c', teal:'#467da0' };
const THEME_PRESETS = [
  { name:'Tonic (default)', colors: DEFAULT_THEME },
  { name:'Forest', colors: { ink:'#1a2420', paper:'#eef1e6', gold:'#c9a24b', rose:'#b5654a', teal:'#4f8f6a' } },
  { name:'Sunset', colors: { ink:'#2a1a2e', paper:'#fdf0e4', gold:'#f0973b', rose:'#e0526f', teal:'#7a5ea8' } },
  { name:'Mono', colors: { ink:'#181818', paper:'#f2f0ec', gold:'#9a9a9a', rose:'#c96b6b', teal:'#6b96a0' } }
];

function hexToRgb(hex){
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? { r:parseInt(m[1],16), g:parseInt(m[2],16), b:parseInt(m[3],16) } : { r:0,g:0,b:0 };
}
function rgbToHex(r,g,b){
  const c = v => Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0');
  return '#' + c(r) + c(g) + c(b);
}
function shade(hex, amount){ // amount: positive lightens, negative darkens
  const { r, g, b } = hexToRgb(hex);
  const f = v => v + (amount>0 ? (255-v)*amount : v*amount);
  return rgbToHex(f(r), f(g), f(b));
}
function rgba(hex, a){
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function applyTheme(theme){
  const t = { ...DEFAULT_THEME, ...theme };
  const root = document.documentElement.style;
  root.setProperty('--ink', t.ink);
  root.setProperty('--ink-2', shade(t.ink, 0.1));
  root.setProperty('--paper', t.paper);
  root.setProperty('--paper-2', shade(t.paper, -0.06));
  root.setProperty('--gold', t.gold);
  root.setProperty('--rose', t.rose);
  root.setProperty('--teal', t.teal);
  root.setProperty('--line', rgba(t.ink, 0.15));
  root.setProperty('--text-on-ink', t.paper);
  root.setProperty('--text-dim', rgba(t.paper, 0.6));
  document.querySelector('meta[name="theme-color"]').setAttribute('content', t.ink);

  // sync the picker UI to match
  Object.keys(DEFAULT_THEME).forEach(key=>{
    const colorInput = document.getElementById('theme-' + key);
    const textInput = document.getElementById('theme-' + key + '-text');
    if(colorInput) colorInput.value = t[key];
    if(textInput) textInput.value = t[key];
  });
}
function loadTheme(){
  try{
    const raw = localStorage.getItem(THEME_KEY);
    return raw ? { ...DEFAULT_THEME, ...JSON.parse(raw) } : { ...DEFAULT_THEME };
  }catch(e){ return { ...DEFAULT_THEME }; }
}
function saveTheme(theme){
  localStorage.setItem(THEME_KEY, JSON.stringify(theme));
  persistRemoteTheme(theme);
}
let remoteThemeDebounceTimer = null;
function persistRemoteTheme(theme){
  // only push to the server once the person is signed in and has a profile row to attach it to
  if(!currentUserId || !myProfile) return;
  clearTimeout(remoteThemeDebounceTimer);
  remoteThemeDebounceTimer = setTimeout(()=>{
    upsertMyProfile({ theme });
  }, 600);
}
function currentThemeFromInputs(){
  const theme = {};
  Object.keys(DEFAULT_THEME).forEach(key=>{
    theme[key] = document.getElementById('theme-' + key).value;
  });
  return theme;
}

const CUSTOM_THEMES_KEY = 'song-journal-custom-themes';
function loadCustomThemes(){
  try{
    const raw = localStorage.getItem(CUSTOM_THEMES_KEY);
    return raw ? JSON.parse(raw) : [];
  }catch(e){ return []; }
}
function saveCustomThemes(list){
  localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(list));
}
function renderThemePresets(){
  const wrap = document.getElementById('themePresets');
  wrap.innerHTML = '';
  THEME_PRESETS.forEach(preset=>{
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-preset-btn';
    const c = preset.colors;
    btn.innerHTML = `<span class="theme-preset-swatch"><span style="background:${c.ink}"></span><span style="background:${c.gold}"></span><span style="background:${c.rose}"></span><span style="background:${c.teal}"></span></span>${preset.name}`;
    btn.addEventListener('click', ()=>{
      applyTheme(preset.colors);
      saveTheme(currentThemeFromInputs());
    });
    wrap.appendChild(btn);
  });
  loadCustomThemes().forEach(theme=>{
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-preset-btn custom';
    const c = theme.colors;
    btn.innerHTML = `<span class="theme-preset-swatch"><span style="background:${c.ink}"></span><span style="background:${c.gold}"></span><span style="background:${c.rose}"></span><span style="background:${c.teal}"></span></span>${escapeHtml(theme.name)}<span class="theme-preset-x" data-delete-theme="${theme.id}" title="Delete this theme">×</span>`;
    btn.addEventListener('click', (e)=>{
      if(e.target.closest('[data-delete-theme]')) return;
      applyTheme(theme.colors);
      saveTheme(currentThemeFromInputs());
    });
    wrap.appendChild(btn);
  });
  wrap.querySelectorAll('[data-delete-theme]').forEach(x=>{
    x.addEventListener('click', (e)=>{
      e.stopPropagation();
      const id = x.dataset.deleteTheme;
      if(confirm('Delete this saved theme?')){
        saveCustomThemes(loadCustomThemes().filter(t=>t.id!==id));
        renderThemePresets();
      }
    });
  });
}

// apply saved theme immediately, even before login, so the whole app (incl. auth screen) reflects it
applyTheme(loadTheme());

document.addEventListener('DOMContentLoaded', ()=>{
  renderThemePresets();

  document.getElementById('themeSaveBtn').addEventListener('click', ()=>{
    const nameInput = document.getElementById('theme-save-name');
    const name = nameInput.value.trim();
    if(!name){ nameInput.focus(); return; }
    const list = loadCustomThemes();
    list.push({ id:'th'+Date.now()+Math.random().toString(36).slice(2,6), name, colors: currentThemeFromInputs() });
    saveCustomThemes(list);
    nameInput.value = '';
    renderThemePresets();
  });

  Object.keys(DEFAULT_THEME).forEach(key=>{
    const colorInput = document.getElementById('theme-' + key);
    const textInput = document.getElementById('theme-' + key + '-text');
    colorInput.addEventListener('input', ()=>{
      textInput.value = colorInput.value;
      applyTheme(currentThemeFromInputs());
      saveTheme(currentThemeFromInputs());
    });
    textInput.addEventListener('change', ()=>{
      let val = textInput.value.trim();
      if(!val.startsWith('#')) val = '#' + val;
      if(/^#[0-9a-fA-F]{6}$/.test(val)){
        colorInput.value = val;
        applyTheme(currentThemeFromInputs());
        saveTheme(currentThemeFromInputs());
      } else {
        textInput.value = colorInput.value; // revert invalid input
      }
    });
  });

  document.getElementById('themeBtn').addEventListener('click', ()=>{
    applyTheme(loadTheme());
    document.getElementById('themeOverlay').classList.add('open');
  });
  document.getElementById('themeCloseBtn').addEventListener('click', ()=>{
    document.getElementById('themeOverlay').classList.remove('open');
  });
  document.getElementById('themeOverlay').addEventListener('click', e=>{
    if(e.target.id==='themeOverlay') document.getElementById('themeOverlay').classList.remove('open');
  });
  document.getElementById('themeResetBtn').addEventListener('click', ()=>{
    applyTheme(DEFAULT_THEME);
    saveTheme(DEFAULT_THEME);
  });
  document.addEventListener('keydown', e=>{
    if(e.key==='Escape') document.getElementById('themeOverlay').classList.remove('open');
  });
});

function uid(){ return 's' + Date.now() + Math.random().toString(36).slice(2,7); }

function setImagePreview(prefix, value){
  const img = document.getElementById(prefix+'-preview');
  const empty = document.getElementById(prefix+'-empty');
  const removeBtn = document.getElementById(prefix+'-remove');
  if(value){
    img.src = value;
    img.style.display = 'block';
    empty.style.display = 'none';
    if(removeBtn) removeBtn.style.display = 'block';
  } else {
    img.style.display = 'none';
    empty.style.display = 'block';
    if(removeBtn) removeBtn.style.display = 'none';
  }
}
function compressImage(dataUrl, maxDim, quality){
  return new Promise((resolve)=>{
    const img = new Image();
    img.onload = ()=>{
      let { width, height } = img;
      if(width > maxDim || height > maxDim){
        if(width > height){
          height = Math.round(height * (maxDim / width));
          width = maxDim;
        } else {
          width = Math.round(width * (maxDim / height));
          height = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = ()=> resolve(dataUrl);
    img.src = dataUrl;
  });
}
function bindCoverInput(fileInputId, prefix, setter){
  document.getElementById(fileInputId).addEventListener('change', e=>{
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = async ()=>{
      const compressed = await compressImage(reader.result, 640, 0.75);
      setter(compressed);
      setImagePreview(prefix, compressed);
    };
    reader.readAsDataURL(file);
  });
  document.getElementById(prefix+'-remove').addEventListener('click', ()=>{
    setter(null);
    setImagePreview(prefix, null);
    document.getElementById(fileInputId).value = '';
  });
}

function renderRemindsPicker(prefix, selectedIds){
  const el = document.getElementById(prefix+'-reminds-picker');
  const hint = document.getElementById(prefix+'-reminds-hint');
  selectedIds = selectedIds || [];
  el.innerHTML = '';
  if(people.length === 0){
    hint.style.display = 'block';
    return;
  }
  hint.style.display = 'none';
  people.forEach(p=>{
    const label = document.createElement('label');
    label.className = 'reminds-chip' + (selectedIds.includes(p.id) ? ' selected' : '');
    const imgOrFallback = p.photo
      ? `<img src="${p.photo}">`
      : `<span class="rc-fallback">${escapeHtml((p.name||'?').charAt(0).toUpperCase())}</span>`;
    label.innerHTML = `<input type="checkbox" value="${escapeAttr(p.id)}" ${selectedIds.includes(p.id)?'checked':''}> ${imgOrFallback} ${escapeHtml(p.name)}`;
    label.querySelector('input').addEventListener('change', e=>{
      label.classList.toggle('selected', e.target.checked);
    });
    el.appendChild(label);
  });
}
function getSelectedReminds(prefix){
  return [...document.querySelectorAll('#'+prefix+'-reminds-picker input:checked')].map(i=>i.value);
}

function renderPeople(){
  const row = document.getElementById('peopleRow');
  if(people.length === 0){
    row.innerHTML = '<span class="reminds-hint">Add someone to start tagging songs that remind you of them.</span>';
    return;
  }
  row.innerHTML = people.map(p=>`
    <button type="button" class="person-card ${remindsFilterId===p.id?'active':''}" data-person="${p.id}" title="Songs that remind me of ${escapeAttr(p.name)}">
      <span class="person-remove" data-remove-person="${p.id}" title="Remove person">×</span>
      ${p.photo ? `<img class="person-photo" src="${p.photo}">` : `<span class="person-photo-fallback">${escapeHtml((p.name||'?').charAt(0).toUpperCase())}</span>`}
      <span class="person-name">${escapeHtml(p.name)}</span>
    </button>
  `).join('');
}

function populateFilters(){
  const genreSel = document.getElementById('filterGenre');
  const moodSel = document.getElementById('filterMood');
  const genres = new Set();
  const moods = new Set();
  songs.forEach(s=>{
    if(s.genres) s.genres.forEach(g=>genres.add(g.trim()));
    (s.tags||[]).forEach(t=>moods.add(t.trim()));
  });
  const curGenre = genreSel.value, curMood = moodSel.value;
  genreSel.innerHTML = '<option value="">All genres</option>' + [...genres].sort().map(g=>`<option value="${escapeAttr(g)}">${escapeHtml(g)}</option>`).join('');
  moodSel.innerHTML = '<option value="">All moods/tags</option>' + [...moods].sort().map(m=>`<option value="${escapeAttr(m)}">${escapeHtml(m)}</option>`).join('');
  genreSel.value = curGenre; moodSel.value = curMood;
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escapeAttr(str){ return escapeHtml(str); }

function formatArtists(artists){
  if(!artists || artists.length === 0) return 'Unknown artist';
  if(artists.length === 1) return artists[0];
  if(artists.length === 2) return artists.join(' & ');
  return artists.slice(0,-1).join(', ') + ' & ' + artists[artists.length-1];
}

function renderTierBadge(tier){
  if(!tier) return `<span class="tier-badge tier-none">UNRATED</span>`;
  return `<span class="tier-badge tier-${tier}">${tier}</span>`;
}

/* ---- tier board: S-D rows of cover art, deduped, no unrated row ---- */
function dedupeSongsForBoard(list){
  const seen = new Set();
  const out = [];
  list.forEach(s=>{
    const key = `${(s.title||'').trim().toLowerCase()}|${(s.artists||[]).join(',').trim().toLowerCase()}|${(s.album||'').trim().toLowerCase()}`;
    if(seen.has(key)) return;
    seen.add(key);
    out.push(s);
  });
  return out;
}
function tierBoardItemHtml(s, editable){
  const initial = (s.title||'?').charAt(0).toUpperCase();
  const cover = s.coverArt
    ? `<img class="tier-board-cover" src="${s.coverArt}" loading="lazy" decoding="async" alt="">`
    : `<div class="tier-board-cover-fallback">${escapeHtml(initial)}</div>`;
  return `
    <div class="tier-board-item" ${editable ? `data-id="${s.id}"` : ''} title="${escapeAttr(s.title||'Untitled')} · ${escapeAttr(formatArtists(s.artists))}">
      ${cover}
      <span class="tier-board-item-label">${escapeHtml(s.title||'Untitled')}</span>
    </div>
  `;
}
function buildTierBoardHtml(list, editable){
  const active = dedupeSongsForBoard((list||[]).filter(s=>!s.archived));
  const byTier = { S:[], A:[], B:[], C:[], D:[] };
  active.forEach(s=>{ if(byTier[s.tier]) byTier[s.tier].push(s); });
  return TIERS.map(t=>{
    const items = byTier[t];
    const body = items.length
      ? `<div class="tier-board-covers">${items.map(s=>tierBoardItemHtml(s, editable)).join('')}</div>`
      : `<div class="tier-board-empty-row">Nothing in ${t} tier yet</div>`;
    return `
      <div class="tier-board-row">
        <div class="tier-board-badge tier-${t}">${t}</div>
        ${body}
      </div>
    `;
  }).join('');
}
function renderTierBoard(){
  const el = document.getElementById('tierBoard');
  const empty = document.getElementById('tierBoardEmptyState');
  const active = songs.filter(s=>!s.archived);
  if(active.length === 0){
    el.innerHTML = '';
    el.style.display = 'none';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  el.style.display = '';
  el.innerHTML = buildTierBoardHtml(songs, true);
}
function renderFriendTierBoard(list){
  const el = document.getElementById('friendTierBoard');
  el.innerHTML = buildTierBoardHtml(list, false);
}
document.getElementById('tierBoard').addEventListener('click', e=>{
  const item = e.target.closest('[data-id]');
  if(!item) return;
  const song = songs.find(s=>s.id===item.dataset.id);
  if(song) openModal(song);
});

function renderLastAdded(){
  const panel = document.getElementById('lastAdded');
  const body = document.getElementById('lastAddedBody');
  if(songs.length === 0){
    panel.style.display = 'none';
    return;
  }
  const latest = songs.reduce((a,b)=> (b.createdAt||0) > (a.createdAt||0) ? b : a);
  panel.style.display = 'flex';
  body.innerHTML = `
    <span class="lat-title">${escapeHtml(latest.title||'Untitled')}</span>
    <span class="lat-artist">${escapeHtml(formatArtists(latest.artists))}</span>
    ${renderTierBadge(latest.tier)}
  `;
}

/* ---- windowed grid rendering (avoids building thousands of DOM nodes at once) ---- */
const GRID_BATCH_SIZE = 60;
let currentGridList = [];
let currentClusterCounts = {};
let renderedCount = 0;
let gridObserver = null;

function songCardHtml(s, clusterCounts){
  const showEx = !!s.isSeedExample;
  return `
      <div class="card ${s.archived?'archived':''}" data-id="${s.id}">
        <button class="pin-btn ${s.pinned?'pinned':''}" data-action="pin" title="${s.pinned?'Unpin':'Pin as favorite'}">${s.pinned?'♥':'♡'}</button>
        <div class="card-top">
          ${s.coverArt ? `<img class="cover-thumb" src="${s.coverArt}" loading="lazy" decoding="async">` : ''}
          <div class="title-stack">
            ${s.archived ? '<span class="archived-badge">ARCHIVED</span>' : ''}
            <p class="track-title">${escapeHtml(s.title||'Untitled')}</p>
            <p class="track-artist">${escapeHtml(formatArtists(s.artists))}${s.album ? ' · '+escapeHtml(s.album) : ''}</p>
          </div>
        </div>
        <div class="meta-row">
          ${s.year ? `<span>${escapeHtml(s.year)}</span>` : (showEx ? `<span class="ex">e.g. 2016</span>` : '')}
          ${(s.genres&&s.genres.length) ? `<span class="meta-genres">· ${s.genres.map(g=>escapeHtml(g)).join(', ')}</span>` : (showEx ? `<span class="ex">· e.g. Rock, Funk/Soul</span>` : '')}
        </div>
        <div class="tier-row">${renderTierBadge(s.tier)}</div>
        ${(s.clusterId && clusterCounts[s.clusterId] > 1) ? `<span class="link-badge" data-cluster="${s.clusterId}">🔗 ${clusterCounts[s.clusterId]} linked</span>` : ''}
        ${(s.tags&&s.tags.length) ? `<div class="tags">${s.tags.map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>` : (showEx ? `<div class="tags">${['nostalgic','road trip','late night'].map(t=>`<span class="tag ex-tag">e.g. ${t}</span>`).join('')}</div>` : '')}
        ${s.lyricSnippet ? `<p class="lyric-snippet">${escapeHtml(s.lyricSnippet)}</p>` : (showEx ? `<p class="lyric-snippet ex">e.g. a line or verse, so you can recognize the song at a glance</p>` : '')}
        ${s.why ? `<p class="why">${escapeHtml(s.why)}</p>` : (showEx ? `<p class="why ex">e.g. the bassline just doesn't let go</p>` : '')}
        ${s.heard ? `<p class="heard"><b>Heard it:</b> ${escapeHtml(s.heard)}</p>` : (showEx ? `<p class="heard ex"><b>Heard it:</b> e.g. a friend's playlist, a coffee shop…</p>` : '')}
        ${s.credit ? `<p class="credit-note"><b>Borrowed from:</b> ${escapeHtml(s.credit)}</p>` : ''}
        ${(s.remindsOf && s.remindsOf.length) ? `<div class="reminds-badges">${s.remindsOf.map(pid=>{
          const p = people.find(pp=>pp.id===pid);
          if(!p) return '';
          return `<span class="reminds-badge" data-person="${p.id}">${p.photo?`<img src="${p.photo}" loading="lazy" decoding="async">`:''}${escapeHtml(p.name)}<button type="button" class="reminds-badge-x" data-remove-reminder="${s.id}|${p.id}" title="Remove ${escapeAttr(p.name)} from this song">×</button></span>`;
        }).join('')}</div>` : (showEx ? `<div class="reminds-badges"><span class="reminds-badge ex">e.g. Mom</span><span class="reminds-badge ex">e.g. a college roommate</span></div>` : '')}
        <div class="card-actions">
          <button data-action="edit">EDIT</button>
          <button data-action="archive">${s.archived ? 'UNARCHIVE' : 'ARCHIVE'}</button>
          <button data-action="delete" class="del">DELETE</button>
        </div>
      </div>
    `;
}

function renderNextGridBatch(){
  const grid = document.getElementById('grid');
  const sentinel = document.getElementById('gridSentinel');
  const slice = currentGridList.slice(renderedCount, renderedCount + GRID_BATCH_SIZE);
  if(slice.length){
    grid.insertAdjacentHTML('beforeend', slice.map(s=>songCardHtml(s, currentClusterCounts)).join(''));
    renderedCount += slice.length;
  }
  if(renderedCount < currentGridList.length){
    sentinel.style.display = 'block';
    if(!gridObserver){
      gridObserver = new IntersectionObserver(entries=>{
        if(entries[0].isIntersecting) renderNextGridBatch();
      }, { rootMargin: '800px' });
      gridObserver.observe(sentinel);
    }
  } else {
    sentinel.style.display = 'none';
  }
}

function render(){
  if(viewingWishlist){
    document.getElementById('tierBoard').style.display = 'none';
    document.getElementById('tierBoardEmptyState').style.display = 'none';
    renderWishlistGrid();
    return;
  }
  if(viewingTierBoard){
    document.getElementById('grid').style.display = 'none';
    document.getElementById('gridSentinel').style.display = 'none';
    document.getElementById('emptyState').style.display = 'none';
    renderLastAdded();
    renderTierBoard();
    return;
  }
  document.getElementById('tierBoard').style.display = 'none';
  document.getElementById('tierBoardEmptyState').style.display = 'none';
  document.getElementById('grid').style.display = '';
  renderLastAdded();
  const grid = document.getElementById('grid');
  const empty = document.getElementById('emptyState');
  const q = document.getElementById('search').value.trim().toLowerCase();
  const fGenre = document.getElementById('filterGenre').value;
  const fMood = document.getElementById('filterMood').value;
  const sortBy = document.getElementById('sortBy').value;

  let list = songs.filter(s=>{
    if(showArchived){ if(!s.archived) return false; }
    else { if(s.archived) return false; }
    if(clusterFilterId) return s.clusterId === clusterFilterId;
    if(remindsFilterId) return (s.remindsOf||[]).includes(remindsFilterId);
    if(q){
      const hay = `${s.title} ${(s.artists||[]).join(' ')} ${s.album}`.toLowerCase();
      if(!hay.includes(q)) return false;
    }
    if(fGenre && !(s.genres||[]).includes(fGenre)) return false;
    if(fMood && !(s.tags||[]).includes(fMood)) return false;
    return true;
  });

  list.sort((a,b)=>{
    if(sortBy === 'pinned') return (b.pinned?1:0) - (a.pinned?1:0) || (tierRank(b.tier) - tierRank(a.tier));
    if(sortBy === 'rating-desc') return tierRank(b.tier) - tierRank(a.tier);
    if(sortBy === 'rating-asc') return tierRank(a.tier) - tierRank(b.tier);
    if(sortBy === 'year-desc') return (parseInt(b.year)||0) - (parseInt(a.year)||0);
    if(sortBy === 'year-asc') return (parseInt(a.year)||0) - (parseInt(b.year)||0);
    if(sortBy === 'title') return a.title.localeCompare(b.title);
    return 0;
  });

  if(list.length === 0){
    grid.innerHTML = '';
    currentGridList = [];
    renderedCount = 0;
    document.getElementById('gridSentinel').style.display = 'none';
    empty.style.display = 'block';
    if(showArchived){
      empty.querySelector('h2').textContent = 'Archive is empty';
      empty.querySelector('p').textContent = 'Songs you archive will show up here.';
    } else {
      empty.querySelector('h2').textContent = songs.length ? 'No matches' : 'No tracks yet';
      empty.querySelector('p').textContent = songs.length ? 'Try a different search or filter.' : 'Add the first song to start your cataloguex.';
    }
  } else {
    empty.style.display = 'none';
    const clusterCounts = {};
    songs.forEach(s=>{ if(s.clusterId) clusterCounts[s.clusterId] = (clusterCounts[s.clusterId]||0)+1; });
    grid.innerHTML = '';
    currentGridList = list;
    currentClusterCounts = clusterCounts;
    renderedCount = 0;
    renderNextGridBatch();
  }

  const clusterBar = document.getElementById('clusterBar');
  if(clusterFilterId){
    clusterBar.style.display = 'flex';
    const clusterName = (list.find(s=>s.clusterName)||{}).clusterName;
    document.getElementById('clusterBarText').textContent = `Viewing "${clusterName || 'Untitled cluster'}" · ${list.length} song${list.length!==1?'s':''}`;
  } else {
    clusterBar.style.display = 'none';
  }

  const remindsBar = document.getElementById('remindsBar');
  if(remindsFilterId){
    const p = people.find(pp=>pp.id===remindsFilterId);
    remindsBar.style.display = 'flex';
    document.getElementById('remindsBarText').textContent = `Songs that remind me of ${p?p.name:'…'} · ${list.length} song${list.length!==1?'s':''}`;
  } else {
    remindsBar.style.display = 'none';
  }

  const active = songs.filter(s=>!s.archived);
  const archivedCount = songs.filter(s=>s.archived).length;
  const sCount = active.filter(s=>s.tier==='S').length;
  document.getElementById('stats').innerHTML = `<b>${myFriendsCount}</b> friend${myFriendsCount!==1?'s':''} &nbsp;·&nbsp; <b>${active.length}</b> songs logged &nbsp;·&nbsp; <b>${sCount}</b> S-tier &nbsp;·&nbsp; <b>${active.filter(s=>s.pinned).length}</b> favorites &nbsp;·&nbsp; <b>${archivedCount}</b> archived`;

  populateFilters();
}

function renderWishlistGrid(){
  document.getElementById('lastAdded').style.display = 'none';
  document.getElementById('clusterBar').style.display = 'none';
  document.getElementById('remindsBar').style.display = 'none';
  const grid = document.getElementById('grid');
  const empty = document.getElementById('emptyState');
  const q = document.getElementById('search').value.trim().toLowerCase();
  let list = wishlist.filter(s=>{
    if(!q) return true;
    const hay = `${s.title} ${(s.artists||[]).join(' ')} ${s.album||''}`.toLowerCase();
    return hay.includes(q);
  });
  if(list.length === 0){
    grid.innerHTML = '';
    empty.style.display = 'block';
    empty.querySelector('h2').textContent = wishlist.length ? 'No matches' : 'No songs yet';
    empty.querySelector('p').textContent = wishlist.length ? 'Try a different search.' : "Add a song you wish you'd written, for inspiration.";
  } else {
    empty.style.display = 'none';
    grid.innerHTML = list.map(s=>`
      <div class="card" data-wish-id="${s.id}">
        <div class="card-top">
          ${s.coverArt ? `<img class="cover-thumb" src="${s.coverArt}">` : ''}
          <div class="title-stack">
            <p class="track-title">${escapeHtml(s.title||'Untitled')}</p>
            <p class="track-artist">${escapeHtml(formatArtists(s.artists))}${s.album ? ' · '+escapeHtml(s.album) : ''}</p>
          </div>
        </div>
        <div class="meta-row">${s.year ? `<span>${escapeHtml(s.year)}</span>`:''}</div>
        ${s.lyricSnippet ? `<p class="lyric-snippet">${escapeHtml(s.lyricSnippet)}</p>` : ''}
        ${s.why ? `<p class="why">${escapeHtml(s.why)}</p>` : ''}
        <div class="card-actions">
          <button data-wish-action="edit">EDIT</button>
          <button data-wish-action="delete" class="del">DELETE</button>
        </div>
      </div>
    `).join('');
  }
  document.getElementById('stats').innerHTML = `<b>${wishlist.length}</b> song${wishlist.length!==1?'s':''} you wish you wrote`;
}

function openModal(song){
  editingId = song ? song.id : null;
  document.getElementById('modalTitle').textContent = song ? 'Edit song' : 'Add a song';
  document.getElementById('f-title').value = song?.title || '';
  document.getElementById('f-artist').value = (song?.artists||[]).join(', ');
  document.getElementById('f-album').value = song?.album || '';
  document.getElementById('f-year').value = song?.year || '';
  document.getElementById('f-genre').value = (song?.genres||[]).join(', ');
  document.getElementById('f-tags').value = (song?.tags||[]).join(', ');
  document.getElementById('f-heard').value = song?.heard || '';
  document.getElementById('f-why').value = song?.why || '';
  document.getElementById('f-credit').value = song?.credit || '';
  document.getElementById('f-lyric').value = song?.lyricSnippet || '';
  currentCoverArt = song?.coverArt || null;
  setImagePreview('f-cover', currentCoverArt);
  document.getElementById('f-song-search').value = '';
  document.getElementById('songSearchResults').style.display = 'none';
  document.getElementById('songSearchResults').innerHTML = '';
  renderRemindsPicker('f', song?.remindsOf || []);
  currentTier = song?.tier || null;
  renderTierPicker();
  document.getElementById('overlay').classList.add('open');
  document.getElementById('f-title').focus();
}
function closeModal(){
  document.getElementById('overlay').classList.remove('open');
  editingId = null;
}
function renderTierPicker(){
  const el = document.getElementById('tierPicker');
  el.innerHTML = '';
  TIERS.forEach(t=>{
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tier-' + t + (currentTier===t ? ' selected':'');
    btn.textContent = t;
    btn.addEventListener('click', ()=>{
      currentTier = (currentTier === t) ? null : t;
      renderTierPicker();
    });
    el.appendChild(btn);
  });
}

function handleSave(){
  const title = document.getElementById('f-title').value.trim();
  if(!title){ document.getElementById('f-title').focus(); return; }
  const data = {
    title,
    artists: document.getElementById('f-artist').value.split(',').map(a=>a.trim()).filter(Boolean),
    album: document.getElementById('f-album').value.trim(),
    year: document.getElementById('f-year').value.trim(),
    genres: document.getElementById('f-genre').value.split(',').map(g=>g.trim()).filter(Boolean),
    tags: document.getElementById('f-tags').value.split(',').map(t=>t.trim()).filter(Boolean),
    heard: document.getElementById('f-heard').value.trim(),
    why: document.getElementById('f-why').value.trim(),
    credit: document.getElementById('f-credit').value.trim(),
    lyricSnippet: document.getElementById('f-lyric').value.trim(),
    coverArt: currentCoverArt,
    remindsOf: getSelectedReminds('f'),
    tier: currentTier
  };
  if(editingId){
    const idx = songs.findIndex(s=>s.id===editingId);
    if(idx>-1) songs[idx] = {...songs[idx], ...data};
  } else {
    songs.unshift({ id: uid(), pinned:false, createdAt: Date.now(), ...data });
  }
  save();
  closeModal();
  render();
}

function openMultiModal(mode){
  multiMode = mode;
  const isAlbum = mode === 'album';
  document.getElementById('multiModalTitle').textContent = isAlbum ? 'New Album' : 'New Linked Cluster';
  document.getElementById('multiHint').textContent = isAlbum
    ? 'Search Apple Music to pull in tracks, art, and per-track artists automatically — or add tracks manually below. Each track becomes its own entry in your cataloguex.'
    : 'These fields apply to every song below — good for tracks that just remind you of each other.';
  document.getElementById('multiAlbumLabel').textContent = isAlbum ? 'Album' : 'Album (optional)';
  document.getElementById('multiArtistLabel').textContent = isAlbum ? 'Primary artist (fills tracks below — edit each track to add features)' : 'Artist(s)';
  document.getElementById('multiWhyLabel').textContent = isAlbum ? 'Thoughts on the album' : 'What connects these';
  document.getElementById('multiTitlesLabel').textContent = isAlbum ? 'Tracks' : 'Song titles';
  document.getElementById('mf-spotify-search-field').style.display = isAlbum ? '' : 'none';
  document.getElementById('mf-tags-field').style.display = isAlbum ? 'none' : '';
  document.getElementById('mf-album-search').value = '';
  document.getElementById('albumSearchResults').style.display = 'none';
  document.getElementById('albumSearchResults').innerHTML = '';
  document.getElementById('mf-artist').value = '';
  document.getElementById('mf-album').value = '';
  document.getElementById('mf-year').value = '';
  document.getElementById('mf-genre').value = '';
  document.getElementById('mf-tags').value = '';
  document.getElementById('mf-heard').value = '';
  document.getElementById('mf-why').value = '';
  document.getElementById('mf-credit').value = '';
  document.getElementById('multiCoverLabel').textContent = isAlbum ? 'Cover art (shared)' : 'Cover art (optional, shared)';
  currentMultiCoverArt = null;
  setImagePreview('mf-cover', null);
  renderRemindsPicker('mf', []);
  currentMultiTier = null;
  renderMultiTierPicker();
  resetTitleBoxes();
  document.getElementById('multiOverlay').classList.add('open');
}
function closeMultiModal(){
  document.getElementById('multiOverlay').classList.remove('open');
}
function renderMultiTierPicker(){
  const el = document.getElementById('multiTierPicker');
  el.innerHTML = '';
  TIERS.forEach(t=>{
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tier-' + t + (currentMultiTier===t ? ' selected':'');
    btn.textContent = t;
    btn.addEventListener('click', ()=>{
      currentMultiTier = (currentMultiTier === t) ? null : t;
      renderMultiTierPicker();
    });
    el.appendChild(btn);
  });
}
function addTitleBoxRow(focus, prefill){
  const container = document.getElementById('titleBoxes');
  const isAlbum = multiMode === 'album';
  const row = document.createElement('div');
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'title-box-input';
  input.placeholder = isAlbum ? `Track ${container.children.length+1} title` : `Song ${container.children.length+1} title`;
  if(prefill && prefill.title) input.value = prefill.title;

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'remove-title';
  removeBtn.textContent = '×';
  removeBtn.addEventListener('click', ()=>{
    if(container.children.length > 1) row.remove();
  });

  if(isAlbum){
    row.className = 'track-box-row';
    const top = document.createElement('div');
    top.className = 'track-box-row-top';
    const num = document.createElement('span');
    num.className = 'track-box-num';
    num.textContent = (container.children.length+1) + '.';
    top.appendChild(num);
    top.appendChild(input);
    top.appendChild(removeBtn);
    row.appendChild(top);

    const sub = document.createElement('div');
    sub.className = 'track-box-sub';
    const artistInput = document.createElement('input');
    artistInput.type = 'text';
    artistInput.className = 'track-box-artist';
    artistInput.placeholder = 'Artist(s) for this track — e.g. Artist One, Artist Two (feat. …)';
    if(prefill && prefill.artist) artistInput.value = prefill.artist;
    const tagsInput = document.createElement('input');
    tagsInput.type = 'text';
    tagsInput.className = 'track-box-tags';
    tagsInput.placeholder = 'Mood / tags for this track (comma-separated)';
    sub.appendChild(artistInput);
    sub.appendChild(tagsInput);
    row.appendChild(sub);
  } else {
    row.className = 'title-box-row';
    row.appendChild(input);
    row.appendChild(removeBtn);
  }

  container.appendChild(row);
  if(focus) input.focus();
}
function resetTitleBoxes(prefillTracks){
  document.getElementById('titleBoxes').innerHTML = '';
  if(prefillTracks && prefillTracks.length){
    prefillTracks.forEach(t=>addTitleBoxRow(false, t));
  } else {
    addTitleBoxRow(false);
    addTitleBoxRow(false);
  }
}
function handleMultiSave(){
  const isAlbum = multiMode === 'album';
  const titleInputs = [...document.querySelectorAll('#titleBoxes .title-box-input')];
  if(titleInputs.every(i=>!i.value.trim())){
    titleInputs[0]?.focus();
    return;
  }
  const sharedArtists = document.getElementById('mf-artist').value.split(',').map(a=>a.trim()).filter(Boolean);
  const shared = {
    album: document.getElementById('mf-album').value.trim(),
    year: document.getElementById('mf-year').value.trim(),
    genres: document.getElementById('mf-genre').value.split(',').map(g=>g.trim()).filter(Boolean),
    heard: document.getElementById('mf-heard').value.trim(),
    why: document.getElementById('mf-why').value.trim(),
    credit: document.getElementById('mf-credit').value.trim(),
    coverArt: currentMultiCoverArt,
    remindsOf: getSelectedReminds('mf'),
    tier: currentMultiTier
  };
  const clusterId = uid();
  const now = Date.now();
  let newSongs;
  if(isAlbum){
    const rows = [...document.querySelectorAll('#titleBoxes .track-box-row')];
    newSongs = rows.map(row=>{
      const title = row.querySelector('.title-box-input').value.trim();
      if(!title) return null;
      const artistVal = row.querySelector('.track-box-artist').value.trim();
      const tagsVal = row.querySelector('.track-box-tags').value.trim();
      return {
        id: uid(), pinned:false, createdAt: now, clusterId, title,
        artists: artistVal ? artistVal.split(',').map(a=>a.trim()).filter(Boolean) : sharedArtists,
        tags: tagsVal.split(',').map(t=>t.trim()).filter(Boolean),
        ...shared
      };
    }).filter(Boolean);
  } else {
    const titles = titleInputs.map(i=>i.value.trim()).filter(Boolean);
    newSongs = titles.map(title=>({
      id: uid(), pinned:false, createdAt: now, clusterId, title,
      artists: sharedArtists,
      tags: document.getElementById('mf-tags').value.split(',').map(t=>t.trim()).filter(Boolean),
      ...shared
    }));
  }
  if(newSongs.length === 0){
    titleInputs[0]?.focus();
    return;
  }
  songs = [...newSongs, ...songs];
  save();
  closeMultiModal();
  render();
}

document.getElementById('grid').addEventListener('click', e=>{
  const linkBadge = e.target.closest('.link-badge');
  if(linkBadge){
    clusterFilterId = linkBadge.dataset.cluster;
    remindsFilterId = null;
    render();
    return;
  }
  const removeReminderBtn = e.target.closest('[data-remove-reminder]');
  if(removeReminderBtn){
    const [songId, personId] = removeReminderBtn.dataset.removeReminder.split('|');
    const song = songs.find(s=>s.id===songId);
    if(song){
      song.remindsOf = (song.remindsOf||[]).filter(pid=>pid!==personId);
      save();
      render();
    }
    return;
  }
  const remindsBadge = e.target.closest('.reminds-badge[data-person]');
  if(remindsBadge){
    remindsFilterId = remindsBadge.dataset.person;
    clusterFilterId = null;
    renderPeople();
    render();
    return;
  }
  const wishBtn = e.target.closest('button[data-wish-action]');
  if(wishBtn){
    const card = wishBtn.closest('.card');
    const id = card.dataset.wishId;
    const item = wishlist.find(w=>w.id===id);
    if(!item) return;
    const action = wishBtn.dataset.wishAction;
    if(action === 'edit'){
      openWishModal(item);
    } else if(action === 'delete'){
      if(confirm(`Remove "${item.title}" from your wishlist?`)){
        wishlist = wishlist.filter(w=>w.id!==id);
        saveWishlist();
        renderWishlistGrid();
      }
    }
    return;
  }
  const btn = e.target.closest('button[data-action]');
  if(!btn) return;
  const card = btn.closest('.card');
  const id = card.dataset.id;
  const song = songs.find(s=>s.id===id);
  if(!song) return;
  const action = btn.dataset.action;
  if(action === 'pin'){
    song.pinned = !song.pinned;
    save(); render();
  } else if(action === 'archive'){
    song.archived = !song.archived;
    if(song.archived) song.pinned = false;
    save(); render();
  } else if(action === 'edit'){
    openModal(song);
  } else if(action === 'delete'){
    if(confirm(`Remove "${song.title}" from your cataloguex?`)){
      songs = songs.filter(s=>s.id!==id);
      save(); render();
    }
  }
});

function updateViewUI(){
  const archBtn = document.getElementById('toggleArchive');
  const wishBtn = document.getElementById('toggleWishlist');
  const tierBtn = document.getElementById('toggleTierBoard');
  archBtn.textContent = showArchived ? '← Back to cataloguex' : 'View archive';
  archBtn.classList.toggle('active', showArchived);
  wishBtn.textContent = viewingWishlist ? '← Back to cataloguex' : '✍ Songs I Wish I Wrote';
  wishBtn.classList.toggle('active', viewingWishlist);
  tierBtn.textContent = viewingTierBoard ? '← Back to cataloguex' : '🏆 Tier board';
  tierBtn.classList.toggle('active', viewingTierBoard);

  const otherMode = showArchived || viewingWishlist;
  document.getElementById('openAdd').style.display = otherMode ? 'none' : '';
  document.getElementById('openCluster').style.display = otherMode ? 'none' : '';
  document.getElementById('viewClustersBtn').style.display = otherMode ? 'none' : '';
  document.getElementById('openAlbum').style.display = otherMode ? 'none' : '';
  document.getElementById('openImportBtn').style.display = (otherMode || guestMode) ? 'none' : '';
  document.getElementById('resetCatalogueBtn').style.display = (otherMode || guestMode) ? 'none' : '';
  document.getElementById('openWish').style.display = viewingWishlist ? '' : 'none';
  document.getElementById('peopleSection').style.display = viewingWishlist ? 'none' : '';
  document.getElementById('filterGenre').style.display = (viewingWishlist || viewingTierBoard) ? 'none' : '';
  document.getElementById('filterMood').style.display = (viewingWishlist || viewingTierBoard) ? 'none' : '';
  document.getElementById('sortBy').style.display = (viewingWishlist || viewingTierBoard) ? 'none' : '';
  document.getElementById('search').style.display = viewingTierBoard ? 'none' : '';
  archBtn.style.display = (viewingWishlist || viewingTierBoard) ? 'none' : '';
  wishBtn.style.display = (showArchived || viewingTierBoard) ? 'none' : '';
  tierBtn.style.display = (showArchived || viewingWishlist) ? 'none' : '';
  clusterFilterId = null;
  remindsFilterId = null;
}
document.getElementById('toggleArchive').addEventListener('click', ()=>{
  showArchived = !showArchived;
  if(showArchived){ viewingWishlist = false; viewingTierBoard = false; }
  updateViewUI();
  render();
});
document.getElementById('toggleWishlist').addEventListener('click', ()=>{
  viewingWishlist = !viewingWishlist;
  if(viewingWishlist){ showArchived = false; viewingTierBoard = false; }
  updateViewUI();
  render();
});
document.getElementById('toggleTierBoard').addEventListener('click', ()=>{
  viewingTierBoard = !viewingTierBoard;
  if(viewingTierBoard){ showArchived = false; viewingWishlist = false; }
  updateViewUI();
  render();
});
document.getElementById('openAdd').addEventListener('click', ()=>openModal(null));
document.getElementById('cancelBtn').addEventListener('click', closeModal);
document.getElementById('saveBtn').addEventListener('click', handleSave);
document.getElementById('overlay').addEventListener('click', e=>{ if(e.target.id==='overlay') closeModal(); });
document.getElementById('openCluster').addEventListener('click', openClusterModal);
document.getElementById('openAlbum').addEventListener('click', ()=>openMultiModal('album'));

