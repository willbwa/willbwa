// Colle ici le lien terminé par /exec (déploiement Apps Script). C’est le SEUL endroit à modifier.
const API = 'https://script.google.com/macros/s/AKfycbxlZRauUrycQA1it43JRD2il7eOiUi3Vy1AI3Y5hf9uHrTXdlEvb_WtdwxEsl-A6TxE/exec';
const INSTA = 'https://www.instagram.com/artisan_willbwa/';

const $ = s => document.querySelector(s);
const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const img = (u, w) => { const m = String(u || '').match(/[-\w]{25,}/); return m ? 'https://drive.google.com/thumbnail?id=' + m[0] + '&sz=w' + (w || 600) : ''; };
const fotos = p => String(p.photo || '').split(/[\s,;]+/).filter(u => /[-\w]{25,}/.test(u));   // plusieurs liens dans la même cellule
const eur = n => n.toFixed(2).replace('.', ',') + ' €';
const dateFr = s => new Date(s + 'T12:00:00').toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const aujourdhui = () => new Date().toLocaleDateString('sv-SE');
const page = document.body.dataset.page;
const maxi = id => { const p = data.catalogue.find(x => String(x.id) === String(id)); return p && p.reste != null ? p.reste : 99; };
let data = { catalogue: [], marches: [], contact: {} }, filtre = 'Tout', sel = {};
try { sel = JSON.parse(localStorage.getItem('sel') || '{}'); } catch (e) {}
const sauve = () => { try { localStorage.setItem('sel', JSON.stringify(sel)); } catch (e) {} };

/* ---------- Menu, pied de page, sélection (communs à toutes les pages) ---------- */
const liens = [['index.html', 'Accueil', 'home'], ['creations.html', 'Créations', 'creations'], ['anciennes.html', 'Anciennes créations', 'anciennes'], ['marches.html', 'Marchés', 'marches'], ['contact.html', 'Contact', 'contact']];
document.body.insertAdjacentHTML('afterbegin', '<nav class="nav"><a class="marque" href="index.html"><img src="logo.png" alt="" width="34" height="34">Willbwa</a>' +
  liens.map(l => '<a href="' + l[0] + '"' + (l[2] === page ? ' aria-current="page"' : '') + '>' + l[1] + '</a>').join('') + '</nav>');
document.body.insertAdjacentHTML('beforeend', `<footer>© Willbwa · Artisan en Belgique · <a href="${INSTA}" target="_blank" rel="noopener">Instagram</a></footer>
<button id="fab" class="btn" hidden>Ma sélection (<span id="nb">0</span>)</button>
<dialog id="dlg"><h2 style="font-size:26px">Ma sélection</h2><div id="lignes"></div><p><b id="total" class="prix"></b></p>
<form id="f-res">
<label>Prénom<input name="client" required maxlength="80" autocomplete="given-name"></label>
<label>E-mail<input name="email" type="email" required maxlength="120" autocomplete="email"></label>
<label>Téléphone (facultatif)<input name="telephone" type="tel" maxlength="30" autocomplete="tel"></label>
<label>Comment veux-tu les recevoir ?<select name="remise" id="remise"><option value="marche">Retrait à un marché (paiement sur place)</option><option value="domicile">Retrait chez Willbwa (paiement sur place)</option><option value="envoi">Envoi par la poste (paiement par virement)</option></select></label>
<label id="l-marche">Marché<select name="marche" id="sel-marche"></select></label>
<label id="l-adresse" hidden>Adresse d’envoi<textarea name="adresse" rows="3" maxlength="250"></textarea></label>
<p class="lead" id="info-envoi" hidden></p>
<label>Un mot pour moi (facultatif)<textarea name="note" rows="2" maxlength="500"></textarea></label>
<input class="piege" name="piege" tabindex="-1" autocomplete="off" aria-hidden="true">
<label style="font-weight:400;display:flex;gap:8px;align-items:flex-start"><input type="checkbox" required style="width:auto;margin-top:5px"><span>J’accepte que mes données servent uniquement à traiter cette réservation.</span></label>
<p class="lead" style="margin:0">Ce n’est pas encore une commande : je te réponds pour confirmer.</p>
<div><button class="btn" type="submit">Envoyer ma réservation</button> <button class="btn alt" type="button" id="fermer">Fermer</button></div>
<p class="msg" id="m-res" role="status"></p></form></dialog>
<dialog id="visu"><div class="vtete"><b id="v-titre"></b><button type="button" id="v-fermer" aria-label="Fermer">✕</button></div>
<div class="vscene" id="v-scene"><button type="button" class="vnav" id="v-prec" aria-label="Photo précédente">‹</button><img id="v-img" alt=""><button type="button" class="vnav" id="v-suiv" aria-label="Photo suivante">›</button></div>
<div class="vminis" id="v-minis"></div><p class="vinfo" id="v-info"></p><div id="v-pied"></div></dialog>`);

