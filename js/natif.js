/* =====================================================================
   natif.js — QUAND TDA TOURNE COMME UNE VRAIE APPLI ANDROID
   ---------------------------------------------------------------------
   La même appli (HTML, CSS, JS) existe sous deux formes :
   1. dans le NAVIGATEUR (site web, PWA) : rien ne change, ce fichier ne
      fait rien ;
   2. dans une APPLI ANDROID installée depuis le fichier APK. Elle est
      fabriquée avec "Capacitor" (voir capacitor.config.json et
      DEPLOIEMENT.md), qui emballe nos fichiers web dans une vraie appli.

   Dans l'appli Android, les rappels n'utilisent plus Internet ni le
   serveur : on demande directement à ANDROID de déclencher chaque rappel
   à l'heure prévue, comme une alarme ("notifications locales").
   → Ça marche appli fermée, sans réseau, et sans dépendre de Chrome.

   Capacitor met ses outils à disposition dans window.Capacitor.Plugins :
   - LocalNotifications : programmer / annuler des notifications
   - Filesystem + Share : écrire un fichier et ouvrir le menu "Partager"
     (pour le bouton "Sauvegarder")
   ===================================================================== */

window.TDA = window.TDA || {};

TDA.natif = (function () {

  const CANAL = 'rappels';          // le "canal" Android de nos notifications
  const MAX_ANDROID = 400;          // Android limite le nombre d'alarmes par appli : on reste en dessous
  const ID_TEST = 1;                // numéro réservé à la notification de test
  let minuteur = null;

  // Sommes-nous dans l'appli Android (et pas dans un navigateur) ?
  function estNatif() {
    return Boolean(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  }

  const plugins = () => window.Capacitor.Plugins;
  const LN = () => plugins().LocalNotifications;

  // Android veut des numéros entiers pour identifier les notifications.
  // On transforme l'identifiant texte ("lq3k9x-a8f2c~2") en nombre (toujours le même).
  function numero(texte) {
    let h = 0;
    for (let i = 0; i < texte.length; i++) h = (h * 31 + texte.charCodeAt(i)) | 0;
    return Math.abs(h) % 2000000000 + 2;   // jamais 1 (réservé au test)
  }

  // Les notifications sont-elles autorisées par Android ? ('granted' = oui)
  async function permission() {
    const r = await LN().checkPermissions();
    return r.display;
  }

  // Le canal de notification : son, vibration, importance haute (s'affiche en haut de l'écran).
  async function preparerCanal() {
    try {
      await LN().createChannel({
        id: CANAL, name: 'Rappels', description: 'Les rappels de vos tâches',
        importance: 5, visibility: 1, vibration: true
      });
    } catch (e) { /* Android trop ancien : le canal par défaut suffit */ }
  }

  // Les rappels "à la minute près" sont-ils autorisés ? (Android 12 et plus)
  // Sinon Android peut les décaler de quelques minutes pour économiser la batterie.
  async function alarmesExactes() {
    try {
      const r = await LN().checkExactNotificationSetting();
      return r.exact_alarm === 'granted';
    } catch (e) { return true; }   // fonction absente = pas de restriction
  }

  async function ouvrirReglageAlarmesExactes() {
    try { await LN().changeExactNotificationSetting(); } catch (e) { /* rien à faire */ }
  }

  // PROGRAMMER : on efface tous les rappels programmés, puis on reprogramme
  // la liste à jour (la même que celle envoyée au serveur dans la version web).
  async function planifierMaintenant(taches) {
    if ((await permission()) !== 'granted') return { ok: false, raison: 'permission' };
    const attente = await LN().getPending();
    const aAnnuler = attente.notifications.filter(n => n.id !== ID_TEST);   // on garde la notification de test
    if (aAnnuler.length) {
      await LN().cancel({ notifications: aAnnuler.map(n => ({ id: n.id })) });
    }
    const liste = TDA.push.rappelsAVenir(taches, false)
      .sort((a, b) => a.quand.localeCompare(b.quand))
      .slice(0, MAX_ANDROID);
    if (liste.length) {
      await LN().schedule({
        notifications: liste.map(r => ({
          id: numero(r.tacheId),
          title: '⏰ ' + (r.titre || TDA.config.NOM),
          body: 'C\'est le moment !',
          channelId: CANAL,
          schedule: { at: new Date(r.quand), allowWhileIdle: true },  // même en veille
          extra: { tacheId: r.tacheId }
        }))
      });
    }
    return { ok: true, nombre: liste.length };
  }

  // Appelé à chaque modification des tâches : on attend 1 s pour regrouper.
  function planifier(taches) {
    clearTimeout(minuteur);
    minuteur = setTimeout(() => planifierMaintenant(taches).catch(e => console.warn('Rappels natifs :', e)), 1000);
  }

  // Au démarrage : les rappels peuvent-ils sonner ? Renvoie 'ok' ou 'coupe'
  // (même convention que TDA.push.verifier, pour le garde-fou).
  async function verifier(taches) {
    await preparerCanal();
    const r = await planifierMaintenant(taches);
    return r.ok ? 'ok' : 'coupe';
  }

  // RÉACTIVER (bouton du garde-fou) : Android affiche sa demande d'autorisation.
  async function reactiver(taches) {
    const r = await LN().requestPermissions();
    if (r.display !== 'granted') {
      throw new Error('Les notifications sont refusées : autorisez-les pour TDA dans les réglages du téléphone.');
    }
    await preparerCanal();
    return planifierMaintenant(taches);
  }

  // TEST : une notification dans 10 secondes (fermez l'appli pour vérifier).
  async function tester() {
    await LN().schedule({
      notifications: [{
        id: ID_TEST, title: '⏰ Test : les rappels fonctionnent 🎉', body: 'Même appli fermée.',
        channelId: CANAL, schedule: { at: new Date(Date.now() + 10000), allowWhileIdle: true }
      }]
    });
  }

  // SAUVEGARDER : écrit le fichier puis ouvre le menu "Partager" d'Android
  // (Drive, e-mail, WhatsApp…), car le téléchargement web ne marche pas ici.
  async function partagerFichier(nomFichier, texte) {
    const { Filesystem, Share } = plugins();
    const ecrit = await Filesystem.writeFile({
      path: nomFichier, data: texte, directory: 'CACHE', encoding: 'utf8'
    });
    await Share.share({ title: 'Sauvegarde ' + TDA.config.NOM, files: [ecrit.uri] });
  }

  return { estNatif, permission, planifier, planifierMaintenant, verifier, reactiver, tester,
           alarmesExactes, ouvrirReglageAlarmesExactes, partagerFichier };
})();
