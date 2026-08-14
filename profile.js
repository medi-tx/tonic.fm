/* =========================================================
   PROFILE: view / edit / onboarding / change password
   ========================================================= */
let currentEditProfilePhoto = null;
let currentOnboardingPhoto = null;

bindCoverInput('ep-photo-file', 'ep-photo', v=>currentEditProfilePhoto=v);
bindCoverInput('ob-photo-file', 'ob-photo', v=>currentOnboardingPhoto=v);

function renderMyProfileView(){
  const photo = myProfile && myProfile.photo;
  const username = (myProfile && myProfile.username) || '';
  const bio = (myProfile && myProfile.bio) || '';
  document.getElementById('myProfileViewPhoto').style.display = photo ? 'block' : 'none';
  if(photo) document.getElementById('myProfileViewPhoto').src = photo;
  document.getElementById('myProfileViewFallback').style.display = photo ? 'none' : 'flex';
  document.getElementById('myProfileViewFallback').textContent = username ? username.charAt(0).toUpperCase() : '?';
  document.getElementById('myProfileViewUsername').textContent = username ? '@'+username : '(no username set)';
  const bioEl = document.getElementById('myProfileViewBio');
  bioEl.textContent = bio || 'No bio yet.';
  bioEl.classList.toggle('empty', !bio);
}

document.getElementById('myProfileBtn').addEventListener('click', ()=>{
  renderMyProfileView();
  document.getElementById('myProfileOverlay').classList.add('open');
});
document.getElementById('myProfileCloseBtn').addEventListener('click', ()=>{
  document.getElementById('myProfileOverlay').classList.remove('open');
});
document.getElementById('myProfileOverlay').addEventListener('click', e=>{
  if(e.target.id==='myProfileOverlay') document.getElementById('myProfileOverlay').classList.remove('open');
});

function openEditProfile(){
  document.getElementById('myProfileOverlay').classList.remove('open');
  currentEditProfilePhoto = (myProfile && myProfile.photo) || null;
  document.getElementById('ep-username').value = (myProfile && myProfile.username) || '';
  document.getElementById('ep-bio').value = (myProfile && myProfile.bio) || '';
  setImagePreview('ep-photo', currentEditProfilePhoto);
  document.getElementById('ep-error').style.display = 'none';
  document.getElementById('editProfileOverlay').classList.add('open');
}
document.getElementById('openEditProfileBtn').addEventListener('click', openEditProfile);
document.getElementById('editProfileCancelBtn').addEventListener('click', ()=>{
  document.getElementById('editProfileOverlay').classList.remove('open');
});
document.getElementById('editProfileOverlay').addEventListener('click', e=>{
  if(e.target.id==='editProfileOverlay') document.getElementById('editProfileOverlay').classList.remove('open');
});
document.getElementById('editProfileSaveBtn').addEventListener('click', async ()=>{
  const errEl = document.getElementById('ep-error');
  const username = document.getElementById('ep-username').value.trim().toLowerCase().replace(/[^a-z0-9_.]/g,'');
  const bio = document.getElementById('ep-bio').value.trim();
  if(!username){ errEl.textContent = 'Choose a username (letters, numbers, _ and . only).'; errEl.style.display=''; return; }
  const error = await upsertMyProfile({ username, bio, photo: currentEditProfilePhoto });
  if(error){
    errEl.textContent = (error.code === '23505') ? 'That username is taken — try another.' : error.message;
    errEl.style.display = '';
    return;
  }
  myProfile = { user_id: currentUserId, username, bio, photo: currentEditProfilePhoto };
  renderMyAvatar();
  document.getElementById('editProfileOverlay').classList.remove('open');
});

function openOnboarding(){
  currentOnboardingPhoto = null;
  document.getElementById('ob-username').value = '';
  document.getElementById('ob-bio').value = '';
  setImagePreview('ob-photo', null);
  document.getElementById('ob-error').style.display = 'none';
  document.getElementById('onboardingOverlay').classList.add('open');
}
document.getElementById('onboardingSaveBtn').addEventListener('click', async ()=>{
  const errEl = document.getElementById('ob-error');
  const username = document.getElementById('ob-username').value.trim().toLowerCase().replace(/[^a-z0-9_.]/g,'');
  const bio = document.getElementById('ob-bio').value.trim();
  if(!username){ errEl.textContent = 'Choose a username (letters, numbers, _ and . only).'; errEl.style.display=''; return; }
  const error = await upsertMyProfile({ username, bio, photo: currentOnboardingPhoto });
  if(error){
    errEl.textContent = (error.code === '23505') ? 'That username is taken — try another.' : error.message;
    errEl.style.display = '';
    return;
  }
  myProfile = { user_id: currentUserId, username, bio, photo: currentOnboardingPhoto };
  renderMyAvatar();
  document.getElementById('onboardingOverlay').classList.remove('open');
});

document.getElementById('openChangePasswordBtn').addEventListener('click', ()=>{
  document.getElementById('myProfileOverlay').classList.remove('open');
  document.getElementById('cp-password').value = '';
  document.getElementById('cp-password-2').value = '';
  document.getElementById('cp-error').style.display = 'none';
  document.getElementById('cp-message').style.display = 'none';
  document.getElementById('passwordOverlay').classList.add('open');
});
document.getElementById('passwordCancelBtn').addEventListener('click', ()=>{
  document.getElementById('passwordOverlay').classList.remove('open');
});
document.getElementById('passwordOverlay').addEventListener('click', e=>{
  if(e.target.id==='passwordOverlay') document.getElementById('passwordOverlay').classList.remove('open');
});
document.getElementById('passwordSaveBtn').addEventListener('click', async ()=>{
  const errEl = document.getElementById('cp-error');
  const msgEl = document.getElementById('cp-message');
  errEl.style.display = 'none'; msgEl.style.display = 'none';
  const pw1 = document.getElementById('cp-password').value;
  const pw2 = document.getElementById('cp-password-2').value;
  if(!pw1 || pw1.length < 6){ errEl.textContent = 'Password must be at least 6 characters.'; errEl.style.display=''; return; }
  if(pw1 !== pw2){ errEl.textContent = 'Passwords do not match.'; errEl.style.display=''; return; }
  const { error } = await sb.auth.updateUser({ password: pw1 });
  if(error){ errEl.textContent = error.message; errEl.style.display=''; return; }
  msgEl.textContent = 'Password updated.';
  msgEl.style.display = '';
  document.getElementById('cp-password').value = '';
  document.getElementById('cp-password-2').value = '';
});
