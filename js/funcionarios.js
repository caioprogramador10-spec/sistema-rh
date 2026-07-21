// =========================================================
// FUNCIONARIOS.JS
// Cadastro de funcionários e controle de exame periódico,
// com alerta visual quando faltar 5 dias ou menos para o prazo.
// =========================================================

const DIAS_ALERTA_EXAME = 5;

document.addEventListener("DOMContentLoaded", () => {
  const formFuncionario = document.getElementById("form-funcionario");
  const formExame = document.getElementById("form-exame");

  formFuncionario.addEventListener("submit", adicionarFuncionario);
  formExame.addEventListener("submit", registrarExame);
});

// ---------------------------------------------------------
// Cadastrar funcionário OU salvar edição de um existente
// ---------------------------------------------------------
async function adicionarFuncionario(evento) {
  evento.preventDefault();

  const id = document.getElementById("func-id").value;
  const nome = document.getElementById("func-nome").value.trim();
  const cargo = document.getElementById("func-cargo").value.trim();
  const setor = document.getElementById("func-setor").value.trim();
  const dataAdmissao = document.getElementById("func-admissao").value || null;
  const sexo = document.getElementById("func-sexo").value || null;
  const idade = document.getElementById("func-idade").value
    ? Number(document.getElementById("func-idade").value)
    : null;
  const dependentes = document.getElementById("func-dependentes").value.trim();

  if (!nome) {
    notificar("Informe o nome do funcionário.", "erro");
    return;
  }

  const registro = {
    nome,
    cargo: cargo || null,
    setor: setor || null,
    data_admissao: dataAdmissao,
    sexo,
    idade,
    dependentes: dependentes || null,
  };

  if (id) {
    const { error } = await sb.from("funcionarios").update(registro).eq("id", id);

    if (error) {
      console.error(error);
      notificar("Erro ao salvar alterações do funcionário.", "erro");
      return;
    }

    notificar("Funcionário atualizado com sucesso.");
    cancelarEdicaoFuncionario();
  } else {
    const { error } = await sb.from("funcionarios").insert(registro);

    if (error) {
      console.error(error);
      notificar("Erro ao cadastrar funcionário.", "erro");
      return;
    }

    notificar("Funcionário cadastrado com sucesso.");
    document.getElementById("form-funcionario").reset();
  }

  carregarFuncionarios();
  popularSelectsFuncionarios();
}

// ---------------------------------------------------------
// Preenche o formulário com os dados do funcionário para edição
// ---------------------------------------------------------
function editarFuncionario(id, nome, cargo, setor, dataAdmissao, sexo, idade, dependentes) {
  document.getElementById("func-id").value = id;
  document.getElementById("func-nome").value = nome;
  document.getElementById("func-cargo").value = cargo || "";
  document.getElementById("func-setor").value = setor || "";
  document.getElementById("func-admissao").value = dataAdmissao || "";
  document.getElementById("func-sexo").value = sexo || "";
  document.getElementById("func-idade").value = idade || "";
  document.getElementById("func-dependentes").value = dependentes || "";

  document.getElementById("func-botao-salvar").textContent = "Salvar alterações";
  document.getElementById("func-botao-cancelar").classList.remove("oculto");
  document.getElementById("form-funcionario").scrollIntoView({ behavior: "smooth", block: "start" });
}

function cancelarEdicaoFuncionario() {
  document.getElementById("form-funcionario").reset();
  document.getElementById("func-id").value = "";
  document.getElementById("func-botao-salvar").textContent = "Cadastrar funcionário";
  document.getElementById("func-botao-cancelar").classList.add("oculto");
}

// ---------------------------------------------------------
// Excluir funcionário (também apaga os exames dele; as
// movimentações de estoque dele ficam, só perdem a referência)
// ---------------------------------------------------------
async function excluirFuncionario(id, nome) {
  const confirmado = confirm(
    `Excluir "${nome}"? Isso também apaga os exames periódicos cadastrados para esse funcionário. Essa ação não pode ser desfeita.`
  );
  if (!confirmado) return;

  const { error } = await sb.from("funcionarios").delete().eq("id", id);

  if (error) {
    console.error(error);
    notificar("Erro ao excluir funcionário.", "erro");
    return;
  }

  notificar("Funcionário excluído.");
  carregarFuncionarios();
  carregarExames();
  popularSelectsFuncionarios();
}

// ---------------------------------------------------------
// Listar funcionários
// ---------------------------------------------------------
let funcionariosCache = [];

async function carregarFuncionarios() {
  const { data, error } = await sb
    .from("funcionarios")
    .select("*")
    .order("nome");

  if (error) {
    console.error(error);
    return;
  }

  funcionariosCache = data;
  filtrarFuncionarios();
}

function filtrarFuncionarios() {
  const termo = (document.getElementById("filtro-funcionarios")?.value || "")
    .trim()
    .toLowerCase();

  const filtrados = !termo
    ? funcionariosCache
    : funcionariosCache.filter(
        (f) =>
          f.nome.toLowerCase().includes(termo) ||
          (f.cargo || "").toLowerCase().includes(termo) ||
          (f.setor || "").toLowerCase().includes(termo)
      );

  renderizarFuncionarios(filtrados);
}

