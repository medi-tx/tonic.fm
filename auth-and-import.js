/* =========================================================
   SUPABASE AUTH + CLOUD SYNC
   ========================================================= */
const SUPABASE_URL = 'https://aaqlnjdooeydtaihhdia.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_90hp8v69T6JrZKTQnKDIEA_Ku0J7eh0';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* =========================================================
   SPOTIFY IMPORT
   Fill in SPOTIFY_CLIENT_ID after registering an app at
   https://developer.spotify.com/dashboard — set that app's
   Redirect URI to the exact URL this page loads from.
   ========================================================= */
const SPOTIFY_CLIENT_ID = 'b46dfce1f67d4faea598d0ae02e42c50';
const SPOTIFY_REDIRECT_URI = location.origin + location.pathname;
const SPOTIFY_SCOPES = 'user-library-read';

/* =========================================================
   TIDAL IMPORT
   Uses the PKCE flow (no client secret — a static page can't
   keep one safe). Set that app's Redirect URI to the exact
   URL this page loads from, same as Spotify above.
   Tidal's third-party "Open API" access for reading a user's
   collection has historically needed manual approval from
   Tidal beyond just creating a Client ID — if the connect flow
   or the import call fails right away, that's the first thing
   to check.
   ========================================================= */
const TIDAL_CLIENT_ID = '7n9d7FqPupVD9l9D';
const TIDAL_REDIRECT_URI = location.origin + location.pathname;
const TIDAL_SCOPES = 'user.read collection.read';
const TIDAL_AUTH_URL = 'https://login.tidal.com/authorize';
const TIDAL_TOKEN_URL = 'https://auth.tidal.com/v1/oauth2/token';
const TIDAL_API_BASE = 'https://openapi.tidal.com/v2';

let authMode = 'login'; // 'login' or 'signup'
let syncTimer = null;

function showAuthScreen(){
  document.getElementById('recoveryScreen').style.display = 'none';
  document.getElementById('authScreen').style.display = 'flex';
  document.getElementById('appWrap').style.display = 'none';
  document.getElementById('loginFields').style.display = '';
  document.getElementById('forgotFields').style.display = 'none';
}
function showApp(){
  document.getElementById('recoveryScreen').style.display = 'none';
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('appWrap').style.display = '';
}
function showRecoveryScreen(){
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('appWrap').style.display = 'none';
  document.getElementById('recoveryScreen').style.display = 'flex';
}
function setAuthError(msg){
  const el = document.getElementById('auth-error');
  if(msg){ el.textContent = msg; el.style.display = ''; } else { el.style.display = 'none'; }
}
function setAuthMessage(msg){
  const el = document.getElementById('auth-message');
  if(msg){ el.textContent = msg; el.style.display = ''; } else { el.style.display = 'none'; }
}

document.getElementById('auth-toggle-btn').addEventListener('click', ()=>{
  authMode = (authMode === 'login') ? 'signup' : 'login';
  document.getElementById('auth-submit-btn').textContent = authMode === 'login' ? 'Log in' : 'Sign up';
  document.getElementById('auth-toggle-btn').textContent = authMode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Log in';
  setAuthError(null); setAuthMessage(null);
});

document.getElementById('auth-submit-btn').addEventListener('click', async ()=>{
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  setAuthError(null); setAuthMessage(null);
  if(!email || !password){ setAuthError('Enter an email and password.'); return; }

  if(authMode === 'login'){
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if(error) setAuthError(error.message);
  } else {
    const { data, error } = await sb.auth.signUp({ email, password });
    if(error){ setAuthError(error.message); return; }
    if(data.session){
      // email confirmation is off in the Supabase project — signed in immediately
    } else {
      setAuthMessage('Check your email to confirm your account, then log in.');
    }
  }
});

document.addEventListener('keydown', e=>{
  if(e.key === 'Enter' && document.getElementById('authScreen').style.display !== 'none'){
    if(document.getElementById('forgotFields').style.display !== 'none'){
      document.getElementById('sendResetBtn').click();
    } else {
      document.getElementById('auth-submit-btn').click();
    }
  }
  if(e.key === 'Enter' && document.getElementById('recoveryScreen').style.display !== 'none'){
    document.getElementById('recoverySubmitBtn').click();
  }
});

function setForgotError(msg){
  const el = document.getElementById('forgot-error');
  if(msg){ el.textContent = msg; el.style.display = ''; } else { el.style.display = 'none'; }
}
function setForgotMessage(msg){
  const el = document.getElementById('forgot-message');
  if(msg){ el.textContent = msg; el.style.display = ''; } else { el.style.display = 'none'; }
}
document.getElementById('forgotPasswordLink').addEventListener('click', ()=>{
  document.getElementById('loginFields').style.display = 'none';
  document.getElementById('forgotFields').style.display = '';
  document.getElementById('forgot-email').value = document.getElementById('auth-email').value;
  setForgotError(null); setForgotMessage(null);
});
document.getElementById('cancelForgotBtn').addEventListener('click', ()=>{
  document.getElementById('loginFields').style.display = '';
  document.getElementById('forgotFields').style.display = 'none';
});
document.getElementById('sendResetBtn').addEventListener('click', async ()=>{
  const email = document.getElementById('forgot-email').value.trim();
  setForgotError(null); setForgotMessage(null);
  if(!email){ setForgotError('Enter your email.'); return; }
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.href.split('#')[0]
  });
  if(error){ setForgotError(error.message); return; }
  setForgotMessage('If that email has an account, a reset link is on its way. Check your inbox.');
});

function setRecoveryError(msg){
  const el = document.getElementById('recovery-error');
  if(msg){ el.textContent = msg; el.style.display = ''; } else { el.style.display = 'none'; }
}
function setRecoveryMessage(msg){
  const el = document.getElementById('recovery-message');
  if(msg){ el.textContent = msg; el.style.display = ''; } else { el.style.display = 'none'; }
}
document.getElementById('recoverySubmitBtn').addEventListener('click', async ()=>{
  const pw1 = document.getElementById('recovery-password').value;
  const pw2 = document.getElementById('recovery-password-2').value;
  setRecoveryError(null); setRecoveryMessage(null);
  if(!pw1 || pw1.length < 6){ setRecoveryError('Password must be at least 6 characters.'); return; }
  if(pw1 !== pw2){ setRecoveryError('Passwords do not match.'); return; }
  const { error } = await sb.auth.updateUser({ password: pw1 });
  if(error){ setRecoveryError(error.message); return; }
  setRecoveryMessage('Password updated! Loading your cataloguex…');
  const { data: { session } } = await sb.auth.getSession();
  if(session && session.user) setTimeout(()=>loadAppForUser(session.user), 900);
});

document.getElementById('logoutBtn').addEventListener('click', async ()=>{
  if(guestMode){
    guestMode = false;
    songs = [];
    people = [];
    wishlist = [];
    document.getElementById('discoverBtn').style.display = '';
    document.getElementById('myProfileBtn').style.display = '';
    document.getElementById('logoutBtn').textContent = 'Log out';
    showAuthScreen();
    return;
  }
  await sb.auth.signOut();
});

async function fetchUserData(userId){
  const { data, error } = await sb
    .from('user_data')
    .select('songs, people, wishlist')
    .eq('user_id', userId)
    .maybeSingle();
  if(error){ console.error('Error loading your data:', error); return null; }
  return data;
}

