/***** WILLBWA : SERVEUR (Sheet + Apps Script) *****/
const FUSEAU = 'Europe/Brussels';
const SITE_URL = 'https://willbwa.github.io/willbwa/';
const INSTA_URL = 'https://www.instagram.com/artisan_willbwa/';

const ONGLETS = {
  Catalogue: ['id', 'nom', 'categorie', 'description', 'prix', 'photo', 'disponibilite', 'visible', 'quantite', 'essence', 'dimensions', 'finition'],
  Marches: ['date', 'lieu', 'horaires', 'remarque', 'public', 'photos', 'date_fin'],
  Reservations: ['date_heure', 'client', 'email', 'telephone', 'remise', 'marche', 'adresse', 'articles', 'total', 'statut', 'note', 'ids_qte', 'stock_rendu'],
  Messages: ['date_heure', 'nom', 'email', 'message'],
  Projets: ['date_heure', 'type', 'creation', 'prenom', 'email', 'projet', 'usage', 'modification', 'description', 'dimensions', 'bois', 'budget', 'photos', 'statut'],
  Config: ['cle', 'valeur']
};

// À lancer UNE FOIS : crée les onglets
function creerStructure() {
  const ss = SpreadsheetApp.getActiveSpreadsheet(), sautes = [];
  // Chaque réglage est essayé séparément : si Google en refuse un (ex. colonne d'un « tableau »), on passe au suivant
  const essai = (nom, fn) => { try { fn(); SpreadsheetApp.flush(); } catch (e) { sautes.push(nom + ' (' + e.message + ')'); } };
  Object.keys(ONGLETS).forEach(nom => essai('en-têtes de ' + nom, () => {
    const f = ss.getSheetByName(nom) || ss.insertSheet(nom);
    f.getRange(1, 1, 1, ONGLETS[nom].length).setValues([ONGLETS[nom]]).setFontWeight('bold').setBackground('#d9ead3');
    f.setFrozenRows(1);
  }));
  // Listes déroulantes : évitent les erreurs de saisie (ex. « oui » attendu)
  const liste = (nom, col, vals) => essai('liste de choix de ' + nom + ' (colonne ' + col + ')', () =>
    ss.getSheetByName(nom).getRange(2, col, 500, 1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(vals, true).setAllowInvalid(false).build()));
  liste('Catalogue', 7, ['en stock', 'sur commande', 'épuisé', 'ancien']);
  liste('Catalogue', 8, ['oui', 'non']);
  liste('Marches', 5, ['oui', 'non']);
  liste('Projets', 14, ['nouvelle', 'en discussion', 'acceptée', 'refusée', 'terminée']);   // colonne statut
  liste('Reservations', 10, ['nouvelle', 'confirmée', 'payée', 'prête', 'remise ou envoyée', 'annulée']);   // colonne statut
  essai('largeur de la colonne articles', () => {
    const res = ss.getSheetByName('Reservations');
    res.getRange('H:H').setWrap(true); res.setColumnWidth(8, 380);   // texte entier visible
  });
  essai('onglet Config', () => {
    const c = ss.getSheetByName('Config');
    const deja = lire_('Config').map(r => r.cle);
    [['email_reception', 'ton.email@exemple.be'], ['frais_envoi', 'Frais d’envoi communiqués par e-mail'],
     ['iban', 'BE00 0000 0000 0000'], ['titulaire', 'Willbwa'], ['contact_public', 'ton.email@exemple.be'],
     ['telephone', ''], ['commune', 'Commune d’Andenne'],
     ['conservation_reservations_mois', 12], ['conservation_messages_mois', 6], ['conservation_projets_mois', 12]
    ].forEach(d => { if (deja.indexOf(d[0]) < 0) c.appendRow(d); });
  });
  essai('feuille vide', () => { const d = ss.getSheetByName('Feuille 1'); if (d && d.getLastRow() === 0) ss.deleteSheet(d); });
  const msg = sautes.length ? 'Terminé. Réglage(s) ignoré(s) par Google : ' + sautes.join(' ; ') : 'Terminé : tout est en ordre.';
  Logger.log(msg); ss.toast(msg, 'Structure', 20);
}

/* ---------- Outils ---------- */
function lire_(nom) {
  const f = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nom);
  const v = f.getDataRange().getValues();
  const h = v.shift();
  return v.filter(r => r.some(c => c !== '')).map(r => {
    const o = {}; h.forEach((k, j) => { o[k] = r[j]; }); return o;
  });
}
function ajouter_(nom, obj) {
  const f = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nom);
  const h = f.getRange(1, 1, 1, f.getLastColumn()).getValues()[0];
  f.appendRow(h.map(k => obj[k] === undefined ? '' : obj[k]));
}
function net_(t, max) {
  t = String(t == null ? '' : t).trim().slice(0, max || 100);
  return t.replace(/^[=+\-@]+/, '').trim(); // empêche les formules dans le Sheet
}
function config_() {
  const c = {}; lire_('Config').forEach(r => { c[r.cle] = r.valeur; }); return c;
}
function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
const MOIS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
// Lit une vraie date, ou un texte comme « 11/12/2026 » ou « Vendredi 11 décembre 2026 ». Renvoie '' si illisible.
function dateIso_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, FUSEAU, 'yyyy-MM-dd');
  const t = String(v || '').toLowerCase().trim();
  if (!t) return '';
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[0];
  m = t.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  m = t.match(/(\d{1,2})\s*(?:er)?\s+([a-zéûè]+)\s+(\d{4})/);
  const i = m ? MOIS_FR.indexOf(m[2]) : -1;
  return i >= 0 ? m[3] + '-' + ('0' + (i + 1)).slice(-2) + '-' + ('0' + m[1]).slice(-2) : '';
}
function dateTxt_(d) { return dateIso_(d); }

