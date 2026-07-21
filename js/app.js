// =========================================================
// APP.JS
// Controla a navegação entre abas, mensagens de feedback
// (toasts) e utilitários usados por estoque.js e funcionarios.js
// =========================================================

document.addEventListener("DOMContentLoaded", () => {
  configurarNavegacao();
  configurarCombosFuncionario();
});

// ---------------------------------------------------------
// Inicializa a conexão com o Supabase e carrega os dados.
// É chamada pelo acesso.js só depois que a senha é confirmada
// (ou de cara, se a sessão já estava liberada).
// ---------------------------------------------------------
function iniciarApp() {
  const conectado = iniciarSupabase();

  if (conectado) {
    carregarMateriais();
    carregarHistoricoMovimentacoes();
    carregarFuncionarios();
    carregarExames();
    carregarAvaliacoes();
    popularSelectsFuncionarios();
    popularSelectMateriais();
  }
}

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
// Combo de funcionário com busca (estilo iOS): usado no
// formulário de exame e no de movimentação de estoque.
// ---------------------------------------------------------
let funcionariosParaCombo = [];

async function popularSelectsFuncionarios() {
  const { data, error } = await sb
    .from("funcionarios")
    .select("id, nome, cargo, setor")
    .eq("ativo", true)
    .order("nome");

  if (error) {
    console.error(error);
    return;
  }

  funcionariosParaCombo = data;

  document.querySelectorAll("[data-combo]").forEach((container) => {
    const input = container.querySelector("[data-combo-input]");
    renderizarListaCombo(container, input ? input.value : "");
  });
}

function configurarCombosFuncionario() {
  document.querySelectorAll("[data-combo]").forEach((container) => {
    const input = container.querySelector("[data-combo-input]");
    const valorOculto = container.querySelector("[data-combo-valor]");

    input.addEventListener("focus", () => {
      renderizarListaCombo(container, input.value);
      container.classList.add("combo-aberto");
    });

    input.addEventListener("input", () => {
      valorOculto.value = "";
      renderizarListaCombo(container, input.value);
      container.classList.add("combo-aberto");
    });

    input.addEventListener("keydown", (evento) => {
      if (evento.key === "Escape") container.classList.remove("combo-aberto");
    });
  });

  // Fecha a lista aberta ao clicar fora do combo
  document.addEventListener("click", (evento) => {
    document.querySelectorAll("[data-combo]").forEach((container) => {
      if (!container.contains(evento.target)) {
        container.classList.remove("combo-aberto");
      }
    });
  });
}

function renderizarListaCombo(container, termoBruto) {
  const lista = container.querySelector("[data-combo-lista]");
  const termo = (termoBruto || "").trim().toLowerCase();

  const filtrados = !termo
    ? funcionariosParaCombo
    : funcionariosParaCombo.filter((f) => f.nome.toLowerCase().includes(termo));

  if (filtrados.length === 0) {
    lista.innerHTML = `<div class="combo-vazio">Nenhum funcionário encontrado</div>`;
    return;
  }

  lista.innerHTML = filtrados
    .map((f) => {
      const subtitulo = [f.cargo, f.setor].filter(Boolean).join(" · ");
      const nomeSeguro = f.nome.replace(/"/g, "&quot;");
      return `
        <button type="button" class="combo-item" data-id="${f.id}" data-nome="${nomeSeguro}">
          <span class="combo-item-avatar">${obterIniciais(f.nome)}</span>
          <span class="combo-item-texto">
            <span class="combo-item-nome">${f.nome}</span>
            ${subtitulo ? `<span class="combo-item-sub">${subtitulo}</span>` : ""}
          </span>
        </button>
      `;
    })
    .join("");

  lista.querySelectorAll(".combo-item").forEach((item) => {
    item.addEventListener("click", () => {
      selecionarCombo(container, item.dataset.id, item.dataset.nome);
    });
  });
}

function obterIniciais(nome) {
  const partes = nome.trim().split(/\s+/);
  return partes
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}

function selecionarCombo(container, id, nome) {
  const input = container.querySelector("[data-combo-input]");
  const valorOculto = container.querySelector("[data-combo-valor]");
  input.value = nome;
  valorOculto.value = id;
  container.classList.remove("combo-aberto");

  const alvoDepartamento = container.dataset.autofillDepartamento;
  if (alvoDepartamento) {
    const campoDepartamento = document.getElementById(alvoDepartamento);
    const funcionario = funcionariosParaCombo.find((f) => f.id === id);
    if (campoDepartamento && funcionario && !campoDepartamento.value) {
      campoDepartamento.value = funcionario.setor || "";
    }
  }
}

// Preenche um combo programaticamente (usado ao editar um exame)
function definirValorCombo(containerId, id) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const input = container.querySelector("[data-combo-input]");
  const valorOculto = container.querySelector("[data-combo-valor]");
  const funcionario = funcionariosParaCombo.find((f) => f.id === id);
  valorOculto.value = id || "";
  input.value = funcionario ? funcionario.nome : "";
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
// Atualiza o contador ao lado do título de uma tabela
// ---------------------------------------------------------
function atualizarContador(id, mostrados, total) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = mostrados === total ? `${total}` : `${mostrados} de ${total}`;
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