async function ensureUserRow(userId){
  const { error } = await sb
    .from('user_data')
    .upsert({ user_id: userId, songs: [], people: [], wishlist: [] }, { onConflict: 'user_id', ignoreDuplicates: true });
  if(error) console.error('Error creating your data row:', error);
}

function syncToSupabase(){
  if(!currentUserId) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(async ()=>{
    const { error } = await sb
      .from('user_data')
      .upsert({ user_id: currentUserId, songs, people, wishlist, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if(error) console.error('Error saving to your account:', error);
  }, 400);
}

let currentUserId = null;
let myProfile = null;
let myFriendsCount = 0;
let guestMode = false;

async function fetchMyProfile(userId){
  const { data, error } = await sb
    .from('profiles')
    .select('user_id, username, bio, photo, theme')
    .eq('user_id', userId)
    .maybeSingle();
  if(error){
    console.error('Error loading your profile (retrying without theme column):', error);
    // theme column may not exist in this database yet — fall back so onboarding/login still works
    const retry = await sb
      .from('profiles')
      .select('user_id, username, bio, photo')
      .eq('user_id', userId)
      .maybeSingle();
    if(retry.error){ console.error('Error loading your profile:', retry.error); return null; }
    return retry.data;
  }
  return data;
}

async function upsertMyProfile(fields){
  const row = { user_id: currentUserId, updated_at: new Date().toISOString(), ...fields };
  const { error } = await sb.from('profiles').upsert(row, { onConflict: 'user_id' });
  return error;
}

function renderMyAvatar(){
  const el = document.getElementById('myAvatarContent');
  if(myProfile && myProfile.photo){
    el.innerHTML = `<img src="${myProfile.photo}">`;
  } else {
    const initial = (myProfile && myProfile.username) ? myProfile.username.charAt(0).toUpperCase() : '?';
    el.innerHTML = escapeHtml(initial);
  }
}

async function loadAppForUser(user){
  currentUserId = user.id;
  myProfile = await fetchMyProfile(user.id);
  renderMyAvatar();
  if(myProfile && myProfile.theme){
    applyTheme(myProfile.theme);
    localStorage.setItem(THEME_KEY, JSON.stringify(myProfile.theme));
  }
  await ensureUserRow(user.id);
  const remote = await fetchUserData(user.id);
  songs = (remote && remote.songs) || [];
  people = (remote && remote.people) || [];
  wishlist = (remote && remote.wishlist) || [];

  // run the existing migration/backfill logic against the loaded songs
  songs.forEach(s=>{
    if(!s.artists){ s.artists = s.artist ? [s.artist] : []; }
    delete s.artist;
    if(!s.genres){ s.genres = s.genre ? [s.genre] : []; }
    delete s.genre;
  });
  songs.forEach((s,i)=>{ if(!s.createdAt) s.createdAt = songs.length - i; });
  songs.forEach(s=>{
    if(!s.tier){
      const r = s.rating || 0;
      if(r >= 5) s.tier = 'S';
      else if(r === 4) s.tier = 'A';
      else if(r === 3) s.tier = 'B';
      else if(r > 0) s.tier = 'C';
      else s.tier = null;
    }
    delete s.rating;
  });

  seedPeopleIfEmpty();
  seedIfEmpty();
  const friendRows = await fetchMyFriendRows();
  processFriendRows(friendRows);
  myFriendsCount = friendRows.filter(r=>r.status==='accepted').length;
  renderPeople();
  updateViewUI();
  render();
  showApp();
  checkRoute();

  if(!myProfile || !myProfile.username){
    openOnboarding();
  } else {
    maybeShowImportNotice();
  }
}

/* ---- PKCE helpers ---- */
function b64urlEncode(bytes){
  let str = '';
  bytes.forEach(b=> str += String.fromCharCode(b));
  return btoa(str).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function generateCodeVerifier(){
  const arr = new Uint8Array(64);
  crypto.getRandomValues(arr);
  return b64urlEncode(arr);
}
async function generateCodeChallenge(verifier){
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return b64urlEncode(new Uint8Array(digest));
}

/* ---- token storage ---- */
function storeSpotifyTokens(tok){
  const expiresAt = Date.now() + (tok.expires_in * 1000) - 60000;
  localStorage.setItem('spotify_access_token', tok.access_token);
  if(tok.refresh_token) localStorage.setItem('spotify_refresh_token', tok.refresh_token);
  localStorage.setItem('spotify_token_expires_at', String(expiresAt));
}
function getStoredSpotifyToken(){
  return {
    access: localStorage.getItem('spotify_access_token'),
    refresh: localStorage.getItem('spotify_refresh_token'),
    expiresAt: parseInt(localStorage.getItem('spotify_token_expires_at') || '0', 10)
  };
}
function isSpotifyConnected(){
  return !!localStorage.getItem('spotify_refresh_token');
}
function disconnectSpotify(){
  localStorage.removeItem('spotify_access_token');
  localStorage.removeItem('spotify_refresh_token');
  localStorage.removeItem('spotify_token_expires_at');
  localStorage.removeItem('spotify_pkce_verifier');
  localStorage.removeItem('spotify_display_name');
  updateImportModalUI();
}
async function fetchSpotifyProfile(token){
  try{
    const res = await fetch('https://api.spotify.com/v1/me', { headers:{ Authorization: 'Bearer ' + token } });
    if(!res.ok) return null;
    const data = await res.json();
    return data.display_name || data.id || null;
  }catch(e){
    return null;
  }
}
async function refreshSpotifyToken(){
  const { refresh } = getStoredSpotifyToken();
  if(!refresh) return null;
  const body = new URLSearchParams({ client_id: SPOTIFY_CLIENT_ID, grant_type: 'refresh_token', refresh_token: refresh });
  const res = await fetch('https://accounts.spotify.com/api/token', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body });
  const tok = await res.json();
  if(tok.access_token){ storeSpotifyTokens(tok); return tok.access_token; }
  disconnectSpotify();
  return null;
}
async function getValidSpotifyToken(){
  const { access, expiresAt } = getStoredSpotifyToken();
  if(!access) return null;
  if(Date.now() < expiresAt) return access;
  return await refreshSpotifyToken();
}

/* ---- connect flow ---- */
async function connectSpotify(){
  if(!SPOTIFY_CLIENT_ID || SPOTIFY_CLIENT_ID === 'YOUR_SPOTIFY_CLIENT_ID'){
    alert('Spotify import is not set up yet — add your Client ID to SPOTIFY_CLIENT_ID in the code first.');
    return;
  }
  const verifier = generateCodeVerifier();
  localStorage.setItem('spotify_pkce_verifier', verifier);
  const challenge = await generateCodeChallenge(verifier);
  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: SPOTIFY_REDIRECT_URI,
    scope: SPOTIFY_SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge
  });
  location.href = 'https://accounts.spotify.com/authorize?' + params.toString();
}

