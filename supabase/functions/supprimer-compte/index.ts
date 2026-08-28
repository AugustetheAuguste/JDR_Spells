// Delete the caller's own account — the one operation a statically exported
// site (CLAUDE.md § 11) cannot do from the browser, because it needs the
// `service_role` key. That key never leaves this function: it is injected by
// the platform as an environment variable, not committed, not sent to the
// client.
//
// The identity to delete comes ONLY from the verified JWT on the request, never
// from the request body. A body parameter would let anyone who can reach this
// URL delete an arbitrary account by id; deriving it from the token means this
// function can only ever delete the account that called it.
//
// `profils`, `personnages`, `listes`, `listes_sorts` are not deleted here: all
// four reference `auth.users` with `on delete cascade` (see
// supabase/migrations/20260827000000_comptes_et_favoris.sql), so removing the
// auth row removes them as a consequence, not as a second step this function
// could get out of sync with.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const ENTETES_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function reponseJson(corps: Record<string, unknown>, statut: number): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { ...ENTETES_CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (requete) => {
  if (requete.method === 'OPTIONS') {
    return new Response(null, { headers: ENTETES_CORS })
  }
  if (requete.method !== 'POST') {
    return reponseJson({ erreur: 'Méthode non autorisée.' }, 405)
  }

  const enteteAutorisation = requete.headers.get('Authorization')
  if (enteteAutorisation === null) {
    return reponseJson({ erreur: 'Jeton d’authentification manquant.' }, 401)
  }

  const urlSupabase = Deno.env.get('SUPABASE_URL')
  const cleAnonyme = Deno.env.get('SUPABASE_ANON_KEY')
  const cleServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (urlSupabase === undefined || cleAnonyme === undefined || cleServiceRole === undefined) {
    // Injected automatically by the platform for every Edge Function — absent
    // only in a local run missing `--env-file`. Reported rather than thrown so
    // the client gets the translated message, not a stack trace.
    return reponseJson({ erreur: 'Configuration de la fonction incomplète.' }, 500)
  }

  // Bound to the caller's own token: `auth.getUser()` on this client can only
  // ever resolve the identity of whoever sent this exact Authorization header.
  const clientAppelant = createClient(urlSupabase, cleAnonyme, {
    global: { headers: { Authorization: enteteAutorisation } },
  })
  const { data, error: erreurUtilisateur } = await clientAppelant.auth.getUser()
  if (erreurUtilisateur !== null || data.user === null) {
    return reponseJson({ erreur: 'Jeton d’authentification invalide ou expiré.' }, 401)
  }

  const clientAdmin = createClient(urlSupabase, cleServiceRole)
  const { error: erreurSuppression } = await clientAdmin.auth.admin.deleteUser(data.user.id)
  if (erreurSuppression !== null) {
    return reponseJson({ erreur: erreurSuppression.message }, 500)
  }

  return reponseJson({ ok: true }, 200)
})
