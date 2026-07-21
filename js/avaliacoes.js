// =========================================================
// AVALIACOES.JS
// Cadastro das avaliações de RH: PAFDC-RH, PDR, PDI e
// Treinamento. As datas (1ª, Eficácia, 2ª, 3ª) são digitadas
// manualmente; o sistema calcula sozinho qual é a próxima data
// pendente e avisa quando ela estiver a 5 dias ou menos.
// =========================================================

const TIPOS_AVALIACAO = {
  pafdc_rh: "PAFDC-RH",
  pdr: "PDR",
  pdi: "PDI",
  treinamento: "Treinamento",
};

const DIAS_ALERTA_AVALIACAO = 5;

let avaliacoesCache = [];

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("form-avaliacao").addEventListener("submit", registrarAvaliacao);
  alternarCampoEficacia();
});

// ---------------------------------------------------------
// O campo "Eficácia" só faz sentido para Treinamento
// ---------------------------------------------------------
function alternarCampoEficacia() {
  const tipo = document.getElementById("avaliacao-tipo").value;
  const grupo = document.getElementById("grupo-avaliacao-eficacia");

  if (tipo === "treinamento") {
    grupo.classList.remove("oculto");
  } else {
    grupo.classList.add("oculto");
    document.getElementById("avaliacao-data-eficacia").value = "";
  }
}

