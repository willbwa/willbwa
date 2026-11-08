// Colle ici le lien terminé par /exec (déploiement Apps Script). C’est le SEUL endroit à modifier.
const API = 'https://script.google.com/macros/s/AKfycbxlZRauUrycQA1it43JRD2il7eOiUi3Vy1AI3Y5hf9uHrTXdlEvb_WtdwxEsl-A6TxE/exec';
const INSTA = 'https://www.instagram.com/artisan_willbwa/';

// Vitesse : se connecter d'avance aux serveurs utilisés, et charger les polices sans bloquer l'affichage
['https://script.google.com', 'https://script.googleusercontent.com', 'https://drive.google.com'].forEach(h => document.head.insertAdjacentHTML('beforeend', '<link rel="preconnect" href="' + h + '">'));
document.head.insertAdjacentHTML('beforeend', '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@500;700;800&family=Newsreader:ital,wght@0,400;0,600;1,400&display=swap">');

const $ = s => document.querySelector(s);
const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const img = (u, w) => { const m = String(u || '').match(/[-\w]{25,}/); return m ? 'https://drive.google.com/thumbnail?id=' + m[0] + '&sz=w' + (w || 480) : ''; };
const fotos = p => String(p.photo || '').split(/[\s,;]+/).filter(u => /[-\w]{25,}/.test(u));   // plusieurs liens dans la même cellule
const eur = n => n.toFixed(2).replace('.', ',') + ' €';
const dateFr = s => new Date(s + 'T12:00:00').toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const jour = d => d.toLocaleDateString('fr-BE', { weekday: 'long' }) + ' ' + (d.getDate() === 1 ? '1er' : d.getDate());
const moisAn = d => d.toLocaleDateString('fr-BE', { month: 'long', year: 'numeric' });
function dateAff(m) {   // un jour, ou plusieurs jours si date_fin est remplie
  const a = new Date(m.date + 'T12:00:00');
  if (!m.date_fin || m.date_fin <= m.date) { const t = jour(a) + ' ' + moisAn(a); return t.charAt(0).toUpperCase() + t.slice(1); }
  const b = new Date(m.date_fin + 'T12:00:00');
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() ? 'Du ' + jour(a) + ' au ' + jour(b) + ' ' + moisAn(b)
    : 'Du ' + jour(a) + ' ' + (a.getFullYear() === b.getFullYear() ? a.toLocaleDateString('fr-BE', { month: 'long' }) : moisAn(a)) + ' au ' + jour(b) + ' ' + moisAn(b);
}
const aujourdhui = () => new Date().toLocaleDateString('sv-SE');
const page = document.body.dataset.page;
// Pendant le chargement : des cartes grises à la place du texte « Chargement… »
if ($('#grille')) $('#grille').innerHTML = Array(4).fill('<article class="card sk"><span class="sk-img"></span><span class="sk-l"></span><span class="sk-l c"></span></article>').join('');
const maxi = id => { const p = data.catalogue.find(x => String(x.id) === String(id)); return p && p.reste != null ? p.reste : 99; };
let data = { catalogue: [], marches: [], contact: {} }, filtre = 'Tout', sel = {}, com = {};
try { sel = JSON.parse(localStorage.getItem('sel') || '{}'); com = JSON.parse(localStorage.getItem('com') || '{}'); } catch (e) {}
const sauve = () => { try { localStorage.setItem('sel', JSON.stringify(sel)); localStorage.setItem('com', JSON.stringify(com)); } catch (e) {} };

/* ---------- Menu, pied de page, sélection (communs à toutes les pages) ---------- */
const liens = [['index.html', 'Accueil', 'home'], ['creations.html', 'Créations', 'creations'], ['anciennes.html', 'Anciennes créations', 'anciennes'], ['projet.html', 'Sur-mesure', 'projet'], ['marches.html', 'Marchés', 'marches'], ['infos.html', 'Infos pratiques', 'infos'], ['contact.html', 'Contact', 'contact']];
document.body.insertAdjacentHTML('afterbegin', '<nav class="nav"><a class="marque" href="index.html"><img src="logo-nav.png" alt="" width="34" height="34">Willbwa</a>' +
  liens.map(l => '<a href="' + l[0] + '"' + (l[2] === page || (page === 'categorie' && l[2] === 'creations') ? ' aria-current="page"' : '') + '>' + l[1] + '</a>').join('') + '</nav>');
