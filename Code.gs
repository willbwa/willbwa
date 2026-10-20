/***** WILLBWA : SERVEUR (Sheet + Apps Script) *****/
const FUSEAU = 'Europe/Brussels';

const ONGLETS = {
  Catalogue: ['id', 'nom', 'categorie', 'description', 'prix', 'photo', 'disponibilite', 'visible'],
  Marches: ['date', 'lieu', 'horaires', 'remarque', 'public', 'photos'],
  Reservations: ['date_heure', 'client', 'email', 'telephone', 'remise', 'marche', 'adresse', 'articles', 'total', 'statut', 'note'],
  Messages: ['date_heure', 'nom', 'email', 'message'],
  Config: ['cle', 'valeur']
};

// À lancer UNE FOIS : crée les onglets
function creerStructure() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(ONGLETS).forEach(nom => {
    const f = ss.getSheetByName(nom) || ss.insertSheet(nom);
    f.getRange(1, 1, 1, ONGLETS[nom].length).setValues([ONGLETS[nom]])
      .setFontWeight('bold').setBackground('#d9ead3');
    f.setFrozenRows(1);
  });
  // Listes déroulantes : évitent les erreurs de saisie (ex. « oui » attendu)
  const liste = (nom, col, vals) => ss.getSheetByName(nom).getRange(2, col, 500, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(vals, true).setAllowInvalid(false).build());
  liste('Catalogue', 7, ['en stock', 'sur commande', 'épuisé', 'ancien']);
  liste('Catalogue', 8, ['oui', 'non']);
  liste('Marches', 5, ['oui', 'non']);
  const c = ss.getSheetByName('Config');
  const deja = lire_('Config').map(r => r.cle);
  [['email_reception', 'ton.email@exemple.be'], ['frais_envoi', 'Frais d’envoi communiqués par e-mail'],
   ['iban', 'BE00 0000 0000 0000'], ['titulaire', 'Willbwa'], ['contact_public', 'ton.email@exemple.be'],
   ['telephone', ''], ['commune', 'Commune d’Andenne']
  ].forEach(d => { if (deja.indexOf(d[0]) < 0) c.appendRow(d); });
  const d = ss.getSheetByName('Feuille 1');
  if (d && d.getLastRow() === 0) ss.deleteSheet(d);
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
function dateTxt_(d) {
  return d instanceof Date ? Utilities.formatDate(d, FUSEAU, 'yyyy-MM-dd') : String(d);
}

/* ---------- Lecture publique : uniquement catalogue, marchés, infos de contact ---------- */
const oui_ = v => String(v).trim().toLowerCase() === 'oui';

function doGet() {
  const cfg = config_();
  const catalogue = lire_('Catalogue').filter(r => oui_(r.visible)).map(r => {
    const dispo = String(r.disponibilite).trim().toLowerCase();
    return { id: String(r.id), nom: r.nom, categorie: r.categorie, description: r.description,
      prix: dispo === 'ancien' ? 0 : Number(r.prix) || 0,   // pas de prix pour les anciennes créations
      photo: r.photo, disponibilite: dispo };
  });
  const marches = lire_('Marches').filter(r => oui_(r.public)).map(r => ({
    date: dateTxt_(r.date), lieu: r.lieu, horaires: r.horaires, remarque: r.remarque,
    photos: String(r.photos || '').split(/[\s,;]+/).filter(Boolean).slice(0, 12)
  })).sort((a, b) => a.date < b.date ? -1 : 1);
  return json_({ catalogue: catalogue, marches: marches, frais_envoi: cfg.frais_envoi,
    contact: { email: cfg.contact_public, telephone: cfg.telephone, commune: cfg.commune } });
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
      return json_(d.type === 'contact' ? contact_(d, email) : reservation_(d, email));
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
    return { nom: p.nom, q: q, prix: Number(p.prix) || 0 };
  });
  if (!lignes.length) throw new Error('Ta sélection est vide.');       // le prix vient du Sheet, jamais du navigateur
  const total = lignes.reduce((s, l) => s + l.q * l.prix, 0);
  const txt = lignes.map(l => l.q + ' × ' + l.nom + ' (' + (l.q * l.prix).toFixed(2) + ' €)').join('\n');
  const marche = net_(d.marche, 120), adresse = net_(d.adresse, 250);
  if (remise === 'marche' && !marche) throw new Error('Choisis un marché.');
  if (remise === 'envoi' && !adresse) throw new Error('Indique ton adresse pour l’envoi.');
  ajouter_('Reservations', { date_heure: new Date(), client: client, email: email,
    telephone: net_(d.telephone, 30), remise: remise, marche: marche, adresse: adresse,
    articles: txt, total: total, statut: 'nouvelle', note: net_(d.note, 500) });
  const resume = txt + '\nTotal articles : ' + total.toFixed(2) + ' €';
  MailApp.sendEmail({ to: cfg.email_reception, replyTo: email,
    subject: 'Willbwa : nouvelle réservation de ' + client,
    body: resume + '\n\nRemise : ' + remise + (marche ? ' (' + marche + ')' : '') +
      (adresse ? '\nAdresse : ' + adresse : '') + '\nE-mail : ' + email });
  MailApp.sendEmail({ to: email, replyTo: cfg.email_reception,
    subject: 'Willbwa : ta demande de réservation',
    body: 'Bonjour ' + client + ',\n\nMerci ! Voici ta demande :\n' + resume +
      '\n\nCe n’est pas encore une commande : je te réponds rapidement pour la confirmer' +
      (remise === 'envoi' ? ', avec les frais d’envoi et mon numéro de compte pour le virement.' : '. Le paiement se fait sur place.') +
      '\n\nWillbwa' });
  return { ok: true };
}

// Test : envoie une réservation fictive (supprime ensuite la ligne dans Reservations)
function testerReservation() {
  const c = lire_('Catalogue')[0];
  Logger.log(reservation_({ client: 'Test', remise: 'domicile', articles: [{ id: c.id, quantite: 1 }] }, 'ton.email@exemple.be'));
}
