// =========================================================
// CLIENTE SUPABASE
// Este arquivo cria a conexão única com o Supabase, usada
// por estoque.js e funcionarios.js
// =========================================================

let sb = null;

function iniciarSupabase() {
  if (
    !SUPABASE_URL ||
    !SUPABASE_KEY ||
    SUPABASE_URL.includes("COLE_AQUI") ||
    SUPABASE_KEY.includes("COLE_AQUI")
  ) {
    mostrarAvisoConfiguracao();
    return false;
  }

  sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  return true;
}

function mostrarAvisoConfiguracao() {
  const aviso = document.getElementById("aviso-config");
  if (aviso) aviso.classList.remove("oculto");
}
