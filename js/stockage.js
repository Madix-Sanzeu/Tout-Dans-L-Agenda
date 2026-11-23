/* =====================================================================
   stockage.js — ENREGISTRER ET RELIRE LES DONNÉES
   ---------------------------------------------------------------------
   Phase 1 : tout est stocké DANS LE NAVIGATEUR de l'appareil, grâce à
   "localStorage" (un petit espace clé → texte propre à chaque site).
   - Avantage : rien ne sort du téléphone, pas de serveur, pas de RGPD.
   - Limite   : pas de synchronisation entre appareils, et si on vide
                les données du navigateur, tout part → d'où l'export.

   Les données sont converties en texte avec JSON.stringify (objet → texte)
   et relues avec JSON.parse (texte → objet).

   En phase 3 (comptes en ligne), SEUL ce fichier devra changer :
   le reste de l'appli appelle juste TDA.stockage.lireTaches(), etc.
   ===================================================================== */

window.TDA = window.TDA || {};

TDA.stockage = (function () {

  // Les "clés" sous lesquelles on range les données.
  const CLE_TACHES = 'tda.taches';
  const CLE_MOMENTS = 'tda.moments';

  // Lit une clé et la transforme en objet. Si rien n'existe ou si le
  // contenu est abîmé, on renvoie la valeur par défaut au lieu de planter.
  function lire(cle, valeurParDefaut) {
    try {
      const texte = localStorage.getItem(cle);
      return texte ? JSON.parse(texte) : valeurParDefaut;
    } catch (erreur) {
      console.warn('Lecture impossible de', cle, erreur);
      return valeurParDefaut;
    }
  }

  // Transforme un objet en texte et l'enregistre.
  function ecrire(cle, valeur) {
    try {
      localStorage.setItem(cle, JSON.stringify(valeur));
    } catch (erreur) {
      console.warn('Écriture impossible de', cle, erreur);
    }
  }

  // Ce qu'on "exporte" : les seules fonctions visibles depuis les autres fichiers.
  return {
    lireTaches: () => lire(CLE_TACHES, []),
    ecrireTaches: (taches) => ecrire(CLE_TACHES, taches),

    // Au premier lancement, on copie les moments par défaut de config.js.
    lireMoments: () => lire(CLE_MOMENTS, null) || structuredClone(TDA.config.MOMENTS_PAR_DEFAUT),
    ecrireMoments: (moments) => ecrire(CLE_MOMENTS, moments),

    // L'identifiant de l'appareil pour les notifications push (voir push.js).
    // null = notifications push désactivées.
    lirePush: () => lire('tda.push', null),
    ecrirePush: (etat) => {
      if (etat) ecrire('tda.push', etat);
      else try { localStorage.removeItem('tda.push'); } catch (e) { /* indisponible */ }
    },

    // Sauvegarde complète dans un seul objet (pour le bouton "Exporter").
    exporter: function () {
      return {
        application: 'Tout Dans l\'Agenda',
        version: 1,
        exporteLe: new Date().toISOString(),
        taches: lire(CLE_TACHES, []),
        moments: lire(CLE_MOMENTS, TDA.config.MOMENTS_PAR_DEFAUT)
      };
    },

    // Restaure une sauvegarde. Renvoie true si le fichier avait l'air valide.
    importer: function (donnees) {
      if (!donnees || !Array.isArray(donnees.taches)) return false;
      ecrire(CLE_TACHES, donnees.taches);
      if (Array.isArray(donnees.moments)) ecrire(CLE_MOMENTS, donnees.moments);
      return true;
    }
  };
})();
