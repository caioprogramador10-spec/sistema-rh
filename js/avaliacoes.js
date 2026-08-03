// =========================================================
// AVALIACOES.JS
// Programa de Desenvolvimento e Performance: PAFDC-RH, PDR,
// PDI, PDE e Treinamento (esse com Eficácia nas 3 etapas).
// As datas são digitadas manualmente; o sistema calcula
// sozinho qual é a próxima pendente e avisa quando faltar
// 5 dias ou menos.
//
// Mudança de avaliação (ex: PDI -> PDR por queda de rendimento):
// o registro antigo fica marcado como "pausado" (não some, só// =========================================================
// AVALIACOES.JS
// Programa de Desenvolvimento e Performance: PAFDC-RH, PDR,
// PDI, PDE e Treinamento (esse com Eficácia nas 3 etapas).
// As datas são digitadas manualmente; o sistema calcula
// sozinho qual é a próxima pendente e avisa quando faltar
// 5 dias ou menos.
//
// Mudança de avaliação (ex: PDI -> PDR por queda de rendimento):
// o registro antigo fica marcado como "pausado" (não some, só
// para de gerar alerta) e um novo é criado, ligado a ele. Ao
// melhorar, o registro antigo é reativado do jeito que estava.
// =========================================================

const TIPOS_AVALIACAO = {
  pafdc_rh: "PAFDC-RH",
  pdr: "PDR",
  pdi: "PDI",
  pde: "PDE",
  treinamento: "Treinamento",
};

const DIAS_ALERTA_AVALIACAO = 5;

let avaliacoesCache = [];

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("form-avaliacao").addEventListener("submit", registrarAvaliacao);
  alternarCampoEficacia();
});

// ---------------------------------------------------------
// Os campos de Eficácia só existem para Treinamento
// ---------------------------------------------------------
function alternarCampoEficacia() {
  const tipo = document.getElementById("avaliacao-tipo").value;
  const grupos = ["grupo-avaliacao-eficacia-1", "grupo-avaliacao-eficacia-2", "grupo-avaliacao-eficacia-3"];
  const campos = ["avaliacao-data-eficacia", "avaliacao-data-eficacia-2", "avaliacao-data-eficacia-3"];

  grupos.forEach((grupoId, i) => {
    const grupo = document.getElementById(grupoId);
    if (tipo === "treinamento") {
      grupo.classList.remove("oculto");
    } else {
      grupo.classList.add("oculto");
      document.getElementById(campos[i]).value = "";
    }
  });
}

// ---------------------------------------------------------
// Registrar avaliação OU salvar edição de uma existente
// ---------------------------------------------------------
async function registrarAvaliacao(evento) {
  evento.preventDefault();

  const id = document.getElementById("avaliacao-id").value;
  const funcionarioId = document.getElementById("avaliacao-funcionario").value;
  const tipo = document.getElementById("avaliacao-tipo").value;
  const observacao = document.getElementById("avaliacao-observacao").value.trim();

  if (!funcionarioId || !tipo) {
    notificar("Selecione o funcionário e o tipo.", "erro");
    return;
  }

  const ehTreinamento = tipo === "treinamento";
  const valor = (campoId) => document.getElementById(campoId).value || null;

  const registro = {
    funcionario_id: funcionarioId,
    tipo,
    departamento: document.getElementById("avaliacao-departamento").value.trim() || null,
    data_1: valor("avaliacao-data-1"),
    data_eficacia: ehTreinamento ? valor("avaliacao-data-eficacia") : null,
    data_2: valor("avaliacao-data-2"),
    data_eficacia_2: ehTreinamento ? valor("avaliacao-data-eficacia-2") : null,
    data_3: valor("avaliacao-data-3"),
    data_eficacia_3: ehTreinamento ? valor("avaliacao-data-eficacia-3") : null,
    observacao: observacao || null,
  };

  if (id) {
    const { error } = await sb.from("avaliacoes").update(registro).eq("id", id);
    if (error) {
      console.error(error);
      notificar("Erro ao salvar alterações.", "erro");
      return;
    }
    notificar("Avaliação atualizada com sucesso.");
    cancelarEdicaoAvaliacao();
  } else {
    const { error } = await sb.from("avaliacoes").insert(registro);
    if (error) {
      console.error(error);
      notificar("Erro ao registrar avaliação.", "erro");
      return;
    }
    notificar("Avaliação registrada com sucesso.");
    document.getElementById("form-avaliacao").reset();
    alternarCampoEficacia();
  }

  carregarAvaliacoes();
}

