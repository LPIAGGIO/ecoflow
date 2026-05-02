/**
 * Contexto de autenticación + hook useAuth.
 *
 * Provee a toda la app:
 *   - `user`        objeto del usuario logueado o null
 *   - `session`     sesión Supabase (incluye access_token) o null
 *   - `loading`     true mientras se está resolviendo el estado inicial
 *   - `signInWithGoogle()`  inicia el flujo OAuth
 *   - `signOut()`           cierra sesión
 *
 * Cómo se usa en cualquier componente:
 *   const { user, signInWithGoogle, signOut } = useAuth();
 *   if (!user) return <button onClick={signInWithGoogle}>Login</button>;
 *
 * Patrón:
 *   - Al montar, leemos la sesión actual (puede haber una persistida en localStorage).
 *   - Suscribimos a cambios de auth (login, logout, refresh de token).
 *   - Cuando el componente se desmonta, limpiamos la suscripción.
 */

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";

const AuthContext = createContext(null);

/**
 * Hook para acceder al contexto de auth desde cualquier componente.
 * Falla si no está envuelto en <AuthProvider>.
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth() debe usarse dentro de <AuthProvider>");
  }
  return ctx;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1) Resolver el estado inicial.
    // Si el user ya estaba logueado y refresca la página, getSession()
    // devuelve la sesión guardada en localStorage sin pegar a la red.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // 2) Suscribirnos a cambios futuros.
    // Esto se dispara cuando: login OK, logout, refresh de token,
    // o cuando la sesión expira por inactividad.
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);
      }
    );

    return () => {
      subscription?.subscription?.unsubscribe?.();
    };
  }, []);

  /**
   * Inicia el flujo OAuth con Google.
   * Después del consent, Google redirige a `redirectTo` con un token en el hash.
   * El SDK lo detecta automáticamente (gracias a detectSessionInUrl) y dispara
   * onAuthStateChange con la nueva sesión.
   */
  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // Volver a la misma URL desde donde se inició el login.
        // En prod va a ser https://ecoflow-bay.vercel.app, en dev http://localhost:5173.
        redirectTo: window.location.origin,
      },
    });
    if (error) {
      console.error("[auth] signInWithGoogle error:", error);
      throw error;
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("[auth] signOut error:", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        loading,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
