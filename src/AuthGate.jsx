import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import App from './App.jsx';
import AuthScreen from './AuthScreen.jsx';

const ACCENT = '#C8FF00';
const BG = '#0a0a0a';

/**
 * AuthGate decides whether to show the auth screen or the main app.
 * - Listens to Supabase auth state changes
 * - Shows loading splash on initial check
 * - Provides logout + user info via React context (TODO)
 */
export default function AuthGate() {
  const [session, setSession] = useState(undefined); // undefined = loading, null = signed out, object = signed in

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
    });

    // Listen for changes
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession ?? null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: BG, fontFamily: "'DM Sans','Noto Sans SC',sans-serif" }}
      >
        <div className="text-center">
          <div
            className="inline-flex w-12 h-12 rounded-2xl items-center justify-center font-black text-[11px] mb-3"
            style={{ backgroundColor: ACCENT, color: 'black' }}
          >
            XHS
          </div>
          <div className="text-[11px]" style={{ color: '#555' }}>
            正在验证登录状态…
          </div>
        </div>
      </div>
    );
  }

  if (session === null) {
    return <AuthScreen />;
  }

  // Signed in — render the main app with user context
  return <App user={session.user} onLogout={() => supabase.auth.signOut()} />;
}
