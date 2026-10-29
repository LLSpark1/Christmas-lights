// Connect the app to your Supabase project (see README → "Turn on logins").
// Both values are on Supabase → Project Settings → API. The anon key is meant to be public;
// the database rules in supabase/schema.sql are what keep each company's data private.
// Leave them empty to run in demo mode, where everything is saved only in this browser.
window.LJE_CONFIG = {
  supabaseUrl: "",
  supabaseAnonKey: "",
};
