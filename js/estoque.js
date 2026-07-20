// =========================================================
// ESTOQUE.JS
// Cadastro de materiais, registro de entrada/saída e
// alerta de estoque mínimo.
// =========================================================

document.addEventListener("DOMContentLoaded", () => {
  const formMaterial = document.getElementById("form-material");
  const formMovimentacao = document.getElementById("form-movimentacao");// =========================================================
// ESTOQUE.JS
// Cadastro de materiais, registro de entrada/saída e
// alerta de estoque mínimo.
// =========================================================

document.addEventListener("DOMContentLoaded", () => {
  const formMaterial = document.getElementById("form-material");
  const formMovimentacao = document.getElementById("form-movimentacao");

  formMaterial.addEventListener("submit", adicionarMaterial);
  formMovimentacao.addEventListener("submit", registrarMovimentacao);
});

// ---------------------------------------------------------
// Cadastrar novo material OU salvar edição de um existente
// ---------------------------------------------------------
async function adicionarMaterial(evento) {
  evento.preventDefault();

  const id = document.getElementById("material-id").value;
  const nome = document.getElementById("material-nome").value.trim();
  const categoria = document.getElementById("material-categoria").value.trim();
  const unidade = document.getElementById("material-unidade").value.trim() || "un";
  const estoqueMinimo = Number(document.getElementById("material-estoque-minimo").value) || 0;

  if (!nome) {
    notificar("Informe o nome do material.", "erro");
    return;
  }

  if (id) {
    // Modo edição: não mexe na quantidade atual aqui (isso é feito
    // via movimentação), só nos dados cadastrais.
    const { error } = await sb
      .from("materiais")
      .update({ nome, categoria: categoria || null, unidade, estoque_minimo: estoqueMinimo })
      .eq("id", id);

    if (error) {
      console.error(error);
      notificar("Erro ao salvar alterações do material.", "erro");
      return;
    }

    notificar("Material atualizado com sucesso.");
    cancelarEdicaoMaterial();
  } else {
    const quantidadeInicial = Number(document.getElementById("material-quantidade-inicial").value) || 0;

    const { error } = await sb.from("materiais").insert({
      nome,
      categoria: categoria || null,
      unidade,
      quantidade_atual: quantidadeInicial,
      estoque_minimo: estoqueMinimo,
    });

    if (error) {
      console.error(error);
      notificar("Erro ao cadastrar material.", "erro");
      return;
    }

    notificar("Material cadastrado com sucesso.");
    document.getElementById("form-material").reset();
  }

  carregarMateriais();
  popularSelectMateriais();
}

// ---------------------------------------------------------
// Preenche o formulário com os dados do material para edição
// ---------------------------------------------------------
function editarMaterial(id, nome, categoria, unidade, estoqueMinimo) {
  document.getElementById("material-id").value = id;
  document.getElementById("material-nome").value = nome;
  document.getElementById("material-categoria").value = categoria || "";
  document.getElementById("material-unidade").value = unidade;
  document.getElementById("material-estoque-minimo").value = estoqueMinimo;

  const grupoQtdInicial = document.getElementById("material-quantidade-inicial").closest(".form-grupo");
  grupoQtdInicial.classList.add("oculto");

  document.getElementById("material-botao-salvar").textContent = "Salvar alterações";
  document.getElementById("material-botao-cancelar").classList.remove("oculto");
  document.getElementById("form-material").scrollIntoView({ behavior: "smooth", block: "start" });
}

function cancelarEdicaoMaterial() {
  document.getElementById("form-material").reset();
  document.getElementById("material-id").value = "";
  document.getElementById("material-quantidade-inicial").closest(".form-grupo").classList.remove("oculto");
  document.getElementById("material-botao-salvar").textContent = "Cadastrar material";
  document.getElementById("material-botao-cancelar").classList.add("oculto");
}

// ---------------------------------------------------------
// Excluir material (também apaga o histórico de movimentações
// dele, por causa do ON DELETE CASCADE no banco)
// ---------------------------------------------------------
async function excluirMaterial(id, nome) {
  const confirmado = confirm(
    `Excluir "${nome}"? Isso também apaga todo o histórico de movimentações desse material. Essa ação não pode ser desfeita.`
  );
  if (!confirmado) return;

  const { error } = await sb.from("materiais").delete().eq("id", id);

  if (error) {
    console.error(error);
    notificar("Erro ao excluir material.", "erro");
    return;
  }

  notificar("Material excluído.");
  carregarMateriais();
  carregarHistoricoMovimentacoes();
  popularSelectMateriais();
}

// ---------------------------------------------------------
// Listar materiais (com destaque para estoque baixo)
// ---------------------------------------------------------
let materiaisCache = [];

async function carregarMateriais() {
  const { data, error } = await sb
    .from("materiais")
    .select("*")
    .order("nome");

  if (error) {
    console.error(error);
    return;
  }

  materiaisCache = data;
  filtrarMateriais();
}

function filtrarMateriais() {
  const termo = (document.getElementById("filtro-materiais")?.value || "")
    .trim()
    .toLowerCase();

  const filtrados = !termo
    ? materiaisCache
    : materiaisCache.filter((m) => {
        const estoqueBaixo = m.quantidade_atual <= m.estoque_minimo;
        const statusTexto = estoqueBaixo ? "estoque baixo" : "ok";
        return (
          m.nome.toLowerCase().includes(termo) ||
          (m.categoria || "").toLowerCase().includes(termo) ||
          (m.unidade || "").toLowerCase().includes(termo) ||
          statusTexto.includes(termo)
        );
      });

  renderizarMateriais(filtrados);
}

function renderizarMateriais(data) {
  const corpo = document.getElementById("tabela-materiais-corpo");
  corpo.innerHTML = "";

  if (data.length === 0) {
    corpo.innerHTML = `<tr><td colspan="6" class="celula-vazia">${
      materiaisCache.length === 0
        ? "Nenhum material cadastrado ainda."
        : "Nenhum material encontrado para esse filtro."
    }</td></tr>`;
    return;
  }

  data.forEach((material) => {
    const estoqueBaixo = material.quantidade_atual <= material.estoque_minimo;

    const linha = document.createElement("tr");
    if (estoqueBaixo) linha.classList.add("linha-alerta");

    const nomeEscapado = material.nome.replace(/'/g, "\\'");
    const categoriaEscapada = (material.categoria || "").replace(/'/g, "\\'");

    linha.innerHTML = `
      <td>${material.nome}</td>
      <td>${material.categoria || "-"}</td>
      <td>${material.quantidade_atual} ${material.unidade}</td>
      <td>${material.estoque_minimo} ${material.unidade}</td>
      <td>${
        estoqueBaixo
          ? '<span class="badge badge-alerta">Estoque baixo</span>'
          : '<span class="badge badge-ok">OK</span>'
      }</td>
      <td>
        <div class="acoes-tabela">
          <button class="botao-mini" onclick="editarMaterial('${material.id}', '${nomeEscapado}', '${categoriaEscapada}', '${material.unidade}', ${material.estoque_minimo})">Editar</button>
          <button class="botao-mini-perigo" onclick="excluirMaterial('${material.id}', '${nomeEscapado}')">Excluir</button>
        </div>
      </td>
    `;
    corpo.appendChild(linha);
  });
}

// ---------------------------------------------------------
// Registrar movimentação (entrada ou saída)
// ---------------------------------------------------------
async function registrarMovimentacao(evento) {
  evento.preventDefault();

  const materialId = document.getElementById("mov-material").value;
  const funcionarioId = document.getElementById("mov-funcionario").value;
  const tipo = document.getElementById("mov-tipo").value;
  const quantidade = Number(document.getElementById("mov-quantidade").value);
  const observacao = document.getElementById("mov-observacao").value.trim();

  if (!materialId || !tipo || !quantidade || quantidade <= 0) {
    notificar("Preencha material, tipo e uma quantidade válida.", "erro");
    return;
  }

  if (tipo === "saida" && !funcionarioId) {
    notificar("Para registrar saída, selecione o funcionário que recebeu o material.", "erro");
    return;
  }

  // Confere se há saldo suficiente antes de dar saída
  if (tipo === "saida") {
    const { data: material, error: erroMaterial } = await sb
      .from("materiais")
      .select("quantidade_atual, nome")
      .eq("id", materialId)
      .single();

    if (erroMaterial) {
      console.error(erroMaterial);
      notificar("Erro ao verificar saldo do material.", "erro");
      return;
    }

    if (quantidade > material.quantidade_atual) {
      notificar(`Saldo insuficiente de "${material.nome}" para essa saída.`, "erro");
      return;
    }
  }

  const { error } = await sb.from("movimentacoes_estoque").insert({
    material_id: materialId,
    funcionario_id: funcionarioId || null,
    tipo,
    quantidade,
    observacao: observacao || null,
  });

  if (error) {
    console.error(error);
    notificar("Erro ao registrar movimentação.", "erro");
    return;
  }

  notificar(
    tipo === "saida"
      ? "Saída registrada e estoque atualizado."
      : "Entrada registrada e estoque atualizado."
  );
  document.getElementById("form-movimentacao").reset();
  carregarMateriais();
  carregarHistoricoMovimentacoes();
}

// ---------------------------------------------------------
// Histórico de movimentações (últimas 200, filtrável por data)
// ---------------------------------------------------------
let historicoCache = [];

async function carregarHistoricoMovimentacoes() {
  const { data, error } = await sb
    .from("movimentacoes_estoque")
    .select(
      "id, tipo, quantidade, observacao, data, materiais(nome, unidade), funcionarios(nome)"
    )
    .order("data", { ascending: false })
    .limit(200);

  if (error) {
    console.error(error);
    return;
  }

  historicoCache = data;
  filtrarHistorico();
}

function filtrarHistorico() {
  const tipo = document.getElementById("filtro-historico-tipo")?.value || "todos";
  const de = document.getElementById("filtro-historico-de")?.value || "";
  const ate = document.getElementById("filtro-historico-ate")?.value || "";

  const filtrados = historicoCache.filter((mov) => {
    if (tipo !== "todos" && mov.tipo !== tipo) return false;
    const dataMov = mov.data.slice(0, 10); // yyyy-mm-dd
    if (de && dataMov < de) return false;
    if (ate && dataMov > ate) return false;
    return true;
  });

  renderizarHistorico(filtrados);
}

function limparFiltroHistorico() {
  document.getElementById("filtro-historico-tipo").value = "todos";
  document.getElementById("filtro-historico-de").value = "";
  document.getElementById("filtro-historico-ate").value = "";
  filtrarHistorico();
}

function renderizarHistorico(data) {
  const corpo = document.getElementById("tabela-historico-corpo");
  corpo.innerHTML = "";

  if (data.length === 0) {
    corpo.innerHTML = `<tr><td colspan="7" class="celula-vazia">${
      historicoCache.length === 0
        ? "Nenhuma movimentação registrada ainda."
        : "Nenhuma movimentação encontrada nesse período."
    }</td></tr>`;
    return;
  }

  data.forEach((mov) => {
    const linha = document.createElement("tr");
    const dataFormatada = new Date(mov.data).toLocaleString("pt-BR");

    linha.innerHTML = `
      <td>${dataFormatada}</td>
      <td>${mov.materiais?.nome || "-"}</td>
      <td>
        <span class="badge ${mov.tipo === "entrada" ? "badge-ok" : "badge-neutro"}">
          ${mov.tipo === "entrada" ? "Entrada" : "Saída"}
        </span>
      </td>
      <td>${mov.quantidade} ${mov.materiais?.unidade || ""}</td>
      <td>${mov.funcionarios?.nome || "-"}</td>
      <td>${mov.observacao || "-"}</td>
      <td>
        <button class="botao-mini-perigo" onclick="excluirMovimentacao('${mov.id}')">Excluir</button>
      </td>
    `;
    corpo.appendChild(linha);
  });
}

// ---------------------------------------------------------
// Excluir uma movimentação (o trigger do banco desfaz
// automaticamente o efeito dela no estoque)
// ---------------------------------------------------------
async function excluirMovimentacao(id) {
  const confirmado = confirm(
    "Excluir esta movimentação? O estoque do material será ajustado automaticamente (a quantidade voltará ao que era antes desse registro)."
  );
  if (!confirmado) return;

  const { error } = await sb.from("movimentacoes_estoque").delete().eq("id", id);

  if (error) {
    console.error(error);
    notificar("Erro ao excluir movimentação.", "erro");
    return;
  }

  notificar("Movimentação excluída e estoque ajustado.");
  carregarMateriais();
  carregarHistoricoMovimentacoes();
}


  formMaterial.addEventListener("submit", adicionarMaterial);
  formMovimentacao.addEventListener("submit", registrarMovimentacao);
});

// ---------------------------------------------------------
// Cadastrar novo material OU salvar edição de um existente
// ---------------------------------------------------------
async function adicionarMaterial(evento) {
  evento.preventDefault();

  const id = document.getElementById("material-id").value;
  const nome = document.getElementById("material-nome").value.trim();
  const categoria = document.getElementById("material-categoria").value.trim();
  const unidade = document.getElementById("material-unidade").value.trim() || "un";
  const estoqueMinimo = Number(document.getElementById("material-estoque-minimo").value) || 0;

  if (!nome) {
    notificar("Informe o nome do material.", "erro");
    return;
  }

  if (id) {
    // Modo edição: não mexe na quantidade atual aqui (isso é feito
    // via movimentação), só nos dados cadastrais.
    const { error } = await sb
      .from("materiais")
      .update({ nome, categoria: categoria || null, unidade, estoque_minimo: estoqueMinimo })
      .eq("id", id);

    if (error) {
      console.error(error);
      notificar("Erro ao salvar alterações do material.", "erro");
      return;
    }

    notificar("Material atualizado com sucesso.");
    cancelarEdicaoMaterial();
  } else {
    const quantidadeInicial = Number(document.getElementById("material-quantidade-inicial").value) || 0;

    const { error } = await sb.from("materiais").insert({
      nome,
      categoria: categoria || null,
      unidade,
      quantidade_atual: quantidadeInicial,
      estoque_minimo: estoqueMinimo,
    });

    if (error) {
      console.error(error);
      notificar("Erro ao cadastrar material.", "erro");
      return;
    }

    notificar("Material cadastrado com sucesso.");
    document.getElementById("form-material").reset();
  }

  carregarMateriais();
  popularSelectMateriais();
}

// ---------------------------------------------------------
// Preenche o formulário com os dados do material para edição
// ---------------------------------------------------------
function editarMaterial(id, nome, categoria, unidade, estoqueMinimo) {
  document.getElementById("material-id").value = id;
  document.getElementById("material-nome").value = nome;
  document.getElementById("material-categoria").value = categoria || "";
  document.getElementById("material-unidade").value = unidade;
  document.getElementById("material-estoque-minimo").value = estoqueMinimo;

  const grupoQtdInicial = document.getElementById("material-quantidade-inicial").closest(".form-grupo");
  grupoQtdInicial.classList.add("oculto");

  document.getElementById("material-botao-salvar").textContent = "Salvar alterações";
  document.getElementById("material-botao-cancelar").classList.remove("oculto");
  document.getElementById("form-material").scrollIntoView({ behavior: "smooth", block: "start" });
}

function cancelarEdicaoMaterial() {
  document.getElementById("form-material").reset();
  document.getElementById("material-id").value = "";
  document.getElementById("material-quantidade-inicial").closest(".form-grupo").classList.remove("oculto");
  document.getElementById("material-botao-salvar").textContent = "Cadastrar material";
  document.getElementById("material-botao-cancelar").classList.add("oculto");
}

// ---------------------------------------------------------
// Excluir material (também apaga o histórico de movimentações
// dele, por causa do ON DELETE CASCADE no banco)
// ---------------------------------------------------------
async function excluirMaterial(id, nome) {
  const confirmado = confirm(
    `Excluir "${nome}"? Isso também apaga todo o histórico de movimentações desse material. Essa ação não pode ser desfeita.`
  );
  if (!confirmado) return;

  const { error } = await sb.from("materiais").delete().eq("id", id);

  if (error) {
    console.error(error);
    notificar("Erro ao excluir material.", "erro");
    return;
  }

  notificar("Material excluído.");
  carregarMateriais();
  carregarHistoricoMovimentacoes();
  popularSelectMateriais();
}

// ---------------------------------------------------------
// Listar materiais (com destaque para estoque baixo)
// ---------------------------------------------------------
let materiaisCache = [];

async function carregarMateriais() {
  const { data, error } = await sb
    .from("materiais")
    .select("*")
    .order("nome");

  if (error) {
    console.error(error);
    return;
  }

  materiaisCache = data;
  filtrarMateriais();
}

function filtrarMateriais() {
  const termo = (document.getElementById("filtro-materiais")?.value || "")
    .trim()
    .toLowerCase();

  const filtrados = !termo
    ? materiaisCache
    : materiaisCache.filter((m) => {
        const estoqueBaixo = m.quantidade_atual <= m.estoque_minimo;
        const statusTexto = estoqueBaixo ? "estoque baixo" : "ok";
        return (
          m.nome.toLowerCase().includes(termo) ||
          (m.categoria || "").toLowerCase().includes(termo) ||
          (m.unidade || "").toLowerCase().includes(termo) ||
          statusTexto.includes(termo)
        );
      });

  renderizarMateriais(filtrados);
}

function renderizarMateriais(data) {
  const corpo = document.getElementById("tabela-materiais-corpo");
  corpo.innerHTML = "";

  if (data.length === 0) {
    corpo.innerHTML = `<tr><td colspan="6" class="celula-vazia">${
      materiaisCache.length === 0
        ? "Nenhum material cadastrado ainda."
        : "Nenhum material encontrado para esse filtro."
    }</td></tr>`;
    return;
  }

  data.forEach((material) => {
    const estoqueBaixo = material.quantidade_atual <= material.estoque_minimo;

    const linha = document.createElement("tr");
    if (estoqueBaixo) linha.classList.add("linha-alerta");

    const nomeEscapado = material.nome.replace(/'/g, "\\'");
    const categoriaEscapada = (material.categoria || "").replace(/'/g, "\\'");

    linha.innerHTML = `
      <td>${material.nome}</td>
      <td>${material.categoria || "-"}</td>
      <td>${material.quantidade_atual} ${material.unidade}</td>
      <td>${material.estoque_minimo} ${material.unidade}</td>
      <td>${
        estoqueBaixo
          ? '<span class="badge badge-alerta">Estoque baixo</span>'
          : '<span class="badge badge-ok">OK</span>'
      }</td>
      <td>
        <div class="acoes-tabela">
          <button class="botao-mini" onclick="editarMaterial('${material.id}', '${nomeEscapado}', '${categoriaEscapada}', '${material.unidade}', ${material.estoque_minimo})">Editar</button>
          <button class="botao-mini-perigo" onclick="excluirMaterial('${material.id}', '${nomeEscapado}')">Excluir</button>
        </div>
      </td>
    `;
    corpo.appendChild(linha);
  });
}

// ---------------------------------------------------------
// Registrar movimentação (entrada ou saída)
// ---------------------------------------------------------
async function registrarMovimentacao(evento) {
  evento.preventDefault();

  const materialId = document.getElementById("mov-material").value;
  const funcionarioId = document.getElementById("mov-funcionario").value;
  const tipo = document.getElementById("mov-tipo").value;
  const quantidade = Number(document.getElementById("mov-quantidade").value);
  const observacao = document.getElementById("mov-observacao").value.trim();

  if (!materialId || !tipo || !quantidade || quantidade <= 0) {
    notificar("Preencha material, tipo e uma quantidade válida.", "erro");
    return;
  }

  if (tipo === "saida" && !funcionarioId) {
    notificar("Para registrar saída, selecione o funcionário que recebeu o material.", "erro");
    return;
  }

  // Confere se há saldo suficiente antes de dar saída
  if (tipo === "saida") {
    const { data: material, error: erroMaterial } = await sb
      .from("materiais")
      .select("quantidade_atual, nome")
      .eq("id", materialId)
      .single();

    if (erroMaterial) {
      console.error(erroMaterial);
      notificar("Erro ao verificar saldo do material.", "erro");
      return;
    }

    if (quantidade > material.quantidade_atual) {
      notificar(`Saldo insuficiente de "${material.nome}" para essa saída.`, "erro");
      return;
    }
  }

  const { error } = await sb.from("movimentacoes_estoque").insert({
    material_id: materialId,
    funcionario_id: funcionarioId || null,
    tipo,
    quantidade,
    observacao: observacao || null,
  });

  if (error) {
    console.error(error);
    notificar("Erro ao registrar movimentação.", "erro");
    return;
  }

  notificar(
    tipo === "saida"
      ? "Saída registrada e estoque atualizado."
      : "Entrada registrada e estoque atualizado."
  );
  document.getElementById("form-movimentacao").reset();
  carregarMateriais();
  carregarHistoricoMovimentacoes();
}

// ---------------------------------------------------------
// Histórico de movimentações (últimas 200, filtrável por data)
// ---------------------------------------------------------
let historicoCache = [];

async function carregarHistoricoMovimentacoes() {
  const { data, error } = await sb
    .from("movimentacoes_estoque")
    .select(
      "id, tipo, quantidade, observacao, data, materiais(nome, unidade), funcionarios(nome)"
    )
    .order("data", { ascending: false })
    .limit(200);

  if (error) {
    console.error(error);
    return;
  }

  historicoCache = data;
  filtrarHistorico();
}

function filtrarHistorico() {
  const tipo = document.getElementById("filtro-historico-tipo")?.value || "todos";
  const de = document.getElementById("filtro-historico-de")?.value || "";
  const ate = document.getElementById("filtro-historico-ate")?.value || "";

  const filtrados = historicoCache.filter((mov) => {
    if (tipo !== "todos" && mov.tipo !== tipo) return false;
    const dataMov = mov.data.slice(0, 10); // yyyy-mm-dd
    if (de && dataMov < de) return false;
    if (ate && dataMov > ate) return false;
    return true;
  });

  renderizarHistorico(filtrados);
}

function limparFiltroHistorico() {
  document.getElementById("filtro-historico-tipo").value = "todos";
  document.getElementById("filtro-historico-de").value = "";
  document.getElementById("filtro-historico-ate").value = "";
  filtrarHistorico();
}

function renderizarHistorico(data) {
  const corpo = document.getElementById("tabela-historico-corpo");
  corpo.innerHTML = "";

  if (data.length === 0) {
    corpo.innerHTML = `<tr><td colspan="7" class="celula-vazia">${
      historicoCache.length === 0
        ? "Nenhuma movimentação registrada ainda."
        : "Nenhuma movimentação encontrada nesse período."
    }</td></tr>`;
    return;
  }

  data.forEach((mov) => {
    const linha = document.createElement("tr");
    const dataFormatada = new Date(mov.data).toLocaleString("pt-BR");

    linha.innerHTML = `
      <td>${dataFormatada}</td>
      <td>${mov.materiais?.nome || "-"}</td>
      <td>
        <span class="badge ${mov.tipo === "entrada" ? "badge-ok" : "badge-neutro"}">
          ${mov.tipo === "entrada" ? "Entrada" : "Saída"}
        </span>
      </td>
      <td>${mov.quantidade} ${mov.materiais?.unidade || ""}</td>
      <td>${mov.funcionarios?.nome || "-"}</td>
      <td>${mov.observacao || "-"}</td>
      <td>
        <button class="botao-mini-perigo" onclick="excluirMovimentacao('${mov.id}')">Excluir</button>
      </td>
    `;
    corpo.appendChild(linha);
  });
}

// ---------------------------------------------------------
// Excluir uma movimentação (o trigger do banco desfaz
// automaticamente o efeito dela no estoque)
// ---------------------------------------------------------
async function excluirMovimentacao(id) {
  const confirmado = confirm(
    "Excluir esta movimentação? O estoque do material será ajustado automaticamente (a quantidade voltará ao que era antes desse registro)."
  );
  if (!confirmado) return;

  const { error } = await sb.from("movimentacoes_estoque").delete().eq("id", id);

  if (error) {
    console.error(error);
    notificar("Erro ao excluir movimentação.", "erro");
    return;
  }

  notificar("Movimentação excluída e estoque ajustado.");
  carregarMateriais();
  carregarHistoricoMovimentacoes();
}