document.body.insertAdjacentHTML('beforeend', `<footer><p>Par catégorie : <a href="porte-cles.html">Porte-clés</a> · <a href="decapsuleurs.html">Décapsuleurs</a> · <a href="lampes.html">Lampes</a> · <a href="bougies.html">Bougies</a></p>© Willbwa · Artisan en Belgique · <a href="${INSTA}" target="_blank" rel="noopener">Instagram</a> · <a href="infos.html#donnees">Données et confidentialité</a></footer>
<div id="toast" role="status" hidden></div>
<button id="fab" class="btn" hidden>Ma sélection (<span id="nb">0</span>)</button>
<dialog id="dlg"><h2 style="font-size:26px">Ma sélection</h2><div id="lignes"></div><p><b id="total" class="prix"></b></p>
<form id="f-res">
<label>Prénom<input name="client" required maxlength="80" autocomplete="given-name"></label>
<label>E-mail<input name="email" type="email" required maxlength="120" autocomplete="email"></label>
<label>Téléphone (facultatif)<input name="telephone" type="tel" maxlength="30" autocomplete="tel"></label>
<label>Comment veux-tu les recevoir ?<select name="remise" id="remise"><option value="marche">Retrait à un marché (paiement sur place)</option><option value="domicile">Retrait chez Willbwa, pas à un marché (paiement sur place)</option><option value="envoi">Envoi par la poste (paiement par virement)</option></select></label>
<label id="l-marche">Marché<select name="marche" id="sel-marche"></select></label>
<label id="l-adresse" hidden>Adresse d’envoi<textarea name="adresse" rows="3" maxlength="250"></textarea></label>
<p class="lead" id="info-envoi" hidden></p>
<label>Un mot pour moi (facultatif)<textarea name="note" rows="2" maxlength="500"></textarea></label>
<input class="piege" name="piege" tabindex="-1" autocomplete="off" aria-hidden="true">
<label style="font-weight:400;display:flex;gap:8px;align-items:flex-start"><input type="checkbox" required style="width:auto;margin-top:5px"><span>J’accepte que mes données servent uniquement à traiter cette réservation. Elles sont effacées automatiquement après <span class="cons-r">12</span> mois.</span></label>
<p class="lead" style="margin:0">Ce n’est pas encore une commande : je te réponds pour confirmer.</p>
<div><button class="btn" type="submit">Envoyer ma réservation</button> <button class="btn alt" type="button" id="fermer">Fermer</button></div>
<p class="msg" id="m-res" role="status"></p></form></dialog>
<dialog id="visu"><div class="vtete"><b id="v-titre"></b><button type="button" id="v-fermer" aria-label="Fermer">✕</button></div>
<div class="vscene" id="v-scene"><button type="button" class="vnav" id="v-prec" aria-label="Photo précédente">‹</button><img id="v-img" alt=""><button type="button" class="vnav" id="v-suiv" aria-label="Photo suivante">›</button></div>
<div class="vminis" id="v-minis"></div><p class="vinfo" id="v-info"></p><div id="v-pied"></div></dialog>`);

/* ---------- Affichage ---------- */
const etiquette = p => p.etat === 'reserve' ? '<span class="badge res">Réservé</span>' : p.etat === 'vendu' ? '<span class="badge ven">Vendu</span>' : p.reste === 1 ? '<span class="badge uni">Pièce unique</span>' : '';
const vignette = (p, eager) => { const f = fotos(p); return '<button class="vignette" type="button" aria-label="Voir les photos de ' + esc(p.nom) + '">' +
  (f.length ? '<img ' + (eager ? 'fetchpriority="high"' : 'loading="lazy"') + ' decoding="async" src="' + esc(img(f[0])) + '" alt="' + esc(p.nom) + '">' : '<span class="sansphoto">Photo à venir</span>') +
  etiquette(p) + (f.length > 1 ? '<span class="nbph">' + f.length + ' photos</span>' : '') + '</button>'; };
