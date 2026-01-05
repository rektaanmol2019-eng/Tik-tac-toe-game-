// Single-page Tic-Tac-Toe with round persistence and Quit button
// CPU 1–6 (Level 6 alpha–beta), 1–10 target wins, 3-tie cap, ARIA grid, Web Audio clicks, localStorage persistence

/* ===== DOM ===== */
const setupEl     = document.getElementById('setup');
const gameRootEl  = document.getElementById('gameRoot');
const bannerP1El  = document.getElementById('bannerP1');
const bannerP2El  = document.getElementById('bannerP2');

const boardEl  = document.getElementById('board');
const turnEl   = document.getElementById('turn');
const resultEl = document.getElementById('result');
const cells    = Array.from(document.querySelectorAll('.cell'));

const modeEl    = document.getElementById('modeSelect');
const targetSel = document.getElementById('targetWins');
const p1NameEl  = document.getElementById('p1Name');
const p2NameEl  = document.getElementById('p2Name');
const p1MarkEls = Array.from(document.querySelectorAll('input[name="p1Mark"]'));
const startBtn  = document.getElementById('startMatch');
const clearBtn  = document.getElementById('clearSaved');
const cpuLevelEl= document.getElementById('cpuLevel');

const p1LabelEl = document.getElementById('p1Label');
const p2LabelEl = document.getElementById('p2Label');
const p1WinsEl  = document.getElementById('p1Wins');
const p2WinsEl  = document.getElementById('p2Wins');
const targetLab = document.getElementById('targetLabel');

const nextRoundBtn  = document.getElementById('nextRound');
const newMatchBtn   = document.getElementById('newMatch');
const resetRoundBtn = document.getElementById('resetRound');

/* Quit button (present in HTML or created dynamically) */
let quitMatchBtn = document.getElementById('quitMatch');

/* Summary modal */
const summaryEl   = document.getElementById('matchSummary');
const sumWinnerEl = document.getElementById('sumWinner');
const sumFinalEl  = document.getElementById('sumFinal');
const sumP1NameEl = document.getElementById('sumP1Name');
const sumP1WinsEl = document.getElementById('sumP1Wins');
const sumP1MarkEl = document.getElementById('sumP1Mark');
const sumP2NameEl = document.getElementById('sumP2Name');
const sumP2WinsEl = document.getElementById('sumP2Wins');
const sumP2MarkEl = document.getElementById('sumP2Mark');
const sumTimelineEl = document.getElementById('sumTimeline');
const summaryRematchBtn = document.getElementById('summaryRematch');
const summaryNewMatchBtn= document.getElementById('summaryNewMatch');
const summaryCloseBtn   = document.getElementById('summaryClose');
const summaryCopyBtn    = document.getElementById('summaryCopy');

/* Extra summary stats */
const sumTiesEl      = document.getElementById('sumTies');
const sumP1LossesEl  = document.getElementById('sumP1Losses');
const sumP2LossesEl  = document.getElementById('sumP2Losses');

/* ===== Persistence keys ===== */
const LS_SETTINGS = 'TTT_SETTINGS_V1';
const LS_SCORE    = 'TTT_SCORE_V1';
const LS_HISTORY  = 'TTT_HISTORY_V1';
const LS_ROUND    = 'TTT_ROUND_V1';

/* ===== Sounds ===== */
const sStart = new Audio('game-start-317318.mp3');
const sWin   = new Audio('game-over-38511.mp3');
const sTie   = new Audio('game-over-2-sound-effect-230463.mp3');
const sMatch = new Audio('winner-game-sound-404167.mp3');
sStart.volume = 0.40; sWin.volume = 0.52; sTie.volume = 0.48; sMatch.volume = 0.55;
[sStart, sWin, sTie, sMatch].forEach(a => { try { a.preload = 'auto'; a.load(); } catch {} });