/* ---------- Données (gardées 60 s pour aller vite entre les pages) ---------- */
async function charger() {
  try { const c = JSON.parse(sessionStorage.getItem('wb') || 'null'); if (c && Date.now() - c.t < 60000) return c.d; } catch (e) {}
  const d = await (await fetch(API)).json();
  try { sessionStorage.setItem('wb', JSON.stringify({ t: Date.now(), d: d })); } catch (e) {}
  return d;
}

/* ---------- Affichage ---------- */
const vignette = p => { const f = fotos(p); return '<button class="vignette" type="button" aria-label="Voir les photos de ' + esc(p.nom) + '">' +
  (f.length ? '<img loading="lazy" src="' + esc(img(f[0])) + '" alt="' + esc(p.nom) + '">' : '<span class="sansphoto">Photo à venir</span>') +
  (f.length > 1 ? '<span class="nbph">' + f.length + ' photos</span>' : '') + '</button>'; };
const carte = (p, anc) => '<article class="card" data-pid="' + esc(p.id) + '">' + vignette(p) + '<div><h3>' + esc(p.nom) + '</h3><small>' + esc(p.description) + '</small>' +
  (anc ? '<a class="btn" href="contact.html?creation=' + encodeURIComponent(p.nom) + '">Je veux du sur-mesure</a>'
    : '<span class="prix">' + eur(p.prix) + '</span>' + (p.disponibilite === 'sur commande' ? '<small>Sur commande</small>' : p.reste === 1 ? '<small>Pièce unique</small>' : p.reste > 1 ? '<small>Il en reste ' + p.reste + '</small>' : '') +
      '<button class="btn" data-id="' + esc(p.id) + '"' + (p.disponibilite === 'épuisé' ? ' disabled>Épuisé' : '>Ajouter à ma sélection') + '</button>') + '</div></article>';

function liste(anc) {
  const src = data.catalogue.filter(p => (p.disponibilite === 'ancien') === anc).reverse();   // les plus récentes (dernières lignes du Sheet) en premier
  const cats = ['Tout'].concat([...new Set(src.map(p => p.categorie).filter(Boolean))]);
  $('#chips').innerHTML = cats.map(c => '<button class="chip" aria-pressed="' + (c === filtre) + '" data-c="' + esc(c) + '">' + esc(c) + '</button>').join(' ');
  $('#chips').querySelectorAll('button').forEach(b => b.onclick = () => { filtre = b.dataset.c; liste(anc); });
  const q = $('#q').value.toLowerCase();
  const l = src.filter(p => (filtre === 'Tout' || p.categorie === filtre) && (p.nom + ' ' + p.description).toLowerCase().includes(q));
  $('#grille').innerHTML = l.length ? l.map(p => carte(p, anc)).join('') : '<p class="vide">' + (src.length ? 'Aucune création ne correspond à ta recherche.' : 'Les créations arrivent bientôt.') + '</p>';
  $('#grille').querySelectorAll('button[data-id]').forEach(b => b.onclick = () => { sel[b.dataset.id] = Math.min(maxi(b.dataset.id), (sel[b.dataset.id] || 0) + 1); maj(); });
  branche(anc);
}

