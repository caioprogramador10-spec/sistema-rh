# Sistema RH — Estoque + Exames Periódicos

Sistema simples em HTML, CSS, JavaScript puro e Supabase, com duas abas:

- **Estoque**: cadastro de materiais, entrada/saída, baixa automática quando o
  funcionário recebe um material, e alerta de estoque mínimo.
- **Funcionários & Exames**: cadastro de funcionários e controle do Exame
  Periódico, com alerta visual quando faltarem 5 dias ou menos para o prazo
  (e destaque diferente para exames já atrasados).

## Estrutura de arquivos

```
sistema-rh/
├── index.html              → estrutura da página (as duas abas)
├── css/
│   └── style.css           → toda a estilização
├── js/
│   ├── config.js            → aqui você cola a URL e a chave do Supabase
│   ├── supabaseClient.js    → cria a conexão com o Supabase
│   ├── app.js                → navegação entre abas e funções compartilhadas
│   ├── estoque.js            → toda a lógica da aba de estoque
│   └── funcionarios.js       → toda a lógica da aba de funcionários/exames
└── sql/
    └── schema.sql           → script para criar as tabelas no Supabase
```

## Passo a passo para configurar o Supabase

### 1. Criar a conta e o projeto
1. Acesse **https://supabase.com** e crie uma conta gratuita (dá para entrar
   com GitHub, Google ou e-mail).
2. Clique em **New Project**.
3. Escolha um nome (ex: `sistema-rh`), crie uma senha para o banco de dados
   (guarde essa senha, mas ela não será usada nos arquivos do sistema) e
   escolha a região mais próxima (ex: South America - São Paulo).
4. Clique em **Create new project** e aguarde 1-2 minutos até o projeto
   ficar pronto.

### 2. Criar as tabelas
1. No menu lateral do seu projeto, clique em **SQL Editor**.
2. Clique em **New query**.
3. Abra o arquivo `sql/schema.sql` (que está nesta pasta), copie **todo** o
   conteúdo e cole no editor.
4. Clique em **Run** (ou pressione Ctrl+Enter). Isso vai criar as 4 tabelas
   (`materiais`, `funcionarios`, `movimentacoes_estoque`,
   `exames_periodicos`) e a regra que atualiza o estoque automaticamente.

### 3. Pegar a URL e a chave do projeto
1. No menu lateral, clique no ícone de engrenagem **Project Settings**.
2. Clique em **API Keys**.
3. Copie o valor de **Project URL**.
4. Copie a chave **pública**:
   - Se aparecer a aba de chaves novas, copie a **Publishable key**
     (começa com `sb_publishable_...`).
   - Se o projeto ainda usa o sistema antigo, vá na aba **Legacy API
     Keys** e copie a **anon public**.
   - ⚠️ **Nunca** copie a "Secret key" (`sb_secret_...`) nem a
     `service_role` para este sistema — essas são de uso exclusivo de
     servidor, e o Supabase bloqueia (erro 401) quando são usadas
     direto no navegador.

### 4. Preencher o arquivo de configuração
Abra o arquivo `js/config.js` e substitua:

```js
const SUPABASE_URL = "COLE_AQUI_A_URL_DO_SEU_PROJETO";
const SUPABASE_KEY = "COLE_AQUI_A_CHAVE_ANON_PUBLIC";
```

pelos valores que você copiou no passo anterior.

### 5. Abrir o sistema
Basta abrir o arquivo `index.html` duas vezes clicando nele — ele funciona
direto no navegador, não precisa instalar nada. Se quiser publicar para o
RH acessar de qualquer computador, você pode subir esses arquivos em
qualquer serviço de hospedagem de site simples (ex: Netlify, Vercel, ou até
uma pasta compartilhada na rede da empresa).

## Como o alerta de 5 dias funciona

Na tela de **Exames**, cada exame cadastrado mostra quantos dias faltam até
`data_proximo_exame`. As regras de destaque (definidas em `js/funcionarios.js`,
constante `DIAS_ALERTA_EXAME`) são:

- **Faltam mais de 5 dias** → linha normal.
- **Faltam 5 dias ou menos** → linha destacada em amarelo/laranja.
- **Prazo já passou** → linha destacada em vermelho, marcada como "Atrasado".
- **Marcado como realizado** → linha esmaecida, some do foco de atenção.

Se um dia vocês quiserem alerta por **e-mail** também (além do visual), dá
para evoluir isso depois usando o Supabase Edge Functions + um serviço de
e-mail — é só pedir que eu te ajudo a montar.

## Solução de problemas comuns

**Acabei de receber os campos de sexo/idade/dependentes ou a aba
"Avaliações" — preciso fazer alguma coisa?**
Sim: volte no **SQL Editor** do Supabase e rode o `sql/schema.sql` inteiro
de novo. É seguro, não apaga nada que você já tinha cadastrado.

**Já tenho o sistema rodando e agora tem botão de editar/excluir — preciso
fazer alguma coisa?**
Sim: volte no **SQL Editor** do Supabase e rode o `sql/schema.sql` inteiro
de novo. Ele adiciona um novo gatilho (trigger) que faz o estoque voltar
ao normal automaticamente quando você exclui uma movimentação. É seguro
rodar de novo, não apaga nenhum dado que você já tem.

**Erro no console: "Failed to load resource... status of 401"**
Quase sempre é a chave errada em `js/config.js`. Confira:
- Você copiou a **Publishable key** (`sb_publishable_...`) ou a
  **anon public** (sistema antigo) — e não a Secret key/service_role?
- A `SUPABASE_URL` está exatamente igual à do painel, sem espaço, sem
  aspas sobrando, terminando em `.supabase.co` (sem barra `/` no final)?
- Depois de editar `js/config.js`, salvou o arquivo e recarregou a
  página no navegador?

**Erro no console: "permission denied for table..." (403)**
Isso significa que a tabela existe, mas não está liberada para a API.
Volte no SQL Editor do Supabase e rode este trecho (já incluído no
final do `sql/schema.sql`):
```sql
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on materiais, funcionarios,
  movimentacoes_estoque, exames_periodicos to anon, authenticated;
```
Isso costuma ser necessário em projetos criados mais recentemente, que
não expõem tabelas à API automaticamente por padrão.

## Observação sobre segurança

O sistema agora tem uma **tela de senha** na entrada (arquivo `js/acesso.js`),
configurada em `js/config.js` na variável `ACESSO_SENHA`. Troque essa senha
antes de divulgar o link pro RH.

Importante: essa é uma proteção **simples**, não é uma segurança de verdade
— como o código roda todo no navegador, qualquer pessoa com conhecimento
técnico consegue ver a senha inspecionando o código da página. Ela serve
pra evitar que o link vaze/seja aberto por engano ou curiosidade, não pra
proteger contra alguém realmente querendo entrar sem permissão.

Se um dia precisar de segurança de verdade (login individual por usuário,
por exemplo), dá pra evoluir para autenticação real do Supabase — é só
pedir que eu te ajudo a montar.