/* ===== Web Audio clicks (single context) ===== */
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
function getCtx() { return audioCtx || (audioCtx = new AudioCtx()); }
function clickOK() {
  const ctx = getCtx(); const t0 = ctx.currentTime;
  const n = ctx.createBufferSource(); const buf = ctx.createBuffer(1, ctx.sampleRate * 0.03, ctx.sampleRate);
  const d = buf.getChannelData(0); for (let i=0;i<d.length;i++) d[i] = (Math.random()*2-1)*(1-i/d.length);
  n.buffer = buf; const g = ctx.createGain(); g.gain.setValueAtTime(0.24,t0); g.gain.exponentialRampToValueAtTime(0.001,t0+0.03);
  n.connect(g).connect(ctx.destination); n.start(t0); n.stop(t0+0.03);
  const o = ctx.createOscillator(); const og = ctx.createGain();
  o.type='sine'; o.frequency.setValueAtTime(620,t0); o.frequency.exponentialRampToValueAtTime(220,t0+0.06);
  og.gain.setValueAtTime(0.16,t0); og.gain.exponentialRampToValueAtTime(0.0001,t0+0.08);
  o.connect(og).connect(ctx.destination); o.start(t0); o.stop(t0+0.08);
}
function clickBlocked() {
  const ctx = getCtx(); const t0 = ctx.currentTime;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type='square'; o.frequency.setValueAtTime(140,t0); o.frequency.exponentialRampToValueAtTime(100,t0+0.07);
  g.gain.setValueAtTime(0.08,t0); g.gain.exponentialRampToValueAtTime(0.0001,t0+0.09);
  o.connect(g).connect(ctx.destination); o.start(t0); o.stop(t0+0.1);
}

/* ===== State ===== */
let mode = 'pvp';
let board = Array(9).fill(null);
let current = 'X';
let gameActive = false;

let players = {
  p1: { name: 'Player 1', mark: 'X', wins: 0 },
  p2: { name: 'Player 2', mark: 'O', wins: 0 }
};

let targetWins = 3;
let round = 1;
let starterMark = 'X';
let roundHistory = [];

let tieStreak = 0;
let totalTies = 0;
const MAX_TIES_STREAK = 3;
const MAX_TIES_TOTAL  = 3;

let DIFFICULTY = 6;

const WINS = [
  [0,1,2], [3,4,5], [6,7,8],
  [0,3,6], [1,4,7], [2,5,8],
  [0,4,8], [2,4,6]
];

/* ===== Storage helpers ===== */
function saveSettings() {
  const payload = {
    mode,
    targetWins: Math.max(1, Math.min(10, targetWins)),
    p1Name: sanitizeName(players.p1.name),
    p2Name: sanitizeName(players.p2.name),
    p1Mark: players.p1.mark,
    cpuLevel: DIFFICULTY
  };
  try { localStorage.setItem(LS_SETTINGS, JSON.stringify(payload)); } catch {}
}
function loadSettings() {
  try { const s = localStorage.getItem(LS_SETTINGS); return s ? JSON.parse(s) : null; } catch { return null; }
}
function saveScore() {
  const payload = { p1Wins: players.p1.wins, p2Wins: players.p2.wins, round, starterMark, totalTies, tieStreak };
  try { localStorage.setItem(LS_SCORE, JSON.stringify(payload)); } catch {}
}
function loadScore() {
  try { const s = localStorage.getItem(LS_SCORE); return s ? JSON.parse(s) : null; } catch { return null; }
}
function saveHistory() { try { localStorage.setItem(LS_HISTORY, JSON.stringify(roundHistory)); } catch {} }
function loadHistory() { try { const s = localStorage.getItem(LS_HISTORY); return s ? JSON.parse(s) : []; } catch { return []; } }
function clearSavedAll() { try { localStorage.removeItem(LS_SETTINGS); localStorage.removeItem(LS_SCORE); localStorage.removeItem(LS_HISTORY); localStorage.removeItem(LS_ROUND); } catch {} }

