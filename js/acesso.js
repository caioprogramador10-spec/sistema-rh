// =========================================================
// ACESSO.JS
// Trava simples de senha na entrada do sistema. NÃO é uma
// segurança forte (a senha fica visível pra quem inspecionar
// o código da página), serve só pra impedir que alguém abra
// o link sem querer e comece a mexer nos dados.
//
// A liberação fica guardada em sessionStorage, ou seja: dura
// enquanto a aba do navegador estiver aberta. Ao fechar e abrir
// de novo, pede a senha outra vez.
//
// Os dados do sistema (Supabase) só começam a carregar DEPOIS
// que a senha é confirmada — não ficam carregando escondidos
// atrás da tela de senha.
// =========================================================

document.addEventListener("DOMContentLoaded", () => {
  const tela = document.getElementById("tela-acesso");
  const form = document.getElementById("form-acesso");
  const input = document.getElementById("acesso-senha-input");
  const erro = document.getElementById("acesso-erro");

  const modoSalvo = sessionStorage.getItem("rh_acesso_modo");

  if (modoSalvo) {
    tela.classList.add("oculto");
    aplicarModoAcesso(modoSalvo);
    iniciarApp();
  } else {
    input.focus();
  }

  form.addEventListener("submit", (evento) => {
    evento.preventDefault();

    let modo = null;
    if (input.value === ACESSO_SENHA) modo = "completo";
    else if (input.value === ACESSO_SENHA_VISUALIZACAO) modo = "visualizacao";

    if (modo) {
      sessionStorage.setItem("rh_acesso_modo", modo);
      tela.classList.add("oculto");
      erro.classList.add("oculto");
      aplicarModoAcesso(modo);
      iniciarApp();
    } else {
      erro.classList.remove("oculto");
      input.value = "";
      input.focus();
    }
  });
});

// ---------------------------------------------------------
// Modo "visualização": só a aba Avaliações, sem nenhum botão
// ---------------------------------------------------------
function aplicarModoAcesso(modo) {
  if (modo !== "visualizacao") return;

  document.body.classList.add("modo-visualizacao");

  document.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("ativo"));
  document.querySelectorAll(".pagina").forEach((p) => p.classList.remove("ativa"));
  document.querySelector('[data-pagina="pagina-avaliacoes"]').classList.add("ativo");
  document.getElementById("pagina-avaliacoes").classList.add("ativa");
}