const detail = p => [p.essence, p.dimensions].filter(Boolean).map(esc).join(' · ');
const carte = (p, anc, i) => '<article class="card' + (p.etat === 'reserve' ? ' reserve' : '') + '" data-pid="' + esc(p.id) + '">' + vignette(p, i < 4) + '<div><h3>' + esc(p.nom) + '</h3>' +
  (detail(p) ? '<small><b>' + detail(p) + '</b></small>' : '') + '<small>' + esc(p.description) + '</small>' +
  (anc ? '<a class="btn" href="projet.html?creation=' + encodeURIComponent(p.nom) + '">Je veux du sur-mesure</a>'
    : '<span class="prix">' + eur(p.prix) + '</span>' + (p.disponibilite === 'sur commande' ? '<small>Sur commande</small>' : p.reste > 1 ? '<small>Il en reste ' + p.reste + '</small>' : '') +
      '<button class="btn" data-id="' + esc(p.id) + '"' + (p.etat === 'reserve' ? ' disabled>Déjà réservé' : p.disponibilite === 'épuisé' ? ' disabled>Épuisé' : '>Ajouter à ma sélection') + '</button>') + '</div></article>';

function liste(anc) {
  const motif = document.body.dataset.cat ? new RegExp(document.body.dataset.cat) : null;   // page d'une catégorie
  const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[-_]/g, ' ');
  const src = data.catalogue.filter(p => (p.disponibilite === 'ancien') === anc && (!motif || motif.test(norm(p.categorie)))).reverse().sort((a, b) => (a.etat === 'reserve') - (b.etat === 'reserve'));   // les plus récentes (dernières lignes du Sheet) en premier
  const cats = ['Tout'].concat(!anc && src.some(p => p.reste === 1) ? ['Pièces uniques'] : [], [...new Set(src.map(p => p.categorie).filter(Boolean))]);
  $('#chips').innerHTML = cats.map(c => '<button class="chip" aria-pressed="' + (c === filtre) + '" data-c="' + esc(c) + '">' + esc(c) + '</button>').join(' ');
  if (motif) $('#chips').innerHTML = '';
  $('#chips').querySelectorAll('button').forEach(b => b.onclick = () => { filtre = b.dataset.c; liste(anc); });
  const q = $('#q').value.toLowerCase();
  const l = src.filter(p => (filtre === 'Tout' || (filtre === 'Pièces uniques' ? p.reste === 1 : p.categorie === filtre)) && (p.nom + ' ' + p.description + ' ' + p.essence + ' ' + p.finition + ' ' + p.categorie).toLowerCase().includes(q));
  $('#grille').innerHTML = l.length ? l.map((p, i) => carte(p, anc, i)).join('') : '<p class="vide">' + (src.length ? 'Aucune création ne correspond à ta recherche.' : motif ? 'Pas de pièce disponible dans cette catégorie pour le moment. Regarde les <a href="anciennes.html">anciennes créations</a> ou <a href="contact.html">écris-moi</a> pour du sur-mesure.' : 'Les créations arrivent bientôt.') + '</p>';
  $('#grille').querySelectorAll('button[data-id]').forEach(b => b.onclick = () => { sel[b.dataset.id] = Math.min(maxi(b.dataset.id), (sel[b.dataset.id] || 0) + 1); maj();
    const p = data.catalogue.find(x => String(x.id) === b.dataset.id); toast('« ' + (p ? p.nom : 'Article') + ' » ajouté. Tu peux préciser ton choix dans ta sélection.'); });
  branche(anc);
}