/* Live round persistence */
function saveRound() {
  const payload = {
    board,
    current,
    gameActive,
    ui: {
      nextRoundHidden: nextRoundBtn.hidden,
      newMatchHidden: newMatchBtn.hidden,
      resetRoundHidden: resetRoundBtn.hidden,
      resultText: resultEl.textContent
    }
  };
  try { localStorage.setItem(LS_ROUND, JSON.stringify(payload)); } catch {}
}
function loadRound() {
  try { const s = localStorage.getItem(LS_ROUND); return s ? JSON.parse(s) : null; } catch { return null; }
}
function clearRound() {
  try { localStorage.removeItem(LS_ROUND); } catch {}
}

/* ===== Views ===== */
function showHome() {
  board = Array(9).fill(null);
  cells.forEach((c, i) => {
    c.textContent = '';
    c.className = 'cell';
    c.setAttribute('aria-label', cellAriaLabel(i, null));
  });
  gameActive = false;
  boardEl.setAttribute('aria-disabled', 'true');
  setupEl.hidden = false;
  gameRootEl.hidden = true;
  bannerP1El.textContent = players.p1.name || 'Player 1';
  bannerP2El.textContent = (mode === 'cpu' ? 'CPU' : (players.p2.name || 'Player 2'));
}

/* Render board from state */
function renderBoardFromState() {
  cells.forEach((c, i) => {
    const v = board[i];
    c.textContent = v || '';
    c.className = 'cell' + (v ? (' ' + v.toLowerCase()) : '');
    c.setAttribute('aria-label', cellAriaLabel(i, v));
    if (gameActive) c.removeAttribute('disabled'); else c.setAttribute('disabled', 'true');
  });
}

function showGame() {
  setupEl.hidden = true;
  gameRootEl.hidden = false;
}

/* ===== Setup events ===== */
modeEl.addEventListener('change', () => {
  const cpu = modeEl.value === 'cpu';
  if (cpuLevelEl) {
    cpuLevelEl.parentElement.style.display = ''; // always visible
    cpuLevelEl.disabled = !cpu;                  // disabled in PvP
  }
  if (cpu) { p2NameEl.value = 'CPU'; p2NameEl.disabled = true; }
  else { p2NameEl.disabled = false; }
  bannerP2El.textContent = cpu ? 'CPU' : (p2NameEl.value || 'Player 2');
  saveSettings();
});
p1NameEl.addEventListener('input', () => { bannerP1El.textContent = p1NameEl.value || 'Player 1'; saveSettings(); });
p2NameEl.addEventListener('input', () => { bannerP2El.textContent = p2NameEl.value || 'Player 2'; saveSettings(); });
if (cpuLevelEl) {
  cpuLevelEl.addEventListener('change', () => {
    const v = parseInt(cpuLevelEl.value, 10);
    if (v >= 1 && v <= 6) DIFFICULTY = v;
    saveSettings();
  });
}
clearBtn.addEventListener('click', () => {
  clearSavedAll();
  alert('Saved settings, score, history, and live round cleared.');
});

/* ===== Buttons ===== */
startBtn.addEventListener('click', startMatch);
nextRoundBtn.addEventListener('click', () => { beginRound(); });
newMatchBtn.addEventListener('click', () => { showHome(); });
resetRoundBtn.addEventListener('click', resetRound);

/* Quit Match button (create if missing) */
if (!quitMatchBtn) {
  quitMatchBtn = document.createElement('button');
  quitMatchBtn.id = 'quitMatch';
  quitMatchBtn.type = 'button';
  quitMatchBtn.className = 'ghost';
  quitMatchBtn.textContent = 'Quit Match';
  const controls = newMatchBtn.parentElement || boardEl.parentElement;
  controls && controls.appendChild(quitMatchBtn);
}
quitMatchBtn.addEventListener('click', () => {
  const ok = confirm('Quit the current match? Progress in this match will be cleared.');
  if (!ok) return;
  players.p1.wins = 0; players.p2.wins = 0;
  roundHistory = []; round = 1; totalTies = 0; tieStreak = 0; starterMark = 'X';
  saveScore(); saveHistory(); clearRound();
  showHome();
});

