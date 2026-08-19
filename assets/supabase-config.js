// =====================================================================
// Supabase project connection settings.
//
// The "anon" key is NOT a secret — it's the public client key Supabase
// is designed to have exposed in frontend code. Your data is protected
// by the Row Level Security policies in supabase/schema.sql, not by
// hiding this key. Never put your service_role key here or anywhere
// in frontend code.
//
// Fill these in after creating your Supabase project (see README.md).
// =====================================================================
window.SUPABASE_URL = "https://mqjalanpvudpgqaalqtx.supabase.co";
window.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xamFsYW5wdnVkcGdxYWFscXR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxNzE5NTYsImV4cCI6MjEwMjc0Nzk1Nn0.79qzvBsbn4ljd8x-dG-CSnpg6Uk4_FzL4Oui-T44_ww";

window.supabaseClient = window.supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_ANON_KEY
);
