// =========================================
//  BONK POLO LEAGUE — Script Principal
//  Integração: Google Sheets via opensheet
// =========================================

const SHEET_ID = "1gLTV_QFIUtdHQ98HCOF0ZwaJCOyJ3oXtI9KRLd2g8DM";
const API = `https://opensheet.elk.sh/${SHEET_ID}`;

// Cores para os times (cycling)
const TEAM_COLORS = [
  "#00c2ff", "#818cf8", "#34d399", "#f59e0b",
  "#f472b6", "#a78bfa", "#38bdf8", "#fb923c",
  "#4ade80", "#c084fc"
];
const teamColorMap = {};

function getTeamColor(name) {
  if (!name) return TEAM_COLORS[0];
  if (!teamColorMap[name]) {
    const keys = Object.keys(teamColorMap).length;
    teamColorMap[name] = TEAM_COLORS[keys % TEAM_COLORS.length];
  }
  return teamColorMap[name];
}

function getInitials(name) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

// =========================================
//  FETCH HELPER
// =========================================
async function fetchAba(aba) {
  try {
    const res = await fetch(`${API}/${encodeURIComponent(aba)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn(`Aba "${aba}" não encontrada ou erro:`, e.message);
    return [];
  }
}

// =========================================
//  NAVBAR
// =========================================
const navbar = document.getElementById("navbar");
const navToggle = document.getElementById("navToggle");
const mobileMenu = document.getElementById("mobileMenu");

window.addEventListener("scroll", () => {
  navbar.classList.toggle("scrolled", window.scrollY > 40);
});

navToggle.addEventListener("click", () => {
  mobileMenu.classList.toggle("open");
});

document.querySelectorAll(".mob-link").forEach(link => {
  link.addEventListener("click", () => mobileMenu.classList.remove("open"));
});

// Highlight nav link ativo
const sections = document.querySelectorAll("section[id], .hero[id]");
const navLinks = document.querySelectorAll(".nav-link");
window.addEventListener("scroll", () => {
  let current = "";
  sections.forEach(sec => {
    if (window.scrollY >= sec.offsetTop - 120) current = sec.id;
  });
  navLinks.forEach(link => {
    link.classList.toggle("active", link.getAttribute("href") === `#${current}`);
  });
}, { passive: true });

// =========================================
//  MODAL
// =========================================
const modalOverlay = document.getElementById("modalOverlay");
const modalClose = document.getElementById("modalClose");
const modalContent = document.getElementById("modalContent");

function openModal(html) {
  modalContent.innerHTML = html;
  modalOverlay.classList.add("open");
  document.body.style.overflow = "hidden";
}
function closeModal() {
  modalOverlay.classList.remove("open");
  document.body.style.overflow = "";
}
modalClose.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", e => {
  if (e.target === modalOverlay) closeModal();
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape") closeModal();
});

// =========================================
//  RANKING
// =========================================
async function carregarRanking() {
  const data = await fetchAba("Ranking");
  const loading = document.getElementById("rankingLoading");
  const tabela = document.getElementById("tabelaRanking");
  const tbody = tabela.querySelector("tbody");

  loading.style.display = "none";
  tabela.style.display = "table";

  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:40px;color:var(--text3)">Nenhum dado encontrado</td></tr>`;
    return;
  }

  tbody.innerHTML = "";
  data.forEach((linha, i) => {
    const vals = Object.values(linha);
    const pos = vals[0] || (i + 1);
    const time = vals[1] || "—";
    const cor = getTeamColor(time);
    const posClass = i === 0 ? "pos-1" : i === 1 ? "pos-2" : i === 2 ? "pos-3" : "";

    // Colunas dinâmicas: tenta pegar J V E D GP GC SG Pts Forma
    // Adapta ao que existir na planilha
    const J   = vals[2] || "—";
    const V   = vals[3] || "—";
    const E   = vals[4] || "—";
    const D   = vals[5] || "—";
    const GP  = vals[6] || "—";
    const GC  = vals[7] || "—";
    const SG  = vals[8] || "—";
    const Pts = vals[9] !== undefined ? vals[9] : (vals[vals.length - 1] || "—");
    const Forma = vals[10] || "";

    let formaBadges = "";
    if (Forma) {
      Forma.split("").forEach(c => {
        const cls = c === "V" ? "V" : c === "D" ? "D" : "E";
        formaBadges += `<span class="form-badge ${cls}">${c}</span>`;
      });
    }

    tbody.innerHTML += `
      <tr class="${posClass}">
        <td class="col-pos">${pos}</td>
        <td class="col-team">
          <div class="team-name">
            <span class="team-dot-rank" style="background:${cor}"></span>
            ${time}
          </div>
        </td>
        <td>${J}</td>
        <td>${V}</td>
        <td>${E}</td>
        <td>${D}</td>
        <td>${GP}</td>
        <td>${GC}</td>
        <td>${SG}</td>
        <td class="col-pts">${Pts}</td>
        <td class="col-form"><div class="form-badges">${formaBadges || "—"}</div></td>
      </tr>`;
  });

  // Atualizar hero stat
  const el = document.querySelector("#statTimes .hstat-num");
  if (el) el.textContent = data.length;
}