function renderizarFuncionarios(data) {
  atualizarContador("contador-funcionarios", data.length, funcionariosCache.length);
  const corpo = document.getElementById("tabela-funcionarios-corpo");
  corpo.innerHTML = "";

  if (data.length === 0) {
    corpo.innerHTML = `<tr><td colspan="8" class="celula-vazia">${
      funcionariosCache.length === 0
        ? "Nenhum funcionário cadastrado ainda."
        : "Nenhum funcionário encontrado para esse filtro."
    }</td></tr>`;
    return;
  }

  data.forEach((f) => {
    const linha = document.createElement("tr");
    const nomeEscapado = f.nome.replace(/'/g, "\\'");
    const cargoEscapado = (f.cargo || "").replace(/'/g, "\\'");
    const setorEscapado = (f.setor || "").replace(/'/g, "\\'");
    const sexoEscapado = (f.sexo || "").replace(/'/g, "\\'");
    const dependentesEscapados = (f.dependentes || "").replace(/'/g, "\\'");

    linha.innerHTML = `
      <td>${f.nome}</td>
      <td>${f.cargo || "-"}</td>
      <td>${f.setor || "-"}</td>
      <td>${formatarData(f.data_admissao)}</td>
      <td>${f.sexo || "-"}</td>
      <td>${f.idade || "-"}</td>
      <td>${f.dependentes || "-"}</td>
      <td>
        <div class="acoes-tabela">
          <button class="botao-mini" onclick="editarFuncionario('${f.id}', '${nomeEscapado}', '${cargoEscapado}', '${setorEscapado}', '${f.data_admissao || ""}', '${sexoEscapado}', '${f.idade || ""}', '${dependentesEscapados}')">Editar</button>
          <button class="botao-mini-perigo" onclick="excluirFuncionario('${f.id}', '${nomeEscapado}')">Excluir</button>
        </div>
      </td>
    `;
    corpo.appendChild(linha);
  });
}

// ---------------------------------------------------------
// Registrar exame periódico OU salvar edição de um existente
// ---------------------------------------------------------
async function registrarExame(evento) {
  evento.preventDefault();

  const id = document.getElementById("exame-id").value;
  const funcionarioId = document.getElementById("exame-funcionario").value;
  const dataUltimo = document.getElementById("exame-data-ultimo").value;
  const dataProximo = document.getElementById("exame-data-proximo").value;
  const observacao = document.getElementById("exame-observacao").value.trim();

  if (!funcionarioId || !dataUltimo || !dataProximo) {
    notificar("Preencha funcionário, data do exame e data do próximo exame.", "erro");
    return;
  }

  if (id) {
    const { error } = await sb
      .from("exames_periodicos")
      .update({
        funcionario_id: funcionarioId,
        data_ultimo_exame: dataUltimo,
        data_proximo_exame: dataProximo,
        observacao: observacao || null,
      })
      .eq("id", id);

    if (error) {
      console.error(error);
      notificar("Erro ao salvar alterações do exame.", "erro");
      return;
    }

    notificar("Exame atualizado com sucesso.");
    cancelarEdicaoExame();
  } else {
    const { error } = await sb.from("exames_periodicos").insert({
      funcionario_id: funcionarioId,
      data_ultimo_exame: dataUltimo,
      data_proximo_exame: dataProximo,
      observacao: observacao || null,
    });

    if (error) {
      console.error(error);
      notificar("Erro ao registrar exame.", "erro");
      return;
    }

    notificar("Exame registrado com sucesso.");
    document.getElementById("form-exame").reset();
  }

  carregarExames();
}

// ---------------------------------------------------------
// Preenche o formulário com os dados do exame para edição
// ---------------------------------------------------------
function editarExame(id, funcionarioId, dataUltimo, dataProximo, observacao) {
  document.getElementById("exame-id").value = id;
  definirValorCombo("combo-exame-funcionario", funcionarioId);
  document.getElementById("exame-data-ultimo").value = dataUltimo;
  document.getElementById("exame-data-proximo").value = dataProximo;
  document.getElementById("exame-observacao").value = observacao || "";

  document.getElementById("exame-botao-salvar").textContent = "Salvar alterações";
  document.getElementById("exame-botao-cancelar").classList.remove("oculto");
  document.getElementById("form-exame").scrollIntoView({ behavior: "smooth", block: "start" });
}

function cancelarEdicaoExame() {
  document.getElementById("form-exame").reset();
  document.getElementById("exame-id").value = "";
  document.getElementById("exame-botao-salvar").textContent = "Registrar exame";
  document.getElementById("exame-botao-cancelar").classList.add("oculto");
}

// ---------------------------------------------------------
// Excluir exame periódico
// ---------------------------------------------------------
async function excluirExame(id) {
  const confirmado = confirm("Excluir este exame periódico? Essa ação não pode ser desfeita.");
  if (!confirmado) return;

  const { error } = await sb.from("exames_periodicos").delete().eq("id", id);

  if (error) {
    console.error(error);
    notificar("Erro ao excluir exame.", "erro");
    return;
  }

  notificar("Exame excluído.");
  carregarExames();
}

// ---------------------------------------------------------
// Marcar exame como realizado: registra a data de hoje como
// o exame feito e já agenda automaticamente o próximo para
// daqui a 1 ano, mantendo o funcionário no controle de prazos.
// ---------------------------------------------------------
async function marcarExameRealizado(id) {
  const hoje = hojeISO();
  const proximo = somarUmAno(hoje);

  const confirmado = confirm(
    `Marcar exame como realizado hoje (${formatarData(hoje)})?\n\nO próximo exame será agendado automaticamente para ${formatarData(proximo)}.`
  );
  if (!confirmado) return;

  const { error } = await sb
    .from("exames_periodicos")
    .update({
      data_ultimo_exame: hoje,
      data_proximo_exame: proximo,
      realizado: false,
    })
    .eq("id", id);

  if (error) {
    console.error(error);
    notificar("Erro ao atualizar exame.", "erro");
    return;
  }

  notificar(`Exame realizado. Próximo exame agendado para ${formatarData(proximo)}.`);
  carregarExames();
}

// ---------------------------------------------------------
// Listar exames, ordenado pelo prazo mais próximo,
// com destaque quando faltar DIAS_ALERTA_EXAME dias ou menos
// ---------------------------------------------------------
async function carregarExames() {
  const { data, error } = await sb
    .from("exames_periodicos")
    .select("id, funcionario_id, data_ultimo_exame, data_proximo_exame, realizado, observacao, funcionarios(nome, setor)")
    .order("data_proximo_exame");

  if (error) {
    console.error(error);
    return;
  }

  examesCache = data;
  filtrarExames();
}

// ---------------------------------------------------------
// Classifica um exame em: atrasado, alerta, em_dia ou realizado
// ---------------------------------------------------------
function classificarExame(exame) {
  const dias = diasAte(exame.data_proximo_exame);
  if (exame.realizado) return { status: "realizado", dias };
  if (dias < 0) return { status: "atrasado", dias };
  if (dias <= DIAS_ALERTA_EXAME) return { status: "alerta", dias };
  return { status: "em_dia", dias };
}

let examesCache = [];

function filtrarExames() {
  const statusSelecionado = document.getElementById("filtro-exames-status")?.value || "todos";

  const filtrados =
    statusSelecionado === "todos"
      ? examesCache
      : examesCache.filter((exame) => classificarExame(exame).status === statusSelecionado);

  renderizarExames(filtrados);
}

function renderizarExames(data) {
  atualizarContador("contador-exames", data.length, examesCache.length);
  const corpo = document.getElementById("tabela-exames-corpo");
  corpo.innerHTML = "";

  if (data.length === 0) {
    corpo.innerHTML = `<tr><td colspan="6" class="celula-vazia">${
      examesCache.length === 0
        ? "Nenhum exame registrado ainda."
        : "Nenhum exame encontrado para esse filtro."
    }</td></tr>`;
    return;
  }

  data.forEach((exame) => {
    const { status, dias } = classificarExame(exame);
    const linha = document.createElement("tr");
    const observacaoEscapada = (exame.observacao || "").replace(/'/g, "\\'");

    let statusHtml;
    if (status === "realizado") {
      linha.classList.add("linha-ok");
      statusHtml = '<span class="badge badge-ok">Realizado</span>';
    } else if (status === "atrasado") {
      linha.classList.add("linha-vencida");
      statusHtml = `<span class="badge badge-vencido">Atrasado (${Math.abs(dias)}d)</span>`;
    } else if (status === "alerta") {
      linha.classList.add("linha-alerta");
      statusHtml = `<span class="badge badge-alerta">Faltam ${dias} dia(s)</span>`;
    } else {
      statusHtml = `<span class="badge badge-neutro">Faltam ${dias} dias</span>`;
    }

    linha.innerHTML = `
      <td>${exame.funcionarios?.nome || "-"}</td>
      <td>${exame.funcionarios?.setor || "-"}</td>
      <td>${formatarData(exame.data_ultimo_exame)}</td>
      <td>${formatarData(exame.data_proximo_exame)}</td>
      <td>${statusHtml}</td>
      <td>
        <div class="acoes-tabela">
          ${
            exame.realizado
              ? ""
              : `<button class="botao-mini" onclick="marcarExameRealizado('${exame.id}')">Marcar realizado</button>`
          }
          <button class="botao-mini" onclick="editarExame('${exame.id}', '${exame.funcionario_id}', '${exame.data_ultimo_exame}', '${exame.data_proximo_exame}', '${observacaoEscapada}')">Editar</button>
          <button class="botao-mini-perigo" onclick="excluirExame('${exame.id}')">Excluir</button>
        </div>
      </td>
    `;
    corpo.appendChild(linha);
  });
}