let pendingSpotifyAutoImport = false;
async function handleSpotifyRedirect(){
  const params = new URLSearchParams(location.search);
  const code = params.get('code');
  if(!code || params.get('state') === 'tidal') return;
  history.replaceState({}, document.title, location.pathname + location.hash);
  const verifier = localStorage.getItem('spotify_pkce_verifier');
  if(!verifier) return;
  const body = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    grant_type: 'authorization_code',
    code,
    redirect_uri: SPOTIFY_REDIRECT_URI,
    code_verifier: verifier
  });
  const res = await fetch('https://accounts.spotify.com/api/token', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body });
  const tok = await res.json();
  if(tok.access_token){
    storeSpotifyTokens(tok);
    fetchSpotifyProfile(tok.access_token).then(name=>{
      if(name) localStorage.setItem('spotify_display_name', name);
      updateImportModalUI();
    });
    pendingSpotifyAutoImport = true;
    waitForAppReadyThenImport();
  }
}
function waitForAppReadyThenImport(){
  if(currentUserId){
    pendingSpotifyAutoImport = false;
    openImportModal();
    importFromSpotify();
  } else {
    setTimeout(waitForAppReadyThenImport, 300);
  }
}

/* ---- Tidal: token storage ---- */
function storeTidalTokens(tok){
  const expiresAt = Date.now() + (tok.expires_in * 1000) - 60000;
  localStorage.setItem('tidal_access_token', tok.access_token);
  if(tok.refresh_token) localStorage.setItem('tidal_refresh_token', tok.refresh_token);
  localStorage.setItem('tidal_token_expires_at', String(expiresAt));
}
function getStoredTidalToken(){
  return {
    access: localStorage.getItem('tidal_access_token'),
    refresh: localStorage.getItem('tidal_refresh_token'),
    expiresAt: parseInt(localStorage.getItem('tidal_token_expires_at') || '0', 10)
  };
}
function isTidalConnected(){
  return !!localStorage.getItem('tidal_refresh_token');
}
function disconnectTidal(){
  localStorage.removeItem('tidal_access_token');
  localStorage.removeItem('tidal_refresh_token');
  localStorage.removeItem('tidal_token_expires_at');
  localStorage.removeItem('tidal_pkce_verifier');
  localStorage.removeItem('tidal_display_name');
  localStorage.removeItem('tidal_user_id');
  updateImportModalUI();
}
async function fetchTidalProfile(token){
  try{
    const res = await fetch(TIDAL_API_BASE + '/users/me', {
      headers:{ Authorization: 'Bearer ' + token, Accept: 'application/vnd.api+json' }
    });
    if(!res.ok) return null;
    const data = await res.json();
    const d = data && data.data;
    if(!d) return null;
    const attrs = d.attributes || {};
    return { id: d.id, name: attrs.username || attrs.nickname || attrs.name || null };
  }catch(e){
    return null;
  }
}
async function refreshTidalToken(){
  const { refresh } = getStoredTidalToken();
  if(!refresh) return null;
  const body = new URLSearchParams({ client_id: TIDAL_CLIENT_ID, grant_type: 'refresh_token', refresh_token: refresh });
  const res = await fetch(TIDAL_TOKEN_URL, { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body });
  const tok = await res.json();
  if(tok.access_token){ storeTidalTokens(tok); return tok.access_token; }
  disconnectTidal();
  return null;
}
async function getValidTidalToken(){
  const { access, expiresAt } = getStoredTidalToken();
  if(!access) return null;
  if(Date.now() < expiresAt) return access;
  return await refreshTidalToken();
}

/* ---- Tidal: connect flow ---- */
async function connectTidal(){
  if(!TIDAL_CLIENT_ID || TIDAL_CLIENT_ID === 'YOUR_TIDAL_CLIENT_ID'){
    alert('Tidal import is not set up yet — add your Client ID to TIDAL_CLIENT_ID in the code first.');
    return;
  }
  const verifier = generateCodeVerifier();
  localStorage.setItem('tidal_pkce_verifier', verifier);
  const challenge = await generateCodeChallenge(verifier);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: TIDAL_CLIENT_ID,
    redirect_uri: TIDAL_REDIRECT_URI,
    scope: TIDAL_SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state: 'tidal'
  });
  location.href = TIDAL_AUTH_URL + '?' + params.toString();
}

let pendingTidalAutoImport = false;
async function handleTidalRedirect(){
  const params = new URLSearchParams(location.search);
  const code = params.get('code');
  if(!code || params.get('state') !== 'tidal') return;
  history.replaceState({}, document.title, location.pathname + location.hash);
  const verifier = localStorage.getItem('tidal_pkce_verifier');
  if(!verifier) return;
  const body = new URLSearchParams({
    client_id: TIDAL_CLIENT_ID,
    grant_type: 'authorization_code',
    code,
    redirect_uri: TIDAL_REDIRECT_URI,
    code_verifier: verifier
  });
  try{
    const res = await fetch(TIDAL_TOKEN_URL, { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body });
    const tok = await res.json();
    if(tok.access_token){
      storeTidalTokens(tok);
      const profile = await fetchTidalProfile(tok.access_token);
      if(profile){
        if(profile.id) localStorage.setItem('tidal_user_id', profile.id);
        if(profile.name) localStorage.setItem('tidal_display_name', profile.name);
      }
      updateImportModalUI();
      pendingTidalAutoImport = true;
      waitForAppReadyThenImportTidal();
    } else {
      console.error('Tidal token exchange failed', tok);
      tidalConnectError = 'Tidal token exchange failed: ' + (tok.error_description || tok.error || res.status);
      waitForAppReadyThenShowTidalError();
    }
  }catch(e){
    console.error('Tidal token exchange threw', e);
    tidalConnectError = 'Could not reach Tidal to exchange the login code' +
      (e && e.message ? (': ' + e.message) : '') +
      ' — this is often a CORS block on auth.tidal.com from the browser.';
    waitForAppReadyThenShowTidalError();
  }
}
let tidalConnectError = null;
function waitForAppReadyThenShowTidalError(){
  if(currentUserId){
    openImportModal();
    document.getElementById('importProgressWrap').style.display = '';
    document.getElementById('importProgressText').textContent = tidalConnectError;
    tidalConnectError = null;
  } else {
    setTimeout(waitForAppReadyThenShowTidalError, 300);
  }
}
function waitForAppReadyThenImportTidal(){
  if(currentUserId){
    pendingTidalAutoImport = false;
    openImportModal();
    importFromTidal();
  } else {
    setTimeout(waitForAppReadyThenImportTidal, 300);
  }
}
handleSpotifyRedirect();
handleTidalRedirect();

