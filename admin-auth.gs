/**
 * Willbwa — authentification de l'espace privé.
 *
 * À intégrer au routeur privé avant d'exposer une quelconque donnée.
 * Ne jamais appeler ces fonctions depuis les routes publiques du site.
 *
 * Configuration : exécuter configurerAccesPrive(clientId, comptes) une fois
 * depuis l'éditeur Apps Script. Les valeurs sont conservées dans Script Properties.
 */
function configurerAccesPrive(clientId, comptesAutorises) {
  const id = String(clientId || '').trim();
  const comptes = Array.isArray(comptesAutorises)
    ? comptesAutorises.map(function (e) { return String(e || '').trim().toLowerCase(); }).filter(Boolean)
    : [];
  if (!id || id.indexOf('.apps.googleusercontent.com') < 0) {
    throw new Error('Identifiant OAuth Google invalide.');
  }
  if (!comptes.length || comptes.some(function (e) {
    return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  })) {
    throw new Error('La liste des comptes autorisés est invalide.');
  }
  PropertiesService.getScriptProperties().setProperties({
    WILLBWA_ADMIN_OAUTH_CLIENT_ID: id,
    WILLBWA_ADMIN_ALLOWED_EMAILS: JSON.stringify(Array.from(new Set(comptes)))
  }, false);
  return 'Configuration enregistrée. Aucun compte ni identifiant n’est affiché dans les journaux.';
}

/**
 * Vérifie un jeton Google Identity Services et renvoie le compte autorisé.
 * À appeler côté serveur pour CHAQUE requête privée, avant tout accès Sheet/Drive.
 */
function verifierAccesPrive_(idToken) {
  const token = String(idToken || '').trim();
  if (!token || token.length > 10000) throw new Error('Connexion requise.');

  const props = PropertiesService.getScriptProperties();
  const clientId = props.getProperty('WILLBWA_ADMIN_OAUTH_CLIENT_ID');
  const rawAllowed = props.getProperty('WILLBWA_ADMIN_ALLOWED_EMAILS');
  if (!clientId || !rawAllowed) throw new Error('Connexion privée non configurée.');

  let allowed;
  try { allowed = JSON.parse(rawAllowed); } catch (e) { throw new Error('Configuration privée invalide.'); }
  if (!Array.isArray(allowed)) throw new Error('Configuration privée invalide.');

  const response = UrlFetchApp.fetch(
    'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token),
    { muteHttpExceptions: true, followRedirects: false }
  );
  if (response.getResponseCode() !== 200) throw new Error('Connexion Google invalide.');
  let claims;
  try { claims = JSON.parse(response.getContentText()); } catch (e) { throw new Error('Connexion Google invalide.'); }

  const expiresAt = Number(claims.exp);
  const email = String(claims.email || '').trim().toLowerCase();
  const verified = claims.email_verified === true || String(claims.email_verified).toLowerCase() === 'true';
  const issuer = String(claims.iss || '');
  const issuerValide = issuer === 'accounts.google.com' || issuer === 'https://accounts.google.com';
  if (!issuerValide || claims.aud !== clientId || !expiresAt || expiresAt * 1000 <= Date.now() ||
      !verified || !email || !claims.sub || allowed.indexOf(email) < 0) {
    throw new Error('Ce compte Google n’est pas autorisé.');
  }
  return email;
}

/** Exemple de garde pour une future action privée. Ne pas renvoyer le jeton au client. */
function exigerAccesPrive_(donnees) {
  if (!donnees || typeof donnees !== 'object') throw new Error('Requête invalide.');
  return verifierAccesPrive_(donnees.idToken);
}
