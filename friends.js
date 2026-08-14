/* =========================================================
   DISCOVER + ADD FRIENDS (pending request / accept flow)
   ========================================================= */
let allProfilesCache = [];
let myFriendIds = new Set();
let outgoingRequestIds = new Set();
let incomingRequests = []; // [{ id, requester_id }]

async function fetchFriendsCount(){
  const { count, error } = await sb
    .from('friends')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'accepted')
    .or(`requester_id.eq.${currentUserId},addressee_id.eq.${currentUserId}`);
  if(error){ console.error('Error loading friends count:', error); return 0; }
  return count || 0;
}
async function fetchAllProfiles(){
  const { data, error } = await sb
    .from('profiles')
    .select('user_id, username, bio, photo')
    .neq('user_id', currentUserId)
    .limit(100);
  if(error){ console.error('Error loading people:', error); return []; }
  return (data || []).filter(p=>p.username);
}
async function fetchMyFriendRows(){
  const { data, error } = await sb
    .from('friends')
    .select('id, requester_id, addressee_id, status')
    .or(`requester_id.eq.${currentUserId},addressee_id.eq.${currentUserId}`);
  if(error){ console.error('Error loading friends:', error); return []; }
  return data || [];
}
function processFriendRows(rows){
  myFriendIds = new Set();
  outgoingRequestIds = new Set();
  incomingRequests = [];
  rows.forEach(r=>{
    if(r.status === 'accepted'){
      const other = r.requester_id === currentUserId ? r.addressee_id : r.requester_id;
      myFriendIds.add(other);
    } else if(r.status === 'pending'){
      if(r.requester_id === currentUserId){
        outgoingRequestIds.add(r.addressee_id);
      } else {
        incomingRequests.push({ id: r.id, requester_id: r.requester_id });
      }
    }
  });
}
async function sendFriendRequest(addresseeId){
  const { error } = await sb.from('friends').upsert(
    { requester_id: currentUserId, addressee_id: addresseeId, status: 'pending' },
    { onConflict: 'requester_id,addressee_id' }
  );
  if(error){ console.error('Error sending friend request:', error); return false; }
  outgoingRequestIds.add(addresseeId);
  return true;
}
async function acceptFriendRequest(rowId, requesterId){
  const { error } = await sb.from('friends').update({ status: 'accepted' }).eq('id', rowId);
  if(error){ console.error('Error accepting friend request:', error); return false; }
  myFriendIds.add(requesterId);
  incomingRequests = incomingRequests.filter(r=>r.id!==rowId);
  return true;
}
async function declineFriendRequest(rowId){
  const { error } = await sb.from('friends').delete().eq('id', rowId);
  if(error){ console.error('Error declining friend request:', error); return false; }
  incomingRequests = incomingRequests.filter(r=>r.id!==rowId);
  return true;
}
function renderFriendRequests(){
  const wrap = document.getElementById('friendRequestsWrap');
  const list = document.getElementById('friendRequestsList');
  if(incomingRequests.length === 0){ wrap.style.display = 'none'; list.innerHTML = ''; return; }
  wrap.style.display = '';
  list.innerHTML = incomingRequests.map(r=>{
    const p = allProfilesCache.find(x=>x.user_id === r.requester_id);
    const username = p ? p.username : 'unknown';
    const initial = username.charAt(0).toUpperCase();
    return `
      <div class="discover-row">
        ${p && p.photo ? `<img src="${escapeHtml(p.photo)}">` : `<span class="drow-fallback">${escapeHtml(initial)}</span>`}
        <span style="flex:1;">
          <span class="drow-name">@${escapeHtml(username)}</span><br>
          <span class="drow-bio">wants to be friends</span>
        </span>
        <span class="row-btn-group">
          <button type="button" class="modal-action-btn accent" data-accept-request="${r.id}" data-requester="${r.requester_id}">Accept</button>
          <button type="button" class="modal-action-btn" data-decline-request="${r.id}">Decline</button>
        </span>
      </div>
    `;
  }).join('');
}
function renderDiscoverList(filter){
  const wrap = document.getElementById('discoverList');
  const q = (filter||'').trim().toLowerCase();
  const list = allProfilesCache.filter(p=>!q || p.username.toLowerCase().includes(q));
  if(list.length === 0){
    wrap.innerHTML = '<p class="profile-empty-note">No one found.</p>';
    return;
  }
  wrap.innerHTML = list.map(p=>{
    const isFriend = myFriendIds.has(p.user_id);
    const isRequested = outgoingRequestIds.has(p.user_id);
    const initial = p.username.charAt(0).toUpperCase();
    let btnLabel = '+ Add friend';
    if(isFriend) btnLabel = 'Friends';
    else if(isRequested) btnLabel = 'Requested';
    return `
      <div class="discover-row" data-user-id="${p.user_id}">
        ${p.photo ? `<img src="${escapeHtml(p.photo)}">` : `<span class="drow-fallback">${escapeHtml(initial)}</span>`}
        <span style="flex:1;">
          <span class="drow-name">@${escapeHtml(p.username)}</span><br>
          <span class="drow-bio">${escapeHtml(p.bio || '')}</span>
        </span>
        <button type="button" class="modal-action-btn" data-add-friend="${p.user_id}" ${(isFriend||isRequested) ? 'disabled' : ''}>${btnLabel}</button>
      </div>
    `;
  }).join('');
}
document.getElementById('discoverBtn').addEventListener('click', async ()=>{
  document.getElementById('discoverOverlay').classList.add('open');
  document.getElementById('friend-username-search').value = '';
  document.getElementById('discoverList').innerHTML = '<p class="profile-empty-note">Loading…</p>';
  document.getElementById('friendRequestsWrap').style.display = 'none';
  const [profiles, rows] = await Promise.all([fetchAllProfiles(), fetchMyFriendRows()]);
  allProfilesCache = profiles;
  processFriendRows(rows);
  renderFriendRequests();
  renderDiscoverList('');
  loadFriendLeaderboard();
});
document.getElementById('friend-username-search').addEventListener('input', e=>{
  renderDiscoverList(e.target.value);
});
document.getElementById('discoverList').addEventListener('click', async e=>{
  const btn = e.target.closest('[data-add-friend]');
  if(btn){
    if(btn.disabled) return;
    btn.disabled = true;
    btn.textContent = '…';
    const ok = await sendFriendRequest(btn.dataset.addFriend);
    btn.textContent = ok ? 'Requested' : '+ Add friend';
    if(!ok) btn.disabled = false;
    return;
  }
  const row = e.target.closest('[data-user-id]');
  if(row) openOtherProfile(row.dataset.userId);
});
function openOtherProfile(userId){
  const p = allProfilesCache.find(x=>x.user_id === userId);
  if(!p) return;
  const photoEl = document.getElementById('otherProfilePhoto');
  const fallbackEl = document.getElementById('otherProfileFallback');
  if(p.photo){
    photoEl.src = p.photo; photoEl.style.display = 'block'; fallbackEl.style.display = 'none';
  } else {
    photoEl.style.display = 'none'; fallbackEl.style.display = 'flex';
    fallbackEl.textContent = p.username.charAt(0).toUpperCase();
  }
  document.getElementById('otherProfileUsername').textContent = '@' + p.username;
  const bioEl = document.getElementById('otherProfileBio');
  bioEl.textContent = p.bio || 'No bio yet.';
  bioEl.classList.toggle('empty', !p.bio);
  updateOtherProfileFriendBtn(userId);
  document.getElementById('otherProfileOverlay').classList.add('open');
}
function updateOtherProfileFriendBtn(userId){
  const btn = document.getElementById('otherProfileFriendBtn');
  btn.dataset.userId = userId;
  const isFriend = myFriendIds.has(userId);
  const isRequested = outgoingRequestIds.has(userId);
  btn.disabled = isFriend || isRequested;
  btn.textContent = isFriend ? 'Friends' : (isRequested ? 'Requested' : '+ Add friend');
  const catBtn = document.getElementById('otherProfileCatalogueBtn');
  const p = allProfilesCache.find(x=>x.user_id === userId);
  if(isFriend && p && p.username){
    catBtn.style.display = '';
    catBtn.dataset.username = p.username;
  } else {
    catBtn.style.display = 'none';
  }
}
document.getElementById('otherProfileCatalogueBtn').addEventListener('click', ()=>{
  const username = document.getElementById('otherProfileCatalogueBtn').dataset.username;
  if(!username) return;
  document.getElementById('otherProfileOverlay').classList.remove('open');
  document.getElementById('discoverOverlay').classList.remove('open');
  goToFriendCatalogue(username);
});
document.getElementById('otherProfileFriendBtn').addEventListener('click', async ()=>{
  const btn = document.getElementById('otherProfileFriendBtn');
  if(btn.disabled) return;
  const userId = btn.dataset.userId;
  btn.disabled = true;
  btn.textContent = '…';
  const ok = await sendFriendRequest(userId);
  updateOtherProfileFriendBtn(userId);
  renderDiscoverList(document.getElementById('friend-username-search').value);
  if(!ok) return;
});
document.getElementById('otherProfileCloseBtn').addEventListener('click', ()=>{
  document.getElementById('otherProfileOverlay').classList.remove('open');
});
document.getElementById('otherProfileOverlay').addEventListener('click', e=>{
  if(e.target.id==='otherProfileOverlay') document.getElementById('otherProfileOverlay').classList.remove('open');
});
document.getElementById('friendRequestsList').addEventListener('click', async e=>{
  const acceptBtn = e.target.closest('[data-accept-request]');
  const declineBtn = e.target.closest('[data-decline-request]');
  if(acceptBtn){
    acceptBtn.disabled = true;
    const ok = await acceptFriendRequest(acceptBtn.dataset.acceptRequest, acceptBtn.dataset.requester);
    if(ok){
      myFriendsCount++;
      render();
      renderFriendRequests();
      renderDiscoverList(document.getElementById('friend-username-search').value);
    }
    else { acceptBtn.disabled = false; }
  } else if(declineBtn){
    declineBtn.disabled = true;
    const ok = await declineFriendRequest(declineBtn.dataset.declineRequest);
    if(ok){ renderFriendRequests(); }
    else { declineBtn.disabled = false; }
  }
});
document.getElementById('discoverCloseBtn').addEventListener('click', ()=>{
  document.getElementById('discoverOverlay').classList.remove('open');
});
document.getElementById('discoverOverlay').addEventListener('click', e=>{
  if(e.target.id==='discoverOverlay') document.getElementById('discoverOverlay').classList.remove('open');
});