/* ---------- Lecture publique : uniquement catalogue, marchés, infos de contact ---------- */
const oui_ = v => String(v).trim().toLowerCase() === 'oui';

// Stock d'un article : null = illimité (sur commande, ou colonne quantite vide)
function reste_(p) {
  const d = String(p.disponibilite).trim().toLowerCase();
  if (d !== 'en stock' || p.quantite === '' || p.quantite == null || isNaN(Number(p.quantite))) return null;
  return Math.max(0, Number(p.quantite));
}
function retirerStock_(id, q) {
  const f = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Catalogue');
  const v = f.getDataRange().getValues(), h = v[0];
  const ci = h.indexOf('id'), cq = h.indexOf('quantite');
  if (cq < 0) return;
  for (let i = 1; i < v.length; i++) {
    if (String(v[i][ci]) === String(id)) {
      if (v[i][cq] !== '' && !isNaN(Number(v[i][cq]))) f.getRange(i + 1, cq + 1).setValue(Math.max(0, Number(v[i][cq]) - q));
      return;
    }
  }
}

// Pièces réservées par des clients mais pas encore remises (statut ni « annulée » ni « remise ou envoyée »)
function reservesActives_() {
  const out = {};
  try {
    lire_('Reservations').forEach(r => {
      const st = String(r.statut).trim().toLowerCase();
      if (!r.ids_qte || st.indexOf('annul') === 0 || st.indexOf('remise') === 0) return;
      String(r.ids_qte).split(';').forEach(p => { const a = p.split(':'); out[a[0]] = (out[a[0]] || 0) + (Number(a[1]) || 0); });
    });
  } catch (e) {}
  return out;
}

function donneesPubliques_() {
  const cfg = config_();
  const reserves = reservesActives_();
  const catalogue = lire_('Catalogue').filter(r => oui_(r.visible)).map(r => {
    const reste = reste_(r), res = reserves[String(r.id)] || 0;
    const dispo0 = String(r.disponibilite).trim().toLowerCase();
    let dispo = dispo0, etat = dispo0 === 'ancien' ? 'ancien' : dispo0 === 'épuisé' ? 'epuise' : dispo0 === 'sur commande' ? 'commande' : 'disponible';
    if (dispo0 === 'en stock' && reste === 0) {
      if (res > 0) etat = 'reserve';                   // réservée par un client, pas encore remise : reste dans « Créations », marquée « Réservé »
      else { dispo = 'ancien'; etat = 'vendu'; }       // vendue : passe dans « Anciennes créations »
    }
    return { id: String(r.id), nom: r.nom, categorie: r.categorie, description: r.description,
      prix: dispo === 'ancien' ? 0 : Number(r.prix) || 0,   // pas de prix pour les anciennes créations
      photo: r.photo, reste: reste, disponibilite: dispo, etat: etat,
      essence: String(r.essence || ''), dimensions: String(r.dimensions || ''), finition: String(r.finition || '') };
  });
  const marches = lire_('Marches').filter(r => oui_(r.public)).map(r => ({
    date: dateIso_(r.date), date_fin: dateIso_(r.date_fin), lieu: r.lieu, horaires: r.horaires, remarque: r.remarque,
    photos: String(r.photos || '').split(/[\s,;]+/).filter(Boolean).slice(0, 12)
  })).filter(m => m.date).sort((a, b) => a.date < b.date ? -1 : 1);   // une date illisible = marché non affiché
  return { catalogue: catalogue, marches: marches, frais_envoi: cfg.frais_envoi,
    contact: { email: cfg.contact_public, telephone: cfg.telephone, commune: cfg.commune },
    conservation: { reservations: Number(cfg.conservation_reservations_mois) || 12, messages: Number(cfg.conservation_messages_mois) || 6, projets: Number(cfg.conservation_projets_mois) || 12 } };
}