const galerie = m => m.photos && m.photos.length ? '<div class="galerie">' + m.photos.map((u, i) => '<a href="' + esc(img(u, 1600)) + '" data-k="' + data.marches.indexOf(m) + '" data-i="' + i + '" target="_blank" rel="noopener"><img loading="lazy" src="' + esc(img(u)) + '" alt="Photo du marché : ' + esc(m.lieu) + '"></a>').join('') + '</div>' : '';
const bloc = m => '<div class="marche"><time>' + esc(dateFr(m.date)) + '</time><div><b>' + esc(m.lieu) + '</b><br>' + esc(m.horaires) + (m.remarque ? '<br><small>' + esc(m.remarque) + '</small>' : '') + galerie(m) + '</div></div>';
const aVenir = () => data.marches.filter(m => m.date >= aujourdhui());
const passes = () => data.marches.filter(m => m.date < aujourdhui()).reverse();

const pages = {
  home() {
    const m = aVenir()[0];
    $('#prochain').innerHTML = m ? bloc(m) + '<p><a href="marches.html">Voir tous les marchés</a></p>' : '<p class="vide">Pas de marché annoncé pour le moment. Suis-moi sur Instagram pour être prévenu.</p>';
  },
  creations() { $('#q').oninput = () => liste(false); liste(false); },
  anciennes() { $('#q').oninput = () => liste(true); liste(true); },
  marches() {
    const v = aVenir(), p = passes();
    $('#a-venir').innerHTML = v.length ? v.map(bloc).join('') : '<p class="vide">Pas de marché annoncé pour le moment. Reviens bientôt ou suis-moi sur Instagram.</p>';
    $('#passes').innerHTML = p.length ? p.map(bloc).join('') : '<p class="vide">Les photos des marchés passés arrivent bientôt.</p>';
  },
  contact() {
    const c = data.contact || {}, l = [];
    if (c.telephone) l.push('<dt>Téléphone</dt><dd><a href="tel:' + esc(String(c.telephone).replace(/[^\d+]/g, '')) + '">' + esc(c.telephone) + '</a></dd>');
    if (c.email) l.push('<dt>E-mail</dt><dd><a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a></dd>');
    if (c.commune) l.push('<dt>Localisation</dt><dd>' + esc(c.commune) + '</dd>');
    l.push('<dt>Instagram</dt><dd><a href="' + INSTA + '" target="_blank" rel="noopener">@artisan_willbwa</a></dd>');
    $('#infos').innerHTML = l.join('');
    const cr = new URLSearchParams(location.search).get('creation');
    if (cr) $('#f-contact [name=message]').value = 'Bonjour, j’aimerais une création sur mesure, dans le style de « ' + cr + ' ».\n';
  }
};

