// app.js - Improved odds extraction, correct bet type, PDF with QR code and table formatting

// Helper: Parse uploaded HTML file, return DOM Document
function parseHTMLFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = evt => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(evt.target.result, "text/html");
      resolve(doc);
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

// Improved odds logic: pick odds matching "pred"/"1X2" column per sport
function extractMatches(doc, sport) {
  let matches = [];
  let rows = doc.querySelectorAll('.rcnt');
  rows.forEach(row => {
    try {
      let team1 = row.querySelector('.homeTeam')?.innerText || '';
      let team2 = row.querySelector('.awayTeam')?.innerText || '';
      let time = row.querySelector('.date_bah')?.innerText || '';
      let league = row.querySelector('.shortTag')?.innerText || '';
      // Probabilities (for football/tennis/volleyball: 1 and 2)
      let probSpans = row.querySelectorAll('.fprc span, .fprc.bsk span');
      let prob1 = Number(probSpans[0]?.innerText || 0);
      let prob2 = Number(probSpans[1]?.innerText || 0);
      let diff = Math.abs(prob1 - prob2);

      // Extract bet type from pred
      let betType = row.querySelector('.predict span, .predict_y span, .predict_no span')?.innerText.trim() || '';
      // Date
      let date = time.split(' ')[0] || (new Date()).toLocaleDateString();

      // Improved odds extraction
      let oddsSpans = row.querySelectorAll('.haodd span');
      let odds = "";
      let oddsIndex = 0;

      // Logic for index based on sport and betType
      if (sport === 'tennis') {
        // "1" or "2" (Player 1 or Player 2)
        oddsIndex = (betType === "2") ? 1 : 0;
      } else if (sport === 'football' || sport === 'volleyball') {
        // "1" = home, "X" = draw, "2" = away
        if (betType === "2") oddsIndex = 2;
        else if (betType.toUpperCase() === "X") oddsIndex = 1;
        else oddsIndex = 0;
      }
      // Defensive: only pick if odds exists and is not "-"
      if (oddsSpans[oddsIndex]) {
        let val = oddsSpans[oddsIndex].innerText.trim();
        if (val && val !== "-" && !isNaN(parseFloat(val))) odds = parseFloat(val);
        else odds = ""; // leave blank if not a valid value
      }

      matches.push({
        team1, team2, time, league, prob1, prob2, diff, betType, date, odds
      });
    } catch (e) {}
  });
  // Filter and return best 10
  return matches.filter(m => m.diff >= 35).slice(0, 10);
}

