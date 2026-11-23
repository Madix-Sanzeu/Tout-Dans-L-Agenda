// =====================================================================
// Fonction serveur "tda-envoi" — appelée CHAQUE MINUTE par la base
// ---------------------------------------------------------------------
// 1. vérifie que l'appel vient bien de notre planificateur (secret) ;
// 2. prend les rappels dont l'heure est arrivée ;
// 3. envoie chaque notification, puis EFFACE le rappel ;
// 4. si un téléphone s'est désabonné (erreur 404/410), on l'efface ;
// 5. efface les appareils sans nouvelles depuis 90 jours.
//
// Secrets à définir dans Supabase (Edge Functions → Secrets) :
//   VAPID_PRIVATE_KEY : la moitié privée de la paire de clés VAPID
// =====================================================================

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

// La moitié PUBLIQUE est la même que dans js/config.js de l'appli.
const VAPID_PUBLIQUE = 'BBf_49_c2dGPShOcYm1KooVIgAvOc7YEZZ_8QM0rW3U70MHX8m4xkFrOGfh4W0G9gpYEC5zBlbzJV9rQpdfnB3E';
const CONTACT = 'https://madix-sanzeu.github.io/Tout-Dans-L-Agenda/';

const base = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

Deno.serve(async (req) => {
  // 1. Le secret du planificateur
  const { data: autorise } = await base.rpc('tda_verifier_cron', { secret_recu: req.headers.get('x-tda-cron') ?? '' });
  if (autorise !== true) return new Response('Interdit', { status: 403 });

  // La clé privée VAPID doit avoir été saisie dans les secrets Supabase.
  const vapidPrivee = Deno.env.get('VAPID_PRIVATE_KEY');
  if (!vapidPrivee) return new Response('Secret VAPID_PRIVATE_KEY manquant', { status: 503 });
  webpush.setVapidDetails(CONTACT, VAPID_PUBLIQUE, vapidPrivee);

  // 2. Les rappels arrivés à l'heure (500 au maximum par minute)
  const { data: rappels, error } = await base
    .from('rappels')
    .select('id, tache_id, titre, appareil_id, appareils(abonnement)')
    .lte('quand', new Date().toISOString())
    .order('quand')
    .limit(500);
  if (error) return new Response(error.message, { status: 500 });

  let envoyes = 0;
  for (const r of rappels ?? []) {
    const charge = JSON.stringify({
      titre: r.titre ? '⏰ ' + r.titre : '⏰ Tout Dans l\'Agenda',
      corps: r.titre ? 'C\'est le moment !' : 'Une tâche vous attend.',
      tacheId: r.tache_id,
    });
    try {
      // 3. Envoi (le contenu est chiffré : seul le téléphone peut le lire)
      await webpush.sendNotification((r as any).appareils.abonnement, charge, { TTL: 3600, urgency: 'high' });
      envoyes++;
    } catch (e: any) {
      // 4. Abonnement expiré ou supprimé par le téléphone
      if (e?.statusCode === 404 || e?.statusCode === 410) {
        await base.from('appareils').delete().eq('id', r.appareil_id);
      } else {
        console.error('Échec envoi', e?.statusCode, e?.body);
      }
    }
    await base.from('rappels').delete().eq('id', r.id); // effacé dès l'envoi
  }

  // 5. Ménage : appareils abandonnés
  const limite = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
  await base.from('appareils').delete().lt('vu_le', limite);

  return new Response(JSON.stringify({ envoyes }), { headers: { 'Content-Type': 'application/json' } });
});
