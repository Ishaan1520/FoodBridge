import { supabase, isSupabaseConfigured } from './supabase';

function requireSupabase() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file, then restart the dev server.');
  }
}

export async function getCurrentUser(sessionOverride = null) {
  requireSupabase();

  let session = sessionOverride;

  if (!session) {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    session = data.session;
  }

  if (!session?.user) return null;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, organisation, is_verified')
    .eq('id', session.user.id)
    .single();

  if (error) {
    throw new Error(`Signed in, but the FoodBridge profile could not be loaded: ${error.message}`);
  }

  return {
    id: profile.id,
    name: profile.full_name || session.user.email?.split('@')[0] || 'FoodBridge user',
    email: session.user.email,
    role: profile.role,
    organisation: profile.organisation || '',
    isVerified: profile.is_verified,
  };
}

export async function signIn(email, password) {
  requireSupabase();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) throw error;

  return getCurrentUser(data.session);
}

export async function signUp({ fullName, email, password, role, organisation }) {
  requireSupabase();

  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        full_name: fullName.trim(),
        role,
        organisation: organisation.trim(),
      },
    },
  });

  if (error) throw error;

  // Projects with email confirmation enabled return a user but no session.
  if (!data.session) return { needsEmailConfirmation: true };

  return {
    needsEmailConfirmation: false,
    user: await getCurrentUser(data.session),
  };
}

export async function signOutFromSupabase() {
  requireSupabase();

  const { error } = await supabase.auth.signOut();

  if (error) throw error;
}