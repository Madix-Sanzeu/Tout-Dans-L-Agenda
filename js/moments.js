/* =====================================================================
   moments.js — SAVOIR "QUEL MOMENT DE VIE" EST EN COURS
   ---------------------------------------------------------------------
   Un moment de vie (Travail, Perso...) a une ou plusieurs "plages" :
   des jours de la semaine + une heure de début + une heure de fin.
   Ce fichier répond à une seule question : "à cette date/heure-ci,
   quels moments sont actifs ?"
   ===================================================================== */

window.TDA = window.TDA || {};

TDA.moments = (function () {

  // "09:30" → 570 (nombre de minutes depuis minuit). Plus facile à comparer.
  function enMinutes(heureTexte) {
    const [h, m] = heureTexte.split(':').map(Number);
    return h * 60 + m;
  }

  // Une plage est-elle active à la date donnée ?
  function plageActive(plage, date) {
    const jour = date.getDay();                       // 0 = dimanche ... 6 = samedi
    const maintenant = date.getHours() * 60 + date.getMinutes();
    const debut = enMinutes(plage.debut);
    const fin = enMinutes(plage.fin);

    if (debut <= fin) {
      // Cas normal, ex. 09:00 → 18:00
      return plage.jours.includes(jour) && maintenant >= debut && maintenant < fin;
    }
    // Cas qui passe minuit, ex. 22:00 → 02:00 :
    // soit on est le soir d'un jour coché, soit la nuit qui suit un jour coché.
    const veille = (jour + 6) % 7;
    return (plage.jours.includes(jour) && maintenant >= debut) ||
           (plage.jours.includes(veille) && maintenant < fin);
  }

  // Renvoie la liste des id des moments actifs, ex. ['travail'].
  // 'partout' est TOUJOURS actif.
  function actifs(moments, date = new Date()) {
    const ids = moments
      .filter(moment => moment.plages.some(plage => plageActive(plage, date)))
      .map(moment => moment.id);
    return ['partout', ...ids];
  }

  // Tous les moments, y compris "N'importe quand", pour les menus déroulants.
  function tous(moments) {
    return [TDA.config.MOMENT_PARTOUT, ...moments];
  }

  // Retrouve un moment à partir de son id (ou "N'importe quand" par défaut).
  function trouver(moments, id) {
    return tous(moments).find(m => m.id === id) || TDA.config.MOMENT_PARTOUT;
  }

  return { actifs, tous, trouver, plageActive };
})();