/* ---- fetch + merge ---- */
// wraps fetch() to transparently retry on 429s, honoring Spotify's Retry-After
// header (falls back to exponential backoff if the header is missing)
async function spotifyFetch(url, token, onRetryWait, maxRetries){
  if(maxRetries === undefined) maxRetries = 5;
  for(let attempt = 0; ; attempt++){
    const res = await fetch(url, { headers:{ Authorization: 'Bearer ' + token } });
    if(res.status === 429 && attempt < maxRetries){
      const retryAfter = parseInt(res.headers.get('Retry-After'), 10);
      const waitSecs = isNaN(retryAfter) ? Math.pow(2, attempt) : retryAfter;
      if(onRetryWait) onRetryWait(waitSecs);
      await new Promise(r=>setTimeout(r, waitSecs * 1000));
      continue;
    }
    return res;
  }
}
async function fetchSpotifySavedTracks(token, onProgress){
  let url = 'https://api.spotify.com/v1/me/tracks?limit=50';
  let items = [];
  while(url){
    const res = await spotifyFetch(url, token, waitSecs=>{
      if(onProgress) onProgress(items.length, items.length, `Spotify asked us to slow down — waiting ${waitSecs}s…`);
    });
    if(!res.ok){
      let detail = '';
      try{ const body = await res.json(); detail = (body.error && body.error.message) || ''; }catch(e){}
      const err = new Error(detail || ('spotify_fetch_failed_' + res.status));
      err.status = res.status;
      throw err;
    }
    const data = await res.json();
    items = items.concat(data.items || []);
    if(onProgress) onProgress(items.length, data.total || items.length);
    url = data.next;
  }
  return items;
}
async function fetchSpotifyArtistGenres(token, artistIds){
  const genreMap = {};
  const ids = [...new Set(artistIds)].filter(Boolean);
  for(let i=0;i<ids.length;i+=50){
    const batch = ids.slice(i, i+50);
    const res = await spotifyFetch('https://api.spotify.com/v1/artists?ids=' + batch.join(','), token);
    if(!res.ok) continue;
    const data = await res.json();
    (data.artists || []).forEach(a=>{ if(a) genreMap[a.id] = a.genres || []; });
  }
  return genreMap;
}
// wraps fetch() to transparently retry on 429s (same pattern as spotifyFetch)
async function tidalFetch(url, token, onRetryWait, maxRetries){
  if(maxRetries === undefined) maxRetries = 5;
  for(let attempt = 0; ; attempt++){
    const res = await fetch(url, { headers:{ Authorization: 'Bearer ' + token, Accept: 'application/vnd.api+json' } });
    if(res.status === 429 && attempt < maxRetries){
      const retryAfter = parseInt(res.headers.get('Retry-After'), 10);
      const waitSecs = isNaN(retryAfter) ? Math.pow(2, attempt) : retryAfter;
      if(onRetryWait) onRetryWait(waitSecs);
      await new Promise(r=>setTimeout(r, waitSecs * 1000));
      continue;
    }
    return res;
  }
}
// Tidal's collection API is JSON:API — the "data" array holds lightweight
// track references (id + addedAt), and the actual track/artist/album fields
// come back in "included" when you ask for them via ?include=. Field names
// here are our best read of Tidal's public docs; if titles/artists come back
// empty, open devtools → Network on a real import and adjust the attribute
// names below to match what Tidal actually sends back.
async function fetchTidalFavoriteTracks(token, userId, onProgress){
  let url = TIDAL_API_BASE + '/userCollections/' + encodeURIComponent(userId) +
    '/relationships/tracks?include=tracks,tracks.artists,tracks.albums,tracks.genres,tracks.albums.genres,tracks.albums.coverArt&page[limit]=50';
  let refs = [];
  const includedById = {};
  while(url){
    const res = await tidalFetch(url, token, waitSecs=>{
      if(onProgress) onProgress(refs.length, refs.length, `Tidal asked us to slow down — waiting ${waitSecs}s…`);
    });
    if(!res.ok){
      let detail = '';
      try{ const body = await res.json(); detail = (body.errors && body.errors[0] && body.errors[0].detail) || ''; }catch(e){}
      const err = new Error(detail || ('tidal_fetch_failed_' + res.status));
      err.status = res.status;
      throw err;
    }
    const data = await res.json();
    if(refs.length === 0){
      // stash the first page's raw response so it can be inspected without DevTools —
      // see the "Copy Tidal debug info" button in the import modal
      try{ localStorage.setItem('tidal_debug_raw', JSON.stringify(data, null, 2)); }catch(e){}
    }
    refs = refs.concat(data.data || []);
    (data.included || []).forEach(item=>{ includedById[item.type + ':' + item.id] = item; });
    if(onProgress) onProgress(refs.length, refs.length);
    url = (data.links && data.links.next) ? (data.links.next.startsWith('http') ? data.links.next : TIDAL_API_BASE + data.links.next) : null;
  }
  // Assemble each track reference into a Spotify-shaped {track:{...}} object
  // so the rest of the import pipeline (dedupe, mapping) can stay the same.
  return refs.map(ref=>{
    const track = includedById['tracks:' + ref.id];
    if(!track) return null;
    const attrs = track.attributes || {};
    const artistRefs = (track.relationships && track.relationships.artists && track.relationships.artists.data) || [];
    const artists = artistRefs.map(a=>{
      const full = includedById['artists:' + a.id];
      return { id: a.id, name: full && full.attributes ? full.attributes.name : (a.id || 'Unknown') };
    });
    const albumRef = (track.relationships && track.relationships.albums && track.relationships.albums.data && track.relationships.albums.data[0]) || null;
    const album = albumRef ? includedById['albums:' + albumRef.id] : null;
    const albumAttrs = album ? (album.attributes || {}) : {};
    let genreRefs = (track.relationships && track.relationships.genres && track.relationships.genres.data) || [];
    if(genreRefs.length === 0 && album && album.relationships && album.relationships.genres){
      // Tidal frequently leaves the per-track genres relationship empty even
      // when the album itself is genre-tagged — fall back to that.
      genreRefs = album.relationships.genres.data || [];
    }
    const genres = genreRefs
      .map(g=>{ const full = includedById['genres:' + g.id]; return full && full.attributes ? full.attributes.name : null; })
      .filter(Boolean);
    // Cover art is NOT a plain album attribute — Tidal returns it as a
    // separate "artworks" resource via the album's coverArt relationship
    // (hence tracks.albums.coverArt in the include= above). The artwork
    // resource's own attribute shape isn't nailed down yet, so this reads
    // several plausible shapes defensively and falls back to Tidal's
    // classic resources.tidal.com/images/{uuid}/{w}x{h}.jpg convention
    // (artwork ids are historically the same UUIDs used there) if none of
    // the attribute guesses pan out. See the "Copy Tidal debug info"
    // button — it now reports the artwork resource's real attribute keys,
    // so if cover art still doesn't show up, that tells us what to fix.
    const coverArtRefs = (album && album.relationships && album.relationships.coverArt && album.relationships.coverArt.data) || [];
    const coverArtRef = Array.isArray(coverArtRefs) ? coverArtRefs[0] : coverArtRefs;
    const artwork = coverArtRef ? includedById['artworks:' + coverArtRef.id] : null;
    const artworkAttrs = artwork ? (artwork.attributes || {}) : {};
    const fileLinks = artworkAttrs.files || artworkAttrs.imageLinks || artworkAttrs.images || [];
    const bestImage = fileLinks.slice().sort((a,b)=>
      ((b.meta && b.meta.width) || b.width || 0) - ((a.meta && a.meta.width) || a.width || 0)
    )[0];
    const bestImageUrl = bestImage ? (bestImage.href || bestImage.url) : null;
    const fallbackImageUrl = (!bestImageUrl && artwork && /^[0-9a-f-]{30,36}$/i.test(artwork.id))
      ? `https://resources.tidal.com/images/${artwork.id}/750x750.jpg`
      : null;
    const coverArtUrl = bestImageUrl || fallbackImageUrl || null;
    return {
      track: {
        id: track.id,
        name: attrs.title || '',
        artists: artists.length ? artists : [{ id:null, name:'Unknown' }],
        genres,
        album: {
          name: albumAttrs.title || '',
          release_date: albumAttrs.releaseDate || '',
          images: coverArtUrl ? [{ url: coverArtUrl }] : []
        }
      }
    };
  }).filter(Boolean);
}