/* ---------- Vitesse : le résultat est gardé en mémoire (cache) ---------- */
const CACHE_PARTS = 40000;   // taille d'un morceau (le cache limite chaque valeur à 100 Ko)
function cachePut_(txt) {
  const n = Math.ceil(txt.length / CACHE_PARTS), o = { dn: String(n) };
  for (let i = 0; i < n; i++) o['d' + i] = txt.slice(i * CACHE_PARTS, (i + 1) * CACHE_PARTS);
  CacheService.getScriptCache().putAll(o, 600);   // 10 minutes
}
function cacheGet_() {
  const c = CacheService.getScriptCache(), n = Number(c.get('dn'));
  if (!n) return null;
  const cles = []; for (let i = 0; i < n; i++) cles.push('d' + i);
  const p = c.getAll(cles); let t = '';
  for (let i = 0; i < n; i++) { if (p['d' + i] == null) return null; t += p['d' + i]; }
  return t;
}
function cacheVider_() {
  const c = CacheService.getScriptCache(), n = Number(c.get('dn')) || 0, cles = ['dn'];
  for (let i = 0; i < n; i++) cles.push('d' + i);
  c.removeAll(cles);
}
function doGet() {
  let txt = null;
  try { txt = cacheGet_(); } catch (e) {}
  if (!txt) {
    txt = JSON.stringify(donneesPubliques_());
    try { cachePut_(txt); } catch (e) {}
  }
  return ContentService.createTextOutput(txt).setMimeType(ContentService.MimeType.JSON);
}
// Modification à la main dans le Sheet : le site se met à jour tout de suite.
// Si tu mets statut = « annulée » dans Reservations, les pièces sont remises dans le Catalogue (une seule fois).
function onEdit(e) {
  try { cacheVider_(); } catch (err) {}
  try {
    const f = e && e.range && e.range.getSheet();
    if (!f || f.getName() !== 'Reservations' || e.range.getRow() < 2) return;
    const h = f.getRange(1, 1, 1, f.getLastColumn()).getValues()[0];
    if (e.range.getColumn() === h.indexOf('statut') + 1) rendreStockSiAnnulee_(f, e.range.getRow(), h);
  } catch (err) {}
}
function rendreStockSiAnnulee_(f, ligne, h) {
  const colonne = nom => { let i = h.indexOf(nom); if (i < 0) { i = h.length; f.getRange(1, i + 1).setValue(nom); h.push(nom); } return i; };   // crée la colonne si elle manque
  const si = h.indexOf('statut');
  if (si < 0 || String(f.getRange(ligne, si + 1).getValue()).toLowerCase().indexOf('annul') !== 0) return;
  const ci = colonne('ids_qte'), cr = colonne('stock_rendu');
  if (f.getRange(ligne, cr + 1).getValue() === 'oui') return;                       // déjà remis : pas de double
  const cat = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Catalogue');
  const d = cat.getDataRange().getValues(), idI = d[0].indexOf('id'), nomI = d[0].indexOf('nom'), qI = d[0].indexOf('quantite');
  if (qI < 0) return;
  const ajout = {}; let ok = true, n = 0;
  const poser = (i, q) => { if (i > 0) { ajout[i] = (ajout[i] || 0) + q; n++; } else ok = false; };
  const ids = String(f.getRange(ligne, ci + 1).getValue() || '');
  if (ids) {                                                                        // réservations récentes : « id:quantité;id:quantité »
    ids.split(';').forEach(p => { const a = p.split(':'); poser(d.findIndex((r, k) => k > 0 && String(r[idI]) === a[0]), Number(a[1])); });
  } else {                                                                          // anciennes réservations (tests) : on relit le texte de la colonne articles
    String(f.getRange(ligne, h.indexOf('articles') + 1).getValue() || '').split('\n').forEach(t => {
      const m = t.match(/^\s*(\d+)\s×\s(.+?)\s\(\d+[.,]\d{2}\s€\)/);
      if (m) poser(d.findIndex((r, k) => k > 0 && String(r[nomI]).trim() === m[2].trim()), Number(m[1]));
    });
  }
  Object.keys(ajout).forEach(i => {
    const cur = d[i][qI];
    if (cur !== '' && !isNaN(Number(cur))) cat.getRange(Number(i) + 1, qI + 1).setValue(Number(cur) + ajout[i]);
  });
  f.getRange(ligne, cr + 1).setValue(ok && n ? 'oui' : 'à vérifier à la main');
  cacheVider_();
}
// À lancer à la main si besoin : traite toutes les réservations « annulée » dont les pièces n'ont pas encore été remises
function rendreStockDesAnnulees() {
  const ss = SpreadsheetApp.getActiveSpreadsheet(), f = ss.getSheetByName('Reservations');
  const h = f.getRange(1, 1, 1, f.getLastColumn()).getValues()[0];
  for (let r = 2; r <= f.getLastRow(); r++) rendreStockSiAnnulee_(f, r, h);
  ss.toast('Terminé : regarde la colonne stock_rendu et le Catalogue.', 'Réservations', 10);
}
function rechaufferCache() { cacheVider_(); doGet(); }      // lancé toutes les 5 minutes : le serveur reste « chaud » et rapide
function installerDeclencheur() {                           // À LANCER UNE SEULE FOIS (et après chaque mise à jour de ce fichier si on te le demande)
  ScriptApp.getProjectTriggers().forEach(t => { if (['rechaufferCache', 'nettoyerDonnees'].indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('rechaufferCache').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('nettoyerDonnees').timeBased().everyDays(1).atHour(3).create();
}

/* ---------- Écriture : réservation et contact ---------- */
function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.piege) return json_({ ok: true });                       // robot : on fait semblant
    const email = net_(d.email, 120).toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Adresse e-mail invalide.');
    const cache = CacheService.getScriptCache();
    const cle = 'rl_' + email;
    if (cache.get(cle)) throw new Error('Une demande vient d’être envoyée. Réessaie dans quelques minutes.');
    cache.put(cle, '1', 120);
    const verrou = LockService.getScriptLock(); verrou.waitLock(15000);
    try {
      return json_(d.type === 'contact' ? contact_(d, email) : d.type === 'projet' ? projet_(d, email) : reservation_(d, email));
    } finally { verrou.releaseLock(); }
  } catch (err) {
    return json_({ ok: false, erreur: err.message });
  }
}

function contact_(d, email) {
  const nom = net_(d.nom, 80), msg = net_(d.message, 1500);
  if (!nom || !msg) throw new Error('Nom et message obligatoires.');
  ajouter_('Messages', { date_heure: new Date(), nom: nom, email: email, message: msg });
  MailApp.sendEmail({ to: config_().email_reception, replyTo: email,
    subject: 'Willbwa : message de ' + nom, body: msg + '\n\n' + email });
  return { ok: true };
}

