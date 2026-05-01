// =========================================
//  BONK POLO LEAGUE — Sistema de Login
//  Armazena contas no Google Sheets (aba "Jogadores")
//  Uma conta por jogador — sem duplicatas
// =========================================

const SHEET_ID = "1gLTV_QFIUtdHQ98HCOF0ZwaJCOyJ3oXtI9KRLd2g8DM";
const API_BASE = `https://opensheet.elk.sh/${SHEET_ID}`;

// =========================================
//  ESTADO GLOBAL DE SESSÃO
// =========================================
let currentUser = null;

function salvarSessao(user) {
  currentUser = user;
  sessionStorage.setItem("bpl_user", JSON.stringify(user));
}

function carregarSessao() {
  try {
    const raw = sessionStorage.getItem("bpl_user");
    if (raw) currentUser = JSON.parse(raw);
  } catch (_) { currentUser = null; }
}

function sairSessao() {
  currentUser = null;
  sessionStorage.removeItem("bpl_user");
  atualizarNavPerfil();
  fecharPainelPerfil();
}

// =========================================
//  FETCH JOGADORES DA PLANILHA
// =========================================
async function fetchJogadores() {
  try {
    const res = await fetch(`${API_BASE}/${encodeURIComponent("Jogadores")}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn("Erro ao buscar jogadores:", e.message);
    return [];
  }
}

// =========================================
//  VERIFICAR SE NOME JÁ EXISTE
// =========================================
async function nomeJaExiste(nome) {
  const jogadores = await fetchJogadores();
  return jogadores.some(j => {
    const vals = Object.values(j);
    return (vals[0] || "").trim().toLowerCase() === nome.trim().toLowerCase();
  });
}

// =========================================
//  BUSCAR DADOS DO JOGADOR NA PLANILHA
// =========================================
async function buscarJogadorNaPlanilha(nome) {
  const jogadores = await fetchJogadores();
  return jogadores.find(j => {
    const vals = Object.values(j);
    return (vals[0] || "").trim().toLowerCase() === nome.trim().toLowerCase();
  });
}

// =========================================
//  BUSCAR ESTATÍSTICAS DO JOGADOR
//  (cruza com abas Gols, Assistencias, Defesas)
// =========================================
async function buscarEstatisticasJogador(nome) {
  const [gols, assists, defesas, ranking] = await Promise.all([
    fetchAba("Gols"),
    fetchAba("Assistencias"),
    fetchAba("Defesas"),
    fetchAba("Ranking"),
  ]);

  const normalizar = str => (str || "").trim().toLowerCase();
  const nomeBusca = normalizar(nome);

  const findVal = (arr) => {
    const entry = arr.find(l => normalizar(Object.values(l)[0]) === nomeBusca);
    return entry ? (parseInt(Object.values(entry)[1]) || 0) : 0;
  };

  // Buscar time e posição no ranking
  let time = "—";
  let posicao = "—";
  // Tenta achar o time nas abas Times
  const times = await fetchAba("Times");
  times.forEach(t => {
    const vals = Object.values(t);
    const listaJog = (vals[4] || "").split(",").map(j => j.trim().toLowerCase());
    if (listaJog.includes(nomeBusca)) time = vals[0] || "—";
  });

  // Buscar posição no ranking pelo time
  if (time !== "—") {
    const pos = ranking.findIndex(l =>
      (Object.values(l)[1] || "").trim().toLowerCase() === time.trim().toLowerCase()
    );
    if (pos !== -1) posicao = pos + 1;
  }

  return {
    gols:    findVal(gols),
    assists: findVal(assists),
    defesas: findVal(defesas),
    time,
    posicao,
  };
}

// Reutiliza o fetchAba do script principal se existir, senão declara local
async function fetchAba(aba) {
  try {
    const res = await fetch(`${API_BASE}/${encodeURIComponent(aba)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

// =========================================
//  MODAL DE LOGIN / CADASTRO
// =========================================
function criarModalLogin() {
  if (document.getElementById("loginModal")) return;

  const overlay = document.createElement("div");
  overlay.id = "loginModal";
  overlay.className = "login-modal-overlay";
  overlay.innerHTML = `
    <div class="login-modal-box" id="loginModalBox">
      <button class="login-modal-close" id="loginModalClose">✕</button>

      <!-- Tabs -->
      <div class="login-tabs">
        <button class="login-tab active" data-tab="entrar">Entrar</button>
        <button class="login-tab" data-tab="criar">Criar Conta</button>
      </div>

      <!-- ENTRAR -->
      <div class="login-pane" id="pane-entrar">
        <div class="login-icon">🏊</div>
        <h2 class="login-title">BEM-VINDO DE VOLTA</h2>
        <p class="login-sub">Acesse seu perfil de jogador</p>
        <div class="login-field">
          <label>Nome do Jogador</label>
          <input type="text" id="loginNome" placeholder="Seu nome exato na planilha" autocomplete="off">
        </div>
        <div class="login-field">
          <label>Senha</label>
          <input type="password" id="loginSenha" placeholder="••••••••">
        </div>
        <div class="login-error" id="loginErro"></div>
        <button class="login-btn" id="btnEntrar">ENTRAR</button>
      </div>

      <!-- CRIAR CONTA -->
      <div class="login-pane hidden" id="pane-criar">
        <div class="login-icon">⚡</div>
        <h2 class="login-title">CRIAR PERFIL</h2>
        <p class="login-sub">Uma conta por jogador — nome deve bater com a planilha</p>
        <div class="login-field">
          <label>Nome do Jogador</label>
          <input type="text" id="criarNome" placeholder="Nome exato como na planilha" autocomplete="off">
        </div>
        <div class="login-field">
          <label>Senha</label>
          <input type="password" id="criarSenha" placeholder="Mínimo 4 caracteres">
        </div>
        <div class="login-field">
          <label>Confirmar Senha</label>
          <input type="password" id="criarSenha2" placeholder="Repita a senha">
        </div>
        <div class="login-error" id="criarErro"></div>
        <div class="login-info" id="criarInfo"></div>
        <button class="login-btn" id="btnCriar">CRIAR CONTA</button>
        <p class="login-note">⚠️ Após criar, seus dados ficam salvos no Google Sheets da liga</p>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  injetarEstilosLogin();
  bindLoginModal();
}

function bindLoginModal() {
  // Fechar
  document.getElementById("loginModalClose").addEventListener("click", fecharLoginModal);
  document.getElementById("loginModal").addEventListener("click", e => {
    if (e.target.id === "loginModal") fecharLoginModal();
  });

  // Tabs
  document.querySelectorAll(".login-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".login-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      document.querySelectorAll(".login-pane").forEach(p => p.classList.add("hidden"));
      document.getElementById(`pane-${tab.dataset.tab}`).classList.remove("hidden");
      limparErros();
    });
  });

  // Enter nos inputs
  ["loginNome","loginSenha","criarNome","criarSenha","criarSenha2"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        const tab = document.querySelector(".login-tab.active")?.dataset.tab;
        if (tab === "entrar") document.getElementById("btnEntrar").click();
        else document.getElementById("btnCriar").click();
      }
    });
  });

  // Botão entrar
  document.getElementById("btnEntrar").addEventListener("click", handleEntrar);

  // Botão criar
  document.getElementById("btnCriar").addEventListener("click", handleCriar);
}

function limparErros() {
  ["loginErro","criarErro","criarInfo"].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = ""; el.classList.remove("visible"); }
  });
}

function mostrarErro(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.add("visible");
}

function mostrarInfo(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.style.color = "var(--win)";
  el.classList.add("visible");
}

function setBtnLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = loading ? "AGUARDE..." : (btnId === "btnEntrar" ? "ENTRAR" : "CRIAR CONTA");
}

// =========================================
//  HANDLER: ENTRAR
// =========================================
async function handleEntrar() {
  limparErros();
  const nome  = (document.getElementById("loginNome")?.value || "").trim();
  const senha = (document.getElementById("loginSenha")?.value || "").trim();

  if (!nome || !senha) {
    mostrarErro("loginErro", "Preencha nome e senha.");
    return;
  }

  setBtnLoading("btnEntrar", true);

  const jogadorRow = await buscarJogadorNaPlanilha(nome);
  if (!jogadorRow) {
    mostrarErro("loginErro", "Jogador não encontrado. Crie uma conta primeiro.");
    setBtnLoading("btnEntrar", false);
    return;
  }

  const vals = Object.values(jogadorRow);
  const senhaSalva = (vals[1] || "").trim();

  if (senhaSalva !== senha) {
    mostrarErro("loginErro", "Senha incorreta.");
    setBtnLoading("btnEntrar", false);
    return;
  }

  // Login OK
  const user = { nome: vals[0], email: vals[2] || "" };
  salvarSessao(user);
  fecharLoginModal();
  atualizarNavPerfil();
  abrirPainelPerfil();
  setBtnLoading("btnEntrar", false);
}

// =========================================
//  HANDLER: CRIAR CONTA
//  Usa Google Forms para gravar na planilha
// =========================================
async function handleCriar() {
  limparErros();
  const nome   = (document.getElementById("criarNome")?.value || "").trim();
  const senha  = (document.getElementById("criarSenha")?.value || "").trim();
  const senha2 = (document.getElementById("criarSenha2")?.value || "").trim();

  if (!nome) { mostrarErro("criarErro", "Informe seu nome de jogador."); return; }
  if (senha.length < 4) { mostrarErro("criarErro", "Senha mínima: 4 caracteres."); return; }
  if (senha !== senha2) { mostrarErro("criarErro", "As senhas não coincidem."); return; }

  setBtnLoading("btnCriar", true);
  mostrarInfo("criarInfo", "⏳ Verificando disponibilidade...");

  const jaExiste = await nomeJaExiste(nome);
  if (jaExiste) {
    mostrarErro("criarErro", "Este nome já possui uma conta. Faça login.");
    document.getElementById("criarInfo").textContent = "";
    setBtnLoading("btnCriar", false);
    return;
  }

  mostrarInfo("criarInfo", "✅ Nome disponível! Criando conta...");

  // Grava via Google Apps Script Web App
  // INSTRUÇÃO: Você precisa criar um Google Apps Script na sua planilha que aceite POST
  // e grave na aba "Jogadores". Veja o README abaixo.
  // Por padrão, usamos um endpoint público da Apps Script — substitua a URL abaixo:
  const GAS_URL = ""; // ← cole aqui a URL do seu Google Apps Script Web App

  if (!GAS_URL) {
    // Fallback: salva localmente e informa o admin
    const user = { nome, email: "" };
    salvarSessao(user);
    document.getElementById("criarInfo").textContent =
      "✅ Conta criada localmente! Peça ao admin para adicionar na planilha: " + nome + " | " + senha;
    document.getElementById("criarInfo").style.color = "var(--gold)";
    atualizarNavPerfil();
    setTimeout(() => { fecharLoginModal(); abrirPainelPerfil(); }, 2500);
    setBtnLoading("btnCriar", false);
    return;
  }

  try {
    await fetch(GAS_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, senha }),
    });

    const user = { nome, email: "" };
    salvarSessao(user);
    document.getElementById("criarInfo").textContent = "✅ Conta criada! Entrando...";
    atualizarNavPerfil();
    setTimeout(() => { fecharLoginModal(); abrirPainelPerfil(); }, 1500);
  } catch (e) {
    mostrarErro("criarErro", "Erro ao criar conta. Tente novamente.");
  }

  setBtnLoading("btnCriar", false);
}

// =========================================
//  PAINEL PERFIL DO JOGADOR
// =========================================
async function abrirPainelPerfil() {
  if (!currentUser) { abrirLoginModal(); return; }

  const painel = document.getElementById("painelPerfil") || criarPainelPerfil();
  painel.classList.add("open");
  document.body.style.overflow = "hidden";

  // Mostrar loading
  document.getElementById("perfilStats").innerHTML = `
    <div class="perfil-loading">
      <div class="perfil-spinner"></div>
      <span>Carregando estatísticas...</span>
    </div>`;

  const stats = await buscarEstatisticasJogador(currentUser.nome);
  renderPerfilStats(stats);
}

function fecharPainelPerfil() {
  const painel = document.getElementById("painelPerfil");
  if (painel) { painel.classList.remove("open"); document.body.style.overflow = ""; }
}

function criarPainelPerfil() {
  const overlay = document.createElement("div");
  overlay.id = "painelPerfil";
  overlay.className = "perfil-overlay";
  overlay.innerHTML = `
    <div class="perfil-panel">
      <div class="perfil-header">
        <div class="perfil-avatar" id="perfilAvatar"></div>
        <div class="perfil-header-info">
          <div class="perfil-nome" id="perfilNome"></div>
          <div class="perfil-time" id="perfilTime"></div>
        </div>
        <button class="perfil-close" id="perfilClose">✕</button>
      </div>

      <div id="perfilStats" class="perfil-stats-area"></div>

      <div class="perfil-actions">
        <button class="perfil-sair-btn" id="perfilSair">Sair da conta</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById("perfilClose").addEventListener("click", fecharPainelPerfil);
  overlay.addEventListener("click", e => { if (e.target === overlay) fecharPainelPerfil(); });
  document.getElementById("perfilSair").addEventListener("click", sairSessao);

  return overlay;
}

function renderPerfilStats(stats) {
  if (!currentUser) return;

  const avatar = document.getElementById("perfilAvatar");
  const nomeEl = document.getElementById("perfilNome");
  const timeEl = document.getElementById("perfilTime");

  const initials = currentUser.nome.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  const cor = typeof getTeamColor === "function" ? getTeamColor(stats.time) : "#00c2ff";

  avatar.textContent = initials;
  avatar.style.background = cor + "20";
  avatar.style.color = cor;
  avatar.style.borderColor = cor + "40";

  nomeEl.textContent = currentUser.nome.toUpperCase();
  timeEl.textContent = stats.time !== "—" ? `⚽ ${stats.time}` : "Sem time cadastrado";

  const posLabel = stats.posicao === "—" ? "—" : `#${stats.posicao}`;

  document.getElementById("perfilStats").innerHTML = `
    <div class="perfil-stats-grid">
      <div class="perfil-stat-card">
        <span class="psc-val" style="color:${cor}">${stats.gols}</span>
        <span class="psc-label">Gols</span>
      </div>
      <div class="perfil-stat-card">
        <span class="psc-val" style="color:#f472b6">${stats.assists}</span>
        <span class="psc-label">Assistências</span>
      </div>
      <div class="perfil-stat-card">
        <span class="psc-val" style="color:#34d399">${stats.defesas}</span>
        <span class="psc-label">Defesas</span>
      </div>
      <div class="perfil-stat-card psc-wide">
        <span class="psc-val" style="color:var(--gold)">${posLabel}</span>
        <span class="psc-label">Posição do time no ranking</span>
      </div>
    </div>

    <div class="perfil-tip">
      <span>📊</span>
      <span>Suas estatísticas são atualizadas pelo administrador da liga na planilha.</span>
    </div>
  `;
}

// =========================================
//  BOTÃO NA NAV
// =========================================
function injetarBotaoNav() {
  const navLinks = document.querySelector(".nav-links");
  if (!navLinks || document.getElementById("navBtnPerfil")) return;

  const li = document.createElement("li");
  li.innerHTML = `<button class="nav-btn-perfil" id="navBtnPerfil" onclick="currentUser ? abrirPainelPerfil() : abrirLoginModal()">
    <span id="navPerfilLabel">⚡ Login</span>
  </button>`;
  navLinks.appendChild(li);
}

function atualizarNavPerfil() {
  const label = document.getElementById("navPerfilLabel");
  if (!label) return;
  if (currentUser) {
    const initials = currentUser.nome.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
    label.innerHTML = `<span class="nav-avatar">${initials}</span> ${currentUser.nome.split(" ")[0]}`;
  } else {
    label.innerHTML = "⚡ Login";
  }
}

function abrirLoginModal() {
  criarModalLogin();
  document.getElementById("loginModal").classList.add("open");
  document.body.style.overflow = "hidden";
  setTimeout(() => document.getElementById("loginNome")?.focus(), 100);
}

function fecharLoginModal() {
  const el = document.getElementById("loginModal");
  if (el) { el.classList.remove("open"); document.body.style.overflow = ""; }
}

// =========================================
//  ESTILOS INJETADOS
// =========================================
function injetarEstilosLogin() {
  if (document.getElementById("loginStyles")) return;
  const style = document.createElement("style");
  style.id = "loginStyles";
  style.textContent = `
    /* ---- MODAL LOGIN ---- */
    .login-modal-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(6,13,23,0.92);
      backdrop-filter: blur(12px);
      z-index: 3000;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .login-modal-overlay.open { display: flex; }

    .login-modal-box {
      background: #0c1824;
      border: 1px solid #1e3a58;
      border-radius: 16px;
      padding: 36px 32px 28px;
      max-width: 420px;
      width: 100%;
      position: relative;
      animation: fadeUp 0.3s ease;
    }

    .login-modal-close {
      position: absolute;
      top: 14px;
      right: 16px;
      font-size: 18px;
      color: #3d5f78;
      cursor: pointer;
      background: none;
      border: none;
      transition: color 0.2s;
    }
    .login-modal-close:hover { color: #e8f4fd; }

    .login-tabs {
      display: flex;
      gap: 0;
      background: #060d17;
      border: 1px solid #1a3048;
      border-radius: 8px;
      padding: 3px;
      margin-bottom: 28px;
    }
    .login-tab {
      flex: 1;
      padding: 8px;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #3d5f78;
      background: none;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
      font-family: 'DM Sans', sans-serif;
    }
    .login-tab.active {
      background: #0f1c2a;
      color: #00c2ff;
      box-shadow: inset 0 0 0 1px #1e3a58;
    }

    .login-pane.hidden { display: none; }

    .login-icon {
      font-size: 36px;
      text-align: center;
      margin-bottom: 10px;
    }
    .login-title {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 28px;
      letter-spacing: 0.08em;
      text-align: center;
      color: #e8f4fd;
      margin-bottom: 4px;
    }
    .login-sub {
      font-size: 13px;
      color: #3d5f78;
      text-align: center;
      margin-bottom: 24px;
    }

    .login-field {
      margin-bottom: 14px;
    }
    .login-field label {
      display: block;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #7a9bb5;
      margin-bottom: 6px;
    }
    .login-field input {
      width: 100%;
      background: #060d17;
      border: 1px solid #1a3048;
      border-radius: 8px;
      padding: 11px 14px;
      font-size: 14px;
      color: #e8f4fd;
      font-family: 'DM Sans', sans-serif;
      transition: border-color 0.2s, box-shadow 0.2s;
      outline: none;
    }
    .login-field input:focus {
      border-color: #00c2ff60;
      box-shadow: 0 0 0 3px #00c2ff10;
    }
    .login-field input::placeholder { color: #2d4a5f; }

    .login-error {
      font-size: 13px;
      color: #ef4444;
      margin-bottom: 12px;
      min-height: 18px;
      display: none;
    }
    .login-error.visible { display: block; }

    .login-info {
      font-size: 12px;
      margin-bottom: 10px;
      min-height: 16px;
      display: none;
      color: #22c55e;
    }
    .login-info.visible { display: block; }

    .login-btn {
      width: 100%;
      padding: 13px;
      background: #00c2ff;
      color: #001520;
      font-weight: 800;
      font-size: 14px;
      letter-spacing: 0.1em;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      font-family: 'DM Sans', sans-serif;
      transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s;
      margin-bottom: 14px;
    }
    .login-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 20px #00c2ff35; }
    .login-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

    .login-note {
      font-size: 11px;
      color: #3d5f78;
      text-align: center;
      line-height: 1.6;
    }

    /* ---- NAV BOTÃO ---- */
    .nav-btn-perfil {
      font-size: 13px;
      font-weight: 600;
      color: #e8f4fd;
      background: #00c2ff18;
      border: 1px solid #00c2ff30;
      padding: 7px 14px;
      border-radius: 7px;
      margin-left: 8px;
      cursor: pointer;
      font-family: 'DM Sans', sans-serif;
      transition: background 0.2s, border-color 0.2s;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .nav-btn-perfil:hover { background: #00c2ff25; border-color: #00c2ff60; }

    .nav-avatar {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      background: #00c2ff30;
      color: #00c2ff;
      border-radius: 50%;
      font-size: 10px;
      font-weight: 800;
      font-family: 'Bebas Neue', sans-serif;
      letter-spacing: 0;
    }

    /* ---- PAINEL PERFIL ---- */
    .perfil-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(6,13,23,0.85);
      backdrop-filter: blur(10px);
      z-index: 2500;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .perfil-overlay.open { display: flex; }

    .perfil-panel {
      background: #0c1824;
      border: 1px solid #1e3a58;
      border-radius: 20px;
      width: 100%;
      max-width: 480px;
      overflow: hidden;
      animation: fadeUp 0.3s ease;
    }

    .perfil-header {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 24px 24px 20px;
      background: #0f1c2a;
      border-bottom: 1px solid #1a3048;
      position: relative;
    }

    .perfil-avatar {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      border: 2px solid transparent;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Bebas Neue', sans-serif;
      font-size: 26px;
      letter-spacing: 0.04em;
      flex-shrink: 0;
    }

    .perfil-nome {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 26px;
      letter-spacing: 0.06em;
      color: #e8f4fd;
      line-height: 1;
    }
    .perfil-time {
      font-size: 13px;
      color: #7a9bb5;
      margin-top: 4px;
    }

    .perfil-close {
      position: absolute;
      top: 16px;
      right: 16px;
      font-size: 18px;
      color: #3d5f78;
      cursor: pointer;
      background: none;
      border: none;
      transition: color 0.2s;
    }
    .perfil-close:hover { color: #e8f4fd; }

    .perfil-stats-area {
      padding: 24px;
    }

    .perfil-stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }

    .perfil-stat-card {
      background: #0f1c2a;
      border: 1px solid #1a3048;
      border-radius: 12px;
      padding: 16px 12px;
      text-align: center;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .perfil-stat-card.psc-wide {
      grid-column: 1 / -1;
      flex-direction: row;
      align-items: center;
      justify-content: center;
      gap: 14px;
    }

    .psc-val {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 36px;
      line-height: 1;
    }
    .psc-wide .psc-val { font-size: 32px; }
    .psc-label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #3d5f78;
    }

    .perfil-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 40px 0;
      color: #3d5f78;
      font-size: 13px;
    }
    .perfil-spinner {
      width: 28px;
      height: 28px;
      border: 2px solid #1a3048;
      border-top-color: #00c2ff;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .perfil-tip {
      display: flex;
      gap: 10px;
      font-size: 12px;
      color: #3d5f78;
      background: #0f1c2a;
      border: 1px solid #1a3048;
      border-radius: 8px;
      padding: 12px 14px;
      line-height: 1.5;
    }

    .perfil-actions {
      padding: 0 24px 24px;
    }
    .perfil-sair-btn {
      width: 100%;
      padding: 11px;
      background: none;
      border: 1px solid #1a3048;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      color: #ef4444;
      cursor: pointer;
      font-family: 'DM Sans', sans-serif;
      transition: background 0.2s, border-color 0.2s;
    }
    .perfil-sair-btn:hover { background: #ef444415; border-color: #ef444440; }

    /* Escape key */
    @media (max-width: 480px) {
      .login-modal-box { padding: 28px 20px 22px; }
      .perfil-stats-grid { grid-template-columns: 1fr 1fr; }
      .perfil-stat-card.psc-wide { grid-column: 1 / -1; }
    }
  `;
  document.head.appendChild(style);
}

// =========================================
//  README PARA O ADMIN
//  Como configurar o Google Apps Script
// =========================================
/*
  CONFIGURAÇÃO (admin da liga):

  1. Abra a planilha do Google Sheets
  2. Crie uma aba chamada "Jogadores" com as colunas:
     A: Nome | B: Senha | C: Email (opcional)

  3. Vá em Extensões > Apps Script e cole:

  ---
  function doPost(e) {
    const data = JSON.parse(e.postData.contents);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Jogadores");
    sheet.appendRow([data.nome, data.senha, data.email || ""]);
    return ContentService.createTextOutput(JSON.stringify({ok:true}))
      .setMimeType(ContentService.MimeType.JSON);
  }
  ---

  4. Clique em Implantar > Nova implantação
     - Tipo: App da Web
     - Executar como: Eu
     - Quem tem acesso: Qualquer pessoa
  5. Copie a URL gerada e cole em GAS_URL neste arquivo.
*/

// =========================================
//  INICIALIZAÇÃO
// =========================================
// =========================================
//  INICIALIZAÇÃO
// =========================================
carregarSessao();
injetarBotaoNav();
atualizarNavPerfil();

document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    fecharLoginModal();
    fecharPainelPerfil();
  }
});