// =========================================
//  PARTIDAS (RECENTES + PRÓXIMAS)
// =========================================
async function carregarPartidas() {
  const [recentes, proximas] = await Promise.all([
    fetchAba("Partidas"),
    fetchAba("Proximas")
  ]);

  renderPartidas(recentes, "partidasRecentes", false);
  renderPartidas(proximas, "partidasProximas", true);

  // Contagem de partidas
  const el = document.querySelector("#statPartidas .hstat-num");
  if (el) el.textContent = recentes.length || "—";
}

function renderPartidas(data, containerId, proximas) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  if (!data.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📅</div>
        <span>${proximas ? "Nenhuma partida agendada" : "Nenhuma partida registrada"}</span>
        <small>Adicione dados na aba "${proximas ? "Proximas" : "Partidas"}" da planilha</small>
      </div>`;
    return;
  }

  data.forEach(linha => {
    const vals = Object.values(linha);
    const data_jogo = vals[0] || "";
    const timeA = vals[1] || "?";
    const golsA = vals[2] !== undefined ? vals[2] : "";
    const golsB = vals[3] !== undefined ? vals[3] : "";
    const timeB = vals[4] || "?";
    const status = vals[5] || (proximas ? "Próxima" : "Encerrado");

    const statusClass = proximas ? "prox"
      : status.toLowerCase().includes("w.o") ? "wip"
      : "enc";

    const placar = proximas
      ? `<span class="pt-vs">vs</span>`
      : `<span class="pt-placar">${golsA} — ${golsB}</span>`;

    container.innerHTML += `
      <div class="partida-card">
        <div class="partida-meta">
          <span class="partida-status ${statusClass}">${status}</span>
          <span class="partida-data">${data_jogo}</span>
        </div>
        <div class="partida-teams">
          <span class="pt-team">${timeA}</span>
          ${placar}
          <span class="pt-team right">${timeB}</span>
        </div>
      </div>`;
  });
}

// Tabs partidas
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    document.getElementById("partidasRecentes").style.display = tab === "recentes" ? "grid" : "none";
    document.getElementById("partidasProximas").style.display = tab === "proximas" ? "grid" : "none";
  });
});

// =========================================
//  TIMES
// =========================================
async function carregarTimes() {
  const data = await fetchAba("Times");
  const grid = document.getElementById("timesGrid");
  grid.innerHTML = "";

  if (!data.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🏊</div>
        <span>Nenhum time cadastrado</span>
        <small>Adicione dados na aba "Times" da planilha</small>
      </div>`;
    return;
  }

  // Armazenar dados para modal
  const timesData = {};

  data.forEach(linha => {
    const vals = Object.values(linha);
    const nome = vals[0] || "Time";
    const jogadores = vals[1] || "—";
    const vitorias = vals[2] || "0";
    const gols = vals[3] || "0";
    const cor = getTeamColor(nome);
    timesData[nome] = { nome, jogadores, vitorias, gols, cor, raw: vals };

    const card = document.createElement("div");
    card.className = "time-card";
    card.style.setProperty("--team-color", cor);
    card.innerHTML = `
      <div style="position:absolute;top:0;left:0;right:0;height:3px;background:${cor}"></div>
      <div class="time-icon" style="background:${cor}20;color:${cor}">${getInitials(nome)}</div>
      <div class="time-name">${nome}</div>
      <div class="time-jogadores">${jogadores} jogadores</div>
      <div class="time-stats-mini">
        <div class="tsm-item">
          <span class="tsm-val">${vitorias}</span>
          <span class="tsm-label">VITÓRIAS</span>
        </div>
        <div class="tsm-item">
          <span class="tsm-val">${gols}</span>
          <span class="tsm-label">GOLS</span>
        </div>
      </div>
      <div class="time-ver">Ver detalhes →</div>`;

    card.addEventListener("click", () => abrirModalTime(timesData[nome]));
    grid.appendChild(card);
  });
}

