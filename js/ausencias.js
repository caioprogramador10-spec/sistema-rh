// =========================================================
// AUSENCIAS.JS
// Controle de faltas, atestados e -6h por funcionário.
// Total de ausências = faltas + atestados + -6h (automático).
// =========================================================

let ausenciasCache = [];

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("form-ausencia").addEventListener("submit", registrarAusencia);
});

async function carregarAusencias() {
  const { data, error } = await sb
    .from("ausencias")
    .select(
      "id, funcionario_id, mes_referencia, faltas, atestados, horas_menos6, adv_susp, recebe_va, atestado_pendente, observacao, funcionarios(nome)"
    )
    .order("mes_referencia", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  ausenciasCache = data;
  filtrarAusencias();
}

function filtrarAusencias() {
  const mes = document.getElementById("filtro-ausencias-mes")?.value || "";
  const termo = (document.getElementById("filtro-ausencias-busca")?.value || "").trim().toLowerCase();

  const filtradas = ausenciasCache.filter((a) => {
    if (mes && (a.mes_referencia || "").slice(0, 7) !== mes) return false;
    if (termo && !(a.funcionarios?.nome || "").toLowerCase().includes(termo)) return false;
    return true;
  });

  renderizarAusencias(filtradas);
}

function formatarDataReferencia(data) {
  return formatarData(data);
}

function renderizarAusencias(lista) {
  atualizarContador("contador-ausencias", lista.length, ausenciasCache.length);
  const corpo = document.getElementById("tabela-ausencias-corpo");
  corpo.innerHTML = "";

  if (lista.length === 0) {
    corpo.innerHTML = `<tr><td colspan="10" class="celula-vazia">${
      ausenciasCache.length === 0
        ? "Nenhuma ausência registrada ainda."
        : "Nenhum registro encontrado para esse filtro."
    }</td></tr>`;
    return;
  }

  lista.forEach((a) => {
    const total = (a.faltas || 0) + (a.atestados || 0) + (a.horas_menos6 || 0);
    const linha = document.createElement("tr");
    if (total > 0) linha.classList.add("linha-alerta");

    const observacaoEscapada = (a.observacao || "").replace(/'/g, "\\'");

    linha.innerHTML = `
      <td>${a.funcionarios?.nome || "-"}</td>
      <td>${formatarDataReferencia(a.mes_referencia)}</td>
      <td>${a.faltas || 0}</td>
      <td>${a.atestados || 0}</td>
      <td>${a.horas_menos6 || 0}</td>
      <td><span class="badge ${total > 0 ? "badge-alerta" : "badge-ok"}">${total}</span></td>
      <td>${a.adv_susp || "-"}</td>
      <td>${a.recebe_va ? "Sim" : "Não"}</td>
      <td>${a.atestado_pendente ? '<span class="badge badge-alerta">Sim</span>' : "Não"}</td>
      <td>
        <div class="acoes-tabela">
          <button class="botao-mini" onclick="editarAusencia('${a.id}', '${a.funcionario_id}', '${a.mes_referencia || ""}', ${a.faltas || 0}, ${a.atestados || 0}, ${a.horas_menos6 || 0}, '${a.adv_susp || ""}', ${a.recebe_va}, ${a.atestado_pendente}, '${observacaoEscapada}')">Editar</button>
          <button class="botao-mini-perigo" onclick="excluirAusencia('${a.id}')">Excluir</button>
        </div>
      </td>
    `;
    corpo.appendChild(linha);
  });
}

async function registrarAusencia(evento) {
  evento.preventDefault();

  const id = document.getElementById("ausencia-id").value;
  const funcionarioId = document.getElementById("ausencia-funcionario").value;

  if (!funcionarioId) {
    notificar("Selecione o funcionário.", "erro");
    return;
  }

  const registro = {
    funcionario_id: funcionarioId,
    mes_referencia: document.getElementById("ausencia-mes").value || null,
    faltas: Number(document.getElementById("ausencia-faltas").value) || 0,
    atestados: Number(document.getElementById("ausencia-atestados").value) || 0,
    horas_menos6: Number(document.getElementById("ausencia-6h").value) || 0,
    adv_susp: document.getElementById("ausencia-adv-susp").value || null,
    recebe_va: document.getElementById("ausencia-recebe-va").value === "sim",
    atestado_pendente: document.getElementById("ausencia-atestado-pendente").value === "sim",
    observacao: document.getElementById("ausencia-observacao").value.trim() || null,
  };

  const resultado = id
    ? await sb.from("ausencias").update(registro).eq("id", id)
    : await sb.from("ausencias").insert(registro);

  if (resultado.error) {
    console.error(resultado.error);
    notificar("Erro ao salvar a ausência.", "erro");
    return;
  }

  notificar(id ? "Ausência atualizada com sucesso." : "Ausência registrada com sucesso.");

  if (id) {
    cancelarEdicaoAusencia();
  } else {
    document.getElementById("form-ausencia").reset();
  }

  carregarAusencias();
}

function editarAusencia(id, funcionarioId, mes, faltas, atestados, horas6, advSusp, recebeVa, atestadoPendente, observacao) {
  document.getElementById("ausencia-id").value = id;
  definirValorCombo("combo-ausencia-funcionario", funcionarioId);
  document.getElementById("ausencia-mes").value = mes || "";
  document.getElementById("ausencia-faltas").value = faltas;
  document.getElementById("ausencia-atestados").value = atestados;
  document.getElementById("ausencia-6h").value = horas6;
  document.getElementById("ausencia-adv-susp").value = advSusp || "";
  document.getElementById("ausencia-recebe-va").value = recebeVa ? "sim" : "nao";
  document.getElementById("ausencia-atestado-pendente").value = atestadoPendente ? "sim" : "nao";
  document.getElementById("ausencia-observacao").value = observacao || "";

  document.getElementById("ausencia-botao-salvar").textContent = "Salvar alterações";
  document.getElementById("ausencia-botao-cancelar").classList.remove("oculto");
  document.getElementById("form-ausencia").scrollIntoView({ behavior: "smooth", block: "start" });
}

function cancelarEdicaoAusencia() {
  document.getElementById("form-ausencia").reset();
  document.getElementById("ausencia-id").value = "";
  document.getElementById("ausencia-botao-salvar").textContent = "Registrar ausência";
  document.getElementById("ausencia-botao-cancelar").classList.add("oculto");
}

async function excluirAusencia(id) {
  if (!confirm("Excluir este registro de ausência?")) return;

  const { error } = await sb.from("ausencias").delete().eq("id", id);

  if (error) {
    console.error(error);
    notificar("Erro ao excluir.", "erro");
    return;
  }

  notificar("Registro excluído.");
  carregarAusencias();
}
