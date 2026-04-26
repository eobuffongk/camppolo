const sheetID = "1gLTV_QFIUtdHQ98HCOF0ZwaJCOyJ3oXtI9KRLd2g8DM";

async function carregarTabela(aba, tabelaID) {
  const url = `https://opensheet.elk.sh/${sheetID}/${aba}`;
  const res = await fetch(url);
  const data = await res.json();

  const tbody = document.querySelector(`#${tabelaID} tbody`);
  tbody.innerHTML = "";

  data.forEach(linha => {
    let tr = "<tr>";
    Object.values(linha).forEach(valor => {
      tr += `<td>${valor}</td>`;
    });
    tr += "</tr>";
    tbody.innerHTML += tr;
  });
}

// carregar tudo
carregarTabela("Ranking", "ranking");
carregarTabela("Gols", "gols");
carregarTabela("Assistencias", "assistencias");
carregarTabela("Defesas", "defesas");