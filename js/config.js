// =========================================================
// CONFIGURAÇÃO DO SUPABASE
// =========================================================
// Preencha aqui com os dados do SEU projeto Supabase.
// Onde encontrar: no painel do Supabase, vá em
// Project Settings (ícone de engrenagem) > API Keys
//
// SUPABASE_URL = "Project URL"
//
// SUPABASE_KEY = a chave PÚBLICA, para uso no navegador.
//   - Se o projeto usa o sistema novo de chaves: copie a
//     "Publishable key" (começa com sb_publishable_...)
//   - Se o projeto usa o sistema antigo (aba "Legacy API Keys"):
//     copie a chave "anon public"
//
// NUNCA use aqui a "Secret key" (sb_secret_...) nem a
// "service_role" — essas são só para uso no servidor e o
// Supabase BLOQUEIA (erro 401) o uso delas direto do navegador.
// =========================================================

const SUPABASE_URL = "https://tznltzbhemayihagucxs.supabase.co";
const SUPABASE_KEY = "sb_publishable_hCcort9rdDsHcO--2L5txg_zKBflR6Y";

// =========================================================
// SENHA DE ACESSO AO SISTEMA
// =========================================================
// Proteção simples: qualquer pessoa que souber essa senha
// consegue entrar. NÃO é uma segurança de verdade (quem souber
// inspecionar o código da página consegue ver esse valor), mas
// evita que gente sem o link certo ou curiosos abram o sistema
// à toa.
//
// TROQUE esse valor para a senha que o RH vai usar.
// =========================================================
const ACESSO_SENHA = "rh2026";