const galerie = m => m.photos && m.photos.length ? '<div class="galerie">' + m.photos.map((u, i) => '<a href="' + esc(img(u, 1600)) + '" data-k="' + data.marches.indexOf(m) + '" data-i="' + i + '" target="_blank" rel="noopener"><img loading="lazy" src="' + esc(img(u)) + '" alt="Photo du marché : ' + esc(m.lieu) + '"></a>').join('') + '</div>' : '';
const echapIcs = t => String(t).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, '\\$&');
const ymd = s => s.replace(/-/g, '');
function jourSuivant(s) { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); }
function agenda(m) {   // lien Google Agenda + fichier .ics (Apple, Outlook) ; l'événement dure la journée entière, les horaires sont dans la description
  const fin = jourSuivant(m.date_fin || m.date), titre = 'Willbwa au marché : ' + m.lieu;
  const desc = [m.horaires, m.remarque, 'Plus d’infos : https://willbwa.github.io/willbwa/marches.html'].filter(Boolean).join('\n');
  const g = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(titre) + '&dates=' + ymd(m.date) + '/' + ymd(fin) + '&details=' + encodeURIComponent(desc) + '&location=' + encodeURIComponent(m.lieu);
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Willbwa//FR', 'BEGIN:VEVENT', 'UID:' + ymd(m.date) + '-' + m.lieu.replace(/\W+/g, '') + '@willbwa', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z',
    'DTSTART;VALUE=DATE:' + ymd(m.date), 'DTEND;VALUE=DATE:' + ymd(fin), 'SUMMARY:' + echapIcs(titre), 'LOCATION:' + echapIcs(m.lieu), 'DESCRIPTION:' + echapIcs(desc), 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  return '<p class="cal">Ajouter à mon calendrier : <a href="' + esc(g) + '" target="_blank" rel="noopener">Google Agenda</a> · <a href="data:text/calendar;charset=utf-8,' + encodeURIComponent(ics) + '" download="willbwa-marche.ics">Apple, Outlook (fichier .ics)</a></p>';
}
const bloc = (m, avenir) => '<div class="marche"><time>' + esc(dateAff(m)) + '</time><div><b>' + esc(m.lieu) + '</b><br>' + esc(m.horaires) + (m.remarque ? '<br><small>' + esc(m.remarque) + '</small>' : '') + (avenir ? agenda(m) : '') + galerie(m) + '</div></div>';
const aVenir = () => data.marches.filter(m => (m.date_fin || m.date) >= aujourdhui());
const passes = () => data.marches.filter(m => (m.date_fin || m.date) < aujourdhui()).reverse();