// Render a table for matches per sport
function renderTable(matches, sport) {
  let table = document.createElement('table');
  table.className = 'sport-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th colspan="12">${sport.toUpperCase()} - Top ${matches.length} Matches</th>
      </tr>
      <tr>
        <th>Home Team</th>
        <th>Away Team</th>
        <th>Time</th>
        <th>League</th>
        <th>Date</th>
        <th>1X2</th>
        <th>Score 1</th>
        <th>Score 2</th>
        <th>Diff</th>
        <th>Odds</th>
        <th>Delete</th>
      </tr>
    </thead>
    <tbody>
      ${matches.map((m, i) => `
        <tr>
          <td>${m.team1}</td>
          <td>${m.team2}</td>
          <td>${m.time}</td>
          <td>${m.league}</td>
          <td>${m.date}</td>
          <td>${m.betType}</td>
          <td>${m.prob1}</td>
          <td>${m.prob2}</td>
          <td>${m.diff}</td>
          <td class="odds-cell">${m.odds}</td>
          <td><button class="delete-btn" data-index="${i}" data-sport="${sport}">Delete</button></td>
        </tr>
      `).join('')}
    </tbody>
  `;
  return table;
}

let allMatches = { football: [], tennis: [], volleyball: [] };

document.getElementById('processBtn').onclick = async () => {
  const footballFile = document.getElementById('footballFile').files[0];
  const tennisFile = document.getElementById('tennisFile').files[0];
  const volleyballFile = document.getElementById('volleyballFile').files[0];

  if (!footballFile && !tennisFile && !volleyballFile) return alert('Upload at least one file');

  document.getElementById('exportPdfBtn').style.display = "none";
  document.getElementById('tablesContainer').innerHTML = "";

  if (footballFile) {
    const doc = await parseHTMLFile(footballFile);
    allMatches.football = extractMatches(doc, 'football');
    document.getElementById('tablesContainer').appendChild(renderTable(allMatches.football, 'football'));
  }
  if (tennisFile) {
    const doc = await parseHTMLFile(tennisFile);
    allMatches.tennis = extractMatches(doc, 'tennis');
    document.getElementById('tablesContainer').appendChild(renderTable(allMatches.tennis, 'tennis'));
  }
  if (volleyballFile) {
    const doc = await parseHTMLFile(volleyballFile);
    allMatches.volleyball = extractMatches(doc, 'volleyball');
    document.getElementById('tablesContainer').appendChild(renderTable(allMatches.volleyball, 'volleyball'));
  }
  document.getElementById('exportPdfBtn').style.display = "inline";
};

// Row delete
document.getElementById('tablesContainer').addEventListener('click', (e) => {
  if (e.target.classList.contains('delete-btn')) {
    let sport = e.target.dataset.sport;
    let idx = Number(e.target.dataset.index);
    allMatches[sport].splice(idx, 1);
    document.getElementById('tablesContainer').innerHTML = '';
    for (let sp of ['football', 'tennis', 'volleyball']) {
      if (allMatches[sp].length)
        document.getElementById('tablesContainer').appendChild(renderTable(allMatches[sp], sp));
    }
  }
});

// PDF Export with QR code and tables
document.getElementById('exportPdfBtn').onclick = async () => {
  const { jsPDF } = window.jspdf;
  let doc = new jsPDF('p', 'pt', 'a4');
  let now = new Date();

  // Generate QR code (using qrious)
  let qr = new QRious({ value: "https://github.com/peterRxt/Project-1", size: 100 });
  let qrImg = qr.toDataURL();
  doc.addImage(qrImg, 'PNG', 40, 20, 80, 80);

  let y = 120;

  for (let sport of ['football', 'tennis', 'volleyball']) {
    let matches = allMatches[sport];
    if (!matches.length) continue;

    doc.setFontSize(14);
    doc.text(`${sport.toUpperCase()} - Top ${matches.length} Matches`, 140, y);

    // Table data
    let tableBody = matches.map(m => [
      m.team1, m.team2, m.time, m.league, m.date, m.betType, m.prob1, m.prob2, m.diff, m.odds
    ]);
    let headers = [
      "Home Team", "Away Team", "Time", "League", "Date", "1X2", "Score 1", "Score 2", "Diff", "Odds"
    ];

    y += 10;
    doc.autoTable({
      head: [headers],
      body: tableBody,
      startY: y,
      theme: 'grid',
      headStyles: { fillColor: [30, 144, 255] },
      margin: { left: 40, right: 40 }
    });

    // Get Y after table
    y = doc.lastAutoTable.finalY + 10;

    // Product of odds (accumulated)
    let accOdds = matches.reduce((acc, m) => acc * (Number(m.odds) || 1), 1);
    doc.setFontSize(11);
    doc.text(`Accumulated Bet Slip Odds: ${accOdds && accOdds !== 1 ? accOdds.toFixed(2) : '-'}`, 40, y);
    y += 30;
  }
  doc.setFontSize(10);
  doc.text(`Exported: ${now.toLocaleString()}`, 40, y);
  doc.text("Generated by peter", 40, y + 20);

  doc.save(`filtered_matches_${now.toISOString().slice(0,19).replace(/[:T]/g,'-')}.pdf`);
};