/* Cell clicks */
cells.forEach(btn => btn.addEventListener('click', () => onCellClick(btn)));

/* ===== Boot ===== */
(function boot() {
  // Ensure 1..10 options exist
  if (targetSel && targetSel.options.length < 10) {
    targetSel.innerHTML = '';
    for (let i = 1; i <= 10; i++) {
      const opt = document.createElement('option');
      opt.value = String(i); opt.textContent = String(i);
      targetSel.add(opt);
    }
  }

  // Restore settings
  const s = loadSettings();
  if (s) {
    mode = s.mode || 'pvp'; modeEl.value = mode;
    targetWins = Math.max(1, Math.min(10, s.targetWins || 3)); targetSel.value = String(targetWins);
    players.p1.name = s.p1Name || 'Player 1';
    players.p2.name = s.p2Name || (mode === 'cpu' ? 'CPU' : 'Player 2');
    p1NameEl.value = players.p1.name; p2NameEl.value = players.p2.name;

    if (cpuLevelEl) {
      DIFFICULTY = Math.min(6, Math.max(1, s.cpuLevel ?? 6));
      cpuLevelEl.value = String(DIFFICULTY);
      cpuLevelEl.parentElement.style.display = '';
      cpuLevelEl.disabled = (mode !== 'cpu');
    }

    const mark = s.p1Mark === 'O' ? 'O' : 'X';
    (p1MarkEls.find(r => r.value === mark) || p1MarkEls[0]).checked = true;
    players.p1.mark = mark; players.p2.mark = mark === 'X' ? 'O' : 'X';
  }

  // Restore score/history
  const sc = loadScore();
  if (sc) {
    players.p1.wins = sc.p1Wins || 0;
    players.p2.wins = sc.p2Wins || 0;
    round = Math.max(1, sc.round || 1);
    starterMark = sc.starterMark === 'O' ? 'O' : 'X';
    totalTies = sc.totalTies || 0;
    tieStreak = sc.tieStreak || 0;
  }
  roundHistory = loadHistory();

  bannerP1El.textContent = players.p1.name;
  bannerP2El.textContent = mode === 'cpu' ? 'CPU' : players.p2.name;

  // Restore live round snapshot if present
  const rs = loadRound();
  if (rs && Array.isArray(rs.board) && rs.board.length === 9) {
    board = rs.board.slice();
    current = rs.current === 'O' ? 'O' : 'X';
    gameActive = !!rs.gameActive;

    p1LabelEl.textContent = `${players.p1.name} (${players.p1.mark})`;
    p2LabelEl.textContent = `${players.p2.name} (${players.p2.mark})`;
    p1WinsEl.textContent = players.p1.wins;
    p2WinsEl.textContent = players.p2.wins;
    targetLab.textContent = targetWins;

    showGame();
    renderBoardFromState();

    if (rs.ui) {
      nextRoundBtn.hidden  = !!rs.ui.nextRoundHidden;
      newMatchBtn.hidden   = !!rs.ui.newMatchHidden;
      resetRoundBtn.hidden = !!rs.ui.resetRoundHidden;
      resultEl.textContent = rs.ui.resultText || '';
    } else {
      nextRoundBtn.hidden = true; newMatchBtn.hidden = true; resetRoundBtn.hidden = !gameActive;
    }

    boardEl.setAttribute('aria-disabled', gameActive ? 'false' : 'true');
    updateTurnText();
  } else {
    showHome();
  }
})();