const pages = {
  home() {
    recentes();
    const m = aVenir()[0];
    $('#prochain').innerHTML = m ? bloc(m, true) + '<p><a href="marches.html">Voir tous les marchés</a></p>' : '<p class="vide">Pas de marché annoncé pour le moment. Suis-moi sur Instagram pour être prévenu.</p>';
  },
  creations() { $('#q').oninput = () => liste(false); liste(false); },
  categorie() { $('#q').oninput = () => liste(false); liste(false); },
  anciennes() {
    if (!$('#encart')) document.querySelector('.tools').insertAdjacentHTML('beforebegin', '<div id="encart" class="encart"><p><b>Chaque morceau de bois est unique.</b> Je peux parfois réaliser des créations dans le même esprit, adaptées à tes envies.</p><a class="btn" href="projet.html">Je veux du sur-mesure</a></div>');
    $('#q').oninput = () => liste(true); liste(true);
  },
  projet() {
    const cr = new URLSearchParams(location.search).get('creation'), mode = cr ? 'creation' : 'libre';
    document.querySelectorAll('[data-for]').forEach(e => { const on = e.dataset.for === mode; e.hidden = !on; e.querySelectorAll('input,textarea').forEach(i => { i.disabled = !on; }); });
    document.querySelectorAll('[data-reqmode]').forEach(i => { i.required = i.dataset.reqmode === mode; });
    $('#p-titre').textContent = cr ? 'Sur-mesure : à partir d’une création' : 'Imaginons un projet ensemble';
    $('#p-intro').textContent = cr ? 'Cette création te plaît, mais tu la voudrais un peu différente ? Dis-moi ce que tu aimerais changer.' : 'Tu as une idée d’objet en bois ? Ce n’est pas forcément quelque chose que j’ai déjà fait : raconte-la-moi, et voyons ensemble ce qui est possible.';
    const c = cr ? data.catalogue.find(x => x.nom === cr) : null, f = c ? fotos(c) : [];
    $('#insp').innerHTML = cr ? '<div class="insp">' + (f.length ? '<img src="' + esc(img(f[0])) + '" alt="' + esc(cr) + '">' : '') + '<div><small>Création qui t’inspire</small><br><b>' + esc(cr) + '</b></div></div>' : '';
    const h = document.querySelector('#f-projet [name=creation]'); if (h) h.value = cr || '';
  },
  marches() {
    const v = aVenir(), p = passes();
    $('#a-venir').innerHTML = v.length ? v.map(m => bloc(m, true)).join('') : '<p class="vide">Pas de marché annoncé pour le moment. Reviens bientôt ou suis-moi sur Instagram.</p>';
    $('#passes').innerHTML = p.length ? p.map(m => bloc(m, false)).join('') : '<p class="vide">Les photos des marchés passés arrivent bientôt.</p>';
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

function tuileKo(img) {   // une photo qui ne charge pas : on retire sa tuile (et le bandeau s'il ne reste rien)
  img.parentNode.remove();
  const s = document.getElementById('recentes');
  if (s && !s.querySelector('.vig')) s.remove();
}
function recentes() {   // bandeau de photos sur l'accueil : les 6 dernières créations disponibles
  const l = data.catalogue.filter(p => p.etat === 'disponible' && fotos(p).length).slice().reverse().slice(0, 6), a = $('#recentes'), ancre = document.querySelector('#about');
  if (a) a.remove();
  if (!ancre || !l.length) return;
  ancre.insertAdjacentHTML('beforebegin', '<section id="recentes"><h2>Dernières créations</h2><div class="bande">' + l.map(p => '<button type="button" class="vig" data-pid="' + esc(p.id) + '" aria-label="Voir ' + esc(p.nom) + '"><img loading="lazy" src="' + esc(img(fotos(p)[0])) + '" alt="' + esc(p.nom) + '" onerror="tuileKo(this)">' + etiquette(p) + '<span class="leg">' + esc(p.nom) + '</span></button>').join('') + '</div><p><a href="creations.html">Voir toutes les créations</a></p></section>');
  document.querySelectorAll('#recentes .vig').forEach(b => { b.onclick = () => ouvrir(b.dataset.pid, false); });
}

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
  const car = [['Essence', p.essence], ['Dimensions', p.dimensions], ['Finition', p.finition]].filter(x => x[1]).map(x => '<li><b>' + x[0] + ' :</b> ' + esc(x[1]) + '</li>').join('');
  const etat = p.etat === 'reserve' ? 'Cette pièce est réservée.' : p.etat === 'vendu' ? 'Cette pièce a été vendue.' : '';
  const info = esc(p.description) + (car ? '<ul class="car">' + car + '</ul>' : '') + (anc ? (etat ? '<br><b>' + etat + '</b>' : '')
    : '<br><b class="prix">' + eur(p.prix) + '</b>' + (p.reste === 1 ? ' · Pièce unique' : p.reste > 1 ? ' · Il en reste ' + p.reste : '') + (etat ? ' · <b>' + etat + '</b>' : ''));
  const pied = anc ? '<a class="btn" href="projet.html?creation=' + encodeURIComponent(p.nom) + '">Je veux du sur-mesure</a>'
    : (p.etat === 'reserve' || p.disponibilite === 'épuisé') ? '' : (p.reste === 1 ? '' : '<input class="com" id="v-com" maxlength="200" placeholder="Précision (facultatif) : lequel veux-tu ? Décris-le ou donne son numéro" aria-label="Précision pour ' + esc(p.nom) + '" value="' + esc(com[id] || '') + '">') + '<button class="btn" id="v-ajout" type="button">Ajouter à ma sélection</button>';
  visu(p.nom, f, info, pied, 0);
  if ($('#v-ajout')) $('#v-ajout').onclick = () => {
    const v = $('#v-com') ? $('#v-com').value.trim() : '';
    if (v) com[id] = v;
    sel[id] = Math.min(maxi(id), (sel[id] || 0) + 1); maj(); $('#visu').close();
    toast('« ' + p.nom + ' » ajouté à ta sélection.');
  };
}
function branche(anc) {
  const g = $('#grille');
  g.querySelectorAll('article').forEach(a => { a.onclick = e => { if (!e.target.closest('.btn')) ouvrir(a.dataset.pid, anc); }; });
  g.querySelectorAll('.vignette img').forEach(i => { i.onerror = () => i.replaceWith(Object.assign(document.createElement('span'), { className: 'sansphoto', textContent: 'Photo indisponible' })); });
}
function galeries() {
  document.querySelectorAll('.galerie a').forEach(a => {
    a.onclick = e => { e.preventDefault(); const m = data.marches[+a.dataset.k]; if (m) visu(m.lieu + ' · ' + dateAff(m), m.photos, '', '', +a.dataset.i); };
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

let toastT;
function toast(msg) {
  const t = $('#toast'); t.innerHTML = esc(msg) + ' <button type="button" id="toast-voir">Voir ma sélection</button>'; t.hidden = false;
  $('#toast-voir').onclick = () => { t.hidden = true; $('#dlg').showModal(); };
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 8000);
}

/* ---------- Sélection et réservation ---------- */
function maj() {
  const ids = Object.keys(sel).filter(id => data.catalogue.some(p => String(p.id) === id && p.disponibilite !== 'ancien' && p.disponibilite !== 'épuisé' && p.etat !== 'reserve') && sel[id] > 0);
  Object.keys(sel).forEach(k => { if (!ids.includes(k)) delete sel[k]; });
  ids.forEach(k => { sel[k] = Math.min(sel[k], maxi(k)); });
  Object.keys(com).forEach(k => { if (!ids.includes(k)) delete com[k]; });
  sauve();
  const n = ids.reduce((s, id) => s + sel[id], 0);
  $('#nb').textContent = n; $('#fab').hidden = !n;
  let t = 0;
  $('#lignes').innerHTML = ids.map(id => {
    const p = data.catalogue.find(x => String(x.id) === id); t += p.prix * sel[id];
    return '<div class="art"><div class="ligne"><span>' + esc(p.nom) + '</span><button data-m="' + esc(id) + '" aria-label="Retirer un">−</button><span>' + sel[id] + '</span><button data-p="' + esc(id) + '" aria-label="Ajouter un">+</button><span>' + eur(p.prix * sel[id]) + '</span></div><input class="com" data-c="' + esc(id) + '" maxlength="200" placeholder="Précision (facultatif) : lequel veux-tu ? Décris-le ou donne son numéro" aria-label="Précision pour ' + esc(p.nom) + '" value="' + esc(com[id] || '') + '"></div>';
  }).join('');
  $('#lignes').querySelectorAll('.com').forEach(i => { i.oninput = () => { com[i.dataset.c] = i.value; sauve(); }; });
  $('#total').textContent = 'Total des articles : ' + eur(t);
  $('#lignes').querySelectorAll('[data-m]').forEach(b => b.onclick = () => { sel[b.dataset.m]--; maj(); });
  $('#lignes').querySelectorAll('[data-p]').forEach(b => b.onclick = () => { sel[b.dataset.p] = Math.min(maxi(b.dataset.p), sel[b.dataset.p] + 1); maj(); });
  if (!n && $('#dlg').open) $('#dlg').close();
}
$('#fab').onclick = () => $('#dlg').showModal();
$('#fermer').onclick = () => $('#dlg').close();
function majRemise() {   // ce qui est caché est aussi désactivé : il n'est donc pas envoyé
  const v = $('#remise').value, adr = document.querySelector('#l-adresse textarea');
  $('#l-marche').hidden = v !== 'marche'; $('#sel-marche').disabled = v !== 'marche';
  $('#l-adresse').hidden = v !== 'envoi'; adr.disabled = v !== 'envoi'; adr.required = v === 'envoi';
  $('#info-envoi').hidden = v !== 'envoi';
}
$('#remise').onchange = majRemise; majRemise();

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
  f.type = 'reservation'; f.articles = Object.keys(sel).map(id => ({ id: id, quantite: sel[id], commentaire: com[id] || '' }));
  envoyer(e.target, f, '#m-res', () => { sel = {}; com = {}; sauve(); setTimeout(maj, 2500); });
};

/* ---------- Demande de projet : photos réduites avant l'envoi ---------- */
let fotosProjet = [];
function reduire(file) {
  return new Promise((ok, ko) => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      const k = Math.min(1, 1400 / Math.max(im.width, im.height)), c = document.createElement('canvas');
      c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url); ok(c.toDataURL('image/jpeg', 0.82));
    };
    im.onerror = () => { URL.revokeObjectURL(url); ko(new Error('Photo illisible')); };
    im.src = url;
  });
}
function miniaturesProjet() {
  $('#p-minis').innerHTML = fotosProjet.map((u, i) => '<span><img src="' + u + '" alt="Photo ' + (i + 1) + '"><button type="button" data-x="' + i + '" aria-label="Retirer la photo ' + (i + 1) + '">×</button></span>').join('');
  $('#p-minis').querySelectorAll('[data-x]').forEach(b => { b.onclick = () => { fotosProjet.splice(+b.dataset.x, 1); miniaturesProjet(); }; });
}
if ($('#f-projet')) {
  $('#p-fichiers').onchange = async e => {
    const m = $('#m-projet');
    for (const f of [...e.target.files]) {
      if (fotosProjet.length >= 3) { m.className = 'msg err'; m.textContent = '3 photos maximum.'; break; }
      try { fotosProjet.push(await reduire(f)); m.textContent = ''; } catch (err) { m.className = 'msg err'; m.textContent = 'Une photo n’a pas pu être lue. Essaie avec une autre.'; }
    }
    e.target.value = ''; miniaturesProjet();
  };
  $('#f-projet').onsubmit = e => {
    e.preventDefault();
    const mode = new URLSearchParams(location.search).get('creation') ? 'creation' : 'libre';
    envoyer(e.target, Object.assign(Object.fromEntries(new FormData(e.target)), { type: 'projet', mode: mode, photos: fotosProjet }), '#m-projet', () => { fotosProjet = []; miniaturesProjet(); });
  };
}

