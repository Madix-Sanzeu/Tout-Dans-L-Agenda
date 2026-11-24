/* =====================================================================
   rappels.js — LES NOTIFICATIONS
   ---------------------------------------------------------------------
   Phase 1 : l'appli vérifie toutes les 30 secondes (réglable dans
   config.js) si une tâche a un rappel arrivé à échéance, et affiche
   une notification du système.

   ⚠️ Limite importante : cela ne fonctionne que si l'appli est OUVERTE
   (ou en arrière-plan récent). Pour des rappels appli fermée, il faudra
   en phase 2 un petit serveur qui envoie des notifications "push".

   Si l'utilisateur refuse les notifications, on affiche quand même
   un bandeau dans l'appli (fonction "afficherBandeau" fournie par app.js).
   ===================================================================== */

window.TDA = window.TDA || {};

TDA.rappels = (function () {

  // Les notifications sont-elles disponibles dans ce navigateur ?
  function disponibles() {
    return 'Notification' in window;
  }

  // Demande l'autorisation (le navigateur affiche sa propre fenêtre).
  // "async" + "await" : on attend la réponse de l'utilisateur.
  async function demanderAutorisation() {
    if (!disponibles()) return 'indisponible';
    if (Notification.permission === 'default') {
      return await Notification.requestPermission();
    }
    return Notification.permission; // 'granted' (oui) ou 'denied' (non)
  }

  // Affiche une notification pour une tâche.
  async function notifier(tache) {
    const titre = '⏰ ' + tache.titre;
    const options = { body: TDA.config.NOM + ' — c\'est le moment !', icon: 'icone.svg', tag: tache.id };

    if (disponibles() && Notification.permission === 'granted') {
      try {
        // Sur téléphone, il faut passer par le "service worker" (voir sw.js).
        const sw = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
        if (sw) { await sw.showNotification(titre, options); return; }
        new Notification(titre, options);   // sur ordinateur, ceci suffit
        return;
      } catch (e) {
        console.warn('Notification impossible, on passe au bandeau', e);
      }
    }
    // Plan B : un bandeau dans l'appli.
    if (TDA.app) TDA.app.afficherBandeau(titre);
  }

  // Parcourt les tâches et déclenche les rappels arrivés à l'heure.
  // Renvoie true si au moins une tâche a été modifiée (pour sauvegarder).
  function verifier(taches, maintenant = new Date()) {
    let modifie = false;
    for (const tache of taches) {
      if (tache.faiteLe || !tache.rappel || tache.rappelEnvoye) continue;
      if (new Date(tache.rappel) <= maintenant) {
        notifier(tache);
        tache.rappelEnvoye = true;   // pour ne pas sonner deux fois
        modifie = true;
      }
    }
    return modifie;
  }

  return { disponibles, demanderAutorisation, verifier };
})();
