// =====================================================================
// Fonction serveur "tda-rappels" — appelée PAR L'APPLI
// ---------------------------------------------------------------------
// Trois actions possibles, envoyées en JSON :
//   { action: 'abonner',      appareilId, secret, abonnement }
//   { action: 'synchroniser', appareilId, secret, rappels: [{ tacheId, quand, titre }] }
//   { action: 'supprimer',    appareilId, secret }
//
// Pas de compte utilisateur : un appareil est reconnu par son identifiant
// + son secret (on ne garde que l'empreinte SHA-256 du secret).
// Cette fonction est écrite en TypeScript (du JavaScript avec des types)
// et tourne sur les serveurs de Supabase (moteur "Deno").
// =====================================================================

import { createClient } from 'npm:@supabase/supabase-js@2';

// Autorise l'appli (hébergée sur un autre domaine) à appeler cette fonction.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, apikey, authorization, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const base = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

function repondre(statut: number, corps: unknown) {
  return new Response(JSON.stringify(corps), { status: statut, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

async function sha256(texte: string) {
  const octets = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texte));
  return [...new Uint8Array(octets)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return repondre(405, { erreur: 'POST uniquement' });

  let d: any;
  try { d = await req.json(); } catch { return repondre(400, { erreur: 'JSON invalide' }); }

  // Vérifications de base : identifiant et secret bien formés.
  if (!UUID.test(d.appareilId ?? '') || !/^[0-9a-f]{64}$/.test(d.secret ?? '')) {
    return repondre(400, { erreur: 'Identifiant ou secret invalide' });
  }
  const empreinte = await sha256(d.secret);

  // ---------- ABONNER : enregistre un nouvel appareil ----------
  if (d.action === 'abonner') {
    const ab = d.abonnement;
    if (!ab?.endpoint?.startsWith('https://') || !ab?.keys?.p256dh || !ab?.keys?.auth) {
      return repondre(400, { erreur: 'Abonnement push invalide' });
    }
    const { error } = await base.from('appareils').insert({
      id: d.appareilId,
      secret_hash: empreinte,
      abonnement: { endpoint: ab.endpoint, keys: { p256dh: ab.keys.p256dh, auth: ab.keys.auth } },
    });
    if (error) return repondre(409, { erreur: 'Appareil déjà enregistré' });
    return repondre(200, { ok: true });
  }

  // Pour les autres actions, l'appareil doit exister ET le secret correspondre.
  const { data: appareil } = await base.from('appareils').select('id, secret_hash').eq('id', d.appareilId).maybeSingle();
  if (!appareil || appareil.secret_hash !== empreinte) return repondre(403, { erreur: 'Appareil inconnu' });

  // ---------- SYNCHRONISER : remplace la liste des rappels de l'appareil ----------
  if (d.action === 'synchroniser') {
    if (!Array.isArray(d.rappels) || d.rappels.length > 500) return repondre(400, { erreur: 'Liste de rappels invalide' });
    const lignes = d.rappels
      .filter((r: any) => typeof r.tacheId === 'string' && !isNaN(Date.parse(r.quand)))
      .map((r: any) => ({
        appareil_id: d.appareilId,
        tache_id: r.tacheId.slice(0, 64),
        quand: new Date(r.quand).toISOString(),
        titre: typeof r.titre === 'string' ? r.titre.slice(0, 140) : null,
      }));
    await base.from('rappels').delete().eq('appareil_id', d.appareilId);
    if (lignes.length) {
      const { error } = await base.from('rappels').insert(lignes);
      if (error) return repondre(500, { erreur: 'Enregistrement impossible' });
    }
    await base.from('appareils').update({ vu_le: new Date().toISOString() }).eq('id', d.appareilId);
    return repondre(200, { ok: true, rappels: lignes.length });
  }

  // ---------- SUPPRIMER : efface l'appareil et tous ses rappels ----------
  if (d.action === 'supprimer') {
    await base.from('appareils').delete().eq('id', d.appareilId); // les rappels partent avec (cascade)
    return repondre(200, { ok: true });
  }

  return repondre(400, { erreur: 'Action inconnue' });
});