/* =========================================================
   FRIEND CATALOGUEX PAGE  (routed at #/u/username)
   ========================================================= */
function usernameFromRoute(){
  const m = location.hash.match(/^#\/u\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}
function goToFriendCatalogue(username){
  location.hash = '/u/' + encodeURIComponent(username);
}
function closeFriendCatalogue(){
  document.getElementById('friendWrap').style.display = 'none';
  document.getElementById('appWrap').style.display = '';
  applyTheme(loadTheme());
}
document.getElementById('friendBackBtn').addEventListener('click', ()=>{
  history.pushState('', document.title, location.pathname + location.search);
  closeFriendCatalogue();
});

async function fetchProfileByUsername(username){
  const { data, error } = await sb
    .from('profiles')
    .select('user_id, username, bio, photo, theme')
    .ilike('username', username)
    .maybeSingle();
  if(error){
    console.error('Error loading that profile (retrying without theme column):', error);
    const retry = await sb
      .from('profiles')
      .select('user_id, username, bio, photo')
      .ilike('username', username)
      .maybeSingle();
    if(retry.error){ console.error('Error loading that profile:', retry.error); return null; }
    return retry.data;
  }
  return data;
}
async function fetchReadOnlySongs(userId){
  const { data, error } = await sb
    .from('user_data')
    .select('songs')
    .eq('user_id', userId)
    .maybeSingle();
  if(error){ console.error('Error loading that cataloguex:', error); return null; }
  return (data && data.songs) || [];
}

/* ---- TASTE MATCH (fun social feature #1 + #2) ---- */
function jaccardSets(setA, setB){
  if(setA.size===0 && setB.size===0) return 0;
  let inter=0;
  setA.forEach(x=>{ if(setB.has(x)) inter++; });
  const unionSize = new Set([...setA, ...setB]).size;
  return unionSize ? inter/unionSize : 0;
}
function computeTasteMatch(mySongs, theirSongs){
  const norm = v => (v||'').trim().toLowerCase();
  const artistSet = list => { const s=new Set(); (list||[]).forEach(song=>(song.artists||[]).forEach(a=>{ if(norm(a)) s.add(norm(a)); })); return s; };
  const genreSet = list => { const s=new Set(); (list||[]).forEach(song=>(song.genres||[]).forEach(g=>{ if(norm(g)) s.add(norm(g)); })); return s; };
  const myArtists = artistSet(mySongs), theirArtists = artistSet(theirSongs);
  const myGenres = genreSet(mySongs), theirGenres = genreSet(theirSongs);
  const artistScore = jaccardSets(myArtists, theirArtists);
  const genreScore = jaccardSets(myGenres, theirGenres);
  const percent = Math.round((artistScore*0.65 + genreScore*0.35) * 100);
  const sharedArtists = [...myArtists].filter(a=>theirArtists.has(a));
  const theirTrackKeys = new Map();
  (theirSongs||[]).forEach(s=>{ theirTrackKeys.set(norm(s.title)+'|'+norm((s.artists||[])[0]), s); });
  const sharedTracks = (mySongs||[]).filter(s=> s.title && theirTrackKeys.has(norm(s.title)+'|'+norm((s.artists||[])[0])));
  return { percent, sharedArtists, sharedTracks };
}
function tasteMatchLabel(percent){
  if(percent>=70) return 'Soulmates 🎧';
  if(percent>=45) return 'Kindred Spirits 🌊';
  if(percent>=20) return 'Distant Cousins 🌱';
  if(percent>0) return 'Different Wavelengths 🛸';
  return 'Uncharted Territory 🗺️';
}
function renderTasteMatch(mySongs, theirSongs){
  const panel = document.getElementById('friendTasteMatch');
  const favsWrap = document.getElementById('friendSharedFavs');
  const favsList = document.getElementById('sharedFavsList');
  if(!mySongs.length || !theirSongs.length){
    panel.style.display = 'none';
    favsWrap.style.display = 'none';
    return;
  }
  const { percent, sharedArtists, sharedTracks } = computeTasteMatch(mySongs, theirSongs);
  panel.style.display = 'flex';
  document.getElementById('tmPercent').textContent = percent + '%';
  document.getElementById('tmRing').style.setProperty('--tm-pct', percent);
  document.getElementById('tmLabel').textContent = tasteMatchLabel(percent);
  const bits = [];
  if(sharedArtists.length) bits.push(`${sharedArtists.length} shared artist${sharedArtists.length===1?'':'s'}`);
  if(sharedTracks.length) bits.push(`${sharedTracks.length} identical track${sharedTracks.length===1?'':'s'}`);
  document.getElementById('tmDetail').textContent = bits.length ? bits.join(' · ') : 'Not much overlap yet — go explore each other\u2019s taste!';
  if(sharedTracks.length){
    favsWrap.style.display = 'block';
    favsList.innerHTML = sharedTracks.slice(0,10).map(s=>`
      <div class="shared-fav-chip">
        ${s.coverArt ? `<img src="${escapeHtml(s.coverArt)}">` : ''}
        <span>${escapeHtml(s.title||'Untitled')}<br><small>${escapeHtml(formatArtists(s.artists))}</small></span>
      </div>
    `).join('');
  } else {
    favsWrap.style.display = 'none';
  }
}

/* ---- FRIEND LEADERBOARD (fun social feature #3) ---- */
async function loadFriendLeaderboard(){
  const wrap = document.getElementById('friendLeaderboardWrap');
  const list = document.getElementById('friendLeaderboardList');
  const friendIds = [...myFriendIds];
  if(friendIds.length < 2){ wrap.style.display = 'none'; list.innerHTML = ''; return; }
  wrap.style.display = '';
  list.innerHTML = '<p class="profile-empty-note">Crunching the numbers…</p>';
  const results = await Promise.all(friendIds.map(async id=>({ id, songs: (await fetchReadOnlySongs(id)) || [] })));
  let mostProlific=null, pickiest=null, twin=null;
  results.forEach(r=>{
    if(!r.songs.length) return;
    if(!mostProlific || r.songs.length > mostProlific.songs.length) mostProlific = r;
    if(r.songs.length >= 3){
      const ratio = r.songs.filter(s=>s.tier==='S').length / r.songs.length;
      if(ratio > 0 && (!pickiest || ratio > pickiest.ratio)) pickiest = { ...r, ratio };
    }
    const { percent } = computeTasteMatch(songs, r.songs);
    if(percent > 0 && (!twin || percent > twin.percent)) twin = { ...r, percent };
  });
  const usernameFor = id => { const p = allProfilesCache.find(x=>x.user_id===id); return p ? p.username : 'someone'; };
  const rows = [];
  if(mostProlific) rows.push({ emoji:'🎧', title:'Most Prolific', name:usernameFor(mostProlific.id), detail:`${mostProlific.songs.length} tracks catalogued` });
  if(pickiest) rows.push({ emoji:'🔥', title:'Pickiest Curator', name:usernameFor(pickiest.id), detail:`${Math.round(pickiest.ratio*100)}% S-tier picks` });
  if(twin) rows.push({ emoji:'🧬', title:'Your Taste Twin', name:usernameFor(twin.id), detail:`${twin.percent}% match with you` });
  if(!rows.length){ list.innerHTML = '<p class="profile-empty-note">Not enough data yet — add a few tracks and check back!</p>'; return; }
  list.innerHTML = rows.map(r=>`
    <div class="discover-row leaderboard-row" style="cursor:default;">
      <span class="drow-fallback">${r.emoji}</span>
      <span style="flex:1;">
        <span class="drow-name">${escapeHtml(r.title)}: @${escapeHtml(r.name)}</span><br>
        <span class="drow-bio">${escapeHtml(r.detail)}</span>
      </span>
    </div>
  `).join('');
}
function renderFriendGrid(list){
  const grid = document.getElementById('friendGrid');
  const empty = document.getElementById('friendEmptyState');
  const active = (list || []).filter(s=>!s.archived);
  if(active.length === 0){
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  grid.innerHTML = active.map(s=>`
    <div class="card">
      <div class="card-top">
        ${s.coverArt ? `<img class="cover-thumb" src="${s.coverArt}">` : ''}
        <div class="title-stack">
          <p class="track-title">${escapeHtml(s.title||'Untitled')}</p>
          <p class="track-artist">${escapeHtml(formatArtists(s.artists))}${s.album ? ' · '+escapeHtml(s.album) : ''}</p>
        </div>
      </div>
      <div class="meta-row">
        ${s.year ? `<span>${escapeHtml(s.year)}</span>` : ''}
        ${(s.genres&&s.genres.length) ? `<span class="meta-genres">· ${s.genres.map(g=>escapeHtml(g)).join(', ')}</span>` : ''}
      </div>
      <div class="tier-row">${renderTierBadge(s.tier)}</div>
      ${(s.tags&&s.tags.length) ? `<div class="tags">${s.tags.map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
      ${s.lyricSnippet ? `<p class="lyric-snippet">${escapeHtml(s.lyricSnippet)}</p>` : ''}
      ${s.why ? `<p class="why">${escapeHtml(s.why)}</p>` : ''}
      ${s.heard ? `<p class="heard"><b>Heard it:</b> ${escapeHtml(s.heard)}</p>` : ''}
    </div>
  `).join('');
}
let viewingFriendTierBoard = false;
let currentFriendSongs = [];
function renderFriendTierBoard(list){
  document.getElementById('friendTierBoard').innerHTML = buildTierBoardHtml(list, false);
}
function updateFriendViewUI(){
  const grid = document.getElementById('friendGrid');
  const board = document.getElementById('friendTierBoard');
  const btn = document.getElementById('friendTierBoardBtn');
  btn.textContent = viewingFriendTierBoard ? '← Back to grid' : '🏆 Tier board';
  btn.classList.toggle('active', viewingFriendTierBoard);
  if(viewingFriendTierBoard){
    grid.style.display = 'none';
    board.style.display = '';
    document.getElementById('friendEmptyState').style.display = 'none';
    renderFriendTierBoard(currentFriendSongs);
  } else {
    board.style.display = 'none';
    grid.style.display = '';
    renderFriendGrid(currentFriendSongs);
  }
}
document.getElementById('friendTierBoardBtn').addEventListener('click', ()=>{
  viewingFriendTierBoard = !viewingFriendTierBoard;
  updateFriendViewUI();
});
function updateFriendBanner(p){
  document.getElementById('friendName').textContent = '@' + p.username;
  const bioEl = document.getElementById('friendBio');
  bioEl.textContent = p.bio || '';
  bioEl.classList.toggle('empty', !p.bio);
  const photoEl = document.getElementById('friendAvatarImg');
  const fallbackEl = document.getElementById('friendAvatarFallback');
  if(p.photo){
    photoEl.src = p.photo; photoEl.style.display = ''; fallbackEl.style.display = 'none';
  } else {
    photoEl.style.display = 'none'; fallbackEl.style.display = 'flex';
    fallbackEl.textContent = p.username.charAt(0).toUpperCase();
  }
}
function updateFriendAddBtn(userId){
  const btn = document.getElementById('friendAddBtn');
  if(userId === currentUserId){ btn.style.display = 'none'; return; }
  btn.style.display = '';
  const isFriend = myFriendIds.has(userId);
  const isRequested = outgoingRequestIds.has(userId);
  btn.disabled = isFriend || isRequested;
  btn.textContent = isFriend ? 'Friends' : (isRequested ? 'Requested' : '+ Add friend');
  btn.onclick = async ()=>{
    if(btn.disabled) return;
    btn.disabled = true;
    btn.textContent = '…';
    const ok = await sendFriendRequest(userId);
    updateFriendAddBtn(userId);
    if(!ok) return;
  };
}
async function openFriendCatalogue(username){
  document.getElementById('appWrap').style.display = 'none';
  document.getElementById('friendWrap').style.display = '';
  document.getElementById('friendGrid').innerHTML = '';
  document.getElementById('friendEmptyState').style.display = 'none';
  document.getElementById('friendLockedState').style.display = 'none';
  document.getElementById('friendNotFoundState').style.display = 'none';
  document.getElementById('friendName').textContent = '@' + username;
  document.getElementById('friendBio').textContent = '';
  document.getElementById('friendAddBtn').style.display = 'none';
  document.getElementById('friendTierBoardBtn').style.display = 'none';
  viewingFriendTierBoard = false;
  document.getElementById('friendTierBoard').style.display = 'none';
  document.getElementById('friendGrid').style.display = '';
  document.getElementById('friendTasteMatch').style.display = 'none';
  document.getElementById('friendSharedFavs').style.display = 'none';

  const p = await fetchProfileByUsername(username);
  if(!p){
    document.getElementById('friendNotFoundState').style.display = 'block';
    return;
  }
  updateFriendBanner(p);
  updateFriendAddBtn(p.user_id);

  const isSelf = p.user_id === currentUserId;
  const isFriend = myFriendIds.has(p.user_id);

  // show this listener's own theme while browsing their cataloguex; restore ours on the way out
  applyTheme(isSelf ? loadTheme() : (p.theme || DEFAULT_THEME));

  if(!isSelf && !isFriend){
    document.getElementById('friendLockedState').style.display = 'block';
    return;
  }
  document.getElementById('friendTierBoardBtn').style.display = '';
  const friendSongs = isSelf ? songs : await fetchReadOnlySongs(p.user_id);
  currentFriendSongs = friendSongs;
  updateFriendViewUI();
  if(!isSelf) renderTasteMatch(songs, friendSongs);
}
function checkRoute(){
  const username = usernameFromRoute();
  if(username && currentUserId){
    openFriendCatalogue(username);
  } else if(!username && document.getElementById('friendWrap').style.display !== 'none'){
    closeFriendCatalogue();
  }
}
window.addEventListener('hashchange', checkRoute);

document.getElementById('addTitleBox').addEventListener('click', ()=>addTitleBoxRow(true));
document.getElementById('multiCancelBtn').addEventListener('click', closeMultiModal);
document.getElementById('multiSaveBtn').addEventListener('click', handleMultiSave);
document.getElementById('multiOverlay').addEventListener('click', e=>{ if(e.target.id==='multiOverlay') closeMultiModal(); });
document.getElementById('clearClusterFilter').addEventListener('click', ()=>{ clusterFilterId = null; render(); });
document.getElementById('clearRemindsFilter').addEventListener('click', ()=>{ remindsFilterId = null; render(); });
let searchDebounceTimer = null;
document.getElementById('search').addEventListener('input', ()=>{
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(render, 200);
});
document.getElementById('filterGenre').addEventListener('change', render);
document.getElementById('filterMood').addEventListener('change', render);
document.getElementById('sortBy').addEventListener('change', render);
document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeModal(); });

bindCoverInput('f-cover-file', 'f-cover', v=>currentCoverArt=v);
bindCoverInput('mf-cover-file', 'mf-cover', v=>currentMultiCoverArt=v);
bindCoverInput('w-cover-file', 'w-cover', v=>currentWishCoverArt=v);
bindCoverInput('p-photo-file', 'p-photo', v=>currentPersonPhoto=v);

document.getElementById('peopleRow').addEventListener('click', e=>{
  const removeBtn = e.target.closest('[data-remove-person]');
  if(removeBtn){
    e.stopPropagation();
    const id = removeBtn.dataset.removePerson;
    const person = people.find(p=>p.id===id);
    if(person && confirm(`Remove "${person.name}" from your people list? (Songs keep their other tags.)`)){
      people = people.filter(p=>p.id!==id);
      savePeople();
      songs.forEach(s=>{ if(s.remindsOf) s.remindsOf = s.remindsOf.filter(pid=>pid!==id); });
      save();
      if(remindsFilterId === id) remindsFilterId = null;
      renderPeople();
      render();
    }
    return;
  }
  const card = e.target.closest('.person-card');
  if(card){
    const id = card.dataset.person;
    remindsFilterId = (remindsFilterId === id) ? null : id;
    clusterFilterId = null;
    renderPeople();
    render();
  }
});

document.getElementById('addPersonBtn').addEventListener('click', ()=>{
  currentPersonPhoto = null;
  document.getElementById('p-name').value = '';
  setImagePreview('p-photo', null);
  document.getElementById('personOverlay').classList.add('open');
  document.getElementById('p-name').focus();
});
document.getElementById('personCancelBtn').addEventListener('click', ()=>{
  document.getElementById('personOverlay').classList.remove('open');
});
document.getElementById('personOverlay').addEventListener('click', e=>{
  if(e.target.id==='personOverlay') document.getElementById('personOverlay').classList.remove('open');
});
document.getElementById('personSaveBtn').addEventListener('click', ()=>{
  const name = document.getElementById('p-name').value.trim();
  if(!name){ document.getElementById('p-name').focus(); return; }
  people.push({ id: uid(), name, photo: currentPersonPhoto });
  savePeople();
  document.getElementById('personOverlay').classList.remove('open');
  renderPeople();
});

function openWishModal(item){
  editingWishId = item ? item.id : null;
  document.getElementById('wishModalTitle').textContent = item ? 'Edit song' : 'Add a song you wish you wrote';
  document.getElementById('w-title').value = item?.title || '';
  document.getElementById('w-artist').value = (item?.artists||[]).join(', ');
  document.getElementById('w-album').value = item?.album || '';
  document.getElementById('w-year').value = item?.year || '';
  document.getElementById('w-lyric').value = item?.lyricSnippet || '';
  document.getElementById('w-why').value = item?.why || '';
  currentWishCoverArt = item?.coverArt || null;
  setImagePreview('w-cover', currentWishCoverArt);
  document.getElementById('wishSearchField').style.display = item ? 'none' : '';
  document.getElementById('w-search').value = '';
  document.getElementById('wishSearchResults').style.display = 'none';
  document.getElementById('wishSearchResults').innerHTML = '';
  document.getElementById('wishOverlay').classList.add('open');
  document.getElementById('w-title').focus();
}
function closeWishModal(){
  document.getElementById('wishOverlay').classList.remove('open');
  editingWishId = null;
}
function renderWishSearchResults(query){
  const wrap = document.getElementById('wishSearchResults');
  const q = query.trim().toLowerCase();
  if(!q){ wrap.style.display = 'none'; wrap.innerHTML = ''; return; }
  const matches = songs.filter(s=>{
    const title = (s.title||'').toLowerCase();
    const artists = (s.artists||[]).join(' ').toLowerCase();
    return title.includes(q) || artists.includes(q);
  }).slice(0, 8);
  wrap.style.display = 'block';
  if(matches.length === 0){
    wrap.innerHTML = '<p class="profile-empty-note">No matching songs in your cataloguex.</p>';
    return;
  }
  wrap.innerHTML = matches.map(s=>`
    <button type="button" class="discover-row" data-song-id="${s.id}">
      ${s.coverArt ? `<img src="${s.coverArt}">` : `<span class="drow-fallback">${escapeHtml((s.title||'?').charAt(0).toUpperCase())}</span>`}
      <span>
        <span class="drow-name">${escapeHtml(s.title||'Untitled')}</span><br>
        <span class="drow-bio">${escapeHtml((s.artists||[]).join(', ') || 'Unknown artist')}</span>
      </span>
    </button>
  `).join('');
}
document.getElementById('w-search').addEventListener('input', e=>renderWishSearchResults(e.target.value));
document.getElementById('wishSearchResults').addEventListener('click', e=>{
  const row = e.target.closest('[data-song-id]');
  if(!row) return;
  const s = songs.find(x=>x.id===row.dataset.songId);
  if(!s) return;
  document.getElementById('w-title').value = s.title || '';
  document.getElementById('w-artist').value = (s.artists||[]).join(', ');
  document.getElementById('w-album').value = s.album || '';
  document.getElementById('w-year').value = s.year || '';
  currentWishCoverArt = s.coverArt || null;
  setImagePreview('w-cover', currentWishCoverArt);
  document.getElementById('w-search').value = '';
  document.getElementById('wishSearchResults').style.display = 'none';
  document.getElementById('wishSearchResults').innerHTML = '';
});
document.getElementById('openWish').addEventListener('click', ()=>openWishModal(null));
document.getElementById('wishCancelBtn').addEventListener('click', closeWishModal);
document.getElementById('wishOverlay').addEventListener('click', e=>{ if(e.target.id==='wishOverlay') closeWishModal(); });
document.getElementById('wishSaveBtn').addEventListener('click', ()=>{
  const title = document.getElementById('w-title').value.trim();
  if(!title){ document.getElementById('w-title').focus(); return; }
  const data = {
    title,
    artists: document.getElementById('w-artist').value.split(',').map(a=>a.trim()).filter(Boolean),
    album: document.getElementById('w-album').value.trim(),
    year: document.getElementById('w-year').value.trim(),
    lyricSnippet: document.getElementById('w-lyric').value.trim(),
    why: document.getElementById('w-why').value.trim(),
    coverArt: currentWishCoverArt
  };
  if(editingWishId){
    const idx = wishlist.findIndex(w=>w.id===editingWishId);
    if(idx>-1) wishlist[idx] = {...wishlist[idx], ...data};
  } else {
    wishlist.unshift({ id: uid(), createdAt: Date.now(), ...data });
  }
  saveWishlist();
  closeWishModal();
  renderWishlistGrid();
});
document.addEventListener('keydown', e=>{ if(e.key==='Escape'){ closeWishModal(); document.getElementById('personOverlay').classList.remove('open'); } });

// seed with a couple of example people on first run, so the "reminds me of" feature has real names to show
function seedPeopleIfEmpty(){
  if(people.length === 0){
    people = [
      { id:"ex-dad", name:"Dad", photo:null },
      { id:"ex-jamie", name:"CW Jamie", photo:null }
    ];
    savePeople();
  }
}

// seed with a couple of example entries on first run
function seedIfEmpty(){
  if(songs.length === 0){
    songs = [
      {
        id: uid(), pinned:true, title:"Bloodstream", artists:["Alyssa Grace"], album:"",
        year:"2026", genres:["Indie-Folk","Bedroom-Pop","Contemporary Country"],
        tags:["emotional","father-daughter","toxic-relationship","unhealthy dynamic"],
        heard:"TikTok",
        why:"so many lines hit home", tier:"S",
        credit:"", lyricSnippet:"And I'm craving you to change for me\nYou're saying, \"I hear you, I love you, my heart, it hurts for you\nAnd I just cannot give you what you need\"",
        coverArt:AGBS_COVER, remindsOf:["ex-dad"], isSeedExample:true
      },
      {
        id: uid(), pinned:false, title:"Wasted Days And Wasted Nights", artists:["Freddy Fender"], album:"",
        year:"1974", genres:["Swamp Pop","Country","Tex-Mex"],
        tags:["longing","regret","nostalgic sadness","70s"],
        heard:"Waffle House",
        why:"loved to play this when i was working at Waffle House!", tier:"A",
        credit:"Jamie", lyricSnippet:"Why should I keep loving you?\nWhen I know that you're not true",
        coverArt:WDAWN_COVER, remindsOf:["ex-jamie"], isSeedExample:true
      }
    ];
    save();
  }
}

