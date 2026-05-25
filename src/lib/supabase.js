// Supabase client singleton.
// Anon key is public-safe; never put service_role key here.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xoazsbhdxhaezkgcxzel.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhvYXpzYmhkeGhhZXprZ2N4emVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MDgzMDcsImV4cCI6MjA5NTI4NDMwN30.gUDtJBgy3cpKx7n6ssAViqtFO2M51gekSZVbr6gX-KM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: 'xhs_supabase_auth',
  },
});

export const SUPABASE_STORAGE_BUCKET = 'note-assets';
