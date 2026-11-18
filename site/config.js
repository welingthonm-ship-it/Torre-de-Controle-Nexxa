// Configuração da versão web do portal.
window.NX_CONFIG = {
  portal: '/portal/',   // pasta com o código das abas (o mesmo usado no Claude)
  dados: '/dados/',     // CSVs iniciais opcionais, só no modo de teste (não versionados)
  editor: true,         // só no modo de teste (sem Supabase)
  supabase: {
    url: 'https://unvlfnfgtojduiozsepp.supabase.co',
    anonKey: 'sb_publishable_ZCEK6H34wpLm67n35xwVCw_bM8QbnM1',   // chave pública (Publishable key)
    dominio: 'torre-nexxa.com'
  }
};