// ---------------------------------------------------------
// Carregar avaliações do banco
// ---------------------------------------------------------
async function carregarAvaliacoes() {
  const { data, error } = await sb
    .from("avaliacoes")
    .select(
      "id, funcionario_id, tipo, departamento, data_1, data_eficacia, data_2, data_eficacia_2, data_3, data_eficacia_3, resultado, pausado, origem_id, observacao, funcionarios(nome, setor)"
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  avaliacoesCache = data;
  popularFiltroDepartamentos();
  filtrarAvaliacoes();
}

// ---------------------------------------------------------
// Segue as etapas em ordem e trava na primeira que ainda não
// venceu. Um registro "pausado" (histórico de uma mudança de
// avaliação) não gera mais alerta.
// ---------------------------------------------------------
function classificarAvaliacao(avaliacao) {
  if (avaliacao.pausado) {
    return { status: "pausado", dias: null, data: null };
  }

  const ordem =
    avaliacao.tipo === "treinamento"
      ? ["data_1", "data_eficacia", "data_2", "data_eficacia_2", "data_3", "data_eficacia_3"]
      : ["data_1", "data_2", "data_3"];

  for (const campo of ordem) {
    const valor = avaliacao[campo];
    if (!valor) continue;
    const dias = diasAte(valor);
    if (dias > 0) {
      return {
        status: dias <= DIAS_ALERTA_AVALIACAO ? "alerta" : "em_dia",
        dias,
        data: valor,
      };
    }
  }

  const preenchidas = ordem.filter((campo) => avaliacao[campo]);
  if (preenchidas.length === 0) {
    return { status: "sem_data", dias: null, data: null };
  }

  const ultimoCampo = preenchidas[preenchidas.length - 1];
  const indiceUltimo = ordem.indexOf(ultimoCampo);
  const aindaTemEtapaVazia = indiceUltimo < ordem.length - 1;
  const dias = diasAte(avaliacao[ultimoCampo]);

  return {
    status: aindaTemEtapaVazia ? "atrasado" : "concluido",
    dias,
    data: avaliacao[ultimoCampo],
  };
}

// ---------------------------------------------------------
// Filtro por tipo + busca por nome/departamento
// ---------------------------------------------------------
function popularFiltroDepartamentos() {
  const select = document.getElementById("filtro-avaliacoes-departamento");
  const valorAtual = select.value;

  const departamentos = [...new Set(avaliacoesCache.map((a) => a.departamento).filter(Boolean))].sort();

  select.innerHTML = '<option value="todos">Todos os departamentos</option>';
  departamentos.forEach((d) => {
    const opt = document.createElement("option");
    opt.value = d;
    opt.textContent = d;
    select.appendChild(opt);
  });

  if (departamentos.includes(valorAtual)) select.value = valorAtual;
}

function filtrarAvaliacoes() {
  const tipo = document.getElementById("filtro-avaliacoes-tipo")?.value || "todos";
  const prazo = document.getElementById("filtro-avaliacoes-prazo")?.value || "todos";
  const departamento = document.getElementById("filtro-avaliacoes-departamento")?.value || "todos";
  const termo = (document.getElementById("filtro-avaliacoes-busca")?.value || "").trim().toLowerCase();

  const filtradas = avaliacoesCache.filter((a) => {
    if (tipo !== "todos" && a.tipo !== tipo) return false;
    if (prazo !== "todos" && classificarAvaliacao(a).status !== prazo) return false;
    if (departamento !== "todos" && a.departamento !== departamento) return false;
    if (termo && !(a.funcionarios?.nome || "").toLowerCase().includes(termo)) return false;
    return true;
  });

  renderizarAvaliacoes(filtradas);
}

function renderizarAvaliacoes(lista) {
  atualizarContador("contador-avaliacoes", lista.length, avaliacoesCache.length);
  const corpo = document.getElementById("tabela-avaliacoes-corpo");
  corpo.innerHTML = "";

  if (lista.length === 0) {
    corpo.innerHTML = `<tr><td colspan="12" class="celula-vazia">${
      avaliacoesCache.length === 0
        ? "Nenhuma avaliação registrada ainda."
        : "Nenhuma avaliação encontrada para esse filtro."
    }</td></tr>`;
    return;
  }

  lista.forEach((a) => {
    const { status, dias, data } = classificarAvaliacao(a);
    const linha = document.createElement("tr");

    let statusHtml;
    if (status === "alerta") {
      linha.classList.add("linha-alerta");
      statusHtml = `<span class="badge badge-alerta">${formatarData(data)} · faltam ${dias}d</span>`;
    } else if (status === "em_dia") {
      statusHtml = `<span class="badge badge-neutro">${formatarData(data)} · faltam ${dias}d</span>`;
    } else if (status === "atrasado") {
      linha.classList.add("linha-vencida");
      statusHtml = `<span class="badge badge-vencido">Atrasado desde ${formatarData(data)} (${Math.abs(dias)}d)</span>`;
    } else if (status === "concluido") {
      linha.classList.add("linha-ok");
      statusHtml = `<span class="badge badge-ok">Concluído (${formatarData(data)})</span>`;
    } else if (status === "pausado") {
      linha.classList.add("linha-ok");
      linha.style.opacity = "0.6";
      statusHtml = `<span class="badge badge-neutro">Histórico (pausado)</span>`;
    } else {
      statusHtml = `<span class="badge badge-neutro">Sem data registrada</span>`;
    }

    let resultadoHtml;
    if (a.resultado === "aprovado") {
      resultadoHtml = '<span class="badge badge-ok">✅ Aprovado</span>';
    } else if (a.resultado === "reprovado") {
      resultadoHtml = '<span class="badge badge-vencido">❌ Reprovado</span>';
    } else {
      resultadoHtml = '<span class="badge badge-neutro">Pendente</span>';
    }

    const botoesResultado =
      a.data_3 && !a.pausado
        ? `
        <button class="botao-mini-sucesso" onclick="marcarResultadoAvaliacao('${a.id}', 'aprovado')">Aprovado</button>
        <button class="botao-mini-perigo" onclick="marcarResultadoAvaliacao('${a.id}', 'reprovado')">Reprovado</button>
      `
        : "";

    let botaoMudanca = "";
    if (!a.pausado && a.tipo === "pdi") {
      botaoMudanca = `<button class="botao-mini-perigo" onclick="mudarAvaliacao('${a.id}')" title="Queda de rendimento">🔄 Mudar p/ PDR</button>`;
    } else if (!a.pausado && a.tipo === "pdr" && a.origem_id) {
      botaoMudanca = `<button class="botao-mini-sucesso" onclick="mudarAvaliacao('${a.id}')" title="Melhora">🔄 Voltar p/ PDI</button>`;
    }

    const observacaoEscapada = (a.observacao || "").replace(/'/g, "\\'");
    const departamentoEscapado = (a.departamento || "").replace(/'/g, "\\'");

    linha.innerHTML = `
      <td>${a.funcionarios?.nome || "-"}</td>
      <td>${a.departamento || "-"}</td>
      <td><span class="badge badge-neutro">${TIPOS_AVALIACAO[a.tipo] || a.tipo}</span></td>
      <td>${formatarData(a.data_1)}</td>
      <td>${a.tipo === "treinamento" ? formatarData(a.data_eficacia) : "-"}</td>
      <td>${formatarData(a.data_2)}</td>
      <td>${a.tipo === "treinamento" ? formatarData(a.data_eficacia_2) : "-"}</td>
      <td>${formatarData(a.data_3)}</td>
      <td>${a.tipo === "treinamento" ? formatarData(a.data_eficacia_3) : "-"}</td>
      <td>${statusHtml}</td>
      <td>${resultadoHtml}</td>
      <td>
        <div class="acoes-tabela">
          ${botoesResultado}
          ${botaoMudanca}
          <button class="botao-mini" onclick="editarAvaliacao('${a.id}', '${a.funcionario_id}', '${a.tipo}', '${departamentoEscapado}', '${a.data_1 || ""}', '${a.data_eficacia || ""}', '${a.data_2 || ""}', '${a.data_eficacia_2 || ""}', '${a.data_3 || ""}', '${a.data_eficacia_3 || ""}', '${observacaoEscapada}')">Editar</button>
          <button class="botao-mini-perigo" onclick="excluirAvaliacao('${a.id}')">Excluir</button>
        </div>
      </td>
    `;
    corpo.appendChild(linha);
  });
}

// ---------------------------------------------------------
// Mudança de avaliação (PDI <-> PDR), preservando histórico
// ---------------------------------------------------------
async function mudarAvaliacao(id) {
  const atual = avaliacoesCache.find((a) => a.id === id);
  if (!atual) return;

  if (atual.tipo === "pdi") {
    const confirmado = confirm(
      "Mudar este colaborador do PDI para o PDR por queda de rendimento?\n\nO histórico do PDI fica guardado — quando ele melhorar, dá pra voltar exatamente de onde parou."
    );
    if (!confirmado) return;

    const { error: erroPausa } = await sb.from("avaliacoes").update({ pausado: true }).eq("id", id);
    if (erroPausa) {
      console.error(erroPausa);
      notificar("Erro ao mudar a avaliação.", "erro");
      return;
    }

    const { error: erroNovo } = await sb.from("avaliacoes").insert({
      funcionario_id: atual.funcionario_id,
      tipo: "pdr",
      departamento: atual.departamento,
      origem_id: id,
    });
    if (erroNovo) {
      console.error(erroNovo);
      notificar("Erro ao criar o PDR.", "erro");
      return;
    }

    notificar("Colaborador movido para o PDR. O PDI anterior ficou guardado no histórico.");
  } else if (atual.tipo === "pdr" && atual.origem_id) {
    const confirmado = confirm(
      "Marcar melhora e voltar este colaborador para o PDI, na etapa em que ele estava?"
    );
    if (!confirmado) return;

    const { error: erroReativa } = await sb
      .from("avaliacoes")
      .update({ pausado: false })
      .eq("id", atual.origem_id);
    if (erroReativa) {
      console.error(erroReativa);
      notificar("Erro ao voltar para o PDI.", "erro");
      return;
    }

    const { error: erroPausaPdr } = await sb.from("avaliacoes").update({ pausado: true }).eq("id", id);
    if (erroPausaPdr) {
      console.error(erroPausaPdr);
      notificar("Erro ao concluir o PDR.", "erro");
      return;
    }

    notificar("Colaborador de volta ao PDI, na etapa em que estava.");
  }

  carregarAvaliacoes();
}

// ---------------------------------------------------------
// Marca o resultado final (aprovado/reprovado)
// ---------------------------------------------------------
async function marcarResultadoAvaliacao(id, resultado) {
  const { error } = await sb.from("avaliacoes").update({ resultado }).eq("id", id);

  if (error) {
    console.error(error);
    notificar("Erro ao registrar o resultado.", "erro");
    return;
  }

  notificar(resultado === "aprovado" ? "Avaliação marcada como aprovada." : "Avaliação marcada como reprovada.");
  carregarAvaliacoes();
}

// ---------------------------------------------------------
// Preenche o formulário com os dados da avaliação para edição
// ---------------------------------------------------------
function editarAvaliacao(id, funcionarioId, tipo, departamento, data1, dataEficacia, data2, dataEficacia2, data3, dataEficacia3, observacao) {
  document.getElementById("avaliacao-id").value = id;
  definirValorCombo("combo-avaliacao-funcionario", funcionarioId);
  document.getElementById("avaliacao-tipo").value = tipo;
  alternarCampoEficacia();
  document.getElementById("avaliacao-departamento").value = departamento || "";
  document.getElementById("avaliacao-data-1").value = data1 || "";
  document.getElementById("avaliacao-data-eficacia").value = dataEficacia || "";
  document.getElementById("avaliacao-data-2").value = data2 || "";
  document.getElementById("avaliacao-data-eficacia-2").value = dataEficacia2 || "";
  document.getElementById("avaliacao-data-3").value = data3 || "";
  document.getElementById("avaliacao-data-eficacia-3").value = dataEficacia3 || "";
  document.getElementById("avaliacao-observacao").value = observacao || "";

  document.getElementById("avaliacao-botao-salvar").textContent = "Salvar alterações";
  document.getElementById("avaliacao-botao-cancelar").classList.remove("oculto");
  document.getElementById("form-avaliacao").scrollIntoView({ behavior: "smooth", block: "start" });
}

function cancelarEdicaoAvaliacao() {
  document.getElementById("form-avaliacao").reset();
  document.getElementById("avaliacao-id").value = "";
  alternarCampoEficacia();
  document.getElementById("avaliacao-botao-salvar").textContent = "Registrar avaliação";
  document.getElementById("avaliacao-botao-cancelar").classList.add("oculto");
}

// ---------------------------------------------------------
// Excluir avaliação
// ---------------------------------------------------------
async function excluirAvaliacao(id) {
  const confirmado = confirm("Excluir esta avaliação? Essa ação não pode ser desfeita.");
  if (!confirmado) return;

  const { error } = await sb.from("avaliacoes").delete().eq("id", id);

  if (error) {
    console.error(error);
    notificar("Erro ao excluir avaliação.", "erro");
    return;
  }

  notificar("Avaliação excluída.");
  carregarAvaliacoes();
}

// para de gerar alerta) e um novo é criado, ligado a ele. Ao
// melhorar, o registro antigo é reativado do jeito que estava.
// =========================================================

const TIPOS_AVALIACAO = {
  pafdc_rh: "PAFDC-RH",
  pdr: "PDR",
  pdi: "PDI",
  pde: "PDE",
  treinamento: "Treinamento",
};

const DIAS_ALERTA_AVALIACAO = 5;

let avaliacoesCache = [];

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("form-avaliacao").addEventListener("submit", registrarAvaliacao);
  alternarCampoEficacia();
});

// ---------------------------------------------------------
// Os campos de Eficácia só existem para Treinamento
// ---------------------------------------------------------
function alternarCampoEficacia() {
  const tipo = document.getElementById("avaliacao-tipo").value;
  const grupos = ["grupo-avaliacao-eficacia-1", "grupo-avaliacao-eficacia-2", "grupo-avaliacao-eficacia-3"];
  const campos = ["avaliacao-data-eficacia", "avaliacao-data-eficacia-2", "avaliacao-data-eficacia-3"];

  grupos.forEach((grupoId, i) => {
    const grupo = document.getElementById(grupoId);
    if (tipo === "treinamento") {
      grupo.classList.remove("oculto");
    } else {
      grupo.classList.add("oculto");
      document.getElementById(campos[i]).value = "";
    }
  });
}

// ---------------------------------------------------------
// Registrar avaliação OU salvar edição de uma existente
// ---------------------------------------------------------
async function registrarAvaliacao(evento) {
  evento.preventDefault();

  const id = document.getElementById("avaliacao-id").value;
  const funcionarioId = document.getElementById("avaliacao-funcionario").value;
  const tipo = document.getElementById("avaliacao-tipo").value;
  const observacao = document.getElementById("avaliacao-observacao").value.trim();

  if (!funcionarioId || !tipo) {
    notificar("Selecione o funcionário e o tipo.", "erro");
    return;
  }

  const ehTreinamento = tipo === "treinamento";
  const valor = (campoId) => document.getElementById(campoId).value || null;

  const registro = {
    funcionario_id: funcionarioId,
    tipo,
    departamento: document.getElementById("avaliacao-departamento").value.trim() || null,
    data_1: valor("avaliacao-data-1"),
    data_eficacia: ehTreinamento ? valor("avaliacao-data-eficacia") : null,
    data_2: valor("avaliacao-data-2"),
    data_eficacia_2: ehTreinamento ? valor("avaliacao-data-eficacia-2") : null,
    data_3: valor("avaliacao-data-3"),
    data_eficacia_3: ehTreinamento ? valor("avaliacao-data-eficacia-3") : null,
    observacao: observacao || null,
  };

  if (id) {
    const { error } = await sb.from("avaliacoes").update(registro).eq("id", id);
    if (error) {
      console.error(error);
      notificar("Erro ao salvar alterações.", "erro");
      return;
    }
    notificar("Avaliação atualizada com sucesso.");
    cancelarEdicaoAvaliacao();
  } else {
    const { error } = await sb.from("avaliacoes").insert(registro);
    if (error) {
      console.error(error);
      notificar("Erro ao registrar avaliação.", "erro");
      return;
    }
    notificar("Avaliação registrada com sucesso.");
    document.getElementById("form-avaliacao").reset();
    alternarCampoEficacia();
  }

  carregarAvaliacoes();
}

// ---------------------------------------------------------
// Carregar avaliações do banco
// ---------------------------------------------------------
async function carregarAvaliacoes() {
  const { data, error } = await sb
    .from("avaliacoes")
    .select(
      "id, funcionario_id, tipo, departamento, data_1, data_eficacia, data_2, data_eficacia_2, data_3, data_eficacia_3, resultado, pausado, origem_id, observacao, funcionarios(nome, setor)"
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  avaliacoesCache = data;
  popularFiltroDepartamentos();
  filtrarAvaliacoes();
}

// ---------------------------------------------------------
// Segue as etapas em ordem e trava na primeira que ainda não
// venceu. Um registro "pausado" (histórico de uma mudança de
// avaliação) não gera mais alerta.
// ---------------------------------------------------------
function classificarAvaliacao(avaliacao) {
  if (avaliacao.pausado) {
    return { status: "pausado", dias: null, data: null };
  }

  const ordem =
    avaliacao.tipo === "treinamento"
      ? ["data_1", "data_eficacia", "data_2", "data_eficacia_2", "data_3", "data_eficacia_3"]
      : ["data_1", "data_2", "data_3"];

  for (const campo of ordem) {
    const valor = avaliacao[campo];
    if (!valor) continue;
    const dias = diasAte(valor);
    if (dias > 0) {
      return {
        status: dias <= DIAS_ALERTA_AVALIACAO ? "alerta" : "em_dia",
        dias,
        data: valor,
      };
    }
  }

  const preenchidas = ordem.filter((campo) => avaliacao[campo]);
  if (preenchidas.length === 0) {
    return { status: "sem_data", dias: null, data: null };
  }

  const ultimoCampo = preenchidas[preenchidas.length - 1];
  const indiceUltimo = ordem.indexOf(ultimoCampo);
  const aindaTemEtapaVazia = indiceUltimo < ordem.length - 1;
  const dias = diasAte(avaliacao[ultimoCampo]);

  return {
    status: aindaTemEtapaVazia ? "atrasado" : "concluido",
    dias,
    data: avaliacao[ultimoCampo],
  };
}

// ---------------------------------------------------------
// Filtro por tipo + busca por nome/departamento
// ---------------------------------------------------------
function popularFiltroDepartamentos() {
  const select = document.getElementById("filtro-avaliacoes-departamento");
  const valorAtual = select.value;

  const departamentos = [...new Set(avaliacoesCache.map((a) => a.departamento).filter(Boolean))].sort();

  select.innerHTML = '<option value="todos">Todos os departamentos</option>';
  departamentos.forEach((d) => {
    const opt = document.createElement("option");
    opt.value = d;
    opt.textContent = d;
    select.appendChild(opt);
  });

  if (departamentos.includes(valorAtual)) select.value = valorAtual;
}

function filtrarAvaliacoes() {
  const tipo = document.getElementById("filtro-avaliacoes-tipo")?.value || "todos";
  const prazo = document.getElementById("filtro-avaliacoes-prazo")?.value || "todos";
  const departamento = document.getElementById("filtro-avaliacoes-departamento")?.value || "todos";
  const termo = (document.getElementById("filtro-avaliacoes-busca")?.value || "").trim().toLowerCase();

  const filtradas = avaliacoesCache.filter((a) => {
    if (tipo !== "todos" && a.tipo !== tipo) return false;
    if (prazo !== "todos" && classificarAvaliacao(a).status !== prazo) return false;
    if (departamento !== "todos" && a.departamento !== departamento) return false;
    if (termo && !(a.funcionarios?.nome || "").toLowerCase().includes(termo)) return false;
    return true;
  });

  renderizarAvaliacoes(filtradas);
}

function renderizarAvaliacoes(lista) {
  atualizarContador("contador-avaliacoes", lista.length, avaliacoesCache.length);
  const corpo = document.getElementById("tabela-avaliacoes-corpo");
  corpo.innerHTML = "";

  if (lista.length === 0) {
    corpo.innerHTML = `<tr><td colspan="12" class="celula-vazia">${
      avaliacoesCache.length === 0
        ? "Nenhuma avaliação registrada ainda."
        : "Nenhuma avaliação encontrada para esse filtro."
    }</td></tr>`;
    return;
  }

  lista.forEach((a) => {
    const { status, dias, data } = classificarAvaliacao(a);
    const linha = document.createElement("tr");

    let statusHtml;
    if (status === "alerta") {
      linha.classList.add("linha-alerta");
      statusHtml = `<span class="badge badge-alerta">${formatarData(data)} · faltam ${dias}d</span>`;
    } else if (status === "em_dia") {
      statusHtml = `<span class="badge badge-neutro">${formatarData(data)} · faltam ${dias}d</span>`;
    } else if (status === "atrasado") {
      linha.classList.add("linha-vencida");
      statusHtml = `<span class="badge badge-vencido">Atrasado desde ${formatarData(data)} (${Math.abs(dias)}d)</span>`;
    } else if (status === "concluido") {
      linha.classList.add("linha-ok");
      statusHtml = `<span class="badge badge-ok">Concluído (${formatarData(data)})</span>`;
    } else if (status === "pausado") {
      linha.classList.add("linha-ok");
      linha.style.opacity = "0.6";
      statusHtml = `<span class="badge badge-neutro">Histórico (pausado)</span>`;
    } else {
      statusHtml = `<span class="badge badge-neutro">Sem data registrada</span>`;
    }

    let resultadoHtml;
    if (a.resultado === "aprovado") {
      resultadoHtml = '<span class="badge badge-ok">✅ Aprovado</span>';
    } else if (a.resultado === "reprovado") {
      resultadoHtml = '<span class="badge badge-vencido">❌ Reprovado</span>';
    } else {
      resultadoHtml = '<span class="badge badge-neutro">Pendente</span>';
    }

    const botoesResultado =
      a.data_3 && !a.pausado
        ? `
        <button class="botao-mini-sucesso" onclick="marcarResultadoAvaliacao('${a.id}', 'aprovado')">Aprovado</button>
        <button class="botao-mini-perigo" onclick="marcarResultadoAvaliacao('${a.id}', 'reprovado')">Reprovado</button>
      `
        : "";

    let botaoMudanca = "";
    if (!a.pausado && a.tipo === "pdi") {
      botaoMudanca = `<button class="botao-mini-perigo" onclick="mudarAvaliacao('${a.id}')" title="Queda de rendimento">🔄 Mudar p/ PDR</button>`;
    } else if (!a.pausado && a.tipo === "pdr" && a.origem_id) {
      botaoMudanca = `<button class="botao-mini-sucesso" onclick="mudarAvaliacao('${a.id}')" title="Melhora">🔄 Voltar p/ PDI</button>`;
    }

    const observacaoEscapada = (a.observacao || "").replace(/'/g, "\\'");
    const departamentoEscapado = (a.departamento || "").replace(/'/g, "\\'");

    linha.innerHTML = `
      <td>${a.funcionarios?.nome || "-"}</td>
      <td>${a.departamento || "-"}</td>
      <td><span class="badge badge-neutro">${TIPOS_AVALIACAO[a.tipo] || a.tipo}</span></td>
      <td>${formatarData(a.data_1)}</td>
      <td>${a.tipo === "treinamento" ? formatarData(a.data_eficacia) : "-"}</td>
      <td>${formatarData(a.data_2)}</td>
      <td>${a.tipo === "treinamento" ? formatarData(a.data_eficacia_2) : "-"}</td>
      <td>${formatarData(a.data_3)}</td>
      <td>${a.tipo === "treinamento" ? formatarData(a.data_eficacia_3) : "-"}</td>
      <td>${statusHtml}</td>
      <td>${resultadoHtml}</td>
      <td>
        <div class="acoes-tabela">
          ${botoesResultado}
          ${botaoMudanca}
          <button class="botao-mini" onclick="editarAvaliacao('${a.id}', '${a.funcionario_id}', '${a.tipo}', '${departamentoEscapado}', '${a.data_1 || ""}', '${a.data_eficacia || ""}', '${a.data_2 || ""}', '${a.data_eficacia_2 || ""}', '${a.data_3 || ""}', '${a.data_eficacia_3 || ""}', '${observacaoEscapada}')">Editar</button>
          <button class="botao-mini-perigo" onclick="excluirAvaliacao('${a.id}')">Excluir</button>
        </div>
      </td>
    `;
    corpo.appendChild(linha);
  });
}

// ---------------------------------------------------------
// Mudança de avaliação (PDI <-> PDR), preservando histórico
// ---------------------------------------------------------
async function mudarAvaliacao(id) {
  const atual = avaliacoesCache.find((a) => a.id === id);
  if (!atual) return;

  if (atual.tipo === "pdi") {
    const confirmado = confirm(
      "Mudar este colaborador do PDI para o PDR por queda de rendimento?\n\nO histórico do PDI fica guardado — quando ele melhorar, dá pra voltar exatamente de onde parou."
    );
    if (!confirmado) return;

    const { error: erroPausa } = await sb.from("avaliacoes").update({ pausado: true }).eq("id", id);
    if (erroPausa) {
      console.error(erroPausa);
      notificar("Erro ao mudar a avaliação.", "erro");
      return;
    }

    const { error: erroNovo } = await sb.from("avaliacoes").insert({
      funcionario_id: atual.funcionario_id,
      tipo: "pdr",
      departamento: atual.departamento,
      origem_id: id,
    });
    if (erroNovo) {
      console.error(erroNovo);
      notificar("Erro ao criar o PDR.", "erro");
      return;
    }

    notificar("Colaborador movido para o PDR. O PDI anterior ficou guardado no histórico.");
  } else if (atual.tipo === "pdr" && atual.origem_id) {
    const confirmado = confirm(
      "Marcar melhora e voltar este colaborador para o PDI, na etapa em que ele estava?"
    );
    if (!confirmado) return;

    const { error: erroReativa } = await sb
      .from("avaliacoes")
      .update({ pausado: false })
      .eq("id", atual.origem_id);
    if (erroReativa) {
      console.error(erroReativa);
      notificar("Erro ao voltar para o PDI.", "erro");
      return;
    }

    const { error: erroPausaPdr } = await sb.from("avaliacoes").update({ pausado: true }).eq("id", id);
    if (erroPausaPdr) {
      console.error(erroPausaPdr);
      notificar("Erro ao concluir o PDR.", "erro");
      return;
    }

    notificar("Colaborador de volta ao PDI, na etapa em que estava.");
  }

  carregarAvaliacoes();
}

// ---------------------------------------------------------
// Marca o resultado final (aprovado/reprovado)
// ---------------------------------------------------------
async function marcarResultadoAvaliacao(id, resultado) {
  const { error } = await sb.from("avaliacoes").update({ resultado }).eq("id", id);

  if (error) {
    console.error(error);
    notificar("Erro ao registrar o resultado.", "erro");
    return;
  }

  notificar(resultado === "aprovado" ? "Avaliação marcada como aprovada." : "Avaliação marcada como reprovada.");
  carregarAvaliacoes();
}

// ---------------------------------------------------------
// Preenche o formulário com os dados da avaliação para edição
// ---------------------------------------------------------
function editarAvaliacao(id, funcionarioId, tipo, departamento, data1, dataEficacia, data2, dataEficacia2, data3, dataEficacia3, observacao) {
  document.getElementById("avaliacao-id").value = id;
  definirValorCombo("combo-avaliacao-funcionario", funcionarioId);
  document.getElementById("avaliacao-tipo").value = tipo;
  alternarCampoEficacia();
  document.getElementById("avaliacao-departamento").value = departamento || "";
  document.getElementById("avaliacao-data-1").value = data1 || "";
  document.getElementById("avaliacao-data-eficacia").value = dataEficacia || "";
  document.getElementById("avaliacao-data-2").value = data2 || "";
  document.getElementById("avaliacao-data-eficacia-2").value = dataEficacia2 || "";
  document.getElementById("avaliacao-data-3").value = data3 || "";
  document.getElementById("avaliacao-data-eficacia-3").value = dataEficacia3 || "";
  document.getElementById("avaliacao-observacao").value = observacao || "";

  document.getElementById("avaliacao-botao-salvar").textContent = "Salvar alterações";
  document.getElementById("avaliacao-botao-cancelar").classList.remove("oculto");
  document.getElementById("form-avaliacao").scrollIntoView({ behavior: "smooth", block: "start" });
}

function cancelarEdicaoAvaliacao() {
  document.getElementById("form-avaliacao").reset();
  document.getElementById("avaliacao-id").value = "";
  alternarCampoEficacia();
  document.getElementById("avaliacao-botao-salvar").textContent = "Registrar avaliação";
  document.getElementById("avaliacao-botao-cancelar").classList.add("oculto");
}

// ---------------------------------------------------------
// Excluir avaliação
// ---------------------------------------------------------
async function excluirAvaliacao(id) {
  const confirmado = confirm("Excluir esta avaliação? Essa ação não pode ser desfeita.");
  if (!confirmado) return;

  const { error } = await sb.from("avaliacoes").delete().eq("id", id);

  if (error) {
    console.error(error);
    notificar("Erro ao excluir avaliação.", "erro");
    return;
  }

  notificar("Avaliação excluída.");
  carregarAvaliacoes();
}