/* ---------- Visionneuse de photos (agrandir, parcourir, zoomer) ---------- */
let vu = { urls: [], i: 0 }, boite = null, tx = null;
const vim = $('#v-img');
function visu(titre, urls, info, pied, debut) {
  vu = { urls: urls, i: 0 };
  $('#v-titre').textContent = titre; $('#v-info').innerHTML = info || ''; $('#v-pied').innerHTML = pied || '';
  montrer(debut || 0); $('#visu').showModal();
}
function montrer(i) {
  const n = vu.urls.length;
  vu.i = (i + n) % n;
  vim.classList.remove('zoom'); vim.style.transformOrigin = '50% 50%';
  vim.src = img(vu.urls[vu.i], 1600); vim.alt = $('#v-titre').textContent;
  $('#v-prec').hidden = $('#v-suiv').hidden = n < 2;
  $('#v-minis').innerHTML = n < 2 ? '' : vu.urls.map((u, k) => '<button type="button" class="mini' + (k === vu.i ? ' on' : '') + '" data-k="' + k + '" aria-label="Photo ' + (k + 1) + ' sur ' + n + '"><img src="' + esc(img(u, 200)) + '" alt=""></button>').join('');
  $('#v-minis').querySelectorAll('.mini').forEach(b => { b.onclick = () => montrer(+b.dataset.k); });
}
function ouvrir(id, anc) {
  const p = data.catalogue.find(x => String(x.id) === String(id)), f = p ? fotos(p) : [];
  if (!f.length) return;
  const info = esc(p.description) + (anc ? '' : '<br><b class="prix">' + eur(p.prix) + '</b>' + (p.reste === 1 ? ' · Pièce unique' : p.reste > 1 ? ' · Il en reste ' + p.reste : ''));
  const pied = anc ? '<a class="btn" href="contact.html?creation=' + encodeURIComponent(p.nom) + '">Je veux du sur-mesure</a>'
    : p.disponibilite === 'épuisé' ? '' : '<button class="btn" id="v-ajout" type="button">Ajouter à ma sélection</button>';
  visu(p.nom, f, info, pied, 0);
  if ($('#v-ajout')) $('#v-ajout').onclick = () => { sel[id] = Math.min(maxi(id), (sel[id] || 0) + 1); maj(); $('#visu').close(); };
}
function branche(anc) {
  const g = $('#grille');
  g.querySelectorAll('article').forEach(a => { a.onclick = e => { if (!e.target.closest('.btn')) ouvrir(a.dataset.pid, anc); }; });
  g.querySelectorAll('.vignette img').forEach(i => { i.onerror = () => i.replaceWith(Object.assign(document.createElement('span'), { className: 'sansphoto', textContent: 'Photo indisponible' })); });
}
function galeries() {
  document.querySelectorAll('.galerie a').forEach(a => {
    a.onclick = e => { e.preventDefault(); const m = data.marches[+a.dataset.k]; if (m) visu(m.lieu + ' · ' + dateFr(m.date), m.photos, '', '', +a.dataset.i); };
  });
}
const suivre = (cx, cy) => {
  if (!boite) return;
  const x = Math.max(0, Math.min(100, (cx - boite.left) / boite.width * 100)), y = Math.max(0, Math.min(100, (cy - boite.top) / boite.height * 100));
  vim.style.transformOrigin = x + '% ' + y + '%';
};
vim.onclick = e => {
  if (vim.classList.contains('zoom')) { vim.classList.remove('zoom'); return; }
  boite = vim.getBoundingClientRect(); vim.classList.add('zoom'); suivre(e.clientX, e.clientY);
};
vim.onmousemove = e => { if (vim.classList.contains('zoom')) suivre(e.clientX, e.clientY); };
vim.ontouchmove = e => { if (vim.classList.contains('zoom')) { e.preventDefault(); suivre(e.touches[0].clientX, e.touches[0].clientY); } };
$('#v-scene').ontouchstart = e => { tx = e.touches[0].clientX; };
$('#v-scene').ontouchend = e => {
  if (tx != null && !vim.classList.contains('zoom')) { const dx = e.changedTouches[0].clientX - tx; if (Math.abs(dx) > 50) montrer(vu.i + (dx < 0 ? 1 : -1)); }
  tx = null;
};
$('#v-fermer').onclick = () => $('#visu').close();
$('#v-prec').onclick = () => montrer(vu.i - 1);
$('#v-suiv').onclick = () => montrer(vu.i + 1);
$('#visu').onclick = e => { if (e.target === $('#visu')) $('#visu').close(); };
document.addEventListener('keydown', e => {
  if (!$('#visu').open) return;
  if (e.key === 'ArrowRight') montrer(vu.i + 1);
  if (e.key === 'ArrowLeft') montrer(vu.i - 1);
});

