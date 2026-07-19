// =========================================================
// APP.JS
// Controla a navegação entre abas, mensagens de feedback
// (toasts) e utilitários usados por estoque.js e funcionarios.js
// =========================================================

document.addEventListener("DOMContentLoaded", () => {
  const conectado = iniciarSupabase();

  configurarNavegacao();

  if (conectado) {
    carregarMateriais();
    carregarHistoricoMovimentacoes();
    carregarFuncionarios();
    carregarExames();
    popularSelectsFuncionarios();
    popularSelectMateriais();
  }
});

// ---------------------------------------------------------
// Navegação entre abas
// ---------------------------------------------------------
function configurarNavegacao() {
  const botoes = document.querySelectorAll(".nav-item");
  const paginas = document.querySelectorAll(".pagina");

  botoes.forEach((botao) => {
    botao.addEventListener("click", () => {
      const alvo = botao.dataset.pagina;

      botoes.forEach((b) => b.classList.remove("ativo"));
      botao.classList.add("ativo");

      paginas.forEach((p) => {
        p.classList.toggle("ativa", p.id === alvo);
      });
    });
  });
}

// ---------------------------------------------------------
// Toast de feedback (sucesso / erro)
// ---------------------------------------------------------
function notificar(mensagem, tipo = "sucesso") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast toast-${tipo}`;
  toast.textContent = mensagem;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("visivel"));

  setTimeout(() => {
    toast.classList.remove("visivel");
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ---------------------------------------------------------
// Popula os <select> de funcionário (usado no formulário de
// movimentação de estoque e no formulário de exame)
// ---------------------------------------------------------
async function popularSelectsFuncionarios() {
  const { data, error } = await sb
    .from("funcionarios")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome");

  if (error) {
    console.error(error);
    return;
  }

  const selects = document.querySelectorAll("[data-select-funcionario]");
  selects.forEach((select) => {
    const valorAtual = select.value;
    select.innerHTML = '<option value="">Selecione o funcionário</option>';
    data.forEach((f) => {
      const opt = document.createElement("option");
      opt.value = f.id;
      opt.textContent = f.nome;
      select.appendChild(opt);
    });
    if (valorAtual) select.value = valorAtual;
  });
}

// ---------------------------------------------------------
// Popula o <select> de material (usado no formulário de
// movimentação de estoque)
// ---------------------------------------------------------
async function popularSelectMateriais() {
  const { data, error } = await sb
    .from("materiais")
    .select("id, nome, unidade")
    .order("nome");

  if (error) {
    console.error(error);
    return;
  }

  const selects = document.querySelectorAll("[data-select-material]");
  selects.forEach((select) => {
    const valorAtual = select.value;
    select.innerHTML = '<option value="">Selecione o material</option>';
    data.forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = `${m.nome} (${m.unidade})`;
      select.appendChild(opt);
    });
    if (valorAtual) select.value = valorAtual;
  });
}

// ---------------------------------------------------------
// Utilitário: diferença em dias entre hoje e uma data (string yyyy-mm-dd)
// ---------------------------------------------------------
function diasAte(dataString) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(dataString + "T00:00:00");
  const diffMs = alvo - hoje;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function formatarData(dataString) {
  if (!dataString) return "-";
  const [ano, mes, dia] = dataString.split("-");
  return `${dia}/${mes}/${ano}`;
}

// ---------------------------------------------------------
// Utilitário: data de hoje no formato yyyy-mm-dd (fuso local)
// ---------------------------------------------------------
function hojeISO() {
  const d = new Date();
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

// ---------------------------------------------------------
// Utilitário: soma 1 ano a uma data (string yyyy-mm-dd)
// ---------------------------------------------------------
function somarUmAno(dataString) {
  const [ano, mes, dia] = dataString.split("-").map(Number);
  const data = new Date(ano + 1, mes - 1, dia);
  const anoNovo = data.getFullYear();
  const mesNovo = String(data.getMonth() + 1).padStart(2, "0");
  const diaNovo = String(data.getDate()).padStart(2, "0");
  return `${anoNovo}-${mesNovo}-${diaNovo}`;
}