// ---------------------------------------------------------
// Registrar avaliação OU salvar edição de uma existente
// ---------------------------------------------------------
async function registrarAvaliacao(evento) {
  evento.preventDefault();

  const id = document.getElementById("avaliacao-id").value;
  const funcionarioId = document.getElementById("avaliacao-funcionario").value;
  const tipo = document.getElementById("avaliacao-tipo").value;
  const departamento = document.getElementById("avaliacao-departamento").value.trim();
  const data1 = document.getElementById("avaliacao-data-1").value || null;
  const dataEficacia = document.getElementById("avaliacao-data-eficacia").value || null;
  const data2 = document.getElementById("avaliacao-data-2").value || null;
  const data3 = document.getElementById("avaliacao-data-3").value || null;
  const observacao = document.getElementById("avaliacao-observacao").value.trim();

  if (!funcionarioId || !tipo) {
    notificar("Selecione o funcionário e o tipo de avaliação.", "erro");
    return;
  }

  const registro = {
    funcionario_id: funcionarioId,
    tipo,
    departamento: departamento || null,
    data_1: data1,
    data_eficacia: tipo === "treinamento" ? dataEficacia : null,
    data_2: data2,
    data_3: data3,
    observacao: observacao || null,
  };

  if (id) {
    const { error } = await sb.from("avaliacoes").update(registro).eq("id", id);

    if (error) {
      console.error(error);
      notificar("Erro ao salvar alterações da avaliação.", "erro");
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
      "id, funcionario_id, tipo, departamento, data_1, data_eficacia, data_2, data_3, resultado, observacao, funcionarios(nome, setor)"
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  avaliacoesCache = data;
  filtrarAvaliacoes();
}

// ---------------------------------------------------------
// Olha as etapas NA ORDEM em que acontecem (1ª → Eficácia →
// 2ª → 3ª) e trava na PRIMEIRA que ainda não venceu — essa é
// a que está sendo acompanhada agora. Uma etapa cujo dia é
// hoje conta como já feita (não gera alerta), então só uma
// data realmente futura é tratada como pendente.
//
// Só quando essa etapa vence de verdade é que o sistema passa
// a acompanhar a próxima preenchida (por isso a etapa anterior
// "é esquecida" e o cálculo passa pra seguinte).
// ---------------------------------------------------------
function classificarAvaliacao(avaliacao) {
  const ordem =
    avaliacao.tipo === "treinamento"
      ? ["data_1", "data_eficacia", "data_2", "data_3"]
      : ["data_1", "data_2", "data_3"];

  // 1) primeira etapa preenchida cujo prazo ainda não chegou
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

  // 2) nenhuma etapa pendente: olha a última preenchida
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
function filtrarAvaliacoes() {
  const tipo = document.getElementById("filtro-avaliacoes-tipo")?.value || "todos";
  const termo = (document.getElementById("filtro-avaliacoes-busca")?.value || "").trim().toLowerCase();

  const filtradas = avaliacoesCache.filter((a) => {
    if (tipo !== "todos" && a.tipo !== tipo) return false;
    if (!termo) return true;
    const nome = (a.funcionarios?.nome || "").toLowerCase();
    const depto = (a.departamento || "").toLowerCase();
    return nome.includes(termo) || depto.includes(termo);
  });

  renderizarAvaliacoes(filtradas);
}

function renderizarAvaliacoes(lista) {
  atualizarContador("contador-avaliacoes", lista.length, avaliacoesCache.length);
  const corpo = document.getElementById("tabela-avaliacoes-corpo");
  corpo.innerHTML = "";

  if (lista.length === 0) {
    corpo.innerHTML = `<tr><td colspan="10" class="celula-vazia">${
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
      statusHtml = `<span class="badge badge-vencido">Atrasado desde ${formatarData(data)} (${Math.abs(dias)}d) — agende a próxima etapa</span>`;
    } else if (status === "concluido") {
      linha.classList.add("linha-ok");
      statusHtml = `<span class="badge badge-ok">Concluído (última etapa em ${formatarData(data)})</span>`;
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

    const botoesResultado = a.data_3
      ? `
        <button class="botao-mini-sucesso" onclick="marcarResultadoAvaliacao('${a.id}', 'aprovado')">Aprovado</button>
        <button class="botao-mini-perigo" onclick="marcarResultadoAvaliacao('${a.id}', 'reprovado')">Reprovado</button>
      `
      : "";

    const observacaoEscapada = (a.observacao || "").replace(/'/g, "\\'");
    const departamentoEscapado = (a.departamento || "").replace(/'/g, "\\'");

    linha.innerHTML = `
      <td>${a.funcionarios?.nome || "-"}</td>
      <td>${a.departamento || "-"}</td>
      <td><span class="badge badge-neutro">${TIPOS_AVALIACAO[a.tipo] || a.tipo}</span></td>
      <td>${formatarData(a.data_1)}</td>
      <td>${a.tipo === "treinamento" ? formatarData(a.data_eficacia) : "-"}</td>
      <td>${formatarData(a.data_2)}</td>
      <td>${formatarData(a.data_3)}</td>
      <td>${statusHtml}</td>
      <td>${resultadoHtml}</td>
      <td>
        <div class="acoes-tabela">
          ${botoesResultado}
          <button class="botao-mini" onclick="editarAvaliacao('${a.id}', '${a.funcionario_id}', '${a.tipo}', '${departamentoEscapado}', '${a.data_1 || ""}', '${a.data_eficacia || ""}', '${a.data_2 || ""}', '${a.data_3 || ""}', '${observacaoEscapada}')">Editar</button>
          <button class="botao-mini-perigo" onclick="excluirAvaliacao('${a.id}')">Excluir</button>
        </div>
      </td>
    `;
    corpo.appendChild(linha);
  });
}

// ---------------------------------------------------------
// Marca o resultado final (aprovado/reprovado) — só faz
// sentido depois que a 3ª etapa foi preenchida
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
function editarAvaliacao(id, funcionarioId, tipo, departamento, data1, dataEficacia, data2, data3, observacao) {
  document.getElementById("avaliacao-id").value = id;
  definirValorCombo("combo-avaliacao-funcionario", funcionarioId);
  document.getElementById("avaliacao-tipo").value = tipo;
  alternarCampoEficacia();
  document.getElementById("avaliacao-departamento").value = departamento || "";
  document.getElementById("avaliacao-data-1").value = data1 || "";
  document.getElementById("avaliacao-data-eficacia").value = dataEficacia || "";
  document.getElementById("avaliacao-data-2").value = data2 || "";
  document.getElementById("avaliacao-data-3").value = data3 || "";
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