/* ---------- Sélection et réservation ---------- */
function maj() {
  const ids = Object.keys(sel).filter(id => data.catalogue.some(p => String(p.id) === id && p.disponibilite !== 'ancien' && p.disponibilite !== 'épuisé') && sel[id] > 0);
  Object.keys(sel).forEach(k => { if (!ids.includes(k)) delete sel[k]; });
  ids.forEach(k => { sel[k] = Math.min(sel[k], maxi(k)); });
  sauve();
  const n = ids.reduce((s, id) => s + sel[id], 0);
  $('#nb').textContent = n; $('#fab').hidden = !n;
  let t = 0;
  $('#lignes').innerHTML = ids.map(id => {
    const p = data.catalogue.find(x => String(x.id) === id); t += p.prix * sel[id];
    return '<div class="ligne"><span>' + esc(p.nom) + '</span><button data-m="' + esc(id) + '" aria-label="Retirer un">−</button><span>' + sel[id] + '</span><button data-p="' + esc(id) + '" aria-label="Ajouter un">+</button><span>' + eur(p.prix * sel[id]) + '</span></div>';
  }).join('');
  $('#total').textContent = 'Total des articles : ' + eur(t);
  $('#lignes').querySelectorAll('[data-m]').forEach(b => b.onclick = () => { sel[b.dataset.m]--; maj(); });
  $('#lignes').querySelectorAll('[data-p]').forEach(b => b.onclick = () => { sel[b.dataset.p] = Math.min(maxi(b.dataset.p), sel[b.dataset.p] + 1); maj(); });
  if (!n && $('#dlg').open) $('#dlg').close();
}
$('#fab').onclick = () => $('#dlg').showModal();
$('#fermer').onclick = () => $('#dlg').close();
$('#remise').onchange = e => {
  const v = e.target.value;
  $('#l-marche').hidden = v !== 'marche'; $('#l-adresse').hidden = v !== 'envoi'; $('#info-envoi').hidden = v !== 'envoi';
};

async function envoyer(form, corps, msg, apres) {
  const m = $(msg), b = form.querySelector('[type=submit]');
  m.className = 'msg'; m.textContent = 'Envoi en cours…'; b.disabled = true;
  try {
    const r = await (await fetch(API, { method: 'POST', body: JSON.stringify(corps) })).json();
    if (!r.ok) throw new Error(r.erreur || 'Erreur');
    m.className = 'msg ok'; m.textContent = 'Merci, c’est envoyé ! Tu reçois une confirmation par e-mail.';
    apres && apres(); form.reset();
  } catch (e) {
    const mail = data.contact && data.contact.email;
    m.className = 'msg err'; m.textContent = (e.message || 'Envoi impossible') + ' Tu peux aussi m’écrire directement' + (mail ? ' : ' + mail : '.');
  } finally { b.disabled = false; }
}
if ($('#f-contact')) $('#f-contact').onsubmit = e => { e.preventDefault(); envoyer(e.target, Object.assign(Object.fromEntries(new FormData(e.target)), { type: 'contact' }), '#m-contact'); };
$('#f-res').onsubmit = e => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  f.type = 'reservation'; f.articles = Object.keys(sel).map(id => ({ id: id, quantite: sel[id] }));
  envoyer(e.target, f, '#m-res', () => { sel = {}; sauve(); setTimeout(maj, 2500); });
};

charger().then(d => {
  data = d;
  $('#sel-marche').innerHTML = aVenir().map(m => '<option value="' + esc(dateFr(m.date) + ' : ' + m.lieu) + '">' + esc(dateFr(m.date) + ' : ' + m.lieu) + '</option>').join('');
  $('#info-envoi').textContent = d.frais_envoi || '';
  maj(); if (pages[page]) pages[page](); galeries();
}).catch(() => {
  ['#grille', '#a-venir', '#passes', '#prochain'].forEach(s => { if ($(s)) $(s).innerHTML = '<p class="vide">Impossible de charger les informations pour le moment. Réessaie plus tard ou écris-moi.</p>'; });
  if (page === 'contact') pages.contact();
});