let tidalImportInProgress = false;

// Tidal's API doesn't return genre data at all (confirmed via the debug
// tool), so for any newly-imported track missing a genre, look it up on
// Apple Music instead — once per unique album, not once per track, since
// JSONP requests are sequential and album lookups are shared across all
// its tracks. Best-effort: a failed or genre-less lookup just leaves that
// album's tracks with an empty genre, same as before this existed.
function albumGenreKey(albumName, artistName){
  return String(albumName||'').trim().toLowerCase() + '|' + String(artistName||'').trim().toLowerCase();
}
async function backfillTidalGenres(newItems, onProgress){
  const groups = new Map();
  newItems.forEach(it=>{
    const t = it.track;
    if((t.genres && t.genres.length) || !t.album || !t.album.name) return;
    const artistName = (t.artists[0] && t.artists[0].name) || '';
    const key = albumGenreKey(t.album.name, artistName);
    if(!groups.has(key)) groups.set(key, { albumName: t.album.name, artistName, items: [] });
    groups.get(key).items.push(t);
  });
  const keys = Array.from(groups.keys());
  const log = [];
  for(let i=0; i<keys.length; i++){
    const g = groups.get(keys[i]);
    if(onProgress) onProgress(i, keys.length);
    const term = `${g.artistName} ${g.albumName}`.trim();
    try{
      const results = await searchItunes(term, 'album', 3);
      const best = results[0];
      if(best && best.primaryGenreName){
        g.items.forEach(t=>{ t.genres = [best.primaryGenreName]; });
        log.push({ searched: term, matched: true, genre: best.primaryGenreName, matchedTitle: best.collectionName, matchedArtist: best.artistName });
      } else {
        log.push({ searched: term, matched: false, reason: results.length ? 'no primaryGenreName on best result' : 'no iTunes results' });
      }
    }catch(e){
      log.push({ searched: term, matched: false, reason: 'error: ' + (e && e.message ? e.message : String(e)) });
    }
  }
  try{ localStorage.setItem('tidal_genre_backfill_log', JSON.stringify(log, null, 2)); }catch(e){}
}
async function importFromTidal(){
  if(tidalImportInProgress) return; // already running — ignore extra trigger
  tidalImportInProgress = true;
  const connectBtn = document.getElementById('tidalConnectBtn');
  connectBtn.disabled = true;

  const statusEl = document.getElementById('importProgressText');
  const wrap = document.getElementById('importProgressWrap');
  const fill = document.getElementById('importProgressFill');
  wrap.style.display = '';
  fill.style.width = '0%';
  statusEl.textContent = 'Connecting…';

  try{

  const token = await getValidTidalToken();
  const userId = localStorage.getItem('tidal_user_id');
  if(!token || !userId){
    statusEl.textContent = 'Your Tidal connection expired — reconnect and try again.';
    updateImportModalUI();
    return;
  }

  const isFirstImport = songs.length > 0 && songs.every(s=>s.isSeedExample);

  let items;
  try{
    items = await fetchTidalFavoriteTracks(token, userId, (loaded, total, waitMsg)=>{
      statusEl.textContent = waitMsg || `Fetching your saved songs… (${loaded})`;
      fill.style.width = Math.min(100, Math.round(loaded / Math.max(total,1) * 60)) + '%';
    });
  }catch(e){
    if(e && e.status === 401){
      statusEl.textContent = 'Your Tidal connection expired — reconnect and try again.';
    } else if(e && e.status === 429){
      statusEl.textContent = 'Tidal is rate-limiting requests right now — wait a bit and try again.';
    } else if(e && e.status === 403){
      statusEl.textContent = 'Tidal declined that request — your app may still need Open API access approval from Tidal.';
    } else {
      statusEl.textContent = 'Could not reach Tidal' + (e && e.message ? ': ' + e.message : '') + '.';
    }
    return;
  }

  const existingIds = new Set(songs.filter(s=>s.tidalId).map(s=>s.tidalId));
  const existingKeys = new Set(songs.map(s=> songDedupeKey(s.title, s.artists)));
  const seenIds = new Set();
  const seenKeys = new Set();
  const newItems = items.filter(it=>{
    const t = it.track;
    const key = songDedupeKey(t.name, t.artists.map(a=>a.name));
    if(existingIds.has(t.id) || seenIds.has(t.id)) return false;
    if(existingKeys.has(key) || seenKeys.has(key)) return false;
    seenIds.add(t.id);
    seenKeys.add(key);
    return true;
  });
  fill.style.width = '85%';

  if(newItems.length > 0){
    statusEl.textContent = 'Looking up genres on Apple Music…';
    await backfillTidalGenres(newItems, (done, total)=>{
      statusEl.textContent = `Looking up genres on Apple Music… (${done}/${total} albums)`;
    });
  }
  fill.style.width = '92%';

  if(isFirstImport && newItems.length > 0){
    songs = songs.filter(s=>!s.isSeedExample);
  }

  newItems.forEach(it=>{
    const t = it.track;
    songs.unshift({
      id: uid(),
      pinned: false,
      createdAt: Date.now(),
      title: t.name,
      artists: t.artists.map(a=>a.name),
      album: t.album ? t.album.name : '',
      year: (t.album && t.album.release_date) ? t.album.release_date.slice(0,4) : '',
      genres: t.genres || [],
      tags: [],
      heard: '',
      why: '',
      credit: '',
      lyricSnippet: '',
      coverArt: (t.album && t.album.images && t.album.images[0]) ? t.album.images[0].url : '',
      remindsOf: [],
      tier: null,
      tidalId: t.id
    });
  });

  fill.style.width = '100%';
  const skipped = items.length - newItems.length;
  statusEl.textContent = `Imported ${newItems.length} new song${newItems.length!==1?'s':''}.` + (skipped>0 ? ` (${skipped} skipped as duplicates — either already in your cataloguex, or repeated within this import.)` : '');
  save();
  render();
  updateImportModalUI();

  } finally {
    tidalImportInProgress = false;
    connectBtn.disabled = false;
  }
}

/* ---- Apple Music / iTunes search (album + song lookup) ----
   Uses the public iTunes Search API via JSONP (no auth/token needed,
   and JSONP sidesteps the CORS restrictions the plain fetch endpoint has). */
