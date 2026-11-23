/* =====================================================================
   sw.js — LE "SERVICE WORKER"
   ---------------------------------------------------------------------
   Un service worker est un petit script que le navigateur garde en
   arrière-plan pour ce site. Ici, il sert à deux choses :
   1. garder une copie des fichiers de l'appli → elle s'ouvre même sans
      Internet (indispensable pour être "installable") ;
   2. gérer le clic sur une notification (rouvrir l'appli).
   En phase 2, c'est aussi lui qui recevra les notifications "push".

   ⚠️ Quand vous modifiez un fichier de l'appli et le mettez en ligne,
   AUGMENTEZ le numéro de VERSION ci-dessous : sinon les téléphones
   garderont l'ancienne copie.
   ===================================================================== */

const VERSION = 'tda-v5';
const FICHIERS = [
  './', 'index.html', 'aide.html', 'confidentialite.html', 'mentions-legales.html',
  'css/style.css', 'manifest.json', 'icone.svg', 'icone-192.png', 'icone-512.png',
  'js/config.js', 'js/stockage.js', 'js/moments.js', 'js/priorite.js', 'js/rappels.js', 'js/push.js', 'js/app.js'
];

// RÉCEPTION D'UNE NOTIFICATION PUSH envoyée par le serveur (appli fermée ou non).
// Le serveur envoie un petit paquet JSON : { titre, corps, tacheId }.
self.addEventListener('push', (e) => {
  let donnees = {};
  try { donnees = e.data ? e.data.json() : {}; } catch (erreur) { /* paquet illisible */ }
  e.waitUntil(self.registration.showNotification(donnees.titre || '⏰ Tout Dans l\'Agenda', {
    body: donnees.corps || 'Une tâche vous attend.',
    icon: 'icone-192.png',
    badge: 'icone-192.png',
    tag: donnees.tacheId || 'tda',   // même tâche = la notification remplace la précédente
    renotify: true
  }));
});

// Installation : on met les fichiers en cache.
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then(cache => cache.addAll(FICHIERS)));
  self.skipWaiting();
});

// Activation : on supprime les caches des anciennes versions.
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(cles =>
    Promise.all(cles.filter(c => c !== VERSION).map(c => caches.delete(c)))));
  self.clients.claim();
});

// Chaque requête : on essaie le réseau d'abord (version à jour),
// et si pas de réseau, on sert la copie en cache.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(reponse => {
        const copie = reponse.clone();
        caches.open(VERSION).then(cache => cache.put(e.request, copie));
        return reponse;
      })
      .catch(() => caches.match(e.request))
  );
});

// Clic sur une notification : on ramène l'appli au premier plan.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(fenetres =>
      fenetres.length ? fenetres[0].focus() : self.clients.openWindow('./'))
  );
});
