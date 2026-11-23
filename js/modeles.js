/* =====================================================================
   modeles.js — LES MODÈLES DE RAPPELS RÉCURRENTS
   ---------------------------------------------------------------------
   Le bouton « 🔁 Rappel récurrent » ouvre un assistant : on choisit un
   modèle (Anniversaire, Médicament…), on répond à quelques questions,
   et le modèle fabrique la ou les tâches récurrentes.

   Chaque modèle contient :
   - id, emoji, nom, exemples : ce qui s'affiche sur la carte de choix ;
   - description : une phrase d'explication en haut des questions ;
   - champs : la liste des questions (voir "Types de champs" plus bas) ;
   - construire(reponses) : transforme les réponses en tâches.

   Types de champs (affichés par app.js, fonction afficherChamp) :
     texte, date, heure, nombre, choix (boutons), jours (L M M J V S D),
     heures (plusieurs heures, selon un autre champ), moment, etiquettes.
   Options communes : label, aide, requis, defaut, et "si" pour n'afficher
   une question que selon une autre réponse. Ex. : si: { duree: 'jours' }.

   👉 Pour ajouter un modèle : copier un modèle existant dans la liste
   MODELES, changer son id, ses textes, ses champs et sa fonction construire.
   ===================================================================== */

window.TDA = window.TDA || {};

