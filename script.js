let matches = [];

function parseHTMLAndExtractMatches(htmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, "text/html");
  const matchRows = Array.from(doc.querySelectorAll(".rcnt"));

  return matchRows.map((row, idx) => {
    // Date
    let dateElem = row.querySelector(".date_bah");
    let date = dateElem ? dateElem.textContent.trim().split(" ")[0] : "";

    // Teams
    let home = row.querySelector(".homeTeam span") ? row.querySelector(".homeTeam span").textContent.trim() : "";
    let away = row.querySelector(".awayTeam span") ? row.querySelector(".awayTeam span").textContent.trim() : "";
    let teams = home && away ? `${home} vs ${away}` : "";

    // Probabilities
    let probSpans = row.querySelectorAll(".fprc.bsk > span");
    let prob1 = probSpans[0] ? parseInt(probSpans[0].textContent, 10) : 0;
    let prob2 = probSpans[1] ? parseInt(probSpans[1].textContent, 10) : 0;
    let probDiff = prob1 - prob2;

    // --- Robust Pred and Team Value Extraction ---
    let pred = "";
    let teamValue1 = null, teamValue2 = null;
    let predCell = row.querySelector(".predict, .predict_y, .predict_no");
    if (predCell) {
      // Get all numbers (including nested) in the order they appear in the cell
      let numbers = [];
      // Walk all text nodes inside predCell and collect numbers in order
      let walker = document.createTreeWalker(predCell, NodeFilter.SHOW_TEXT, null, false);
      let node;
      while (node = walker.nextNode()) {
        let found = (node.textContent || '').match(/\d+/g);
        if (found) {
          numbers = numbers.concat(found.map(Number));
        }
      }
      if (numbers.length >= 3) {
        pred = numbers[0];
        teamValue1 = numbers[1];
        teamValue2 = numbers[2];
      }
    }
    let valueDiff = (teamValue1 !== null && teamValue2 !== null) ? (teamValue1 - teamValue2) : "";

    // Odds (coeff)
    let odds = "";
    let haodd = row.querySelector('.haodd');
    if (haodd) {
      let oddsSpans = haodd.querySelectorAll("span");
      let visibleOdds = Array.from(oddsSpans).map(s => s.textContent.trim()).filter(s => s && s !== '-');
      odds = visibleOdds.join(" / ");
    }
    if (!odds) odds = "N/A";

    // Score
    let scoreElem = row.querySelector(".lscr_td .fj_column");
    let score = "";
    if (scoreElem) {
      let scoreSpans = scoreElem.querySelectorAll("span");
      if (scoreSpans.length >= 2) {
        score = `${scoreSpans[0].textContent.replace(/[^\d]/g, "")}-${scoreSpans[1].textContent.replace(/[^\d]/g, "")}`;
      }
    }

    return {
      id: `${date}_${teams}_${idx}_${Math.random()}`,
      date,
      teams,
      pred,
      probDiff,
      valueDiff,
      odds,
      score
    };
  });
}

function renderMatches(filteredMatches) {
  const tbody = document.querySelector("#matchesTable tbody");
  tbody.innerHTML = "";
  filteredMatches.forEach((match, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${match.date}</td>
      <td>${match.teams}</td>
      <td>${match.pred !== undefined ? match.pred : ""}</td>
      <td>${match.probDiff !== undefined ? match.probDiff : ""}</td>
      <td>${match.valueDiff !== undefined ? match.valueDiff : ""}</td>
      <td>${match.odds !== undefined ? match.odds : ""}</td>
      <td>${match.score !== undefined ? match.score : ""}</td>
      <td><button class="delete-btn" data-id="${match.id}">Delete</button></td>
    `;
    tbody.appendChild(tr);
  });
  Array.from(document.querySelectorAll(".delete-btn")).forEach(btn => {
    btn.addEventListener("click", function() {
      const id = btn.getAttribute("data-id");
      matches = matches.filter(m => m.id !== id);
      renderMatches(matches);
    });
  });
}

function applyFilter() {
  const teamVal = document.getElementById("teamFilter").value.trim().toLowerCase();
  const probDiffVal = parseInt(document.getElementById("probDiffFilter").value, 10);
  const valDiffVal = parseInt(document.getElementById("valDiffFilter").value, 10);

  let filtered = matches;
  if (teamVal) {
    filtered = filtered.filter(m =>
      m.teams.toLowerCase().includes(teamVal)
    );
  }
  if (!isNaN(probDiffVal)) {
    filtered = filtered.filter(m =>
      Math.abs(m.probDiff) >= probDiffVal
    );
  }
  if (!isNaN(valDiffVal)) {
    filtered = filtered.filter(m =>
      Math.abs(m.valueDiff) >= valDiffVal
    );
  }
  renderMatches(filtered);
}

function clearFilter() {
  document.getElementById("teamFilter").value = "";
  document.getElementById("probDiffFilter").value = "";
  document.getElementById("valDiffFilter").value = "";
  renderMatches(matches);
}

document.getElementById("applyFilter").addEventListener("click", applyFilter);
document.getElementById("clearFilter").addEventListener("click", clearFilter);

document.getElementById("fileInput").addEventListener("change", function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    const htmlText = evt.target.result;
    matches = parseHTMLAndExtractMatches(htmlText).filter(m => m.teams && m.date);
    document.getElementById("filters").style.display = "";
    document.getElementById("matchesTable").style.display = "";
    renderMatches(matches);
  };
  reader.readAsText(file);
});