function itunesJsonp(url){
  return new Promise((resolve, reject)=>{
    const cbName = 'itunesCb_' + Math.random().toString(36).slice(2);
    const script = document.createElement('script');
    let settled = false;
    const cleanup = ()=>{
      delete window[cbName];
      script.remove();
    };
    window[cbName] = (data)=>{
      settled = true;
      cleanup();
      resolve(data);
    };
    script.onerror = ()=>{
      if(!settled){ settled = true; cleanup(); reject(new Error('itunes_request_failed')); }
    };
    script.src = url + (url.includes('?') ? '&' : '?') + 'callback=' + cbName;
    document.body.appendChild(script);
    setTimeout(()=>{
      if(!settled){ settled = true; cleanup(); reject(new Error('itunes_request_timed_out')); }
    }, 10000);
  });
}
async function searchItunes(term, entity, limit){
  const url = 'https://itunes.apple.com/search?media=music&entity=' + entity + '&limit=' + (limit||8) + '&term=' + encodeURIComponent(term);
  const data = await itunesJsonp(url);
  const results = (data && data.results) || [];
  // The iTunes API is notoriously inconsistent about honoring `entity` —
  // it can slip music videos into song results or stray tracks into album
  // results — so filter client-side to guarantee the right kind of result.
  if(entity === 'song'){
    return results.filter(r=>r.wrapperType==='track' && r.kind!=='music-video');
  }
  if(entity === 'album'){
    return results.filter(r=>r.wrapperType==='collection');
  }
  return results;
}
async function lookupItunesAlbum(collectionId){
  const url = 'https://itunes.apple.com/lookup?id=' + encodeURIComponent(collectionId) + '&entity=song&limit=200';
  const data = await itunesJsonp(url);
  return (data && data.results) || [];
}
function upscaleArtwork(url){
  return url ? url.replace(/\d+x\d+bb(?=\.\w+$)/, '600x600bb') : null;
}

/* ---- album search (for "New Album" import) ---- */
let albumSearchDebounce = null;
async function renderAlbumSearchResults(query){
  const wrap = document.getElementById('albumSearchResults');
  const q = query.trim();
  if(!q){ wrap.style.display = 'none'; wrap.innerHTML = ''; return; }
  wrap.style.display = 'block';
  wrap.innerHTML = '<p class="profile-empty-note">Searching…</p>';
  try{
    const albums = await searchItunes(q, 'album', 8);
    if(albums.length === 0){
      wrap.innerHTML = '<p class="profile-empty-note">No matching albums.</p>';
      return;
    }
    wrap.innerHTML = albums.map(a=>`
      <button type="button" class="discover-row" data-collection-id="${a.collectionId}">
        ${a.artworkUrl100 ? `<img src="${a.artworkUrl100}">` : `<span class="drow-fallback">${escapeHtml((a.collectionName||'?').charAt(0).toUpperCase())}</span>`}
        <span>
          <span class="drow-name">${escapeHtml(a.collectionName||'Untitled')}</span><br>
          <span class="drow-bio">${escapeHtml(a.artistName||'')}${a.releaseDate ? ' · '+a.releaseDate.slice(0,4) : ''}</span>
        </span>
      </button>
    `).join('');
  }catch(e){
    wrap.innerHTML = `<p class="profile-empty-note">Could not reach Apple Music${e && e.message ? ': ' + escapeHtml(e.message) : ''}.</p>`;
  }
}
async function selectItunesAlbum(collectionId){
  const wrap = document.getElementById('albumSearchResults');
  wrap.innerHTML = '<p class="profile-empty-note">Loading album…</p>';
  try{
    const items = await lookupItunesAlbum(collectionId);
    const albumInfo = items.find(x=>x.wrapperType==='collection') || items[0] || {};
    const trackItems = items.filter(x=>x.wrapperType==='track').sort((a,b)=>(a.trackNumber||0)-(b.trackNumber||0));
    const cover = albumInfo.artworkUrl100 ? upscaleArtwork(albumInfo.artworkUrl100) : null;
    document.getElementById('mf-album').value = albumInfo.collectionName || '';
    document.getElementById('mf-year').value = albumInfo.releaseDate ? albumInfo.releaseDate.slice(0,4) : '';
    document.getElementById('mf-genre').value = albumInfo.primaryGenreName || '';
    document.getElementById('mf-artist').value = albumInfo.artistName || '';
    currentMultiCoverArt = cover;
    setImagePreview('mf-cover', cover);
    const tracks = trackItems.map(t=>({
      title: t.trackName,
      artist: t.artistName || albumInfo.artistName || ''
    }));
    resetTitleBoxes(tracks);
    document.getElementById('mf-album-search').value = albumInfo.collectionName || '';
    wrap.style.display = 'none';
    wrap.innerHTML = '';
  }catch(e){
    wrap.innerHTML = `<p class="profile-empty-note">Could not load that album${e && e.message ? ': ' + escapeHtml(e.message) : ''}.</p>`;
  }
}
document.getElementById('mf-album-search').addEventListener('input', e=>{
  clearTimeout(albumSearchDebounce);
  const val = e.target.value;
  albumSearchDebounce = setTimeout(()=>renderAlbumSearchResults(val), 350);
});
document.getElementById('albumSearchResults').addEventListener('click', e=>{
  const row = e.target.closest('[data-collection-id]');
  if(!row) return;
  selectItunesAlbum(row.dataset.collectionId);
});

/* ---- song search (for the single "Add a song" / "Edit song" modal) ---- */
let songSearchDebounce = null;
let songSearchCache = [];
async function renderSongSearchResults(query){
  const wrap = document.getElementById('songSearchResults');
  const q = query.trim();
  if(!q){ wrap.style.display = 'none'; wrap.innerHTML = ''; return; }
  wrap.style.display = 'block';
  wrap.innerHTML = '<p class="profile-empty-note">Searching…</p>';
  try{
    const results = await searchItunes(q, 'song', 8);
    songSearchCache = results;
    if(results.length === 0){
      wrap.innerHTML = '<p class="profile-empty-note">No matching songs.</p>';
      return;
    }
    wrap.innerHTML = results.map(t=>`
      <button type="button" class="discover-row" data-track-id="${t.trackId}">
        ${t.artworkUrl100 ? `<img src="${t.artworkUrl100}">` : `<span class="drow-fallback">${escapeHtml((t.trackName||'?').charAt(0).toUpperCase())}</span>`}
        <span>
          <span class="drow-name">${escapeHtml(t.trackName||'Untitled')}</span><br>
          <span class="drow-bio">${escapeHtml(t.artistName||'')}${t.collectionName ? ' · '+escapeHtml(t.collectionName) : ''}</span>
        </span>
      </button>
    `).join('');
  }catch(e){
    wrap.innerHTML = `<p class="profile-empty-note">Could not reach Apple Music${e && e.message ? ': ' + escapeHtml(e.message) : ''}.</p>`;
  }
}
function selectItunesSong(trackId){
  const t = songSearchCache.find(r=>String(r.trackId)===String(trackId));
  if(!t) return;
  document.getElementById('f-title').value = t.trackName || '';
  document.getElementById('f-artist').value = t.artistName || '';
  document.getElementById('f-album').value = t.collectionName || '';
  document.getElementById('f-year').value = t.releaseDate ? t.releaseDate.slice(0,4) : '';
  document.getElementById('f-genre').value = t.primaryGenreName || '';
  const cover = t.artworkUrl100 ? upscaleArtwork(t.artworkUrl100) : null;
  currentCoverArt = cover;
  setImagePreview('f-cover', cover);
  document.getElementById('f-song-search').value = t.trackName || '';
  document.getElementById('songSearchResults').style.display = 'none';
  document.getElementById('songSearchResults').innerHTML = '';
}
document.getElementById('f-song-search').addEventListener('input', e=>{
  clearTimeout(songSearchDebounce);
  const val = e.target.value;
  songSearchDebounce = setTimeout(()=>renderSongSearchResults(val), 350);
});
document.getElementById('songSearchResults').addEventListener('click', e=>{
  const row = e.target.closest('[data-track-id]');
  if(!row) return;
  selectItunesSong(row.dataset.trackId);
});

