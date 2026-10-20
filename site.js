// Colle ici le lien terminé par /exec (déploiement Apps Script). C’est le SEUL endroit à modifier.
const API = 'https://script.google.com/macros/s/AKfycbxlZRauUrycQA1it43JRD2il7eOiUi3Vy1AI3Y5hf9uHrTXdlEvb_WtdwxEsl-A6TxE/exec';
const INSTA = 'https://www.instagram.com/artisan_willbwa/';

const $ = s => document.querySelector(s);
const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const img = (u, w) => { const m = String(u || '').match(/[-\w]{25,}/); return m ? 'https://drive.google.com/thumbnail?id=' + m[0] + '&sz=w' + (w || 600) : ''; };
const eur = n => n.toFixed(2).replace('.', ',') + ' €';
const dateFr = s => new Date(s + 'T12:00:00').toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const aujourdhui = () => new Date().toLocaleDateString('sv-SE');
const page = document.body.dataset.page;
let data = { catalogue: [], marches: [], contact: {} }, filtre = 'Tout', sel = {};
try { sel = JSON.parse(localStorage.getItem('sel') || '{}'); } catch (e) {}
const sauve = () => { try { localStorage.setItem('sel', JSON.stringify(sel)); } catch (e) {} };

/* ---------- Menu, pied de page, sélection (communs à toutes les pages) ---------- */
const liens = [['index.html', 'Accueil', 'home'], ['creations.html', 'Créations', 'creations'], ['anciennes.html', 'Anciennes créations', 'anciennes'], ['marches.html', 'Marchés', 'marches'], ['contact.html', 'Contact', 'contact']];
document.body.insertAdjacentHTML('afterbegin', '<nav class="nav"><a class="marque" href="index.html"><img src="assets/logo.png" alt="" width="34" height="34">Willbwa</a>' +
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
<p class="msg" id="m-res" role="status"></p></form></dialog>`);

/* ---------- Données (gardées 60 s pour aller vite entre les pages) ---------- */
async function charger() {
  try { const c = JSON.parse(sessionStorage.getItem('wb') || 'null'); if (c && Date.now() - c.t < 60000) return c.d; } catch (e) {}
  const d = await (await fetch(API)).json();
  try { sessionStorage.setItem('wb', JSON.stringify({ t: Date.now(), d: d })); } catch (e) {}
  return d;
}

/* ---------- Affichage ---------- */
const carte = (p, anc) => '<article class="card"><img loading="lazy" src="' + esc(img(p.photo)) + '" alt="' + esc(p.nom) + '"><div><h3>' + esc(p.nom) + '</h3><small>' + esc(p.description) + '</small>' +
  (anc ? '<a class="btn" href="contact.html?creation=' + encodeURIComponent(p.nom) + '">Je veux du sur-mesure</a>'
    : '<span class="prix">' + eur(p.prix) + '</span>' + (p.disponibilite === 'sur commande' ? '<small>Sur commande</small>' : '') +
      '<button class="btn" data-id="' + esc(p.id) + '"' + (p.disponibilite === 'épuisé' ? ' disabled>Épuisé' : '>Ajouter à ma sélection') + '</button>') + '</div></article>';

function liste(anc) {
  const src = data.catalogue.filter(p => (p.disponibilite === 'ancien') === anc);
  const cats = ['Tout'].concat([...new Set(src.map(p => p.categorie).filter(Boolean))]);
  $('#chips').innerHTML = cats.map(c => '<button class="chip" aria-pressed="' + (c === filtre) + '" data-c="' + esc(c) + '">' + esc(c) + '</button>').join(' ');
  $('#chips').querySelectorAll('button').forEach(b => b.onclick = () => { filtre = b.dataset.c; liste(anc); });
  const q = $('#q').value.toLowerCase();
  const l = src.filter(p => (filtre === 'Tout' || p.categorie === filtre) && (p.nom + ' ' + p.description).toLowerCase().includes(q));
  $('#grille').innerHTML = l.length ? l.map(p => carte(p, anc)).join('') : '<p class="vide">' + (src.length ? 'Aucune création ne correspond à ta recherche.' : 'Les créations arrivent bientôt.') + '</p>';
  $('#grille').querySelectorAll('button[data-id]').forEach(b => b.onclick = () => { sel[b.dataset.id] = Math.min(99, (sel[b.dataset.id] || 0) + 1); maj(); });
}

const galerie = m => m.photos && m.photos.length ? '<div class="galerie">' + m.photos.map(u => '<a href="' + esc(img(u, 1600)) + '" target="_blank" rel="noopener"><img loading="lazy" src="' + esc(img(u)) + '" alt="Photo du marché : ' + esc(m.lieu) + '"></a>').join('') + '</div>' : '';
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

/* ---------- Sélection et réservation ---------- */
function maj() {
  const ids = Object.keys(sel).filter(id => data.catalogue.some(p => String(p.id) === id && p.disponibilite !== 'ancien') && sel[id] > 0);
  Object.keys(sel).forEach(k => { if (!ids.includes(k)) delete sel[k]; });
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
  $('#lignes').querySelectorAll('[data-p]').forEach(b => b.onclick = () => { sel[b.dataset.p] = Math.min(99, sel[b.dataset.p] + 1); maj(); });
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
  maj(); if (pages[page]) pages[page]();
}).catch(() => {
  ['#grille', '#a-venir', '#passes', '#prochain'].forEach(s => { if ($(s)) $(s).innerHTML = '<p class="vide">Impossible de charger les informations pour le moment. Réessaie plus tard ou écris-moi.</p>'; });
  if (page === 'contact') pages.contact();
});
