import { ReactNode, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { AuthContext } from "@/hooks/useAuth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('[AuthProvider] Initializing auth state...');
    
    // Set up auth state listener first.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      console.log('[AuthProvider] Auth state changed:', event, nextSession?.user?.email || 'no user');
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    });

    // Then check for an existing session.
    supabase.auth.getSession().then(({ data: { session: initialSession }, error }) => {
      console.log('[AuthProvider] getSession result:', { 
        hasSession: !!initialSession, 
        userEmail: initialSession?.user?.email,
        error: error?.message 
      });
      
      if (error) {
        console.error("[AuthProvider] Session validation error:", error);
        supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }

      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName?: string) => {
    console.log('[AuthProvider] signUp called for:', email);
    const redirectUrl = `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });
    
    if (error) {
      console.error('[AuthProvider] signUp error:', error.message);
    } else {
      console.log('[AuthProvider] signUp successful');
    }
    
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    console.log('[AuthProvider] signIn called for:', email);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      console.error('[AuthProvider] signIn error:', error.message);
    } else {
      console.log('[AuthProvider] signIn successful');
    }
    
    return { error: error as Error | null };
  };

  const signOut = async () => {
    console.log('[AuthProvider] signOut called');
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