TDA.modeles = (function () {

  const R = () => TDA.recurrence;
  const A = () => TDA.config.ASSISTANT;
  const JOUR_MS = 24 * 60 * 60 * 1000;

  /* ---------------- Petits outils de dates ---------------- */

  // "2026-11-24" + "08:30" → Date (heure locale)
  function dateHeure(dateTexte, heureTexte) {
    const [a, m, j] = dateTexte.split('-').map(Number);
    const [h, mi] = (heureTexte || '09:00').split(':').map(Number);
    return new Date(a, m - 1, j, h, mi, 0, 0);
  }

  // Aujourd'hui au format "2026-11-24" (pour les champs date)
  function aujourdhui() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // Une date décalée de n jours (n peut être négatif), même heure
  function decaler(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }

  // 1 → "(1 an)", 37 → "(37 ans)"
  function texteAge(age) {
    return '(' + age + (age > 1 ? ' ans)' : ' an)');
  }

  // "08:00" → "8h", "13:30" → "13h30"
  function heureCourte(h) {
    const [hh, mm] = h.split(':');
    return Number(hh) + 'h' + (mm === '00' ? '' : mm);
  }

  /* ---------------- Questions réutilisées par plusieurs modèles ---------------- */

  // "Pendant combien de temps ?" : pas d'arrêt / N jours / jusqu'à une date
  function champsFin() {
    return [
      { id: 'duree', type: 'choix', label: 'Pendant combien de temps ?', defaut: 'sans', options: [
        ['sans', 'Pas d\'arrêt prévu'], ['jours', 'Pendant… jours'], ['date', 'Jusqu\'au…']] },
      { id: 'nbJours', type: 'nombre', label: 'Pendant combien de jours ?', min: 1, max: 365, defaut: 7, suffixe: 'jours', si: { duree: 'jours' } },
      { id: 'finDate', type: 'date', label: 'Jusqu\'au (inclus)', si: { duree: 'date' }, requis: true }
    ];
  }

  // Lit les réponses de champsFin() → date de fin (texte ISO) ou null
  function lireFin(r, debutTexte) {
    if (r.duree === 'jours') return R().finDeJournee(decaler(dateHeure(debutTexte, '00:00'), r.nbJours - 1)).toISOString();
    if (r.duree === 'date') {
      if (r.finDate < debutTexte) throw new Error('La date de fin est avant la date de début.');
      return R().finDeJournee(dateHeure(r.finDate, '00:00')).toISOString();
    }
    return null;
  }

  // "Combien de fois par jour ?" + les heures correspondantes
  function champsPrises(label) {
    return [
      { id: 'fois', type: 'choix', label: label, defaut: '1', options: [
        ['1', '1 fois'], ['2', '2 fois'], ['3', '3 fois'], ['4', '4 fois'], ['5', '5 fois'], ['6', '6 fois']] },
      { id: 'heures', type: 'heures', label: 'À quelles heures ?', selon: 'fois', proposees: n => A().HEURES_PRISES[n] }
    ];
  }

  // Fabrique UNE tâche par heure (ex. médicament matin et soir = 2 tâches).
  // Le titre précise la prise : « Prendre X (1/2 · 8h) ».
  function tachesParHeure(base, heures, regleSansAncre, debutTexte) {
    const taches = [];
    heures.forEach((heure, i) => {
      const regle = { ...regleSansAncre, ancre: dateHeure(debutTexte, heure).toISOString() };
      const rappel = R().premiere(regle);
      if (!rappel) return;                                    // tout est déjà passé
      const titre = heures.length > 1 ? `${base.titre} (${i + 1}/${heures.length} · ${heureCourte(heure)})` : base.titre;
      taches.push({ ...base, titre, rappel: rappel.toISOString(), recurrence: regle });
    });
    if (!taches.length) throw new Error('Toutes les dates sont déjà passées : vérifiez la date de fin.');
    return taches;
  }

  /* ================================================================
     LES MODÈLES
     ================================================================ */
  const MODELES = [

    /* ---------- 🎂 Anniversaire ---------- */
    {
      id: 'anniversaire', emoji: '🎂', nom: 'Anniversaire', exemples: 'Famille, amis, collègues',
      description: 'Un rappel le jour J chaque année, et si vous voulez, un autre quelques jours avant pour penser au cadeau.',
      champs: [
        { id: 'nom', type: 'texte', label: 'L\'anniversaire de qui ?', placeholder: 'Ex. : Léa', requis: true },
        { id: 'date', type: 'date', label: 'Date de naissance', requis: true, aide: 'Année inconnue ? Mettez n\'importe laquelle et répondez « Non » juste en dessous.' },
        { id: 'age', type: 'choix', label: 'Afficher l\'âge dans le rappel ?', defaut: 'oui', options: [
          ['oui', 'Oui, l\'année est la bonne'], ['non', 'Non, année inconnue']] },
        { id: 'heure', type: 'heure', label: 'Heure du rappel', defaut: () => A().HEURE_ANNIVERSAIRE },
        { id: 'cadeau', type: 'choix', label: '🎁 Me prévenir avant, pour le cadeau ?', defaut: '7', options: [
          ['0', 'Non merci'], ['3', '3 jours avant'], ['7', '1 semaine avant'], ['14', '2 semaines avant'], ['autre', 'Autre…']] },
        { id: 'cadeauJours', type: 'nombre', label: 'Combien de jours avant ?', min: 1, max: 90, defaut: 10, suffixe: 'jours', si: { cadeau: 'autre' } },
        { id: 'moment', type: 'moment', label: 'Moment de vie', defaut: 'perso' }
      ],
      construire(r) {
        // On cale la date sur cette année ; si elle est passée, ce sera l'an prochain.
        // Né un 29 février : on part d'une année bissextile (2024), le calcul
        // donnera le 28 février les autres années et le 29 les années bissextiles.
        const [, mois, jour] = r.date.split('-');
        const annee = (mois === '02' && jour === '29') ? 2024 : new Date().getFullYear();
        const cetteAnnee = `${annee}-${mois}-${jour}`;
        const regle = { unite: 'an', intervalle: 1, jours: [], ancre: dateHeure(cetteAnnee, r.heure).toISOString(), fin: null };
        const jourJ = R().premiere(regle, new Date(), true);   // aujourd'hui = on le garde

        // L'âge (facultatif) : on garde l'année de naissance dans la tâche,
        // et l'appli recalcule l'âge du titre chaque année (voir app.js, majAge).
        const anneeNaissance = r.age === 'oui' ? Number(r.date.slice(0, 4)) : null;
        if (anneeNaissance && anneeNaissance > new Date().getFullYear()) {
          throw new Error('L\'année de naissance est dans le futur : vérifiez la date.');
        }
        const avecAge = (titre, dateAnniv) => anneeNaissance ? titre + ' ' + texteAge(dateAnniv.getFullYear() - anneeNaissance) : titre;

        const taches = [{
          titre: avecAge(`Souhaiter l'anniversaire de ${r.nom}`, jourJ), anneeNaissance,
          etiquettes: ['important', 'agreable'], moment: r.moment,
          duree: 5, rappel: jourJ.toISOString(), echeance: null, recurrence: regle, etapes: []
        }];
        const avance = r.cadeau === 'autre' ? r.cadeauJours : Number(r.cadeau);
        if (avance > 0) {
          const regleCadeau = { ...regle, ancre: decaler(new Date(regle.ancre), -avance).toISOString() };
          const rappelCadeau = R().premiere(regleCadeau);
          taches.push({
            titre: avecAge(`Trouver un cadeau pour ${r.nom}`, decaler(rappelCadeau, avance)), anneeNaissance,
            etiquettes: ['important'], moment: r.moment, duree: 30,
            rappel: rappelCadeau.toISOString(),
            echeance: decaler(rappelCadeau, avance).toISOString(),   // le jour de l'anniversaire
            recurrence: regleCadeau,
            etapes: [{ texte: 'Choisir une idée', fait: false }, { texte: 'Acheter ou commander', fait: false }, { texte: 'Emballer', fait: false }]
          });
        }
        return taches;
      }
    },

    /* ---------- 💊 Médicament ---------- */
    {
      id: 'medicament', emoji: '💊', nom: 'Médicament', exemples: 'Traitement, vitamines, pilule',
      description: 'Une tâche par prise, à l\'heure choisie. Suivez toujours la prescription de votre médecin : TDA n\'est qu\'un aide-mémoire.',
      champs: [
        { id: 'nom', type: 'texte', label: 'Quel médicament ?', placeholder: 'Ex. : Doliprane, traitement du matin', requis: true },
        ...champsPrises('Combien de fois par jour ?'),
        { id: 'frequence', type: 'choix', label: 'Quels jours ?', defaut: 'tous', options: [
          ['tous', 'Tous les jours'], ['certains', 'Certains jours de la semaine'], ['n', 'Tous les N jours']] },
        { id: 'jours', type: 'jours', label: 'Lesquels ?', si: { frequence: 'certains' }, requis: true },
        { id: 'tousLesN', type: 'nombre', label: 'Tous les combien de jours ?', min: 2, max: 60, defaut: 2, suffixe: 'jours', si: { frequence: 'n' } },
        { id: 'debut', type: 'date', label: 'À partir du', defaut: aujourdhui, requis: true },
        ...champsFin()
      ],
      construire(r) {
        const regle = {
          unite: r.frequence === 'certains' ? 'semaine' : 'jour',
          intervalle: r.frequence === 'n' ? r.tousLesN : 1,
          jours: r.frequence === 'certains' ? r.jours : [],
          fin: lireFin(r, r.debut)
        };
        const base = { titre: `Prendre ${r.nom}`, etiquettes: ['important'], moment: 'partout', duree: 5, echeance: null, etapes: [] };
        return tachesParHeure(base, r.heures, regle, r.debut);
      }
    },

    /* ---------- 🧾 Facture / paiement ---------- */
    {
      id: 'facture', emoji: '🧾', nom: 'Facture ou paiement', exemples: 'Loyer, abonnement, impôts',
      description: 'Un rappel quelques jours avant chaque échéance, pour avoir le temps de payer.',
      champs: [
        { id: 'quoi', type: 'texte', label: 'Quoi ?', placeholder: 'Ex. : Payer le loyer', requis: true },
        { id: 'date', type: 'date', label: 'Prochaine échéance', requis: true },
        { id: 'frequence', type: 'choix', label: 'Ça revient…', defaut: 'mois', options: [
          ['mois', 'Tous les mois'], ['trimestre', 'Tous les 3 mois'], ['an', 'Tous les ans']] },
        { id: 'avance', type: 'choix', label: 'Me prévenir…', defaut: '3', options: [
          ['0', 'Le jour même'], ['1', 'La veille'], ['3', '3 jours avant'], ['7', '1 semaine avant']] },
        { id: 'heure', type: 'heure', label: 'Heure du rappel', defaut: () => A().HEURE_PAR_DEFAUT }
      ],
      construire(r) {
        return [rappelAvantEcheance(r.quoi, r.date, r.heure, Number(r.avance),
          r.frequence === 'an' ? 'an' : 'mois', r.frequence === 'trimestre' ? 3 : 1, 10)];
      }
    },

    /* ---------- 📄 Renouvellement ---------- */
    {
      id: 'renouvellement', emoji: '📄', nom: 'Renouvellement', exemples: 'Ordonnance, contrôle technique, assurance',
      description: 'Pour ce qui expire et qu\'il faut renouveler à temps : un rappel bien avant la date limite.',
      champs: [
        { id: 'quoi', type: 'texte', label: 'Quoi ?', placeholder: 'Ex. : Renouveler l\'ordonnance', requis: true },
        { id: 'date', type: 'date', label: 'Prochaine date limite', requis: true },
        { id: 'tousLes', type: 'nombre', label: 'Ça revient tous les…', min: 1, max: 60, defaut: 1 },
        { id: 'unite', type: 'choix', label: '', defaut: 'an', options: [['mois', 'mois'], ['an', 'an(s)']] },
        { id: 'avance', type: 'choix', label: 'Me prévenir…', defaut: '14', options: [
          ['7', '1 semaine avant'], ['14', '2 semaines avant'], ['30', '1 mois avant'], ['60', '2 mois avant']] },
        { id: 'heure', type: 'heure', label: 'Heure du rappel', defaut: () => A().HEURE_PAR_DEFAUT }
      ],
      construire(r) {
        return [rappelAvantEcheance(r.quoi, r.date, r.heure, Number(r.avance), r.unite, r.tousLes, 30)];
      }
    },

    /* ---------- 📅 Chaque semaine ---------- */
    {
      id: 'semaine', emoji: '📅', nom: 'Chaque semaine', exemples: 'Poubelles, sport, courses',
      description: 'Les mêmes jours chaque semaine, à la même heure.',
      champs: [
        { id: 'quoi', type: 'texte', label: 'Quoi ?', placeholder: 'Ex. : Sortir les poubelles', requis: true },
        { id: 'jours', type: 'jours', label: 'Quels jours ?', requis: true },
        { id: 'heure', type: 'heure', label: 'À quelle heure ?', defaut: () => A().HEURE_PAR_DEFAUT },
        { id: 'moment', type: 'moment', label: 'Moment de vie', defaut: 'perso' }
      ],
      construire(r) {
        const regle = { unite: 'semaine', intervalle: 1, jours: r.jours, fin: null, ancre: dateHeure(aujourdhui(), r.heure).toISOString() };
        const rappel = R().premiere(regle);
        return [{ titre: r.quoi, etiquettes: [], moment: r.moment, duree: 15, echeance: null, etapes: [],
                  rappel: rappel.toISOString(), recurrence: { ...regle, ancre: rappel.toISOString() } }];
      }
    },

    /* ---------- 🌱 Tous les N jours ---------- */
    {
      id: 'nJours', emoji: '🌱', nom: 'Tous les N jours', exemples: 'Plantes, litière, lessive',
      description: 'Un rappel à intervalle régulier : tous les 2 jours, tous les 10 jours…',
      champs: [
        { id: 'quoi', type: 'texte', label: 'Quoi ?', placeholder: 'Ex. : Arroser les plantes', requis: true },
        { id: 'n', type: 'nombre', label: 'Tous les combien de jours ?', min: 1, max: 365, defaut: 3, suffixe: 'jours' },
        { id: 'debut', type: 'date', label: 'À partir du', defaut: aujourdhui, requis: true },
        { id: 'heure', type: 'heure', label: 'À quelle heure ?', defaut: () => A().HEURE_PAR_DEFAUT },
        { id: 'moment', type: 'moment', label: 'Moment de vie', defaut: 'perso' }
      ],
      construire(r) {
        const regle = { unite: 'jour', intervalle: r.n, jours: [], fin: null, ancre: dateHeure(r.debut, r.heure).toISOString() };
        const rappel = R().premiere(regle);
        return [{ titre: r.quoi, etiquettes: [], moment: r.moment, duree: 15, echeance: null, etapes: [],
                  rappel: rappel.toISOString(), recurrence: regle }];
      }
    },

    /* ---------- ✏️ Personnalisé ---------- */
    {
      id: 'personnalise', emoji: '✏️', nom: 'Personnalisé', exemples: 'Toutes les options',
      description: 'Réglez tout vous-même. Chaque rappel reste modifiable ensuite avec ✎.',
      champs: [
        { id: 'titre', type: 'texte', label: 'Quoi ? (commencez par un verbe d\'action)', placeholder: 'Ex. : Appeler maman', requis: true },
        { id: 'unite', type: 'choix', label: 'Répéter', defaut: 'jour', options: [
          ['jour', 'Tous les jours'], ['semaine', 'Toutes les semaines'], ['mois', 'Tous les mois'], ['an', 'Tous les ans']] },
        { id: 'intervalle', type: 'nombre', label: 'Espacement (1 = à chaque fois, 2 = une fois sur deux…)', min: 1, max: 99, defaut: 1 },
        { id: 'jours', type: 'jours', label: 'Quels jours ?', si: { unite: 'semaine' }, requis: true },
        { id: 'debut', type: 'date', label: 'À partir du', defaut: aujourdhui, requis: true },
        ...champsPrises('Combien de fois ce jour-là ?'),
        ...champsFin(),
        { id: 'etiquettes', type: 'etiquettes', label: 'Priorités' },
        { id: 'moment', type: 'moment', label: 'Moment de vie', defaut: 'partout' }
      ],
      construire(r) {
        const regle = { unite: r.unite, intervalle: r.intervalle, jours: r.unite === 'semaine' ? r.jours : [], fin: lireFin(r, r.debut) };
        const base = { titre: r.titre, etiquettes: r.etiquettes, moment: r.moment, duree: null, echeance: null, etapes: [] };
        return tachesParHeure(base, r.heures, regle, r.debut);
      }
    }
  ];

  // Commun à Facture et Renouvellement : un rappel "avance" jours avant
  // chaque échéance, et l'échéance elle-même comme date limite de la tâche.
  function rappelAvantEcheance(titre, dateTexte, heure, avance, unite, intervalle, duree) {
    const echeance = dateHeure(dateTexte, heure);
    const regle = { unite, intervalle, jours: [], fin: null, ancre: decaler(echeance, -avance).toISOString() };
    const rappel = R().premiere(regle, new Date(), true);
    return { titre, etiquettes: ['important'], moment: 'partout', duree, etapes: [],
             rappel: rappel.toISOString(), echeance: decaler(rappel, avance).toISOString(), recurrence: regle };
  }

  return {
    liste: MODELES,
    trouver: id => MODELES.find(m => m.id === id),
    aujourdhui,
    texteAge
  };
})();