/* ---- dedupe helpers: recognize "same song, different Spotify version" ---- */
function normalizeSongTitle(title){
  let t = (title||'').toLowerCase();
  // words that indicate a different release/version of the same underlying song
  const versionPattern = /(remaster|live|mix|edit|version|mono|stereo|deluxe|bonus track|explicit|clean|anniversary|single|demo|acoustic|instrumental|re-record|rerecord)/i;
  // strip a trailing "(...)" or "[...]" or " - ..." tag if it looks like a version marker
  t = t.replace(/\s*\([^()]*\)\s*$/, m => versionPattern.test(m) ? '' : m);
  t = t.replace(/\s*\[[^\[\]]*\]\s*$/, m => versionPattern.test(m) ? '' : m);
  t = t.replace(/\s+-\s+[^-]*$/, m => versionPattern.test(m) ? '' : m);
  return t.replace(/\s+/g,' ').trim();
}
function songDedupeKey(title, artists){
  const primaryArtist = (artists && artists[0]) ? artists[0].toLowerCase().trim() : '';
  return normalizeSongTitle(title) + '‖' + primaryArtist;
}

let spotifyImportInProgress = false;
async function importFromSpotify(){
  if(spotifyImportInProgress){
    return; // an import is already running — ignore the extra trigger instead of racing it
  }
  spotifyImportInProgress = true;
  const connectBtn = document.getElementById('spotifyConnectBtn');
  connectBtn.disabled = true;

  const statusEl = document.getElementById('importProgressText');
  const wrap = document.getElementById('importProgressWrap');
  const fill = document.getElementById('importProgressFill');
  wrap.style.display = '';
  fill.style.width = '0%';
  statusEl.textContent = 'Connecting…';

  try{

  const token = await getValidSpotifyToken();
  if(!token){
    statusEl.textContent = 'Your Spotify connection expired — reconnect and try again.';
    updateImportModalUI();
    return;
  }

  // "first import" = the cataloguex right now contains nothing but the built-in
  // preset examples. Captured BEFORE we add anything, so a later import can
  // never mistake itself for the first one just because it happens to add songs.
  const isFirstImport = songs.length > 0 && songs.every(s=>s.isSeedExample);

  let items;
  try{
    items = await fetchSpotifySavedTracks(token, (loaded, total, waitMsg)=>{
      statusEl.textContent = waitMsg || `Fetching your saved songs… (${loaded}/${total})`;
      fill.style.width = Math.min(100, Math.round(loaded / Math.max(total,1) * 60)) + '%';
    });
  }catch(e){
    if(e && e.status === 401){
      statusEl.textContent = 'Your Spotify connection expired — reconnect and try again.';
    } else if(e && e.status === 429){
      statusEl.textContent = 'Spotify is rate-limiting requests right now — wait a bit and try again.';
    } else {
      statusEl.textContent = 'Could not reach Spotify' + (e && e.message ? ': ' + e.message : '') + '.';
    }
    return;
  }

  // Spotify's saved-tracks list frequently contains the SAME song under multiple
  // different track IDs — e.g. the original album cut, a "Remastered" reissue,
  // a deluxe edition, a Greatest Hits comp, or a live version. Matching only on
  // track ID misses all of these, so we also dedupe on a normalized
  // title + primary-artist key.
  const existingIds = new Set(songs.filter(s=>s.spotifyId).map(s=>s.spotifyId));
  const existingKeys = new Set(songs.map(s=> songDedupeKey(s.title, s.artists)));
  const seenIds = new Set();
  const seenKeys = new Set();
  const newItems = items.filter(it=>{
    if(!it.track) return false;
    const t = it.track;
    const key = songDedupeKey(t.name, t.artists.map(a=>a.name));
    if(existingIds.has(t.id) || seenIds.has(t.id)) return false;
    if(existingKeys.has(key) || seenKeys.has(key)) return false;
    seenIds.add(t.id);
    seenKeys.add(key);
    return true;
  });

  statusEl.textContent = 'Looking up genres…';
  const artistIds = newItems.map(it=> it.track.artists[0] && it.track.artists[0].id);
  const genreMap = await fetchSpotifyArtistGenres(token, artistIds);
  fill.style.width = '85%';

  // once real songs are coming in on the very first import, the two built-in
  // onboarding examples (Landslide / Redbone) have served their purpose —
  // clear them out. Never touch them on any import after that, so a user's
  // own saved songs are never at risk of being deleted.
  if(isFirstImport && newItems.length > 0){
    songs = songs.filter(s=>!s.isSeedExample);
  }

  newItems.forEach(it=>{
    const t = it.track;
    const genres = (genreMap[t.artists[0] && t.artists[0].id] || []).slice(0, 3);
    songs.unshift({
      id: uid(),
      pinned: false,
      createdAt: Date.now(),
      title: t.name,
      artists: t.artists.map(a=>a.name),
      album: t.album ? t.album.name : '',
      year: (t.album && t.album.release_date) ? t.album.release_date.slice(0,4) : '',
      genres,
      tags: [],
      heard: '',
      why: '',
      credit: '',
      lyricSnippet: '',
      coverArt: (t.album && t.album.images && t.album.images[0]) ? t.album.images[0].url : '',
      remindsOf: [],
      tier: null,
      spotifyId: t.id
    });
  });

  fill.style.width = '100%';
  const skipped = items.length - newItems.length;
  statusEl.textContent = `Imported ${newItems.length} new song${newItems.length!==1?'s':''}.` + (skipped>0 ? ` (${skipped} skipped as duplicates — either already in your cataloguex, or repeated within this import.)` : '');
  save();
  render();
  updateImportModalUI();

  } finally {
    spotifyImportInProgress = false;
    connectBtn.disabled = false;
  }
}

