/* =====================================================================
   recurrence.js — LES TÂCHES QUI REVIENNENT (anniversaires, médicaments…)
   ---------------------------------------------------------------------
   Une tâche récurrente porte une "règle" :
     {
       unite: 'jour' | 'semaine' | 'mois' | 'an',
       intervalle: 1,          // tous les 1, 2, 3... jours / semaines / mois / ans
       jours: [1, 3, 5],       // pour 'semaine' : quels jours (0 = dimanche ... 6 = samedi)
       ancre: '2026-11-24T08:00:00.000Z', // la toute première date (celle du rappel)
       fin: '2026-12-10T22:59:59.000Z'    // facultatif : plus aucune date après (null = pas d'arrêt prévu)
     }

   Toutes les dates sont calculées À PARTIR DE L'ANCRE, et pas en ajoutant
   des jours à la date précédente. Avantages :
   - l'heure ne "glisse" pas (changement d'heure été/hiver) ;
   - un anniversaire le 31 ou le 29 février retombe sur la bonne date
     les mois/années suivants (le 30 ou le 28 quand le jour n'existe pas).

   Ce fichier ne fait QUE des calculs de dates : il ne touche ni à
   l'écran ni au stockage, ce qui le rend facile à tester.
   ===================================================================== */

window.TDA = window.TDA || {};

