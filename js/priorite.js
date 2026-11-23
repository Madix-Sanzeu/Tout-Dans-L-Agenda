/* =====================================================================
   priorite.js — LE CŒUR DE L'APPLI : CALCULER L'ORDRE DES TÂCHES
   ---------------------------------------------------------------------
   Les règles suivent l'article « Comment prioriser ses tâches avec un
   TDAH » (le-tdah-au-quotidien.com), basé sur la MATRICE D'EISENHOWER :

     1. Urgent ET important      → à faire maintenant
     2. Important, pas urgent    → AVANT les urgences simples, pour ne pas
                                   passer sa vie d'urgence en urgence
     3. Urgent, pas important    → déléguer si possible, sinon programmer
     4. Ni urgent ni important   → éliminer, ou reporter

   Comment ça se traduit en score :
   - la CASE de la matrice donne la grosse partie du score (400/300/200/100),
     donc une tâche d'une case passe toujours devant la case suivante ;
   - DANS une même case, l'échéance la plus proche passe devant ;
   - en cas d'égalité, l'article conseille de commencer par la plus
     FACILE (courte) ou celle qu'on a le plus ENVIE de faire (agréable) :
     ce sont donc de petits bonus de départage, comme "Nouveau".

   "Urgent" n'est pas seulement l'étiquette cochée : selon l'article, une
   tâche est urgente si son échéance est proche OU si elle demande beaucoup
   de temps. On la rend donc urgente automatiquement dans ces cas-là.

   On garde les "raisons" pour expliquer à l'utilisateur POURQUOI une tâche
   est à ce rang. Ce fichier ne touche ni à l'écran ni au stockage.
   ===================================================================== */

window.TDA = window.TDA || {};

TDA.priorite = (function () {

  const HEURE = 60 * 60 * 1000;   // une heure en millisecondes
  const JOUR = 24 * HEURE;

  // Une tâche est-elle "nouvelle" ? (créée il y a moins de NOUVEAU_DUREE_HEURES)
  function estNouvelle(tache, maintenant = new Date()) {
    return (maintenant - new Date(tache.creeLe)) < TDA.config.NOUVEAU_DUREE_HEURES * HEURE;
  }

  // Durée "réaliste" : l'article conseille d'ajouter un tiers à son estimation.
  function dureeAvecMarge(tache) {
    return tache.duree ? Math.round(tache.duree * (1 + TDA.config.MARGE_DUREE)) : null;
  }

  // Urgence : étiquette cochée, OU échéance proche, OU grosse tâche à rendre bientôt.
  // Renvoie le motif (texte) ou null si la tâche n'est pas urgente.
  function motifUrgence(tache, maintenant = new Date()) {
    const R = TDA.config.REGLES;
    if (tache.etiquettes.includes('urgent')) return 'cochée Urgent';
    if (!tache.echeance) return null;
    const reste = new Date(tache.echeance) - maintenant;
    if (reste < 0) return 'échéance dépassée';
    if (reste < R.urgentSiEcheanceSousJours * JOUR) return 'échéance proche';
    if ((dureeAvecMarge(tache) || 0) >= R.grosseTacheMinutes && reste < R.grosseTacheEcheanceJours * JOUR) {
      return 'longue tâche à rendre bientôt';
    }
    return null;
  }

  // Dans quelle case de la matrice d'Eisenhower est la tâche ? (1 à 4)
  function quadrant(tache, maintenant = new Date()) {
    const urgent = Boolean(motifUrgence(tache, maintenant));
    const important = tache.etiquettes.includes('important');
    if (urgent && important) return 1;
    if (important) return 2;
    if (urgent) return 3;
    return 4;
  }

  // Calcule { score, quadrant, raisons } pour UNE tâche.
  function calculer(tache, maintenant = new Date()) {
    const P = TDA.config.POIDS;
    const raisons = [];
    let score = 0;

    function ajouter(points, texte) {
      if (!points) return;
      score += points;
      raisons.push(texte + ' +' + points);
    }

    // 1) La case de la matrice : c'est elle qui décide l'essentiel
    const q = quadrant(tache, maintenant);
    const motif = motifUrgence(tache, maintenant);
    const Q = TDA.config.QUADRANTS[q];
    ajouter(Q.points, Q.emoji + ' ' + Q.nom + (motif ? ' (' + motif + ')' : ''));

    // 2) Dans la même case : l'échéance la plus proche d'abord
    if (tache.echeance) {
      const reste = new Date(tache.echeance) - maintenant;
      if (reste < 0)               ajouter(P.echeanceDepassee, '⏰ Échéance dépassée');
      else if (reste < JOUR)       ajouter(P.echeance24h, '⏰ Échéance < 24 h');
      else if (reste < 3 * JOUR)   ajouter(P.echeance3j, '⏰ Échéance < 3 j');
      else if (reste < 7 * JOUR)   ajouter(P.echeance7j, '⏰ Cette semaine');
      else if (reste < 30 * JOUR)  ajouter(P.echeance30j, '⏰ Ce mois-ci');
    }

    // 3) Départage : la plus facile ou la plus agréable d'abord
    if (tache.etiquettes.includes('agreable')) ajouter(P.agreable, '🌿 Agréable');
    if (tache.duree && tache.duree <= 15)     ajouter(P.tacheCourte, '⚡ Facile/rapide');
    if (estNouvelle(tache, maintenant))       ajouter(P.nouveau, '✨ Nouveau');
    const jours = Math.floor((maintenant - new Date(tache.creeLe)) / JOUR);
    ajouter(Math.min(jours * P.parJourDAttente, P.attenteMax), '⌛ En attente');

    return { score, quadrant: q, raisons };
  }

  // Une tâche est-elle "reportée" (bouton "Pas maintenant") ?
  function estReportee(tache, maintenant = new Date()) {
    return Boolean(tache.reporteJusqua) && new Date(tache.reporteJusqua) > maintenant;
  }

  // Trie une liste de tâches. Renvoie une NOUVELLE liste où chaque tâche
  // a en plus ses champs "score", "quadrant" et "raisons".
  function trier(taches, maintenant = new Date()) {
    return taches
      .map(t => ({ ...t, ...calculer(t, maintenant) }))
      .sort((a, b) =>
        b.score - a.score ||
        (a.echeance || '9999').localeCompare(b.echeance || '9999') ||
        a.creeLe.localeCompare(b.creeLe)
      );
  }

  return { calculer, trier, estReportee, estNouvelle, quadrant, dureeAvecMarge };
})();