/* ===== Lifecycle ===== */
function startMatch() {
  mode = modeEl.value;
  targetWins = Math.max(1, Math.min(10, parseInt(targetSel.value, 10) || 3));
  players.p1.name = sanitizeName(p1NameEl.value || 'Player 1');
  players.p2.name = mode === 'cpu' ? 'CPU' : sanitizeName(p2NameEl.value || 'Player 2');
  const chosen = (p1MarkEls.find(r => r.checked)?.value) || 'X';
  players.p1.mark = chosen;
  players.p2.mark = chosen === 'X' ? 'O' : 'X';

  const prev = loadSettings();
  const same =
    prev &&
    prev.mode === mode &&
    prev.p1Name === players.p1.name &&
    prev.p2Name === players.p2.name &&
    prev.p1Mark === players.p1.mark &&
    prev.targetWins === targetWins &&
    prev.cpuLevel === DIFFICULTY;

  if (!same) {
    players.p1.wins = 0;
    players.p2.wins = 0;
    roundHistory = [];
    totalTies = 0;
    tieStreak = 0;
  }

  saveSettings(); saveScore(); saveHistory();

  p1LabelEl.textContent = `${players.p1.name} (${players.p1.mark})`;
  p2LabelEl.textContent = `${players.p2.name} (${players.p2.mark})`;
  p1WinsEl.textContent = players.p1.wins;
  p2WinsEl.textContent = players.p2.wins;
  targetLab.textContent = targetWins;

  round = 1;
  starterMark = 'X';
  tieStreak = 0;

  showGame();
  beginRound();
}

/**
 * Start a new round
 */
function beginRound() {
  try {
    sStart.currentTime = 0;
    sStart.play();
  } catch (e) {
    console.warn('Start sound failed:', e);
  }

  board = Array(9).fill(null);
  moves = 0; // Reset move counter
  cells.forEach((c, i) => {
    c.textContent = '';
    c.className = 'cell';
    c.removeAttribute('disabled');
    c.setAttribute('aria-label', cellAriaLabel(i, null));
  });

  current = starterMark;
  starterMark = starterMark === 'X' ? 'O' : 'X';

  resultEl.textContent = '';
  updateTurnText();

  gameActive = true;
  boardEl.setAttribute('aria-disabled', 'false');

  nextRoundBtn.hidden = true;
  newMatchBtn.hidden = true;
  resetRoundBtn.hidden = false;

  saveRound();
  maybeCpuTurn();
}

function endRound(winnerMark = null, winLine = null) {
  gameActive = false;
  boardEl.setAttribute('aria-disabled', 'true');

  if (winLine) winLine.forEach(i => cells[i].classList.add('win'));

  let winnerKey = null;
  if (winnerMark) {
    winnerKey = (players.p1.mark === winnerMark) ? 'p1' : 'p2';
    players[winnerKey].wins += 1;
    resultEl.textContent = `${players[winnerKey].name} wins Round ${round}!`;
    tieStreak = 0;
    try { sWin.currentTime = 0; sWin.play(); } catch {}
  } else {
    resultEl.textContent = `Round ${round} is a tie.`;
    totalTies += 1;
    tieStreak += 1;
    try { sTie.currentTime = 0; sTie.play(); } catch {}
  }

  roundHistory.push({ round, winnerKey, winnerMark: winnerMark || null });
  saveHistory(); saveScore();

  p1WinsEl.textContent = players.p1.wins;
  p2WinsEl.textContent = players.p2.wins;

  const matchWinner =
    players.p1.wins >= targetWins ? 'p1' :
    players.p2.wins >= targetWins ? 'p2' : null;

  if (matchWinner) {
    resultEl.textContent = `${players[matchWinner].name} wins the match!`;
    cells.forEach(c => c.setAttribute('disabled', 'true'));
    nextRoundBtn.hidden = true;
    newMatchBtn.hidden = false;
    resetRoundBtn.hidden = true;
    try { sMatch.currentTime = 0; sMatch.play(); } catch {}
    saveRound();
    showMatchSummary(matchWinner);
    return;
  }

  const drawReached = (!winnerKey) && (tieStreak >= MAX_TIES_STREAK || totalTies >= MAX_TIES_TOTAL);
  if (drawReached) {
    resultEl.textContent = `Match drawn after ${MAX_TIES_TOTAL} ties.`;
    cells.forEach(c => c.setAttribute('disabled', 'true'));
    nextRoundBtn.hidden = true;
    newMatchBtn.hidden = false;
    resetRoundBtn.hidden = true;
    try { sMatch.currentTime = 0; sMatch.play(); } catch {}
    saveRound();
    showMatchSummary(null);
    return;
  }

  round += 1;
  saveRound();
  setTimeout(beginRound, 900);
}

