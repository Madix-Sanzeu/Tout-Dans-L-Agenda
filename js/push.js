/* =====================================================================
   push.js — LES RAPPELS QUI ARRIVENT MÊME APPLI FERMÉE
   ---------------------------------------------------------------------
   Comment ça marche, en 4 temps :
   1. ABONNER : le navigateur du téléphone fournit une "adresse de
      notification" (un abonnement push). On l'envoie à notre serveur
      (Supabase) avec un identifiant d'appareil tiré au hasard et un
      mot de passe secret, lui aussi tiré au hasard. Pas de compte, pas
      d'email : le serveur ne sait pas QUI vous êtes.
   2. SYNCHRONISER : à chaque changement, on envoie au serveur la liste
      des rappels À VENIR (heure + titre, ou titre masqué si demandé).
   3. ENVOYER : chaque minute, le serveur regarde les rappels arrivés
      à l'heure et envoie la notification, puis les EFFACE.
   4. Le téléphone reçoit la notification dans sw.js (événement "push"),
      même si l'appli est fermée.

   Désactiver = tout ce qui concerne cet appareil est effacé du serveur.
   ===================================================================== */

window.TDA = window.TDA || {};

TDA.push = (function () {

  let minuteur = null;              // pour regrouper les synchronisations

  const C = () => TDA.config.PUSH;

  // Le serveur est-il configuré (dans config.js) ?
  function serveurConfigure() {
    return Boolean(C().URL_SUPABASE && C().CLE_PUBLIQUE_SUPABASE);
  }

  // Ce navigateur sait-il recevoir des notifications push ?
  // (Sur iPhone : seulement si l'appli a été ajoutée à l'écran d'accueil.)
  function compatible() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  // L'enregistrement passe par stockage.js, comme tout le reste.
  const lireEtat = () => TDA.stockage.lirePush();
  const ecrireEtat = (valeur) => TDA.stockage.ecrirePush(valeur);

  function estActif() { return Boolean(lireEtat()); }

  // Un texte aléatoire de n octets, en hexadécimal (pour l'identifiant et le secret).
  function aleatoire(octets) {
    const t = new Uint8Array(octets);
    crypto.getRandomValues(t);
    return [...t].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  function nouvelUuid() {
    const h = aleatoire(16);
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
  }

  // La clé VAPID est écrite en "base64url" ; le navigateur la veut en octets.
  function cleEnOctets(base64url) {
    const base64 = (base64url + '='.repeat((4 - base64url.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/');
    return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  }

  // Envoie une demande à la fonction serveur "tda-rappels".
  async function appelerServeur(action, donnees = {}) {
    const etat = lireEtat();
    const reponse = await fetch(C().URL_SUPABASE + '/functions/v1/tda-rappels', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': C().CLE_PUBLIQUE_SUPABASE
      },
      body: JSON.stringify({ action, appareilId: etat.appareilId, secret: etat.secret, ...donnees })
    });
    if (!reponse.ok) throw new Error('Serveur : ' + reponse.status + ' ' + await reponse.text());
    return reponse.json();
  }

  // Ne garde que ce que le serveur a besoin de savoir : les rappels À VENIR.
  // Pour une tâche RÉCURRENTE, on envoie aussi les prochaines dates à l'avance :
  // ainsi le rappel du médicament de demain arrive même si l'appli n'a pas été rouverte.
  function rappelsAVenir(taches, masquerTitres) {
    const maintenant = new Date();
    const R = TDA.config.RECURRENCE;
    const liste = [];
    for (const t of taches) {
      if (t.faiteLe || !t.rappel) continue;
      const titre = masquerTitres ? null : t.titre.slice(0, 140);
      if (!t.rappelEnvoye && new Date(t.rappel) > maintenant) {
        liste.push({ tacheId: t.id, quand: t.rappel, titre });
      }
      if (t.recurrence) {
        // Chaque date a son propre identifiant : "idDeLaTache~1", "~2"...
        const depuis = new Date(Math.max(maintenant, new Date(t.rappel)));
        TDA.recurrence.prochaines(t.recurrence, depuis, R.PUSH_NOMBRE, R.PUSH_JOURS)
          .forEach((date, i) => liste.push({ tacheId: t.id + '~' + (i + 1), quand: date.toISOString(), titre }));
      }
    }
    return liste.slice(0, 500); // le serveur n'en accepte pas plus
  }

  // 1. ACTIVER (appelé par le bouton dans les réglages)
  async function activer(taches, masquerTitres) {
    if (!serveurConfigure()) throw new Error('Le serveur de notifications n\'est pas encore configuré.');
    if (!compatible()) throw new Error('Ce navigateur ne gère pas les notifications push. Sur iPhone, ajoutez d\'abord l\'appli à l\'écran d\'accueil.');

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Notifications refusées : autorisez-les dans les réglages du téléphone.');

    const sw = await navigator.serviceWorker.ready;
    const abonnement = await sw.pushManager.subscribe({
      userVisibleOnly: true,                                   // obligatoire : chaque push affiche une notification
      applicationServerKey: cleEnOctets(C().CLE_PUBLIQUE_VAPID)
    });

    ecrireEtat({ appareilId: nouvelUuid(), secret: aleatoire(32), masquerTitres: Boolean(masquerTitres) });
    try {
      await appelerServeur('abonner', { abonnement: abonnement.toJSON() });
      await synchroniserMaintenant(taches);
    } catch (e) {
      ecrireEtat(null);                                         // échec : on revient à l'état "inactif"
      await abonnement.unsubscribe().catch(() => {});
      throw e;
    }
  }

  // 2. SYNCHRONISER — on attend 2 s pour regrouper plusieurs changements rapides.
  function planifierSynchro(taches) {
    if (!estActif()) return;
    clearTimeout(minuteur);
    minuteur = setTimeout(() => synchroniserMaintenant(taches).catch(e => console.warn('Synchro push :', e)), 2000);
  }

  async function synchroniserMaintenant(taches) {
    const etat = lireEtat();
    if (!etat) return;
    await appelerServeur('synchroniser', { rappels: rappelsAVenir(taches, etat.masquerTitres) });
  }

  // Changer l'option "masquer les titres" sans tout réactiver.
  function changerMasquage(taches, masquerTitres) {
    const etat = lireEtat();
    if (!etat) return;
    etat.masquerTitres = Boolean(masquerTitres);
    ecrireEtat(etat);
    return synchroniserMaintenant(taches);
  }

  // DÉSACTIVER : efface tout sur le serveur, puis sur l'appareil.
  async function desactiver() {
    if (!estActif()) return;
    try { await appelerServeur('supprimer'); } catch (e) { console.warn('Suppression serveur :', e); }
    try {
      const sw = await navigator.serviceWorker.ready;
      const abonnement = await sw.pushManager.getSubscription();
      if (abonnement) await abonnement.unsubscribe();
    } catch (e) { /* rien à désabonner */ }
    ecrireEtat(null);
  }

  return { serveurConfigure, compatible, estActif, lireEtat, activer, planifierSynchro, changerMasquage, desactiver };
})();
