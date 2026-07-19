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

  const jaLiberado = sessionStorage.getItem("rh_acesso_liberado") === "sim";

  if (jaLiberado) {
    tela.classList.add("oculto");
    iniciarApp();
  } else {
    input.focus();
  }

  form.addEventListener("submit", (evento) => {
    evento.preventDefault();

    if (input.value === ACESSO_SENHA) {
      sessionStorage.setItem("rh_acesso_liberado", "sim");
      tela.classList.add("oculto");
      erro.classList.add("oculto");
      iniciarApp();
    } else {
      erro.classList.remove("oculto");
      input.value = "";
      input.focus();
    }
  });
});