function resetRound() { beginRound(); }

/* ===== Moves ===== */
function onCellClick(btn) {
  if (!gameActive) return;
  if (isCpuTurn()) { clickBlocked(); return; }

  const idx = Number(btn.dataset.index);
  if (board[idx]) { clickBlocked(); return; }

  clickOK();
  playMoveAt(idx);

  const winLine = getWinningLine();
  if (winLine) { saveRound(); endRound(current, winLine); return; }
  if (board.every(Boolean)) { saveRound(); endRound(null, null); return; }

  current = otherMark(current);
  updateTurnText();
  saveRound();
  maybeCpuTurn();
}

/* ===== CPU driver ===== */
function isCpuTurn() { return mode === 'cpu' && markBelongsTo(current, 'p2'); }
function markBelongsTo(mark, key) { return players[key].mark === mark; }

/**
 * Play a move at the given index
 */
function playMoveAt(idx) {
  cells.forEach(c => c.classList.remove('last'));
  board[idx] = current;
  moves++; // Increment move counter
  const btn = cells[idx];
  btn.textContent = current;
  btn.classList.add(current.toLowerCase(), 'last');
  btn.setAttribute('aria-label', cellAriaLabel(idx, current));
}

function getWinningLine(b = board) {
  for (const [a,b2,c] of WINS) {
    if (b[a] && b[a] === b[b2] && b[a] === b[c]) return [a,b2,c];
  }
  return null;
}

function updateTurnText() {
  const key = markBelongsTo(current, 'p1') ? 'p1' : 'p2';
  turnEl.textContent = `Turn: ${players[key].name} (${current})`;
}

function otherMark(m) { return m === 'X' ? 'O' : 'X'; }

/* ===== CPU 1..6 ===== */
function maybeCpuTurn() {
  if (!gameActive) return;
  if (!isCpuTurn()) return;

  setTimeout(() => {
    const move = cpuPickMoveByLevel(DIFFICULTY);
    if (move != null && board[move] == null) {
      playMoveAt(move);

      const winLine = getWinningLine();
      if (winLine) { saveRound(); endRound(current, winLine); return; }
      if (board.every(Boolean)) { saveRound(); endRound(null, null); return; }

      current = otherMark(current);
      updateTurnText();
      saveRound();
    }
  }, 280);
}

function cpuPickMoveByLevel(level) {
  const ai = players.p2.mark;
  const human = players.p1.mark;

  const w = winSpot(board, ai);    if (w != null && level >= 3) return w;
  const b = winSpot(board, human); if (b != null && level >= 3) return b;

  if (level >= 6) {
    const book = openingBookMove(board, ai, human);
    if (book != null) return book;
  }

  switch (level) {
    case 1:  return randomEmpty(board);
    case 2:  return priorityMove(board, [4], [0,2,6,8], [1,3,5,7]);
    case 3:  return priorityMove(board, [4], [0,2,6,8], [1,3,5,7]);
    case 4: {
      const cf = forkMove(board, ai);    if (cf != null) return cf;
      const bf = forkMove(board, human); if (bf != null) return bf;
      return priorityMove(board, [4], [0,2,6,8], [1,3,5,7]);
    }
    case 5: {
      const move = alphaBetaBest(board, ai, human, /*fullDepth=*/false);
      if (move != null && Math.random() < 0.12) {
        const near = tacticalNeighborhood(board, move);
        if (near != null) return near;
      }
      return move ?? priorityMove(board, [4], [0,2,6,8], [1,3,5,7]);
    }
    case 6:
    default: {
      const book2 = openingBookMove(board, ai, human);
      if (book2 != null) return book2;
      return alphaBetaBest(board, ai, human, /*fullDepth=*/true);
    }
  }
}