function abrirModalTime(time) {
  const cor = time.cor;
  const vals = time.raw;
  // A partir do índice 4, pode ter lista de jogadores separados por vírgula
  const listaJogadores = (vals[4] || "").split(",").map(j => j.trim()).filter(Boolean);

  const jogadoresHTML = listaJogadores.length
    ? listaJogadores.map(j => `
        <div class="modal-player-row">
          <span class="modal-player-name">${j}</span>
          <span class="modal-player-role">Jogador</span>
        </div>`).join("")
    : `<div style="color:var(--text3);font-size:13px;padding:12px 0">Nenhum jogador listado — adicione na coluna E da aba Times</div>`;

  openModal(`
    <div class="modal-team-header">
      <div class="modal-team-icon" style="background:${cor}20;color:${cor}">${getInitials(time.nome)}</div>
      <div>
        <div class="modal-team-name">${time.nome}</div>
        <div class="modal-team-info">${time.jogadores} jogadores</div>
      </div>
    </div>
    <div class="modal-stats-row">
      <div class="modal-stat">
        <div class="modal-stat-val">${time.vitorias}</div>
        <div class="modal-stat-label">Vitórias</div>
      </div>
      <div class="modal-stat">
        <div class="modal-stat-val">${time.gols}</div>
        <div class="modal-stat-label">Gols</div>
      </div>
      <div class="modal-stat">
        <div class="modal-stat-val">${time.jogadores}</div>
        <div class="modal-stat-label">Jogadores</div>
      </div>
    </div>
    <div class="modal-section-title">Elenco</div>
    ${jogadoresHTML}
  `);
}

// =========================================
//  ESTATÍSTICAS
// =========================================
async function carregarStats() {
  const [gols, assist, defesas] = await Promise.all([
    fetchAba("Gols"),
    fetchAba("Assistencias"),
    fetchAba("Defesas")
  ]);

  renderStatList(gols, "golsList", "golsLoading");
  renderStatList(assist, "assistList", "assistLoading");
  renderStatList(defesas, "defesasList", "defesasLoading");

  // Hero stat gols
  const elGols = document.querySelector("#statGols .hstat-num");
  if (elGols && gols.length) {
    const total = gols.reduce((acc, l) => acc + (parseInt(Object.values(l)[1]) || 0), 0);
    elGols.textContent = total || "—";
  }

  // Hero stat jogadores
  const elJog = document.querySelector("#statJogadores .hstat-num");
  if (elJog && gols.length) elJog.textContent = gols.length;
}

function renderStatList(data, listId, loadingId) {
  const loading = document.getElementById(loadingId);
  const list = document.getElementById(listId);
  if (loading) loading.style.display = "none";

  if (!data.length) {
    list.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text3);font-size:13px">Nenhum dado encontrado</div>`;
    return;
  }

  const maxVal = Math.max(...data.map(l => parseInt(Object.values(l)[1]) || 0));

  data.slice(0, 10).forEach((linha, i) => {
    const vals = Object.values(linha);
    const jogador = vals[0] || "—";
    const valor = parseInt(vals[1]) || 0;
    const pct = maxVal > 0 ? (valor / maxVal * 100) : 0;

    list.innerHTML += `
      <div class="stat-row">
        <span class="stat-pos">${i + 1}</span>
        <span class="stat-player">${jogador}</span>
        <div class="stat-bar-wrap"><div class="stat-bar" style="width:${pct}%"></div></div>
        <span class="stat-val">${valor}</span>
      </div>`;
  });
}

// =========================================
//  TEMPORADAS ANTERIORES
// =========================================
async function carregarTemporadas() {
  const data = await fetchAba("Temporadas");
  const grid = document.getElementById("temporadasGrid");
  grid.innerHTML = "";

  if (!data.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🏆</div>
        <span>Nenhuma temporada anterior registrada</span>
        <small>Adicione dados na aba "Temporadas" da planilha</small>
      </div>`;
    return;
  }

  data.forEach(linha => {
    const vals = Object.values(linha);
    const temporada  = vals[0] || "—";
    const campeao    = vals[1] || "—";
    const artilheiro = vals[2] || "—";
    const partidas   = vals[3] || "—";
    const gols       = vals[4] || "—";
    const cor        = getTeamColor(campeao);

    grid.innerHTML += `
      <div class="temporada-card">
        <div class="temp-season">TEMPORADA ${temporada}</div>
        <div class="temp-campeao" style="color:${cor}">🏆 ${campeao}</div>
        <div class="temp-artilheiro">Artilheiro: ${artilheiro}</div>
        <div class="temp-stats">
          <div class="temp-stat">
            <span class="ts-val">${partidas}</span>
            <span class="ts-label">Partidas</span>
          </div>
          <div class="temp-stat">
            <span class="ts-val">${gols}</span>
            <span class="ts-label">Gols</span>
          </div>
        </div>
      </div>`;
  });
}

// =========================================
//  INICIALIZAR TUDO
// =========================================
async function init() {
  await Promise.all([
    carregarRanking(),
    carregarPartidas(),
    carregarTimes(),
    carregarStats(),
    carregarTemporadas()
  ]);
}

document.addEventListener("DOMContentLoaded", init);