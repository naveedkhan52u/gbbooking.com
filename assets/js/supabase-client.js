// Public Supabase client configuration. The publishable/anon key is designed for browser use; protect data with RLS.
(function(){
  const SUPABASE_URL='https://kaxgfdeuhawyvcgpxpgu.supabase.co';
  const SUPABASE_KEY='sb_publishable_uckyR_dlbW7C9_gFR3HbrA_9c2B-bCo';
  if(!window.supabase||!window.supabase.createClient){console.error('Supabase JS SDK did not load.');return;}
  window.gbSupabase=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
  });
})();