/* Heuristics & helpers */
function randomEmpty(b) {
  const idx = b.map((v,i)=>v==null?i:null).filter(i=>i!=null);
  return idx.length ? idx[Math.floor(Math.random()*idx.length)] : null;
}
function priorityMove(b, centers, corners, sides) {
  for (const i of centers) if (b[i]==null) return i;
  const availCorners = corners.filter(i=>b[i]==null);
  if (availCorners.length) return availCorners[Math.floor(Math.random()*availCorners.length)];
  const availSides = sides.filter(i=>b[i]==null);
  if (availSides.length) return availSides[Math.floor(Math.random()*availSides.length)];
  return null;
}
function winSpot(b, mark) {
  for (const [a,bb,c] of WINS) {
    const vals = [b[a], b[bb], b[c]];
    const count = vals.filter(v=>v===mark).length;
    const empties = [a,bb,c].filter(i=>b[i]==null);
    if (count===2 && empties.length===1) return empties[0];
  }
  return null;
}
function forkMove(b, mark) {
  for (let i=0;i<9;i++){
    if (b[i]!=null) continue;
    b[i]=mark;
    let threats=0;
    for (const [a,bb,c] of WINS) {
      const vals=[b[a],b[bb],b[c]];
      const cnt=vals.filter(v=>v===mark).length;
      const emp=[a,bb,c].filter(k=>b[k]==null).length;
      if (cnt===2 && emp===1) threats++;
      if (threats>=2){ b[i]=null; return i; }
    }
    b[i]=null;
  }
  return null;
}
function tacticalNeighborhood(b, strongMove) {
  const neighbors = {
    0:[1,3,4], 1:[0,2,4], 2:[1,5,4],
    3:[0,4,6], 4:[1,3,5,7,0,2,6,8],
    5:[2,4,8], 6:[3,4,7], 7:[6,4,8], 8:[5,7,4]
  };
  const cand = (neighbors[strongMove]||[]).filter(i=>b[i]==null);
  return cand.length ? cand[Math.floor(Math.random()*cand.length)] : null;
}

/* Opening book */
function openingBookMove(b, ai, human) {
  const filled = b.filter(v=>v!=null).length;
  if (filled===0) return b[4]==null ? 4 : randomEmptyCorner(b);
  if (filled===1) {
    if (b[4]==null) return 4;
    return randomEmptyCorner(b);
  }
  const corners=[[0,8],[2,6]];
  for (const [c,opp] of corners) {
    if (b[c]===human && b[opp]==null) return opp;
  }
  return null;
}
function randomEmptyCorner(b){
  const corners=[0,2,6,8].filter(i=>b[i]==null);
  return corners.length ? corners[Math.floor(Math.random()*corners.length)] : null;
}

