/* =========================================================
   LINK CLUSTER: search existing songs, add to a cluster
   ========================================================= */
let clusterSelectedIds = [];
function openClusterModal(){
  clusterSelectedIds = [];
  document.getElementById('cluster-name').value = '';
  document.getElementById('cluster-search').value = '';
  document.getElementById('clusterSearchResults').style.display = 'none';
  document.getElementById('clusterSearchResults').innerHTML = '';
  renderClusterSelectedList();
  document.getElementById('clusterOverlay').classList.add('open');
}
function closeClusterModal(){
  document.getElementById('clusterOverlay').classList.remove('open');
}
function renderClusterSearchResults(query){
  const wrap = document.getElementById('clusterSearchResults');
  const q = query.trim().toLowerCase();
  if(!q){ wrap.style.display = 'none'; wrap.innerHTML = ''; return; }
  const matches = songs.filter(s=>{
    if(clusterSelectedIds.includes(s.id)) return false;
    const title = (s.title||'').toLowerCase();
    const artists = (s.artists||[]).join(' ').toLowerCase();
    return title.includes(q) || artists.includes(q);
  }).slice(0, 8);
  wrap.style.display = 'block';
  if(matches.length === 0){
    wrap.innerHTML = '<p class="profile-empty-note">No matching songs.</p>';
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
function renderClusterSelectedList(){
  const wrap = document.getElementById('clusterSelectedList');
  const hint = document.getElementById('clusterEmptyHint');
  const items = clusterSelectedIds.map(id=>songs.find(s=>s.id===id)).filter(Boolean);
  hint.style.display = items.length ? 'none' : '';
  wrap.innerHTML = items.map(s=>`
    <div class="cluster-chip" data-song-id="${s.id}">
      <span>${escapeHtml(s.title||'Untitled')}${(s.artists&&s.artists.length) ? ' — '+escapeHtml(s.artists.join(', ')) : ''}</span>
      <button type="button" class="cluster-chip-x" data-remove="${s.id}" title="Remove">×</button>
    </div>
  `).join('');
}
function handleClusterSave(){
  if(clusterSelectedIds.length < 2){
    alert('Add at least 2 songs to link them together.');
    return;
  }
  const clusterId = uid();
  const clusterName = document.getElementById('cluster-name').value.trim();
  clusterSelectedIds.forEach(id=>{
    const s = songs.find(x=>x.id===id);
    if(s){ s.clusterId = clusterId; s.clusterName = clusterName || null; }
  });
  save();
  closeClusterModal();
  render();
}
document.getElementById('cluster-search').addEventListener('input', e=>renderClusterSearchResults(e.target.value));
document.getElementById('clusterSearchResults').addEventListener('click', e=>{
  const row = e.target.closest('[data-song-id]');
  if(!row) return;
  const id = row.dataset.songId;
  if(!clusterSelectedIds.includes(id)) clusterSelectedIds.push(id);
  document.getElementById('cluster-search').value = '';
  document.getElementById('clusterSearchResults').style.display = 'none';
  document.getElementById('clusterSearchResults').innerHTML = '';
  renderClusterSelectedList();
});
document.getElementById('clusterSelectedList').addEventListener('click', e=>{
  const btn = e.target.closest('[data-remove]');
  if(!btn) return;
  clusterSelectedIds = clusterSelectedIds.filter(id=>id!==btn.dataset.remove);
  renderClusterSelectedList();
});
document.getElementById('clusterCancelBtn').addEventListener('click', closeClusterModal);
document.getElementById('clusterSaveBtn').addEventListener('click', handleClusterSave);
document.getElementById('clusterOverlay').addEventListener('click', e=>{ if(e.target.id==='clusterOverlay') closeClusterModal(); });

/* =========================================================
   VIEW CLUSTERS
   ========================================================= */
let clustersEditMode = false;
function getClusterGroups(){
  const groups = {};
  songs.forEach(s=>{ if(s.clusterId){ (groups[s.clusterId] = groups[s.clusterId] || []).push(s); } });
  return groups;
}
function renderClustersList(){
  const wrap = document.getElementById('clustersListWrap');
  const groups = getClusterGroups();
  const clusterIds = Object.keys(groups).filter(id=>groups[id].length > 1);
  if(clusterIds.length === 0){
    wrap.innerHTML = '<p class="profile-empty-note">No linked clusters yet.</p>';
    return;
  }
  wrap.innerHTML = clusterIds.map(id=>{
    const list = groups[id];
    const name = (list.find(s=>s.clusterName)||{}).clusterName;
    return `
      <div class="cluster-name-row-wrap">
        <button type="button" class="cluster-name-row" data-cluster-id="${id}">
          <span class="cnr-name">${escapeHtml(name || 'Untitled cluster')}</span>
          <span class="cnr-count">${list.length} songs</span>
        </button>
        ${clustersEditMode ? `<button type="button" class="cluster-delete-btn" data-delete-cluster="${id}" title="Delete this cluster">Delete</button>` : ''}
      </div>
    `;
  }).join('');
}
function renderClusterDetail(id){
  const wrap = document.getElementById('clustersListWrap');
  const groups = getClusterGroups();
  const list = groups[id] || [];
  if(list.length === 0){ renderClustersList(); return; }
  const name = (list.find(s=>s.clusterName)||{}).clusterName;
  wrap.innerHTML = `
    <button type="button" class="cluster-back-btn" id="clusterBackBtn">← All clusters</button>
    <div class="cluster-group" data-cluster-id="${id}">
      <p class="cluster-group-name">${escapeHtml(name || 'Untitled cluster')}</p>
      <p class="profile-songs-label">${list.length} linked songs</p>
      ${list.map(s=>`
        <div class="profile-song-row">
          ${s.coverArt ? `<img src="${s.coverArt}">` : ''}
          <span class="psr-title">${escapeHtml(s.title||'Untitled')}</span>
          <span class="psr-artist">${escapeHtml((s.artists||[]).join(', '))}</span>
          <span class="profile-song-row-actions">
            <button type="button" class="psr-edit-btn" data-edit-song="${s.id}">Edit</button>
            <button type="button" class="psr-remove-btn" data-remove-from-cluster="${s.id}">Remove</button>
          </span>
        </div>
      `).join('')}
      <div class="cluster-group-actions">
        <button type="button" class="modal-action-btn" data-view-cluster="${id}">View in grid</button>
        <button type="button" class="cluster-delete-btn" data-delete-cluster="${id}">Delete entire cluster</button>
      </div>
    </div>
  `;
}
function deleteCluster(id){
  const groups = getClusterGroups();
  const list = groups[id] || [];
  if(list.length === 0) return;
  const ok = confirm(`Delete this cluster of ${list.length} songs? The songs themselves will stay in your cataloguex — this only removes the link between them.`);
  if(!ok) return;
  list.forEach(s=>{ s.clusterId = null; s.clusterName = null; });
  save();
  render();
  renderClustersList();
}
function removeSongFromCluster(songId){
  const song = songs.find(s=>s.id===songId);
  if(!song || !song.clusterId) return;
  const clusterId = song.clusterId;
  song.clusterId = null;
  song.clusterName = null;
  save();
  render();
  const groups = getClusterGroups();
  if((groups[clusterId] || []).length > 1){
    renderClusterDetail(clusterId);
  } else {
    renderClustersList();
  }
}
document.getElementById('viewClustersBtn').addEventListener('click', ()=>{
  clustersEditMode = false;
  document.getElementById('editClustersToggleBtn').classList.remove('active');
  document.getElementById('editClustersToggleBtn').textContent = 'Edit clusters';
  renderClustersList();
  document.getElementById('viewClustersOverlay').classList.add('open');
});
document.getElementById('viewClustersCloseBtn').addEventListener('click', ()=>{
  document.getElementById('viewClustersOverlay').classList.remove('open');
});
document.getElementById('editClustersToggleBtn').addEventListener('click', ()=>{
  clustersEditMode = !clustersEditMode;
  const btn = document.getElementById('editClustersToggleBtn');
  btn.classList.toggle('active', clustersEditMode);
  btn.textContent = clustersEditMode ? 'Done editing' : 'Edit clusters';
  renderClustersList();
});
document.getElementById('viewClustersOverlay').addEventListener('click', e=>{
  if(e.target.id==='viewClustersOverlay'){ document.getElementById('viewClustersOverlay').classList.remove('open'); return; }
  const deleteBtn = e.target.closest('[data-delete-cluster]');
  if(deleteBtn){ deleteCluster(deleteBtn.dataset.deleteCluster); return; }
  const editSongBtn = e.target.closest('[data-edit-song]');
  if(editSongBtn){
    const song = songs.find(s=>s.id===editSongBtn.dataset.editSong);
    if(song){
      document.getElementById('viewClustersOverlay').classList.remove('open');
      openModal(song);
    }
    return;
  }
  const removeBtn = e.target.closest('[data-remove-from-cluster]');
  if(removeBtn){ removeSongFromCluster(removeBtn.dataset.removeFromCluster); return; }
  const backBtn = e.target.closest('#clusterBackBtn');
  if(backBtn){ renderClustersList(); return; }
  const nameRow = e.target.closest('.cluster-name-row[data-cluster-id]');
  if(nameRow){ renderClusterDetail(nameRow.dataset.clusterId); return; }
  const viewBtn = e.target.closest('[data-view-cluster]');
  if(viewBtn){
    clusterFilterId = viewBtn.dataset.viewCluster;
    remindsFilterId = null;
    document.getElementById('viewClustersOverlay').classList.remove('open');
    render();
  }
});

