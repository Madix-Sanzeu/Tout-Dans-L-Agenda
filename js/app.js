/* =====================================================================
   app.js — LE CHEF D'ORCHESTRE
   ---------------------------------------------------------------------
   Ce fichier relie tout :
   1. il charge les données (stockage.js) ;
   2. il les trie (priorite.js) selon le moment en cours (moments.js) ;
   3. il les AFFICHE (fonction "afficher") ;
   4. il réagit aux clics (fonction "brancherEvenements") ;
   5. il vérifie les rappels régulièrement (rappels.js).

   Règle d'or de ce fichier : à chaque modification des données, on
   appelle "sauverEtAfficher()". L'écran est entièrement redessiné à
   partir des données : il ne peut donc jamais être "désynchronisé".
   ===================================================================== */

window.TDA = window.TDA || {};

TDA.app = (function () {

  /* ------------------------------------------------------------------
     1. L'ÉTAT : toutes les données en mémoire pendant que l'appli tourne
     ------------------------------------------------------------------ */
  const etat = {
    taches: [],          // la liste de toutes les tâches
    moments: [],         // les moments de vie (Travail, Perso...)
    voirTout: false,     // case "Tous les moments" cochée ?
    tacheEnEdition: null // id de la tâche ouverte dans le formulaire (null = nouvelle)
  };
  let momentsBrouillon = []; // copie modifiable pendant l'édition des réglages

  // Raccourci : $('liste') au lieu de document.getElementById('liste')
  const $ = (id) => document.getElementById(id);

  /* ------------------------------------------------------------------
     2. PETITS OUTILS
     ------------------------------------------------------------------ */

  // Fabrique un identifiant unique, ex. "lq3k9x-a8f2c"
  function nouvelId() {
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }

  // Protège le texte saisi avant de l'insérer dans la page
  // (sinon un titre contenant "<script>" pourrait être interprété).
  function proteger(texte) {
    return String(texte).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // Date ISO (stockée) → valeur pour un champ <input type="datetime-local">
  function versChampDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); // passe en heure locale
    return d.toISOString().slice(0, 16);                    // "2026-11-23T20:15"
  }
  // ... et l'inverse
  function depuisChampDate(valeur) {
    return valeur ? new Date(valeur).toISOString() : null;
  }

  // Affiche une date de façon lisible : "aujourd'hui 14:00", "demain 9:00", "lun. 2 déc. 10:00"
  function dateLisible(iso) {
    const d = new Date(iso);
    const heure = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const aujourdhui = new Date(); aujourdhui.setHours(0, 0, 0, 0);
    const jour = new Date(d); jour.setHours(0, 0, 0, 0);
    const ecart = Math.round((jour - aujourdhui) / 86400000);
    if (ecart === 0) return "aujourd'hui " + heure;
    if (ecart === 1) return 'demain ' + heure;
    if (ecart === -1) return 'hier ' + heure;
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) + ' ' + heure;
  }

  // 20 → "20 min", 80 → "1 h 20", 160 → "2 h 40"
  function dureeLisible(minutes) {
    if (minutes < 60) return minutes + ' min';
    const h = Math.floor(minutes / 60), m = minutes % 60;
    return h + ' h' + (m ? ' ' + String(m).padStart(2, '0') : '');
  }

  // Les repères d'échéance en un clic : "Aujourd'hui", "Cette semaine"...
  function dateHorizon(id) {
    const d = new Date();
    const versDimanche = (7 - d.getDay()) % 7;             // jours jusqu'à dimanche
    switch (id) {
      case 'aujourdhui': break;
      case 'semaine': d.setDate(d.getDate() + versDimanche); break;
      case 'semaineProchaine': d.setDate(d.getDate() + versDimanche + 7); break;
      case 'mois': d.setMonth(d.getMonth() + 1, 0); break;  // jour 0 du mois suivant = dernier jour
      default: return '';                                    // "Plus tard" = pas d'échéance
    }
    d.setHours(20, 0, 0, 0);
    return versChampDate(d.toISOString());
  }

  function estAujourdhui(iso) {
    return iso && new Date(iso).toDateString() === new Date().toDateString();
  }

  // Message temporaire en bas de l'écran, avec un bouton facultatif ("Annuler").
  let minuteurBandeau;
  function afficherBandeau(message, actionTexte, action) {
    const bandeau = $('bandeau');
    bandeau.innerHTML = '<span>' + proteger(message) + '</span>';
    if (actionTexte) {
      const bouton = document.createElement('button');
      bouton.textContent = actionTexte;
      bouton.onclick = () => { action(); bandeau.hidden = true; };
      bandeau.appendChild(bouton);
    }
    bandeau.hidden = false;
    clearTimeout(minuteurBandeau);
    minuteurBandeau = setTimeout(() => { bandeau.hidden = true; }, 5000);
  }

  function sauverEtAfficher() {
    TDA.stockage.ecrireTaches(etat.taches);
    TDA.push.planifierSynchro(etat.taches); // tient le serveur de rappels à jour (si activé)
    afficher();
  }

  function trouverTache(id) {
    return etat.taches.find(t => t.id === id);
  }

  /* ------------------------------------------------------------------
     3. L'AFFICHAGE
     ------------------------------------------------------------------ */

  // Les petites pastilles colorées (étiquettes, moment, échéance...)
  function htmlMeta(tache, montrerMoment) {
    let html = '';
    // La case de la matrice d'Eisenhower (calculée par priorite.js)
    if (tache.quadrant && !tache.faiteLe) {
      const Q = TDA.config.QUADRANTS[tache.quadrant];
      html += `<span class="pastille pastille-case" style="--c:${Q.couleur}">${Q.emoji} ${Q.nom}</span>`;
    }
    // "Nouveau" est calculé automatiquement (voir priorite.js), pas coché.
    if (TDA.priorite.estNouvelle(tache)) {
      const n = TDA.config.NOUVEAU;
      html += `<span class="pastille" style="--c:${n.couleur}">${n.emoji} ${n.nom}</span>`;
    }
    // Urgent / Important sont déjà résumés par la case ; on n'affiche que "Agréable".
    for (const e of TDA.config.ETIQUETTES) {
      if (tache.etiquettes.includes(e.id) && (e.id === 'agreable' || tache.faiteLe)) {
        html += `<span class="pastille" style="--c:${e.couleur}">${e.emoji} ${e.nom}</span>`;
      }
    }
    if (montrerMoment) {
      const m = TDA.moments.trouver(etat.moments, tache.moment);
      html += `<span class="pastille" style="--c:${m.couleur}">${m.emoji} ${proteger(m.nom)}</span>`;
    }
    if (tache.echeance) html += `<span>📅 ${dateLisible(tache.echeance)}</span>`;
    // Durée affichée AVEC la marge d'un tiers conseillée par l'article
    if (tache.duree) html += `<span title="Estimation ${tache.duree} min + un tiers de marge">⏱ ≈ ${dureeLisible(TDA.priorite.dureeAvecMarge(tache))}</span>`;
    const etapes = tache.etapes || [];
    if (etapes.length) html += `<span>🪜 ${etapes.filter(e => e.fait).length}/${etapes.length} étapes</span>`;
    if (tache.rappel && !tache.rappelEnvoye) html += `<span>🔔 ${dateLisible(tache.rappel)}</span>`;
    if (tache.reporteJusqua && TDA.priorite.estReportee(tache)) html += `<span>⏭ jusqu'à ${dateLisible(tache.reporteJusqua)}</span>`;
    return html;
  }

  // Une ligne de la liste. "data-action" et "data-id" servent à savoir
  // sur quoi on a cliqué (voir la fonction "surClicListe").
  function htmlLigne(tache, options = {}) {
    const m = TDA.moments.trouver(etat.moments, tache.moment);
    const fait = Boolean(tache.faiteLe);
    return `
      <li class="tache ${fait ? 'faite' : ''}" style="--couleur-moment:${m.couleur}">
        <button class="case" data-action="${fait ? 'defaire' : 'faire'}" data-id="${tache.id}"
                aria-label="${fait ? 'Remettre à faire' : 'Marquer comme faite'}">${fait ? '✓' : ''}</button>
        <div class="tache-corps">
          <div class="tache-titre">${proteger(tache.titre)}</div>
          <div class="meta">
            ${htmlMeta(tache, options.montrerMoment)}
            ${fait ? '' : `<button class="score" data-action="raisons" data-id="${tache.id}" title="Pourquoi ce rang ?">Pourquoi ? ${tache.score} pts</button>`}
          </div>
          <div class="raisons" id="raisons-${tache.id}" hidden>${(tache.raisons || []).join(' · ') || 'Aucun critère'}</div>
        </div>
        ${options.reportee ? `<button class="bouton-texte" data-action="reprendre" data-id="${tache.id}">Reprendre</button>` : ''}
        ${fait ? '' : `<button class="bouton-texte" data-action="modifier" data-id="${tache.id}" aria-label="Modifier">✎</button>`}
      </li>`;
  }

  // Redessine tout l'écran à partir de "etat".
  function afficher() {
    const maintenant = new Date();
    const actifs = TDA.moments.actifs(etat.moments, maintenant);

    // a) Le moment en cours, sous le titre
    const nomsActifs = actifs.filter(id => id !== 'partout')
      .map(id => { const m = TDA.moments.trouver(etat.moments, id); return m.emoji + ' ' + m.nom; });
    $('moment-actuel').textContent = nomsActifs.length
      ? 'Moment : ' + nomsActifs.join(' + ')
      : '🌙 Hors plages — temps libre';

    // b) Quelles tâches afficher ?
    const aFaire = etat.taches.filter(t => !t.faiteLe);
    const visibles = etat.voirTout ? aFaire : aFaire.filter(t => actifs.includes(t.moment));
    const triees = TDA.priorite.trier(visibles, maintenant);
    const pretes = triees.filter(t => !TDA.priorite.estReportee(t, maintenant));
    const reportees = triees.filter(t => TDA.priorite.estReportee(t, maintenant));

    // c) La grande carte "Maintenant" = la n°1
    const premiere = pretes[0];
    if (premiere) {
      const m = TDA.moments.trouver(etat.moments, premiere.moment);
      const Q = TDA.config.QUADRANTS[premiere.quadrant];
      const etapes = premiere.etapes || [];
      // Les étapes : on peut les cocher une à une directement sur la carte
      const htmlEtapes = etapes.length ? `
          <ol class="etapes">
            ${etapes.map((e, i) => `
              <li class="${e.fait ? 'faite' : ''}">
                <button class="case case-petite" data-action="etape" data-id="${premiere.id}" data-etape="${i}"
                        aria-label="${e.fait ? 'Décocher' : 'Cocher'} l'étape">${e.fait ? '✓' : ''}</button>
                <span>${proteger(e.texte)}</span>
              </li>`).join('')}
          </ol>` : '';
      $('maintenant').innerHTML = `
        <article class="carte-maintenant" style="--couleur-moment:${m.couleur}">
          <div class="meta">${htmlMeta(premiere, true)}</div>
          <h3>${proteger(premiere.titre)}</h3>
          <p class="conseil" style="--c:${Q.couleur}">${Q.emoji} ${Q.conseil}</p>
          ${htmlEtapes}
          <div class="raisons">Pourquoi maintenant : ${premiere.raisons.join(' · ') || 'c\'est la seule tâche'}</div>
          <div class="boutons-maintenant">
            <button class="bouton-fait" data-action="faire" data-id="${premiere.id}">✅ C'est fait</button>
            <button class="bouton-secondaire" data-action="reporter" data-id="${premiere.id}">⏭ Pas maintenant</button>
            <button class="bouton-texte" data-action="modifier" data-id="${premiere.id}">✎ Modifier</button>
          </div>
        </article>`;
    } else {
      $('maintenant').innerHTML = `
        <div class="carte-vide">
          <strong>${aFaire.length ? 'Rien pour ce moment-ci 🎉' : 'Aucune tâche pour l\'instant'}</strong>
          ${aFaire.length ? 'Profitez-en, ou cochez « Tous les moments ».' : 'Ajoutez la première avec le bouton ci-dessous.'}
          ${etat.taches.length ? '' : '<p><button class="bouton-secondaire" data-action="exemple">👀 Voir un exemple</button></p>'}
        </div>`;
    }

    // d) La suite de la liste
    $('liste').innerHTML = pretes.slice(1).map(t => htmlLigne(t, { montrerMoment: etat.voirTout })).join('');

    // e) Les tâches cachées parce qu'elles appartiennent à un autre moment
    const cachees = aFaire.length - visibles.length;
    $('info-autres-moments').textContent = cachees > 0
      ? `${cachees} tâche${cachees > 1 ? 's attendent' : ' attend'} un autre moment de vie.`
      : '';

    // f) Les zones repliables
    $('liste-reportees').innerHTML = reportees.map(t => htmlLigne(t, { reportee: true, montrerMoment: true })).join('');
    $('nb-reportees').textContent = reportees.length;
    $('zone-reportees').hidden = reportees.length === 0;

    const faites = etat.taches.filter(t => estAujourdhui(t.faiteLe));
    $('liste-faites').innerHTML = faites.map(t => htmlLigne(t)).join('');
    $('nb-faites').textContent = faites.length;
    $('zone-faites').hidden = faites.length === 0;
  }

  /* ------------------------------------------------------------------
     4. LES ACTIONS SUR LES TÂCHES
     ------------------------------------------------------------------ */

  function faire(id) {
    const t = trouverTache(id);
    t.faiteLe = new Date().toISOString();
    sauverEtAfficher();
    afficherBandeau('Bravo, une de moins ! 🎉', 'Annuler', () => defaire(id));
  }

  function defaire(id) {
    const t = trouverTache(id);
    t.faiteLe = null;
    sauverEtAfficher();
  }

  function reporter(id) {
    const t = trouverTache(id);
    t.reporteJusqua = new Date(Date.now() + TDA.config.REPORT_MINUTES * 60000).toISOString();
    // Reporter ne fait pas oublier : le rappel est reprogrammé à la fin du report.
    t.rappel = t.reporteJusqua;
    t.rappelEnvoye = false;
    sauverEtAfficher();
    afficherBandeau(`Reportée de ${TDA.config.REPORT_MINUTES} min.`, 'Annuler', () => reprendre(id));
  }

  function reprendre(id) {
    trouverTache(id).reporteJusqua = null;
    sauverEtAfficher();
  }

  // Un seul "écouteur" pour tous les boutons des listes : on lit
  // data-action / data-id sur l'élément cliqué. (C'est la "délégation".)
  function surClicListe(evenement) {
    const bouton = evenement.target.closest('[data-action]');
    if (!bouton) return;
    const id = bouton.dataset.id;
    switch (bouton.dataset.action) {
      case 'faire':     faire(id); break;
      case 'defaire':   defaire(id); break;
      case 'reporter':  reporter(id); break;
      case 'reprendre': reprendre(id); break;
      case 'modifier':  ouvrirFormulaire(id); break;
      case 'raisons':   $('raisons-' + id).hidden = !$('raisons-' + id).hidden; break;
      case 'etape':     cocherEtape(id, Number(bouton.dataset.etape)); break;
      case 'exemple':   chargerExemple(); break;
    }
  }

  // Cocher une étape. Quand toutes sont cochées, on propose de finir la tâche.
  function cocherEtape(id, index) {
    const t = trouverTache(id);
    t.etapes[index].fait = !t.etapes[index].fait;
    sauverEtAfficher();
    if (t.etapes.every(e => e.fait)) {
      afficherBandeau('Toutes les étapes sont faites !', 'Terminer la tâche', () => faire(id));
    }
  }

  // Des tâches d'exemple, pour présenter l'appli sans tout saisir.
  function chargerExemple() {
    const dans = (heures) => new Date(Date.now() + heures * 3600000).toISOString();
    const base = { rappelEnvoye: false, faiteLe: null, reporteJusqua: null };
    etat.taches = [
      { ...base, id: nouvelId(), titre: 'Envoyer le dossier de la CAF', etiquettes: ['important'], moment: 'partout',
        echeance: dans(20), duree: 30, rappel: dans(1), creeLe: dans(-72),
        etapes: [{ texte: 'Retrouver le dernier avis d\'imposition', fait: true },
                 { texte: 'Scanner les 3 justificatifs', fait: false },
                 { texte: 'Remplir le formulaire en ligne', fait: false },
                 { texte: 'Envoyer et noter le numéro de dossier', fait: false }] },
      { ...base, id: nouvelId(), titre: 'Préparer la présentation de lundi', etiquettes: ['important'], moment: 'travail',
        echeance: dans(24 * 6), duree: 120, rappel: dans(18), creeLe: dans(-30), etapes: [] },
      { ...base, id: nouvelId(), titre: 'Rappeler le plombier', etiquettes: ['urgent'], moment: 'partout',
        echeance: null, duree: 5, rappel: dans(2), creeLe: dans(-2), etapes: [] },
      { ...base, id: nouvelId(), titre: 'Choisir un cadeau pour Léa', etiquettes: ['important', 'agreable'], moment: 'perso',
        echeance: dans(24 * 12), duree: 30, rappel: dans(26), creeLe: dans(-5), etapes: [] },
      { ...base, id: nouvelId(), titre: 'Trier les photos du téléphone', etiquettes: ['agreable'], moment: 'perso',
        echeance: null, duree: 60, rappel: dans(48), creeLe: dans(-200), etapes: [] },
      { ...base, id: nouvelId(), titre: 'Répondre au mail du club de sport', etiquettes: [], moment: 'partout',
        echeance: dans(30), duree: 10, rappel: dans(3), creeLe: dans(-1), etapes: [] }
    ];
    etat.voirTout = true;
    $('voir-tout').checked = true;
    sauverEtAfficher();
    afficherBandeau('Exemple chargé (6 tâches). « Tous les moments » est activé.');
  }

  /* ------------------------------------------------------------------
     5. LE FORMULAIRE "AJOUTER / MODIFIER"
     ------------------------------------------------------------------ */

  function ouvrirFormulaire(id = null) {
    etat.tacheEnEdition = id;
    const t = id ? trouverTache(id) : null;

    $('titre-dialogue-tache').textContent = t ? 'Modifier la tâche' : 'Nouvelle tâche';
    $('bouton-supprimer').hidden = !t;
    $('bouton-supprimer').dataset.confirmer = '';
    $('bouton-supprimer').textContent = 'Supprimer';
    $('champ-titre').value = t ? t.titre : '';

    // Les étiquettes à cocher ("Nouveau" n'y figure pas : il est automatique).
    $('choix-etiquettes').innerHTML = TDA.config.ETIQUETTES.map(e => {
      const coche = t ? t.etiquettes.includes(e.id) : false;
      return `<label style="--c:${e.couleur}"><input type="checkbox" value="${e.id}" ${coche ? 'checked' : ''}>${e.emoji} ${e.nom}</label>`;
    }).join('');

    // Le moment : par défaut, le moment en cours (sinon "N'importe quand").
    const actifs = TDA.moments.actifs(etat.moments);
    const momentParDefaut = actifs[1] || 'partout';
    $('champ-moment').innerHTML = TDA.moments.tous(etat.moments)
      .map(m => `<option value="${m.id}">${m.emoji} ${proteger(m.nom)}</option>`).join('');
    $('champ-moment').value = t ? t.moment : momentParDefaut;

    $('champ-echeance').value = t ? versChampDate(t.echeance) : '';
    $('champ-duree').value = t && t.duree ? String(t.duree) : '';
    $('aide-decouper').hidden = !(t && t.duree >= 60);
    // Les étapes : une par ligne dans la zone de texte
    $('champ-etapes').value = t && t.etapes ? t.etapes.map(e => e.texte).join('\n') : '';
    // Les repères d'échéance (« Aujourd'hui », « Cette semaine »...)
    $('raccourcis-echeance').innerHTML = TDA.config.HORIZONS
      .map(h => `<button type="button" data-horizon="${h.id}">${h.nom}</button>`).join('');
    // Rappel OBLIGATOIRE : pour une nouvelle tâche (ou un rappel déjà passé),
    // on propose d'office une heure, que l'utilisateur peut changer.
    const rappelPropose = new Date(Date.now() + TDA.config.RAPPEL_PAR_DEFAUT_MINUTES * 60000).toISOString();
    $('champ-rappel').value = versChampDate(t && !t.rappelEnvoye && t.rappel ? t.rappel : rappelPropose);

    $('dialogue-tache').showModal();
    $('champ-titre').focus();
  }

  function enregistrerFormulaire(evenement) {
    evenement.preventDefault(); // empêche le rechargement de la page
    const titre = $('champ-titre').value.trim();
    if (!titre) return;
    // Pas de rappel = pas d'enregistrement (le champ est aussi "required" dans le HTML).
    if (!$('champ-rappel').value) {
      afficherBandeau('Un rappel est obligatoire : choisissez quand y repenser.');
      $('champ-rappel').focus();
      return;
    }

    const donnees = {
      titre,
      etiquettes: [...$('choix-etiquettes').querySelectorAll('input:checked')].map(i => i.value),
      moment: $('champ-moment').value,
      echeance: depuisChampDate($('champ-echeance').value),
      duree: $('champ-duree').value ? Number($('champ-duree').value) : null,
      rappel: depuisChampDate($('champ-rappel').value)
    };

    // Les étapes : on garde l'état "fait" des lignes qui n'ont pas changé.
    const anciennes = etat.tacheEnEdition ? (trouverTache(etat.tacheEnEdition).etapes || []) : [];
    donnees.etapes = $('champ-etapes').value.split('\n').map(l => l.trim()).filter(Boolean)
      .map(texte => ({ texte, fait: Boolean(anciennes.find(a => a.texte === texte && a.fait)) }));

    if (etat.tacheEnEdition) {
      const t = trouverTache(etat.tacheEnEdition);
      if (donnees.rappel !== t.rappel) t.rappelEnvoye = false; // nouveau rappel → il pourra sonner
      Object.assign(t, donnees);                                // copie les nouveaux champs
    } else {
      etat.taches.push({
        id: nouvelId(),
        ...donnees,
        rappelEnvoye: false,
        creeLe: new Date().toISOString(),
        faiteLe: null,
        reporteJusqua: null
      });
    }

    // Premier rappel programmé → on propose d'activer les notifications.
    if (donnees.rappel && TDA.rappels.disponibles() && Notification.permission === 'default') {
      TDA.rappels.demanderAutorisation();
    }

    $('dialogue-tache').close();
    sauverEtAfficher();
  }

  function supprimerTache() {
    const t = trouverTache(etat.tacheEnEdition);
    if (!t) return;
    // Confirmation en deux clics, sans fenêtre du navigateur (plus doux,
    // et les fenêtres "confirm()" sont bloquées dans certains contextes).
    const bouton = $('bouton-supprimer');
    if (bouton.dataset.confirmer !== 'oui') {
      bouton.dataset.confirmer = 'oui';
      bouton.textContent = 'Vraiment supprimer ?';
      return;
    }
    etat.taches = etat.taches.filter(x => x.id !== t.id);
    $('dialogue-tache').close();
    sauverEtAfficher();
  }

  // Les boutons "Dans 15 min", "Dans 1 h", "Demain 9 h", "Aucun"
  function raccourciRappel(valeur) {
    let d = new Date();
    if (valeur === 'soir') { d.setHours(18, 0, 0, 0); if (d < new Date()) d.setDate(d.getDate() + 1); }
    else if (valeur === 'demain') { d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); }
    else d = new Date(Date.now() + Number(valeur) * 60000);
    $('champ-rappel').value = versChampDate(d.toISOString());
  }

  /* ------------------------------------------------------------------
     6. LES RÉGLAGES (moments de vie, notifications, sauvegarde)
     ------------------------------------------------------------------ */

  const NOMS_JOURS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
  const ORDRE_JOURS = [1, 2, 3, 4, 5, 6, 0]; // on affiche du lundi au dimanche

  function ouvrirReglages() {
    momentsBrouillon = structuredClone(etat.moments);
    afficherEditeurMoments();
    afficherEtatNotifications();
    afficherEtatSauvegarde();
    $('dialogue-reglages').showModal();
  }

  function afficherEditeurMoments() {
    $('editeur-moments').innerHTML = momentsBrouillon.map((m, i) => `
      <div class="moment-edition" data-index="${i}">
        <div class="moment-entete">
          <input value="${proteger(m.emoji)}" data-champ="emoji" aria-label="Emoji" maxlength="4">
          <input value="${proteger(m.nom)}" data-champ="nom" aria-label="Nom du moment" maxlength="30">
          <button type="button" class="bouton-texte" data-reglage="supprimer-moment" aria-label="Supprimer ce moment">🗑</button>
        </div>
        ${m.plages.map((p, j) => `
          <div class="plage" data-plage="${j}">
            ${ORDRE_JOURS.map(jour => `<button type="button" class="jour ${p.jours.includes(jour) ? 'actif' : ''}"
                data-reglage="jour" data-jour="${jour}">${NOMS_JOURS[jour]}</button>`).join('')}
            <input type="time" value="${p.debut}" data-champ="debut" aria-label="Début">
            →
            <input type="time" value="${p.fin}" data-champ="fin" aria-label="Fin">
            <button type="button" class="bouton-texte" data-reglage="supprimer-plage" aria-label="Supprimer cette plage">✕</button>
          </div>`).join('')}
        <button type="button" class="bouton-texte" data-reglage="ajouter-plage">＋ plage horaire</button>
      </div>`).join('');
  }

  // Clics dans l'éditeur de moments (délégation, comme pour la liste)
  function surClicReglages(evenement) {
    const bouton = evenement.target.closest('[data-reglage]');
    if (!bouton) return;
    const bloc = bouton.closest('.moment-edition');
    const moment = momentsBrouillon[Number(bloc.dataset.index)];
    const plageEl = bouton.closest('.plage');
    const plage = plageEl ? moment.plages[Number(plageEl.dataset.plage)] : null;

    switch (bouton.dataset.reglage) {
      case 'jour': {
        const jour = Number(bouton.dataset.jour);
        plage.jours = plage.jours.includes(jour) ? plage.jours.filter(j => j !== jour) : [...plage.jours, jour];
        break;
      }
      case 'supprimer-plage': moment.plages.splice(Number(plageEl.dataset.plage), 1); break;
      case 'ajouter-plage': moment.plages.push({ jours: [1, 2, 3, 4, 5], debut: '09:00', fin: '17:00' }); break;
      case 'supprimer-moment': momentsBrouillon.splice(Number(bloc.dataset.index), 1); break;
    }
    afficherEditeurMoments();
  }

  // Saisie dans les champs texte / heure de l'éditeur
  function surSaisieReglages(evenement) {
    const champ = evenement.target.dataset.champ;
    if (!champ) return;
    const bloc = evenement.target.closest('.moment-edition');
    const moment = momentsBrouillon[Number(bloc.dataset.index)];
    const plageEl = evenement.target.closest('.plage');
    if (plageEl) moment.plages[Number(plageEl.dataset.plage)][champ] = evenement.target.value;
    else moment[champ] = evenement.target.value;
  }

  function nouveauMoment() {
    const couleurs = ['#0c8599', '#9c36b5', '#f08c00', '#5c940d', '#c2255c'];
    momentsBrouillon.push({
      id: 'm-' + nouvelId(), nom: 'Nouveau moment', emoji: '📌',
      couleur: couleurs[momentsBrouillon.length % couleurs.length],
      plages: [{ jours: [6, 0], debut: '10:00', fin: '12:00' }]
    });
    afficherEditeurMoments();
  }

  function enregistrerReglages() {
    // Les tâches d'un moment supprimé passent en "N'importe quand".
    const idsRestants = momentsBrouillon.map(m => m.id);
    for (const t of etat.taches) {
      if (t.moment !== 'partout' && !idsRestants.includes(t.moment)) t.moment = 'partout';
    }
    etat.moments = momentsBrouillon;
    TDA.stockage.ecrireMoments(etat.moments);
    $('dialogue-reglages').close();
    sauverEtAfficher();
    afficherBandeau('Réglages enregistrés.');
  }

  function afficherEtatNotifications() {
    const textes = {
      granted: '✅ Notifications activées (elles sonnent quand l\'appli est ouverte ou en arrière-plan récent).',
      denied: '🚫 Notifications refusées. Réactivez-les dans les réglages du navigateur ; en attendant, un bandeau s\'affiche dans l\'appli.',
      default: 'Les notifications ne sont pas encore activées.'
    };
    const permission = TDA.rappels.disponibles() ? Notification.permission : 'indisponible';
    $('etat-notifications').textContent = textes[permission] || 'Ce navigateur ne gère pas les notifications.';
    $('bouton-notifications').hidden = permission !== 'default';
    afficherEtatPush();
  }

  // Le bloc "Rappels même appli fermée" des réglages
  function afficherEtatPush() {
    const actif = TDA.push.estActif();
    let message = '';
    if (!TDA.push.serveurConfigure()) message = '⏳ Bientôt disponible.';
    else if (actif) message = '✅ Activé sur cet appareil.';
    else if (!TDA.push.compatible()) message = 'Non disponible dans ce navigateur. Sur iPhone : ajoutez d\'abord l\'appli à l\'écran d\'accueil (voir « Installer l\'appli »).';
    $('etat-push').textContent = message;
    $('zone-activer-push').hidden = actif || !TDA.push.serveurConfigure() || !TDA.push.compatible();
    $('zone-desactiver-push').hidden = !actif;
    if (actif) $('push-masquer-titres-actif').checked = Boolean(TDA.push.lireEtat().masquerTitres);
  }

  async function activerPush() {
    const bouton = $('bouton-activer-push');
    bouton.disabled = true;
    try {
      await TDA.push.activer(etat.taches, $('push-masquer-titres').checked);
      afficherBandeau('Rappels activés, même appli fermée. 🔔');
    } catch (e) {
      afficherBandeau(e.message);
    }
    bouton.disabled = false;
    afficherEtatNotifications();
  }

  async function desactiverPush() {
    await TDA.push.desactiver();
    afficherBandeau('Rappels push désactivés, données effacées du serveur.');
    afficherEtatNotifications();
  }

  /* ---------- La sauvegarde dans un fichier ----------
     Les tâches ne sont que sur l'appareil. Pour ne pas les perdre (navigateur
     vidé, changement de téléphone), on fabrique un petit fichier texte (JSON)
     que la personne range où elle veut, puis "Restaurer" le relit. */

  // Nombre de jours entiers écoulés depuis une date ISO (null si pas de date).
  function joursDepuis(iso) {
    if (!iso) return null;
    return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  }

  // Le petit texte "Dernière sauvegarde : …" dans les réglages.
  function afficherEtatSauvegarde() {
    const jours = joursDepuis(TDA.stockage.lireDerniereSauvegarde());
    let message;
    if (jours === null) message = '⚠️ Aucune sauvegarde pour l\'instant.';
    else if (jours === 0) message = '✅ Dernière sauvegarde : aujourd\'hui.';
    else if (jours === 1) message = '✅ Dernière sauvegarde : hier.';
    else message = (jours > TDA.config.SAUVEGARDE_RAPPEL_JOURS ? '⚠️' : '✅')
      + ' Dernière sauvegarde : il y a ' + jours + ' jours.';
    $('etat-sauvegarde').textContent = message;
  }

  // Bouton "Sauvegarder".
  // 1. Sur téléphone, on ouvre le menu "Partager" : la personne envoie le
  //    fichier vers Drive, ses e-mails, WhatsApp… (navigator.share).
  // 2. Sinon (ordinateur, vieux navigateur), on le télécharge.
  async function exporter() {
    const texte = JSON.stringify(TDA.stockage.exporter(), null, 2);
    const nom = 'tda-sauvegarde-' + new Date().toISOString().slice(0, 10);

    // Certains téléphones refusent de partager un .json : on tente alors un .txt
    // (même contenu ; "Restaurer" accepte les deux).
    const essais = [
      new File([texte], nom + '.json', { type: 'application/json' }),
      new File([texte], nom + '.txt', { type: 'text/plain' })
    ];
    const fichier = navigator.canShare ? essais.find(f => navigator.canShare({ files: [f] })) : null;

    if (fichier) {
      try {
        await navigator.share({ files: [fichier], title: 'Sauvegarde Tout Dans l\'Agenda' });
        sauvegardeReussie();
      } catch (e) {
        // "AbortError" = la personne a fermé le menu : ce n'est pas une erreur.
        if (e.name !== 'AbortError') telecharger(texte, nom + '.json');
      }
      return;
    }
    telecharger(texte, nom + '.json');
  }

  // Téléchargement classique d'un fichier fabriqué dans la page.
  function telecharger(texte, nomFichier) {
    const lien = document.createElement('a');
    lien.href = URL.createObjectURL(new Blob([texte], { type: 'application/json' }));
    lien.download = nomFichier;
    lien.click();
    setTimeout(() => URL.revokeObjectURL(lien.href), 1000);
    sauvegardeReussie();
  }

  function sauvegardeReussie() {
    TDA.stockage.noterSauvegarde();
    afficherEtatSauvegarde();
    afficherBandeau('Sauvegarde faite. 💾 Gardez bien ce fichier.');
  }

  // Bouton "Restaurer" : on relit un fichier de sauvegarde.
  function importer(evenement) {
    const fichier = evenement.target.files[0];
    evenement.target.value = ''; // pour pouvoir choisir 2 fois le même fichier
    if (!fichier) return;
    fichier.text().then(texte => {
      let donnees;
      try { donnees = JSON.parse(texte); } catch (e) { donnees = null; }
      if (!donnees || !Array.isArray(donnees.taches)) {
        afficherBandeau('Ce fichier n\'est pas une sauvegarde TDA valide.');
        return;
      }
      // La restauration REMPLACE la liste actuelle : on prévient avant.
      if (etat.taches.length && !confirm('Remplacer vos ' + etat.taches.length
          + ' tâches actuelles par les ' + donnees.taches.length + ' de la sauvegarde ?')) return;

      TDA.stockage.importer(donnees);
      etat.taches = TDA.stockage.lireTaches();
      etat.moments = TDA.stockage.lireMoments();
      TDA.push.planifierSynchro(etat.taches); // met à jour les rappels push s'ils sont activés
      $('dialogue-reglages').close();
      afficher();
      const n = donnees.taches.length;
      afficherBandeau(n + (n > 1 ? ' tâches restaurées.' : ' tâche restaurée.'));
    });
  }

  // Au démarrage : si on a des tâches et pas de sauvegarde récente,
  // on le propose gentiment (au plus une fois par jour, sans bloquer).
  function proposerSauvegarde() {
    if (!etat.taches.length) return;
    const jours = joursDepuis(TDA.stockage.lireDerniereSauvegarde());
    if (jours !== null && jours < TDA.config.SAUVEGARDE_RAPPEL_JOURS) return;
    if (joursDepuis(TDA.stockage.lireDernierRappelSauvegarde()) === 0) return;
    TDA.stockage.noterRappelSauvegarde();
    afficherBandeau(jours === null ? 'Vos tâches ne sont pas encore sauvegardées.'
      : 'Pas de sauvegarde depuis ' + jours + ' jours.', 'Sauvegarder', exporter);
  }

  /* ------------------------------------------------------------------
     7. LE DÉMARRAGE
     ------------------------------------------------------------------ */

  function brancherEvenements() {
    $('maintenant').addEventListener('click', surClicListe);
    $('liste').addEventListener('click', surClicListe);
    $('liste-reportees').addEventListener('click', surClicListe);
    $('liste-faites').addEventListener('click', surClicListe);

    $('bouton-ajouter').addEventListener('click', () => ouvrirFormulaire());
    $('formulaire-tache').addEventListener('submit', enregistrerFormulaire);
    $('bouton-annuler').addEventListener('click', () => $('dialogue-tache').close());
    $('bouton-supprimer').addEventListener('click', supprimerTache);
    document.querySelectorAll('[data-rappel]').forEach(b =>
      b.addEventListener('click', () => raccourciRappel(b.dataset.rappel)));
    $('raccourcis-echeance').addEventListener('click', e => {
      const b = e.target.closest('[data-horizon]');
      if (b) $('champ-echeance').value = dateHorizon(b.dataset.horizon);
    });
    $('champ-duree').addEventListener('change', e => { $('aide-decouper').hidden = Number(e.target.value) < 60; });

    $('voir-tout').addEventListener('change', e => { etat.voirTout = e.target.checked; afficher(); });

    $('bouton-reglages').addEventListener('click', ouvrirReglages);
    $('editeur-moments').addEventListener('click', surClicReglages);
    $('editeur-moments').addEventListener('input', surSaisieReglages);
    $('bouton-nouveau-moment').addEventListener('click', nouveauMoment);
    $('bouton-enregistrer-reglages').addEventListener('click', enregistrerReglages);
    $('bouton-fermer-reglages').addEventListener('click', () => $('dialogue-reglages').close());
    $('bouton-notifications').addEventListener('click', async () => {
      await TDA.rappels.demanderAutorisation();
      afficherEtatNotifications();
    });
    $('bouton-activer-push').addEventListener('click', activerPush);
    $('bouton-desactiver-push').addEventListener('click', desactiverPush);
    $('push-masquer-titres-actif').addEventListener('change', e =>
      TDA.push.changerMasquage(etat.taches, e.target.checked).catch(err => afficherBandeau(err.message)));
    $('bouton-exporter').addEventListener('click', exporter);
    $('champ-importer').addEventListener('change', importer);

    // Quand on revient sur l'appli (onglet ou téléphone rallumé) : on rafraîchit.
    document.addEventListener('visibilitychange', () => { if (!document.hidden) tic(); });
  }

  // Exécuté régulièrement : rappels + changement de moment de vie.
  function tic() {
    if (TDA.rappels.verifier(etat.taches)) TDA.stockage.ecrireTaches(etat.taches);
    afficher();
  }

  function demarrer() {
    etat.taches = TDA.stockage.lireTaches();
    etat.moments = TDA.stockage.lireMoments();

    $('lien-avis').href = TDA.config.LIEN_AVIS;
    TDA.push.planifierSynchro(etat.taches); // au démarrage : rattrape les changements faits hors ligne

    if (TDA.config.LIEN_DON) {
      $('lien-don').href = TDA.config.LIEN_DON;
      $('lien-don').hidden = false;
    }

    brancherEvenements();
    tic();
    setInterval(tic, TDA.config.INTERVALLE_RAPPELS_MS);

    // Protection des données : on demande au navigateur de ne pas les effacer
    // de lui-même, et on propose une sauvegarde si la dernière est ancienne.
    TDA.stockage.demanderPersistance();
    setTimeout(proposerSauvegarde, 3000); // après 3 s, pour ne pas tout montrer d'un coup

    // Le "service worker" (sw.js) permet l'installation et le hors-ligne.
    // Il ne fonctionne que si la page est servie par un serveur web (http/https),
    // pas en double-cliquant sur le fichier : d'où cette vérification.
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(e => console.warn('Service worker :', e));
    }
  }

  // On lance tout quand la page est prête.
  document.addEventListener('DOMContentLoaded', demarrer);

  // Ce qu'on rend accessible aux autres fichiers (rappels.js utilise afficherBandeau).
  return { afficherBandeau };
})();