/* Alpha–beta minimax */
const TT = new Map();
function boardKey(b, turn){ return `${b.map(v=>v||'_').join('')}:${turn}`; }
function staticOutcome(b){
  for (const [a,bb,c] of WINS){
    if (b[a] && b[a]===b[bb] && b[a]===b[c]) return b[a];
  }
  if (b.every(Boolean)) return 'tie';
  return null;
}
function alphaBetaBest(b, ai, human, fullDepth=true){
  TT.clear();
  const order = [4,0,2,6,8,1,3,5,7].filter(i=>b[i]==null);
  let bestMove = null;
  let bestScore = -Infinity;
  for (const m of order){
    b[m]=ai;
    const score = -negamax(b, human, ai, -Infinity, Infinity, 1, fullDepth);
    b[m]=null;
    if (score > bestScore){ bestScore=score; bestMove=m; }
  }
  return bestMove;
}
function negamax(b, turn, ai, alpha, beta, depth, fullDepth){
  const outcome = staticOutcome(b);
  if (outcome){
    if (outcome==='tie') return 0;
    return (outcome===ai) ? (10 - depth) : (depth - 10);
  }
  if (!fullDepth && depth >= 4){
    return heuristicEval(b, ai);
  }
  const key = boardKey(b, turn);
  if (TT.has(key)) return TT.get(key);
  const order = [4,0,2,6,8,1,3,5,7].filter(i=>b[i]==null);
  let best = -Infinity;
  for (const m of order){
    b[m]=turn;
    const score = -negamax(b, otherMark(turn), ai, -beta, -alpha, depth+1, fullDepth);
    b[m]=null;
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  TT.set(key, best);
  return best;
}
function heuristicEval(b, ai){
  const human = otherMark(ai);
  let s=0;
  for (const [a,bb,c] of WINS){
    const line=[b[a],b[bb],b[c]];
    const aiCnt=line.filter(v=>v===ai).length;
    const huCnt=line.filter(v=>v===human).length;
    if (aiCnt && huCnt) continue;
    if (aiCnt===2) s+=3; else if (aiCnt===1) s+=1;
    if (huCnt===2) s-=3; else if (huCnt===1) s-=1;
  }
  if (b[4]===ai) s+=1;
  return s;
}

/* ===== Summary ===== */
function openSummary() { summaryEl.hidden = false; setTimeout(() => summaryRematchBtn.focus?.(), 0); }

function closeSummary() { summaryEl.hidden = true; }

function showMatchSummary(winnerKey) {
  sumWinnerEl.textContent = winnerKey ? `${players[winnerKey].name} wins!` : 'Match drawn!';
  sumFinalEl.textContent = winnerKey ? `${players[winnerKey].name} wins the match!` : 'Match drawn after ties.';
  sumP1NameEl.textContent = players.p1.name;
  sumP1WinsEl.textContent = players.p1.wins;
  sumP1MarkEl.textContent = players.p1.mark;
  sumP2NameEl.textContent = players.p2.name;
  sumP2WinsEl.textContent = players.p2.wins;
  sumP2MarkEl.textContent = players.p2.mark;
  sumTiesEl.textContent = totalTies;
  sumP1LossesEl.textContent = players.p2.wins;
  sumP2LossesEl.textContent = players.p1.wins;
  sumTimelineEl.innerHTML = roundHistory.map(r => {
    const winnerName = r.winnerKey ? players[r.winnerKey].name : 'Tie';
    return `<li>Round ${r.round}: ${winnerName}</li>`;
  }).join('');
  openSummary();
}

/* Summary button events */
summaryRematchBtn.addEventListener('click', () => {
  closeSummary();
  startMatch(); // Start a new match with same settings
});
summaryNewMatchBtn.addEventListener('click', () => {
  closeSummary();
  showHome();
});
summaryCloseBtn.addEventListener('click', closeSummary);
summaryCopyBtn.addEventListener('click', () => {
  const text = `Match Summary:\nWinner: ${sumWinnerEl.textContent}\n${sumP1NameEl.textContent} (${sumP1MarkEl.textContent}): ${sumP1WinsEl.textContent} wins\n${sumP2NameEl.textContent} (${sumP2MarkEl.textContent}): ${sumP2WinsEl.textContent} wins\nTies: ${sumTiesEl.textContent}\nTimeline:\n${roundHistory.map(r => `Round ${r.round}: ${r.winnerKey ? players[r.winnerKey].name : 'Tie'}`).join('\n')}`;
  navigator.clipboard.writeText(text).then(() => alert('Summary copied to clipboard!')).catch(() => alert('Failed to copy.'));
});

/* ===== Helpers ===== */
function sanitizeName(name) {
  return (name || '').trim().substring(0, 20) || 'Player';
}

function cellAriaLabel(index, value) {
  const row = Math.floor(index / 3) + 1;
  const col = (index % 3) + 1;
  const occupied = value ? ` occupied by ${value}` : ' empty';
  return `Row ${row}, Column ${col},${occupied}`;
}