/* ---- import modal wiring ---- */
function updateImportModalUI(){
  const connected = isSpotifyConnected();
  const statusEl = document.getElementById('spotifyStatus');
  statusEl.textContent = connected ? 'Connected' : 'Not connected';
  statusEl.classList.toggle('connected', connected);
  document.getElementById('spotifyConnectBtn').textContent = connected ? 'Import now' : 'Connect';
  const usernameEl = document.getElementById('spotifyUsername');
  const name = localStorage.getItem('spotify_display_name');
  usernameEl.textContent = (connected && name) ? ('@' + name) : '';
  document.getElementById('spotifyDisconnectBtn').disabled = !connected;

  const tidalConnected = isTidalConnected();
  const tidalStatusEl = document.getElementById('tidalStatus');
  tidalStatusEl.textContent = tidalConnected ? 'Connected' : 'Not connected';
  tidalStatusEl.classList.toggle('connected', tidalConnected);
  document.getElementById('tidalConnectBtn').textContent = tidalConnected ? 'Import now' : 'Connect';
  const tidalUsernameEl = document.getElementById('tidalUsername');
  const tidalName = localStorage.getItem('tidal_display_name');
  tidalUsernameEl.textContent = (tidalConnected && tidalName) ? ('@' + tidalName) : '';
  document.getElementById('tidalDisconnectBtn').disabled = !tidalConnected;
}
function openImportModal(){
  updateImportModalUI();
  document.getElementById('importProgressWrap').style.display = 'none';
  document.getElementById('importOverlay').classList.add('open');
  if(isSpotifyConnected() && !localStorage.getItem('spotify_display_name')){
    getValidSpotifyToken().then(token=>{
      if(!token) return;
      fetchSpotifyProfile(token).then(name=>{
        if(name){ localStorage.setItem('spotify_display_name', name); updateImportModalUI(); }
      });
    });
  }
  if(isTidalConnected() && !localStorage.getItem('tidal_display_name')){
    getValidTidalToken().then(token=>{
      if(!token) return;
      fetchTidalProfile(token).then(profile=>{
        if(profile && profile.name){ localStorage.setItem('tidal_display_name', profile.name); updateImportModalUI(); }
      });
    });
  }
}
document.getElementById('openImportBtn').addEventListener('click', openImportModal);
document.getElementById('resetCatalogueBtn').addEventListener('click', ()=>{
  const ok = confirm("Are you sure you want to completely reset your music cataloguex? This will delete all added and imported songs. You will lose all the details you've put into the songs — tiers, notes, tags, and everything else. This can't be undone.");
  if(!ok) return;
  songs = [];
  clusterFilterId = null;
  remindsFilterId = null;
  showArchived = false;
  seedIfEmpty();
  save();
  render();
});
document.getElementById('importCloseBtn').addEventListener('click', ()=>{
  document.getElementById('importOverlay').classList.remove('open');
});
document.getElementById('importOverlay').addEventListener('click', e=>{
  if(e.target.id==='importOverlay') document.getElementById('importOverlay').classList.remove('open');
});
document.getElementById('spotifyConnectBtn').addEventListener('click', ()=>{
  if(isSpotifyConnected()) importFromSpotify();
  else connectSpotify();
});
document.getElementById('spotifyDisconnectBtn').addEventListener('click', ()=>{
  disconnectSpotify();
  const statusEl = document.getElementById('spotifyStatus');
  statusEl.textContent = 'Disconnected — connection reset.';
  setTimeout(()=>{ if(!isSpotifyConnected()) statusEl.textContent = 'Not connected'; }, 1800);
});
document.getElementById('tidalConnectBtn').addEventListener('click', ()=>{
  if(isTidalConnected()) importFromTidal();
  else connectTidal();
});
document.getElementById('tidalDisconnectBtn').addEventListener('click', ()=>{
  disconnectTidal();
  const statusEl = document.getElementById('tidalStatus');
  statusEl.textContent = 'Disconnected — connection reset.';
  setTimeout(()=>{ if(!isTidalConnected()) statusEl.textContent = 'Not connected'; }, 1800);
});
document.getElementById('tidalDebugBtn').addEventListener('click', ()=>{
  const raw = localStorage.getItem('tidal_debug_raw');
  if(!raw){
    alert('No Tidal response captured yet — click "Import now" under Tidal first, then try this again.');
    return;
  }
  let data;
  try{ data = JSON.parse(raw); }catch(e){
    window.prompt('Could not parse the saved response as JSON. Raw text:', raw);
    return;
  }
  const included = data.included || [];
  const albums = included.filter(i=>i.type==='albums');
  const genresRes = included.filter(i=>i.type==='genres');
  const tracks = included.filter(i=>i.type==='tracks');
  const artworks = included.filter(i=>i.type==='artworks');
  const tracksWithOwnGenre = tracks.filter(t=> t.relationships && t.relationships.genres && (t.relationships.genres.data||[]).length > 0);
  const albumsWithGenreRelationship = albums.filter(a=> a.relationships && a.relationships.genres && (a.relationships.genres.data||[]).length > 0);
  const albumsWithCoverArtRelationship = albums.filter(a=> a.relationships && a.relationships.coverArt && (a.relationships.coverArt.data||[]).length > 0);
  const sampleAlbumAttrKeys = albums[0] && albums[0].attributes ? Object.keys(albums[0].attributes).join(', ') : '(no albums in this page)';
  const sampleArtworkAttrKeys = artworks[0] && artworks[0].attributes ? Object.keys(artworks[0].attributes).join(', ') : '(no artworks resources in this page)';
  const sampleArtworkJson = artworks[0] ? JSON.stringify(artworks[0], null, 2) : '(none)';

  let genreBackfillSummary = '(no genre backfill log found — import may predate this feature, or no new albums needed a lookup)';
  const backfillRaw = localStorage.getItem('tidal_genre_backfill_log');
  if(backfillRaw){
    try{
      const backfillLog = JSON.parse(backfillRaw);
      const matchedCount = backfillLog.filter(e=>e.matched).length;
      const lines = backfillLog.map(e=>
        e.matched
          ? `  ✓ "${e.searched}" → ${e.genre} (matched "${e.matchedTitle}" by ${e.matchedArtist})`
          : `  ✗ "${e.searched}" → ${e.reason}`
      );
      genreBackfillSummary = `${matchedCount}/${backfillLog.length} albums matched\n` + lines.join('\n');
    }catch(e){
      genreBackfillSummary = '(could not parse stored backfill log)';
    }
  }

  const summary =
`TIDAL DEBUG SUMMARY
Tracks in this page: ${tracks.length}
Albums included: ${albums.length}
  → sample album attribute keys: ${sampleAlbumAttrKeys}
  → with coverArt relationship present: ${albumsWithCoverArtRelationship.length}
"artworks" resources returned by Tidal at all: ${artworks.length}
  → sample artwork attribute keys: ${sampleArtworkAttrKeys}
  → sample artwork resource (full JSON):
${sampleArtworkJson}
"genres" resources returned by Tidal at all: ${genresRes.length}
Tracks with a non-empty own genres relationship: ${tracksWithOwnGenre.length}
Albums with a non-empty genres relationship: ${albumsWithGenreRelationship.length}

--- iTunes genre backfill (from the last import) ---
${genreBackfillSummary}`;

  window.prompt('Copy this (Ctrl+A then Ctrl+C) and paste it back to Claude:', summary);
});

function maybeShowImportNotice(){
  if(localStorage.getItem('hideImportNotice') === '1') return;
  document.getElementById('importNoticeOverlay').classList.add('open');
}
document.getElementById('importNoticeCloseBtn').addEventListener('click', ()=>{
  if(document.getElementById('importNoticeDontShow').checked){
    localStorage.setItem('hideImportNotice', '1');
  }
  document.getElementById('importNoticeOverlay').classList.remove('open');
});

sb.auth.onAuthStateChange((event, session)=>{
  if(event === 'PASSWORD_RECOVERY'){
    showRecoveryScreen();
    return;
  }
  if(session && session.user){
    document.getElementById('auth-email').value = '';
    document.getElementById('auth-password').value = '';
    setAuthError(null); setAuthMessage(null);
    loadAppForUser(session.user);
  } else {
    currentUserId = null;
    showAuthScreen();
  }
});

sb.auth.getSession().then(({ data: { session } })=>{
  if(session && session.user){
    loadAppForUser(session.user);
  } else {
    showAuthScreen();
  }
});