TDA.recurrence = (function () {

  const JOUR_MS = 24 * 60 * 60 * 1000;
  const NOMS_JOURS_COURTS = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];

  // Le même jour, à minuit (heure locale)
  function debutJour(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  // Le lundi de la semaine, à minuit
  function debutSemaine(date) {
    const d = debutJour(date);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d;
  }

  // Nombre de jours entiers entre deux dates (arrondi : absorbe le changement d'heure)
  function ecartJours(a, b) {
    return Math.round((debutJour(b) - debutJour(a)) / JOUR_MS);
  }

  // L'ancre décalée de n jours, à la même heure
  function ajouterJours(ancre, n) {
    const d = new Date(ancre);
    d.setDate(d.getDate() + n);
    return d;
  }

  // L'ancre décalée de n mois. Si le jour n'existe pas (31 avril, 29 février
  // d'une année non bissextile), on prend le dernier jour du mois.
  function ajouterMois(ancre, n) {
    const annee = ancre.getFullYear();
    const mois = ancre.getMonth() + n;
    const dernierJour = new Date(annee, mois + 1, 0).getDate();
    return new Date(annee, mois, Math.min(ancre.getDate(), dernierJour),
                    ancre.getHours(), ancre.getMinutes(), 0, 0);
  }

  /* La prochaine date de la règle STRICTEMENT après "apres".
     Renvoie un objet Date, ou null si la règle est terminée (date de fin passée). */
  function suivante(regle, apres) {
    const date = suivanteSansFin(regle, apres);
    if (date && regle.fin && date > new Date(regle.fin)) return null;
    return date;
  }

  function suivanteSansFin(regle, apres) {
    const ancre = new Date(regle.ancre);
    const n = Math.max(1, Math.floor(regle.intervalle || 1));
    apres = new Date(apres);
    const jours = (regle.jours || []).filter(j => j >= 0 && j <= 6);

    // ---- Toutes les N semaines, certains jours précis ----
    if (regle.unite === 'semaine' && jours.length) {
      // On essaie chaque jour à partir du plus tardif entre l'ancre et "apres".
      const depart = debutJour(apres > ancre ? apres : ancre);
      for (let i = 0; i <= 7 * n + 7; i++) {
        const c = new Date(depart);
        c.setDate(c.getDate() + i);
        c.setHours(ancre.getHours(), ancre.getMinutes(), 0, 0);
        const numeroSemaine = Math.round((debutSemaine(c) - debutSemaine(ancre)) / (7 * JOUR_MS));
        if (c > apres && c >= ancre && jours.includes(c.getDay()) && numeroSemaine % n === 0) return c;
      }
    }

    // ---- Tous les N jours / N semaines (sans jours précis) ----
    if (regle.unite === 'jour' || regle.unite === 'semaine') {
      const pas = regle.unite === 'jour' ? n : 7 * n;          // en jours
      // On saute directement près de la bonne date, puis on avance si besoin.
      let k = Math.max(0, Math.floor(ecartJours(ancre, apres) / pas));
      let c = ajouterJours(ancre, k * pas);
      for (let securite = 0; c <= apres && securite < 1000; securite++) {
        k++;
        c = ajouterJours(ancre, k * pas);
      }
      return c;
    }

    // ---- Tous les N mois / N ans ----
    const pasMois = regle.unite === 'an' ? 12 * n : n;
    const ecartMois = (apres.getFullYear() - ancre.getFullYear()) * 12 + (apres.getMonth() - ancre.getMonth());
    let k = Math.max(0, Math.floor(ecartMois / pasMois));
    let c = ajouterMois(ancre, k * pasMois);
    for (let securite = 0; c <= apres && securite < 1000; securite++) {
      k++;
      c = ajouterMois(ancre, k * pasMois);
    }
    return c;
  }

  // Les "nombre" prochaines dates après "depuis", sans dépasser "limiteJours".
  // Sert à prévenir le serveur des rappels à venir (même appli fermée).
  function prochaines(regle, depuis, nombre, limiteJours) {
    const limite = new Date(new Date(depuis).getTime() + limiteJours * JOUR_MS);
    const dates = [];
    let d = new Date(depuis);
    while (dates.length < nombre) {
      d = suivante(regle, d);
      if (!d || d > limite) break;          // règle terminée, ou trop loin
      dates.push(d);
    }
    return dates;
  }

  // Texte lisible : "Tous les jours", "Toutes les 2 semaines : lun, jeu", "Tous les ans"
  function libelle(regle) {
    if (!regle) return '';
    const n = Math.max(1, regle.intervalle || 1);
    const textes = {
      jour:    n === 1 ? 'Tous les jours' : `Tous les ${n} jours`,
      semaine: n === 1 ? 'Toutes les semaines' : `Toutes les ${n} semaines`,
      mois:    n === 1 ? 'Tous les mois' : `Tous les ${n} mois`,
      an:      n === 1 ? 'Tous les ans' : `Tous les ${n} ans`
    };
    let texte = textes[regle.unite] || '';
    if (regle.unite === 'semaine' && (regle.jours || []).length) {
      const ordre = [1, 2, 3, 4, 5, 6, 0]; // du lundi au dimanche
      texte += ' : ' + ordre.filter(j => regle.jours.includes(j)).map(j => NOMS_JOURS_COURTS[j]).join(', ');
    }
    if (regle.fin) {
      texte += ', jusqu\'au ' + new Date(regle.fin).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    }
    return texte;
  }

  // Fin de journée (23:59:59) d'une date : la date de fin est INCLUSE.
  function finDeJournee(date) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 0);
    return d;
  }

  // La PREMIÈRE date d'une règle qui commence à "debut" (sa propre ancre),
  // sans proposer une date déjà passée :
  // - si "debut" convient (dans le futur, et bon jour de la semaine), c'est elle ;
  // - sinon, la suivante après maintenant.
  // garderAujourdhui = true : si "debut" est aujourd'hui mais l'heure est passée,
  // on la garde quand même (ex. : anniversaire du jour → on le voit tout de suite).
  function premiere(regle, maintenant = new Date(), garderAujourdhui = false) {
    const debut = new Date(regle.ancre);
    const jours = regle.unite === 'semaine' ? (regle.jours || []) : [];
    const bonJour = !jours.length || jours.includes(debut.getDay());
    const memeJour = debut.toDateString() === maintenant.toDateString();
    if (bonJour && (debut >= maintenant || (garderAujourdhui && memeJour))) return debut;
    return suivante(regle, new Date(Math.max(maintenant, debut - 1)));
  }

  return { suivante, prochaines, libelle, finDeJournee, premiere };
})();