function reservation_(d, email) {
  const cfg = config_();
  const client = net_(d.client, 80);
  const remise = ['marche', 'domicile', 'envoi'].indexOf(d.remise) >= 0 ? d.remise : '';
  if (!client || !remise) throw new Error('Prénom et mode de remise obligatoires.');
  const cat = {}; lire_('Catalogue').filter(r => oui_(r.visible)).forEach(r => { cat[String(r.id)] = r; });
  const lignes = (d.articles || []).slice(0, 40).map(a => {
    const p = cat[String(a.id)]; const q = Number(a.quantite);
    if (!p || ['ancien', 'épuisé'].indexOf(String(p.disponibilite).trim().toLowerCase()) >= 0 || !Number.isInteger(q) || q < 1 || q > 99) throw new Error('Article invalide dans la sélection.');
    const reste = reste_(p);
    if (reste !== null && q > reste) throw new Error(reste === 0 ? '« ' + p.nom + ' » n’est plus disponible.' : 'Il ne reste que ' + reste + ' × « ' + p.nom + ' ».');
    return { id: String(p.id), nom: p.nom, q: q, prix: Number(p.prix) || 0, com: net_(a.commentaire, 200) };
  });
  if (!lignes.length) throw new Error('Ta sélection est vide.');       // le prix vient du Sheet, jamais du navigateur
  const total = lignes.reduce((s, l) => s + l.q * l.prix, 0);
  const txt = lignes.map(l => l.q + ' × ' + l.nom + ' (' + (l.q * l.prix).toFixed(2) + ' €)' + (l.com ? ' — précision : ' + l.com : '')).join('\n');
  const marche = remise === 'marche' ? net_(d.marche, 120) : '', adresse = remise === 'envoi' ? net_(d.adresse, 250) : '';   // on ne garde que ce qui concerne le mode choisi
  const LIB = { marche: 'Retrait à un marché', domicile: 'Retrait chez Willbwa (pas à un marché)', envoi: 'Envoi par la poste' };
  if (remise === 'marche' && !marche) throw new Error('Choisis un marché.');
  if (remise === 'envoi' && !adresse) throw new Error('Indique ton adresse pour l’envoi.');
  ajouter_('Reservations', { date_heure: new Date(), client: client, email: email,
    telephone: net_(d.telephone, 30), remise: LIB[remise], marche: marche, adresse: adresse,
    articles: txt, total: total, statut: 'nouvelle', note: net_(d.note, 500),
    ids_qte: lignes.map(l => l.id + ':' + l.q).join(';'), stock_rendu: '' });
  lignes.forEach(l => retirerStock_(l.id, l.q));   // la pièce est mise de côté pour ce client
  cacheVider_();
  const resume = txt + '\nTotal articles : ' + total.toFixed(2) + ' €';
  let pdf = null;
  try { pdf = reservationPdf_({ client: client, email: email, tel: net_(d.telephone, 30), remise: LIB[remise], marche: marche, adresse: adresse, lignes: lignes, note: net_(d.note, 500) }); } catch (err) { console.error(err); }
  const mail = { to: cfg.email_reception, replyTo: email,
    subject: 'Willbwa : nouvelle réservation de ' + client,
    body: resume + '\n\n' + LIB[remise] + (marche ? ' : ' + marche : '') +
      (adresse ? '\nAdresse : ' + adresse : '') + '\nE-mail : ' + email + (net_(d.telephone, 30) ? '\nTéléphone : ' + net_(d.telephone, 30) : '') +
      (net_(d.note, 500) ? '\nMessage : ' + net_(d.note, 500) : '') + '\n\nLe PDF joint est à imprimer.' };
  if (pdf) mail.attachments = [pdf];
  MailApp.sendEmail(mail);
  MailApp.sendEmail({ to: email, replyTo: cfg.email_reception, name: 'Willbwa',
    subject: 'Willbwa : ta demande de réservation',
    body: 'Bonjour ' + client + ',\n\nMerci ! Voici ta demande :\n' + resume +
      '\n\nCe n’est pas encore une commande : je te réponds rapidement pour la confirmer.\n\nWillbwa · ' + SITE_URL,
    htmlBody: mailClientHtml_(cfg, client, lignes, remise, marche, adresse, net_(d.note, 500)) });
  return { ok: true };
}

// Test : envoie une réservation fictive (supprime ensuite la ligne dans Reservations)
function testerReservation() {
  const c = lire_('Catalogue')[0];
  Logger.log(reservation_({ client: 'Test', remise: 'domicile', articles: [{ id: c.id, quantite: 1 }] }, 'ton.email@exemple.be'));
}

