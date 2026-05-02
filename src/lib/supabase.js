/**
 * Cliente Supabase compartido por toda la app.
 *
 * Se inicializa una sola vez al importar este módulo. Cualquier código que
 * necesite hablar con Supabase (auth, queries a tablas, storage, etc.) debe
 * importar `supabase` desde acá — NO crear nuevas instancias.
 *
 * Las credenciales vienen de env vars `VITE_SUPABASE_URL` y
 * `VITE_SUPABASE_ANON_KEY`. Vite expone solo las vars con prefijo `VITE_`
 * al frontend; las demás (como MAE_API_KEY) solo están disponibles en
 * funciones serverless de /api/.
 *
 * La key `anon` es pública por diseño — la seguridad real la da Row Level
 * Security en las tablas de Postgres, no esta key.
 */

import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // En dev no queremos romper toda la app si alguien clona el repo sin .env.
  // En prod Vercel ya valida que las env vars estén cargadas, así que esto
  // es más una red de seguridad para devs nuevos.
  console.error(
    "[supabase] Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. " +
    "Crear .env.local en la raíz del proyecto."
  );
}

export const supabase = createClient(url ?? "", anonKey ?? "", {
  auth: {
    // persistSession: guarda la sesión en localStorage del browser.
    // Sin esto, el usuario tendría que loguearse cada refresh.
    persistSession: true,
    // autoRefreshToken: cuando el access token expire (1h por default),
    // el SDK lo renueva con el refresh token sin que el user vea nada.
    autoRefreshToken: true,
    // detectSessionInUrl: cuando Google redirige a nuestra app después
    // del OAuth, viene con el token en el hash de la URL. El SDK lo
    // parsea, lo guarda, y limpia la URL. Es lo que permite que el flujo
    // funcione sin que tengamos que escribir un handler de callback.
    detectSessionInUrl: true,
  },
});

/** Helper: ¿está configurado el cliente correctamente? */
export const isSupabaseConfigured = Boolean(url && anonKey);