/* ---------- Démarrage rapide : on affiche tout de suite la dernière version connue, puis on la met à jour ---------- */
function demarrer(d) {
  data = d;
  $('#sel-marche').innerHTML = aVenir().map(m => '<option value="' + esc(dateAff(m) + ' : ' + m.lieu) + '">' + esc(dateAff(m) + ' : ' + m.lieu) + '</option>').join('');
  $('#info-envoi').textContent = d.frais_envoi || '';
  const cs = d.conservation || {};
  document.querySelectorAll('.cons-r').forEach(s => { s.textContent = cs.reservations || 12; });
  document.querySelectorAll('.cons-m').forEach(s => { s.textContent = cs.messages || 6; });
  document.querySelectorAll('.cons-p').forEach(s => { s.textContent = cs.projets || 12; });
  maj(); if (pages[page]) pages[page](); galeries();
}
let connu = null;
try { connu = JSON.parse(localStorage.getItem('wb2') || 'null'); } catch (e) {}
if (connu) demarrer(connu);
fetch(API).then(r => r.json()).then(d => {
  try { localStorage.setItem('wb2', JSON.stringify(d)); } catch (e) {}
  if (JSON.stringify(d) !== JSON.stringify(connu)) demarrer(d);
}).catch(() => {
  if (connu) return;
  ['#grille', '#a-venir', '#passes', '#prochain'].forEach(s => { if ($(s)) $(s).innerHTML = '<p class="vide">Impossible de charger les informations pour le moment. Réessaie plus tard ou écris-moi.</p>'; });
  if (page === 'contact') pages.contact();
});