/* ---------- Joli e-mail de confirmation pour le client ---------- */
function escH_(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function mailClientHtml_(cfg, client, lignes, remise, marche, adresse, note) {
  const e = escH_, eur = x => x.toFixed(2).replace('.', ',') + ' €';
  const F = 'font-family:Arial,Helvetica,sans-serif;';
  const total = lignes.reduce((s, l) => s + l.q * l.prix, 0);
  const lig = lignes.map(l => '<tr><td style="' + F + 'padding:10px 0;border-bottom:1px solid #e8dac2;font-size:15px;color:#3a2616">' + l.q + ' × <b>' + e(l.nom) + '</b>' +
    (l.com ? '<br><span style="font-size:13px;color:#6f5a45">Précision : ' + e(l.com) + '</span>' : '') + '</td>' +
    '<td align="right" style="' + F + 'padding:10px 0;border-bottom:1px solid #e8dac2;font-size:15px;color:#3a2616;white-space:nowrap">' + eur(l.q * l.prix) + '</td></tr>').join('');
  const suite = remise === 'marche' ? 'Je te retrouve au marché <b>' + e(marche) + '</b>. Tu paies sur place : pense à prendre du liquide.'
    : remise === 'domicile' ? 'Tu viens chercher ta commande chez moi : on convient ensemble d’un moment, et tu paies sur place.'
    : 'Ta commande sera envoyée par la poste. Je te donne les frais d’envoi et mon numéro de compte pour le virement dans mon prochain message' + (adresse ? ' (adresse d’envoi : ' + e(adresse) + ')' : '') + '.';
  const ligneContact = (nom, val) => val ? '<tr><td style="' + F + 'padding:3px 14px 3px 0;font-size:14px;color:#6f5a45">' + nom + '</td><td style="' + F + 'padding:3px 0;font-size:14px;color:#3a2616">' + val + '</td></tr>' : '';
  const bouton = (url, txt, fond, texte) => '<a href="' + url + '" style="' + F + 'display:inline-block;padding:12px 22px;margin:4px 6px 4px 0;border-radius:6px;background:' + fond + ';color:' + texte + ';font-size:15px;font-weight:bold;text-decoration:none">' + txt + '</a>';
  const tel = String(cfg.telephone || '').trim();
  return '<div style="background:#f5e9d6;padding:24px 10px"><table role="presentation" align="center" width="100%" style="max-width:600px;margin:auto;border-collapse:collapse;background:#fbf5ea;border-radius:8px;overflow:hidden">' +
    '<tr><td style="background:#4a3320;padding:20px 24px"><table role="presentation" style="border-collapse:collapse"><tr>' +
    '<td style="padding-right:16px"><img src="' + SITE_URL + 'logo.png" width="64" height="64" alt="Willbwa" style="display:block;border-radius:6px"></td>' +
    '<td><div style="' + F + 'font-size:26px;font-weight:bold;color:#f3ead8">Willbwa</div><div style="' + F + 'font-size:13px;color:#e0d2b8">Créations artisanales en bois</div></td></tr></table></td></tr>' +
    '<tr><td style="padding:26px 24px 8px"><div style="' + F + 'font-size:20px;font-weight:bold;color:#3a2616">Merci ' + e(client) + ' !</div>' +
    '<p style="' + F + 'font-size:15px;line-height:1.5;color:#3a2616;margin:10px 0 0">J’ai bien reçu ta demande de réservation. La voici :</p></td></tr>' +
    '<tr><td style="padding:6px 24px"><table role="presentation" width="100%" style="border-collapse:collapse">' + lig +
    '<tr><td style="' + F + 'padding:12px 0;font-size:16px;font-weight:bold;color:#3a2616">Total</td><td align="right" style="' + F + 'padding:12px 0;font-size:16px;font-weight:bold;color:#6b3d1c">' + eur(total) + '</td></tr></table></td></tr>' +
    '<tr><td style="padding:6px 24px"><p style="' + F + 'font-size:15px;line-height:1.5;color:#3a2616;margin:6px 0">' + suite + '</p>' +
    (note ? '<p style="' + F + 'font-size:14px;line-height:1.5;color:#6f5a45;margin:6px 0">Ton message : ' + e(note) + '</p>' : '') + '</td></tr>' +
    '<tr><td style="padding:10px 24px"><div style="' + F + 'background:#f1e3cb;border-radius:6px;padding:12px 14px;font-size:14px;line-height:1.5;color:#6b3d1c">Ce n’est pas encore une commande : je te réponds très vite pour la confirmer. Tu peux répondre directement à ce message.</div></td></tr>' +
    '<tr><td style="padding:14px 24px 4px"><div style="' + F + 'font-size:15px;font-weight:bold;color:#3a2616;margin-bottom:6px">Me contacter</div><table role="presentation" style="border-collapse:collapse">' +
    ligneContact('Téléphone', tel ? '<a href="tel:' + e(tel.replace(/[^\d+]/g, '')) + '" style="color:#6b3d1c">' + e(tel) + '</a>' : '') +
    ligneContact('E-mail', cfg.contact_public ? '<a href="mailto:' + e(cfg.contact_public) + '" style="color:#6b3d1c">' + e(cfg.contact_public) + '</a>' : '') +
    ligneContact('Localisation', cfg.commune ? e(cfg.commune) : '') + '</table></td></tr>' +
    '<tr><td style="padding:12px 24px 26px">' + bouton(SITE_URL, 'Voir le site', '#b9822f', '#1b1208') + bouton(INSTA_URL, 'Instagram @artisan_willbwa', '#6b3d1c', '#ffffff') + '</td></tr>' +
    '</table><p style="' + F + 'text-align:center;font-size:12px;color:#6f5a45;margin:14px 0 0">Tu reçois ce message parce que tu as fait une demande de réservation sur ' + SITE_URL.replace('https://', '') + '</p></div>';
}

/* ---------- PDF de la réservation, à imprimer (joint au mail que tu reçois) ---------- */
function reservationPdf_(r) {
  const e = escH_, eur = x => x.toFixed(2).replace('.', ',') + ' €';
  const td = (t, al, st) => '<td style="padding:7px 8px;border-bottom:1px solid #e0cfb4;font-size:13px;text-align:' + (al || 'left') + ';' + (st || '') + '">' + t + '</td>';
  const th = (t, al) => '<th style="padding:7px 8px;background:#6B3D1C;color:#fff;font-size:12px;text-align:' + (al || 'left') + '">' + t + '</th>';
  const total = r.lignes.reduce((s, l) => s + l.q * l.prix, 0);
  const lig = r.lignes.map(l => '<tr>' + td(l.q, 'right') + td('<b>' + e(l.nom) + '</b>' + (l.com ? '<br><span style="color:#B3401F">Précision : ' + e(l.com) + '</span>' : '')) + td(eur(l.prix), 'right') + td(eur(l.q * l.prix), 'right') + '</tr>').join('');
  const info = (a, b) => b ? '<tr><td style="padding:3px 14px 3px 0;font-size:13px;color:#6F5A45">' + a + '</td><td style="padding:3px 0;font-size:13px"><b>' + e(b) + '</b></td></tr>' : '';
  const coche = t => '<tr><td style="width:16px;height:16px;border:1.5px solid #333"></td><td style="padding:0 0 0 10px;font-size:13px">' + t + '</td></tr><tr><td colspan="2" style="height:10px"></td></tr>';
  const html = '<body style="font-family:Arial,sans-serif;color:#3A2616;margin:28px">' +
    '<h1 style="font-size:24px;margin:0;color:#6B3D1C">Willbwa · Réservation</h1>' +
    '<p style="margin:4px 0 20px;font-size:12px;color:#6F5A45">Reçue le ' + Utilities.formatDate(new Date(), FUSEAU, 'dd/MM/yyyy à HH:mm') + '</p>' +
    '<table style="border-collapse:collapse;margin-bottom:18px">' + info('Client', r.client) + info('E-mail', r.email) + info('Téléphone', r.tel) +
    info('Remise', r.remise) + info('Marché', r.marche) + info('Adresse d’envoi', r.adresse) + info('Message', r.note) + '</table>' +
    '<table style="width:100%;border-collapse:collapse"><tr>' + th('Qté', 'right') + th('Article') + th('Prix', 'right') + th('Total', 'right') + '</tr>' + lig +
    '<tr>' + td('', '') + td('<b>Total des articles</b>') + td('') + td('<b>' + eur(total) + '</b>', 'right') + '</tr></table>' +
    '<h3 style="font-size:15px;margin:26px 0 10px">À faire</h3><table style="border-collapse:collapse">' +
    coche('Réservation confirmée au client par e-mail') + coche('Paiement reçu (sur place ou virement)') + coche('Remis au client ou envoyé') +
    coche('Vente notée dans SWA : Vendre, lieu « Réservation du site »') + '</table></body>';
  return Utilities.newBlob(html, 'text/html', 'reservation.html').getAs('application/pdf')
    .setName(('Reservation ' + r.client + ' ' + Utilities.formatDate(new Date(), FUSEAU, 'yyyy-MM-dd')).replace(/[\\\/:*?"<>|]/g, '-') + '.pdf');
}

/* ---------- Cadre commun des jolis e-mails ---------- */
function mailCadre_(cfg, contenu) {
  const e = escH_, F = 'font-family:Arial,Helvetica,sans-serif;';
  const ligneContact = (nom, val) => val ? '<tr><td style="' + F + 'padding:3px 14px 3px 0;font-size:14px;color:#6f5a45">' + nom + '</td><td style="' + F + 'padding:3px 0;font-size:14px;color:#3a2616">' + val + '</td></tr>' : '';
  const bouton = (url, txt, fond, texte) => '<a href="' + url + '" style="' + F + 'display:inline-block;padding:12px 22px;margin:4px 6px 4px 0;border-radius:6px;background:' + fond + ';color:' + texte + ';font-size:15px;font-weight:bold;text-decoration:none">' + txt + '</a>';
  const tel = String(cfg.telephone || '').trim();
  return '<div style="background:#f5e9d6;padding:24px 10px"><table role="presentation" align="center" width="100%" style="max-width:600px;margin:auto;border-collapse:collapse;background:#fbf5ea;border-radius:8px;overflow:hidden">' +
    '<tr><td style="background:#4a3320;padding:20px 24px"><table role="presentation" style="border-collapse:collapse"><tr>' +
    '<td style="padding-right:16px"><img src="' + SITE_URL + 'logo.png" width="64" height="64" alt="Willbwa" style="display:block;border-radius:6px"></td>' +
    '<td><div style="' + F + 'font-size:26px;font-weight:bold;color:#f3ead8">Willbwa</div><div style="' + F + 'font-size:13px;color:#e0d2b8">Créations artisanales en bois</div></td></tr></table></td></tr>' +
    contenu +
    '<tr><td style="padding:14px 24px 4px"><div style="' + F + 'font-size:15px;font-weight:bold;color:#3a2616;margin-bottom:6px">Me contacter</div><table role="presentation" style="border-collapse:collapse">' +
    ligneContact('Téléphone', tel ? '<a href="tel:' + e(tel.replace(/[^\d+]/g, '')) + '" style="color:#6b3d1c">' + e(tel) + '</a>' : '') +
    ligneContact('E-mail', cfg.contact_public ? '<a href="mailto:' + e(cfg.contact_public) + '" style="color:#6b3d1c">' + e(cfg.contact_public) + '</a>' : '') +
    ligneContact('Localisation', cfg.commune ? e(cfg.commune) : '') + '</table></td></tr>' +
    '<tr><td style="padding:12px 24px 26px">' + bouton(SITE_URL, 'Voir le site', '#b9822f', '#1b1208') + bouton(INSTA_URL, 'Instagram @artisan_willbwa', '#6b3d1c', '#ffffff') + '</td></tr>' +
    '</table><p style="' + F + 'text-align:center;font-size:12px;color:#6f5a45;margin:14px 0 0">Tu reçois ce message parce que tu as fait une demande sur ' + SITE_URL.replace('https://', '') + '</p></div>';
}

/* ---------- Demandes de projet : création personnalisée à partir d'une pièce, ou projet imaginé ensemble ---------- */
function projet_(d, email) {
  const cfg = config_(), creation = d.mode === 'creation';
  const LONG = { prenom: 80, creation: 120, projet: 150, usage: 400, modification: 1500, description: 2000, dimensions: 150, bois: 150, budget: 80 };
  const t = n => net_(d[n], LONG[n]);
  const prenom = t('prenom');
  if (!prenom) throw new Error('Indique ton prénom.');
  if (creation && !t('modification')) throw new Error('Dis-moi ce que tu aimerais modifier.');
  if (!creation && (!t('projet') || !t('description'))) throw new Error('Indique ton projet et décris ton idée.');
  // photos : 3 maximum, images seulement, enregistrées dans ton Drive (dossier « Willbwa projets », privé)
  const blobs = [];
  (Array.isArray(d.photos) ? d.photos : []).slice(0, 3).forEach((p, i) => {
    const m = String(p).match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+\/=]+)$/);
    if (!m) return;
    const o = Utilities.base64Decode(m[2]);
    if (o.length > 2500000) throw new Error('Une photo est trop lourde.');
    const ok = (o[0] === -1 && o[1] === -40) || (o[0] === -119 && o[1] === 80) || (o[0] === 82 && o[1] === 73);   // JPEG, PNG, WEBP
    if (!ok) return;
    blobs.push(Utilities.newBlob(o, m[1], 'projet-' + prenom.replace(/[^\w]+/g, '') + '-' + (i + 1) + '.' + (m[1] === 'image/png' ? 'png' : m[1] === 'image/webp' ? 'webp' : 'jpg')));
  });
  const liens = [];
  if (blobs.length) {
    const it = DriveApp.getFoldersByName('Willbwa projets'), dossier = it.hasNext() ? it.next() : DriveApp.createFolder('Willbwa projets');
    blobs.forEach(b => liens.push(dossier.createFile(b).getUrl()));
  }
  const infos = [['Type', creation ? 'Création personnalisée à partir d’une pièce' : 'Projet à imaginer ensemble'], ['Création de départ', creation ? t('creation') : ''],
    ['Projet', t('projet')], ['À quoi servirait-il', t('usage')], ['À modifier', t('modification')], ['Description', t('description')],
    ['Dimensions', t('dimensions')], ['Bois souhaité', t('bois')], ['Budget approximatif', t('budget')], ['Photos', blobs.length ? blobs.length + ' (jointes à ce mail)' : '']].filter(x => x[1]);
  ajouter_('Projets', { date_heure: new Date(), type: creation ? 'Personnalisé' : 'Projet à imaginer', creation: creation ? t('creation') : '', prenom: prenom, email: email,
    projet: t('projet'), usage: t('usage'), modification: t('modification'), description: t('description'), dimensions: t('dimensions'),
    bois: t('bois'), budget: t('budget'), photos: liens.join('\n'), statut: 'nouvelle' });
  let pdf = null;
  try { pdf = projetPdf_(prenom, email, infos); } catch (err) { console.error(err); }
  const pj = blobs.slice(); if (pdf) pj.unshift(pdf);
  const mail = { to: cfg.email_reception, replyTo: email, subject: 'Willbwa : demande de projet de ' + prenom,
    body: infos.map(x => x[0] + ' : ' + x[1]).join('\n') + '\n\nE-mail : ' + email + '\n\nLe PDF joint est à imprimer.' };
  if (pj.length) mail.attachments = pj;
  MailApp.sendEmail(mail);
  const F = 'font-family:Arial,Helvetica,sans-serif;', e = escH_;
  const lignes = infos.map(x => '<tr><td style="' + F + 'padding:6px 12px 6px 0;font-size:13px;color:#6f5a45;vertical-align:top;white-space:nowrap">' + e(x[0]) + '</td><td style="' + F + 'padding:6px 0;font-size:14px;color:#3a2616">' + e(x[1]).replace(/\n/g, '<br>') + '</td></tr>').join('');
  const contenu = '<tr><td style="padding:26px 24px 8px"><div style="' + F + 'font-size:20px;font-weight:bold;color:#3a2616">Merci ' + e(prenom) + ' !</div>' +
    '<p style="' + F + 'font-size:15px;line-height:1.5;color:#3a2616;margin:10px 0 0">J’ai bien reçu ta demande de projet. Voici ce que tu m’as indiqué :</p></td></tr>' +
    '<tr><td style="padding:6px 24px"><table role="presentation" style="border-collapse:collapse">' + lignes + '</table></td></tr>' +
    '<tr><td style="padding:10px 24px"><div style="' + F + 'background:#f1e3cb;border-radius:6px;padding:12px 14px;font-size:14px;line-height:1.5;color:#6b3d1c">Ceci est une <b>demande de projet</b>, pas une commande. Je regarde si c’est réalisable (et dans quel budget), puis je te réponds par e-mail. Il se peut aussi que ce ne soit pas possible : tu ne t’engages à rien avant que nous soyons d’accord. Tu peux répondre directement à ce message.</div></td></tr>';
  MailApp.sendEmail({ to: email, replyTo: cfg.email_reception, name: 'Willbwa', subject: 'Willbwa : ta demande de projet',
    body: 'Bonjour ' + prenom + ',\n\nMerci ! J’ai bien reçu ta demande de projet :\n' + infos.map(x => x[0] + ' : ' + x[1]).join('\n') +
      '\n\nCeci est une demande de projet, pas une commande : je regarde si c’est réalisable (et dans quel budget) puis je te réponds par e-mail.\n\nWillbwa · ' + SITE_URL,
    htmlBody: mailCadre_(cfg, contenu) });
  return { ok: true };
}

function projetPdf_(prenom, email, infos) {
  const e = escH_;
  const info = (a, b) => '<tr><td style="padding:4px 14px 4px 0;font-size:13px;color:#6F5A45;vertical-align:top;white-space:nowrap">' + e(a) + '</td><td style="padding:4px 0;font-size:13px"><b>' + e(b).replace(/\n/g, '<br>') + '</b></td></tr>';
  const coche = t => '<tr><td style="width:16px;height:16px;border:1.5px solid #333"></td><td style="padding:0 0 0 10px;font-size:13px">' + t + '</td></tr><tr><td colspan="2" style="height:10px"></td></tr>';
  const html = '<body style="font-family:Arial,sans-serif;color:#3A2616;margin:28px"><h1 style="font-size:24px;margin:0;color:#6B3D1C">Willbwa · Demande de projet</h1>' +
    '<p style="margin:4px 0 20px;font-size:12px;color:#6F5A45">Reçue le ' + Utilities.formatDate(new Date(), FUSEAU, 'dd/MM/yyyy à HH:mm') + '</p>' +
    '<table style="border-collapse:collapse;margin-bottom:18px">' + info('Prénom', prenom) + info('E-mail', email) + infos.map(x => info(x[0], x[1])).join('') + '</table>' +
    '<h3 style="font-size:15px;margin:26px 0 10px">À faire</h3><table style="border-collapse:collapse">' +
    coche('Répondu au client (réalisable ou non, budget)') + coche('Devis ou prix envoyé') + coche('Accord du client') + coche('Terminé et remis (puis noter la vente dans SWA)') + '</table></body>';
  return Utilities.newBlob(html, 'text/html', 'projet.html').getAs('application/pdf').setName(('Projet ' + prenom + ' ' + Utilities.formatDate(new Date(), FUSEAU, 'yyyy-MM-dd')).replace(/[\\\/:*?"<>|]/g, '-') + '.pdf');
}

/* ---------- Effacement automatique des données personnelles (lancé chaque nuit par le minuteur) ---------- */
function nettoyerDonnees() {
  const cfg = config_(), ss = SpreadsheetApp.getActiveSpreadsheet(), resume = [];
  const mois = k => Number(cfg[k]) > 0 ? Number(cfg[k]) : 0;
  const avant = n => { const d = new Date(); d.setMonth(d.getMonth() - n); return d; };
  const traiter = (nom, cle, perso, estFinal, supprimerLigne, colPhotos) => {
    const n = mois(cle), f = ss.getSheetByName(nom);
    if (!n || !f || f.getLastRow() < 2) return;
    const v = f.getDataRange().getValues(), h = v[0], di = h.indexOf('date_heure'), si = h.indexOf('statut');
    const s1 = avant(n), s2 = avant(2 * n); let c = 0;
    for (let i = v.length - 1; i >= 1; i--) {                        // de bas en haut : supprimer une ligne ne décale pas les suivantes
      const date = v[i][di];
      if (!(date instanceof Date)) continue;
      const final = si < 0 ? true : estFinal(String(v[i][si]).trim().toLowerCase());
      if (!(date < s2 || (final && date < s1))) continue;            // pas encore l'heure
      if (supprimerLigne) { f.deleteRow(i + 1); c++; continue; }
      if (String(v[i][h.indexOf(perso[0])]) === '(supprimé)') continue;   // déjà fait
      if (colPhotos) String(v[i][h.indexOf(colPhotos)]).split(/\s+/).forEach(u => { const m = u.match(/[-\w]{25,}/); if (m) { try { DriveApp.getFileById(m[0]).setTrashed(true); } catch (err) {} } });
      perso.forEach((k, j) => { const ci = h.indexOf(k); if (ci >= 0) f.getRange(i + 1, ci + 1).setValue(j === 0 ? '(supprimé)' : ''); });
      if (colPhotos) f.getRange(i + 1, h.indexOf(colPhotos) + 1).setValue('');
      c++;
    }
    if (c) resume.push(nom + ' : ' + c);
  };
  // réservations : on efface les données personnelles et on garde les articles et totaux (pour tes statistiques)
  traiter('Reservations', 'conservation_reservations_mois', ['client', 'email', 'telephone', 'adresse', 'note'], s => /^(remise|annul)/.test(s), false, null);
  traiter('Projets', 'conservation_projets_mois', ['prenom', 'email', 'projet', 'usage', 'modification', 'description'], s => /^(accept|refus|termin)/.test(s), false, 'photos');
  traiter('Messages', 'conservation_messages_mois', [], () => true, true, null);
  Logger.log(resume.length ? 'Effacé : ' + resume.join(' ; ') : 'Rien à effacer.');
}
