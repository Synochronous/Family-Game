/* Family Quiz — rebuilt engine with host controls, reusable-safe question selection,
   Jeopardy hints/50-50, penalty wheel, dynamic teams, timers, and detailed stats. */
(() => {
  "use strict";

  const NORMAL_VALUES = [250, 500, 750, 1000, 1250, 1500];
  const DEFAULT_VALUE_RANGES = {
    250: [5, 6], 500: [4, 5], 750: [3, 4], 1000: [2, 3], 1250: [2, 2], 1500: [2, 2]
  };
  const HIGH_VALUE_MIN = 1000;
  const HINT_BASE_PENALTY_CHANCE = 0.10;
  const HINT_PENALTY_CAP = 0.95;
  const FIFTY_BASE_PENALTY_CHANCE = 0.50;
  const FIFTY_CAP = 0.95;
  const BASE_EVENT_CHANCE = 0.15;
  const EVENT_CAP = 0.95;
  const EVENT_RAMP = 0.12;
  const MYSTERY_QUESTION_POOL_SIZE = 12;
  const MYSTERY_UNLOCK_BASE_CHANCE = 0.03;
  const MYSTERY_UNLOCK_RAMP = 0.06;
  const MYSTERY_UNLOCK_CAP = 0.65;
  const MYSTERY_QUARTER_MIN_CHANCE = 0.09;
  const MYSTERY_AUTO_UNLOCK_REMAINING = 6;
  const PAPA_TIMER_SECONDS = 45;
  const NORMAL_TIMER_SECONDS = { 250: 35, 500: 50, 750: 65, 1000: 80, 1250: 95, 1500: 110 };
  const REPRESENTATIVE_LADDER = [100, 250, 500, 750, 1000, 1500, 2000, 3000, 4000, 5000];
  const REPRESENTATIVE_SAFE = [0, 0, 0, 0, 500, 500, 1000, 1000, 1500, 5000];

  const state = {
    mode: null, gameStarted: false, players: [], teams: [],
    questions: [], normalQuestions: [], specialQuestions: [], papaBundles: [], events: [], curses: [], punishments: [],
    usedQuestionIds: new Set(), usedPapaBundleIds: new Set(), unlockedSpecialQuestionIds: new Set(),
    boardCounts: new Map(), boardPools: new Map(),
    currentTeamIndex: 0, currentPlayerId: null, currentQuestion: null, currentSource: null,
    questionOwnerTeamIndex: null, currentAnsweringPlayerId: null, answerLocked: false, resolutionComplete: false,
    stealAvailable: false, stealTeamIndex: null, hintUsedThisQuestion: false, currentEvent: null, currentEventTriggerChance: BASE_EVENT_CHANCE, currentEventValue: 0,
    eventChance: BASE_EVENT_CHANCE, eventTriggeredTeams: new Set(), mysteryUnlockChance: MYSTERY_UNLOCK_BASE_CHANCE, lastMysteryEvent: null, activeCurses: [], selectedCursePlayerId: null, curseOverloadTriggered: false, penaltyActive: false, penaltySequence: null,
    wager: { active: false, locked: false, amount: 0 },
    hintPenaltyChance: {}, highValue50UsedPlayers: new Set(),
    timer: { id: null, remaining: 0, running: false, paused: false, mode: null, expired: false },
    normalAnswered: 0, history: [], selectedSetupPlayerId: null,
    settings: {
      normalQuestionLimit: 40, winCondition: "questions_and_papa", targetScore: 10000,
      valueRanges: structuredClone(DEFAULT_VALUE_RANGES)
    },
    papa: { subIndex: 0, values: [], correctCount: 0, correctIndices: new Set(), rotationUsage: {}, rotationMax: {}, rotationPlayers: {}, playerOrder: {}, playerIndex: {} },
    playerStats: {},
    representative: {
      category: null, questionIndex: 0, winnings: 0, safeWinnings: 0, usedCategories: new Set(), runEnded: false,
      lives: 3, maxLives: 3, baseReviveAvailable: true, baseReviveUsed: false,
      lifelines: { fiftyFifty: "available", callAudience: "available" }, selectedLifeline: null,
      audienceUsed: false
    }
  };

  const $ = s => document.querySelector(s);
  const screens = { menu: $("#screen-menu"), setup: $("#screen-setup"), jeopardy: $("#screen-jeopardy"), categories: $("#screen-categories"), question: $("#screen-question"), results: $("#screen-results") };
  const els = {
    buttonJeopardy: $("#button-jeopardy"), buttonRepresentative: $("#button-representative"), setupMode: $("#setup-mode-label"),
    playerName: $("#player-name"), playerAge: $("#player-age-group"), playerTeam: $("#player-team"), addPlayer: $("#add-player"), playerCount: $("#player-count"), unassigned: $("#unassigned-players"), teamsContainer: $("#teams-container"), teamCount: $("#team-count"),
    questionLimit: $("#question-limit"), winCondition: $("#win-condition"), targetScore: $("#target-score"), valueRangeBody: $("#value-range-body"),
    setupBack: $("#setup-back"), startGame: $("#start-game"), setupViewRoster: $("#setup-view-roster"),
    jeopardyTurn: $("#jeopardy-turn-label"), jeopardyProgress: $("#jeopardy-progress"), jeopardyBoard: $("#jeopardy-board"), jeopardyScoreboard: $("#jeopardy-scoreboard"), jeopardyEffects: $("#jeopardy-effects"), jeopardyCurses: $("#jeopardy-curses"), jeopardyLeaderboard: $("#jeopardy-leaderboard"), jeopardyHistory: $("#jeopardy-history"), jeopardyMenu: $("#jeopardy-menu"), jeopardyViewRoster: $("#jeopardy-view-roster"), jeopardyQuestionMenu: $("#jeopardy-question-menu"),
    repTurn: $("#representative-turn-label"), repGrid: $("#category-grid"), repScoreboard: $("#representative-scoreboard"), repEffects: $("#representative-effects"), repCurses: $("#representative-curses"), repLeaderboard: $("#representative-leaderboard"), repHistory: $("#representative-history"), repMenu: $("#categories-menu"), repViewRoster: $("#representative-view-roster"), repStatus: $("#representative-status"),
    questionMode: $("#question-mode"), questionPlayer: $("#question-player"), questionAnswerer: $("#question-answerer"), questionMysteryEvent: $("#question-mystery-event"), questionScoreboard: $("#question-scoreboard"), questionCategory: $("#question-category"), questionScore: $("#question-score"), questionText: $("#question-text"), answerGrid: $("#answer-grid"), explanation: $("#question-explanation"), explanationText: $("#question-explanation-text"), questionHint: $("#question-hint"), hintRiskContainer: $("#hint-risk-container"), questionActions: $("#question-actions"), questionContinue: $("#question-continue"), questionEffects: $("#question-effects"), questionCurses: $("#question-curses"), questionLeaderboard: $("#question-leaderboard"), questionHistory: $("#question-history"), questionWwtbamStatus: $("#question-wwtbam-status"), lifelineActions: $("#lifeline-actions"),
    resultsList: $("#results-list"), resultsAgain: $("#results-again"), resultsMenu: $("#results-menu"),
    eventOverlay: $("#event-overlay"), eventTitle: $("#event-title"), eventDescription: $("#event-description"), eventEffect: $("#event-effect"), eventTriggerChance: $("#event-trigger-chance"), eventWagerControls: $("#event-wager-controls"), eventWagerInput: $("#event-wager-input"), eventWagerLock: $("#event-wager-lock"), eventWagerLimit: $("#event-wager-limit"), eventClose: $("#event-close"),
    jeopardyQuestionMenuModal: $("#jeopardy-question-menu-modal"), jeopardyQuestionMenuBody: $("#jeopardy-question-menu-body"), jeopardyQuestionMenuClose: $("#jeopardy-question-menu-close"),
    papaMenuModal: $("#papa-menu-modal"), papaMenuBody: $("#papa-menu-body"), papaMenuClose: $("#papa-menu-close"),
    hostHelpButton: $("#host-help-button"), hostHelpModal: $("#host-help-modal"), hostHelpClose: $("#host-help-close"), mysteryUnlockModal: $("#mystery-unlock-modal"), mysteryUnlockClose: $("#mystery-unlock-close"), mysteryUnlockBody: $("#mystery-unlock-body"),
    penaltyOverlay: $("#penalty-overlay"), penaltyStage: $("#penalty-stage"), penaltyType: $("#penalty-type"), penaltyIcon: $("#penalty-icon"), penaltyTitle: $("#penalty-title"), penaltyDescription: $("#penalty-description"), penaltyEffect: $("#penalty-effect"), penaltyClose: $("#penalty-close"), penaltyEffectHost: $("#penalty-effect-host"),
    toast: $("#toast-container"), leaderboardModal: $("#leaderboard-modal"), leaderboardModalBody: $("#leaderboard-modal-body"), leaderboardModalClose: $("#leaderboard-modal-close"),
    rosterModal: $("#team-roster-modal"), rosterBody: $("#team-roster-body"), rosterClose: $("#team-roster-close"), eventWeightsModal: $("#event-weights-modal"), eventWeightsBody: $("#event-weights-body"), eventWeightsClose: $("#event-weights-close"),
    audienceOverlay: $("#audience-overlay"), curseDetailsModal: $("#curse-details-modal"), curseDetailsBody: $("#curse-details-body"), curseDetailsClose: $("#curse-details-close"), audienceBody: $("#audience-body"), audienceClose: $("#audience-close")
  };

  function escapeHtml(v) { return String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }
  function formatScore(n) { return `$${Math.round(Number(n) || 0).toLocaleString()}`; }
  function formatDelta(n) { const v=Math.round(Number(n)||0); return `${v>=0?"+":"-"}${formatScore(Math.abs(v))}`; }
  function applyScoreDelta(teamIndex, delta, reason="Score change") {
    const t = state.teams[Number(teamIndex)];
    if (!t) return 0;
    const amount = Math.round(Number(delta) || 0);
    t.score = Math.round(Number(t.score) || 0) + amount;
    return t.score;
  }
  function randomInt(a,b) { return Math.floor(Math.random()*(b-a+1))+a; }
  function randomFloat(a,b) { return Math.random()*(b-a)+a; }
  function randomItem(a) { return a[Math.floor(Math.random()*a.length)]; }
  function shuffle(a) { const x=[...a]; for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]];} return x; }
  function clamp(n,a,b) { return Math.max(a,Math.min(b,n)); }
  function player(id) { return state.players.find(p=>p.id===id)||null; }
  function team() { return state.teams[state.currentTeamIndex] || null; }
  function teamKey(i) { return state.teams[i]?.id || `team-${i+1}`; }
  function defaultTeamName(index) { return `Team ${index + 1}`; }
  function teamDisplay(tOrIndex) {
    const index = typeof tOrIndex === "number" ? tOrIndex : state.teams.indexOf(tOrIndex);
    const t = typeof tOrIndex === "number" ? state.teams[tOrIndex] : tOrIndex;
    const base = defaultTeamName(Math.max(0, index));
    const name = String(t?.name || base).trim() || base;
    return name.toLowerCase() === base.toLowerCase() ? base : `TEAM ${index + 1} • ${name}`;
  }
  function teamDisplayById(teamId) {
    const index = state.teams.findIndex(t => t.id === teamId);
    return index >= 0 ? teamDisplay(index) : "Unassigned";
  }
  function playerTeamLabel(p) { return p?.teamId ? teamDisplayById(p.teamId) : "Unassigned"; }
  function closeAllTransientOverlays() {
    els.eventOverlay?.classList.add("hidden");
    if (els.penaltyOverlay) els.penaltyOverlay.classList.add("hidden");
    state.penaltyActive = false;
    state.penaltySequence = null;
  }
  function toast(text) { if(!els.toast)return; const d=document.createElement("div");d.className="toast";d.textContent=text;els.toast.appendChild(d);setTimeout(()=>d.remove(),2800); }
  function showScreen(s) { Object.values(screens).forEach(x=>x?.classList.remove("active"));s?.classList.add("active");window.scrollTo(0,0); }
  function addHistory(type,text) { state.history.unshift({type,text,time:new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})});if(state.history.length>100)state.history.length=100;renderHistoryAll(); }

  async function loadJson(name,fallback){
    try{
      let r=await fetch(`data/${name}`,{cache:"no-store"});
      if(!r.ok){
        r=await fetch(name,{cache:"no-store"});
      }
      if(!r.ok)throw new Error(`${name}: ${r.status}`);
      return await r.json();
    }catch(e){
      console.error(`Required data file failed: ${name}`,e);
      return fallback;
    }
  }
  function normalizeQuestion(q,i){
    const choices=q.choices&&typeof q.choices==="object"?[q.choices.A,q.choices.B,q.choices.C,q.choices.D]:q.answers;
    const answers=Array.isArray(choices)?choices.map(String):[]; const letter=typeof q.answer==="string"?q.answer.toUpperCase():null;
    const correct=Number.isInteger(q.correctAnswer)?q.correctAnswer:(letter?"ABCD".indexOf(letter):Number(q.correct??-1));
    return {id:String(q.id??`q-${i+1}`),category:String(q.category??"General"),score:Number(q.score??q.value??0),question:String(q.question??q.text??""),answers,correctAnswer:correct,note:String(q.note??q.explanation??""),difficulty:String(q.difficulty??"medium")};
  }
  function normalizePapa(p){return {id:String(p.id),category:"Papa",papa:true,section:String(p.section||"Papa"),questions:(Array.isArray(p.questions)?p.questions:[]).slice(0,3).map((q,i)=>({id:String(q.id??`${p.id}-${i+1}`),question:String(q.question||""),answers:Array.isArray(q.answers)?q.answers.map(String):[],correctAnswer:Number(q.correctAnswer),valueMin:Number(q.valueMin??p.valueMin??100),valueMax:Number(q.valueMax??p.valueMax??250),note:String(q.note||"")}))};}
  function normalizeSpecialQuestion(q,i){
    const choices=q?.choices&&typeof q.choices==="object"?[q.choices.A,q.choices.B,q.choices.C,q.choices.D,q.choices.E,q.choices.F,q.choices.G,q.choices.H]:q?.answers;
    const answers=Array.isArray(choices)?choices.map(String).slice(0,8):[];
    const letter=typeof q?.answer==="string"?q.answer.toUpperCase():"";
    const correct=Number.isInteger(q?.correctAnswer)?q.correctAnswer:(letter?"ABCDEFGH".indexOf(letter):Number(q?.correct??-1));
    const rawScore=Number(q?.score??q?.value??0);
    return {id:String(q?.id??`special-${i+1}`),category:String(q?.category??"Mystery"),score:clamp(Math.round(rawScore||2000),2000,5000),question:String(q?.question??q?.text??""),answers,correctAnswer:correct,note:String(q?.note??q?.explanation??""),difficulty:String(q?.difficulty??"very-hard")};
  }

  async function loadData() {
    const [rawQ, events, curses, punishments] = await Promise.all([
      loadJson("questions.json", null), loadJson("events.json", []), loadJson("curses.json", []), loadJson("punishments.json", [])
    ]);
    if (!rawQ) throw new Error("questions.json could not be loaded. No fallback question pool is allowed.");
    const normal = Array.isArray(rawQ) ? rawQ.map(normalizeQuestion) : (rawQ.questions || []).map(normalizeQuestion);
    const specialRaw = Array.isArray(rawQ) ? [] : (rawQ.jeopardyQuestionMenu || rawQ.questionMenu || rawQ.specialQuestions || []);
    const special = Array.isArray(specialRaw) ? specialRaw.map(normalizeSpecialQuestion).filter(q=>q.question && q.answers.length===8 && q.correctAnswer>=0 && q.correctAnswer<8).slice(0,MYSTERY_QUESTION_POOL_SIZE) : [];
    const papa = Array.isArray(rawQ) ? [] : (rawQ.papa || []).map(normalizePapa);
    state.questions = [...normal, ...special, ...papa]; state.normalQuestions = normal; state.specialQuestions = special; state.papaBundles = papa;
    state.events = Array.isArray(events) ? events : []; state.curses = Array.isArray(curses) ? curses : []; state.punishments = Array.isArray(punishments) ? punishments : [];
    validateLoadedData();
  }

  function validateLoadedData() {
    const ids = new Set(state.normalQuestions.map(q => q.id));
    const cats = [...new Set(state.normalQuestions.map(q => q.category))];
    console.assert(ids.size === state.normalQuestions.length, "Duplicate normal question IDs");
    console.assert(cats.length === 6, "Expected 6 normal categories", cats);
    console.assert(NORMAL_VALUES.every(v => state.normalQuestions.filter(q => q.score === v).length === 60), "Unexpected value counts");
    console.assert(state.normalQuestions.length === 360, "Unexpected normal question count");
    if (state.specialQuestions.length > MYSTERY_QUESTION_POOL_SIZE) console.warn(`Mystery question pool exceeds ${MYSTERY_QUESTION_POOL_SIZE}; extras were ignored.`);
    if (state.specialQuestions.some(q => q.answers.length !== 8 || q.score < 2000 || q.score > 5000)) console.warn("Some mystery questions do not meet the 8-choice / $2,000–$5,000 specification.");
    if (state.papaBundles.some(b => !Array.isArray(b.questions) || b.questions.length !== 3)) console.warn("Some Birthday Boy bundles are incomplete and were retained for later use.");
  }

  function initializeBoardPools(){
    state.boardCounts.clear();
    state.boardPools.clear();
    const groups=new Map();
    for(const q of state.normalQuestions){
      const key=`${q.category}::${q.score}`;
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push(q);
    }
    const cats=categories();
    for(const value of NORMAL_VALUES){
      const perCategory=cats.map(c=>groups.get(`${c}::${value}`)||[]);
      const leastAvailable=perCategory.length?Math.min(...perCategory.map(pool=>pool.length)):0;
      const configured=state.settings.valueRanges[value]||[0,0];
      const minSetting=Math.min(Number(configured[0])||0,Number(configured[1])||0);
      const maxSetting=Math.max(Number(configured[0])||0,Number(configured[1])||0);
      const safeMin=Math.min(minSetting,leastAvailable);
      const safeMax=Math.min(maxSetting,leastAvailable);
      for(const c of cats){
        const pool=groups.get(`${c}::${value}`)||[];
        const desired=pool.length?randomInt(safeMin,safeMax):0;
        state.boardCounts.set(`${c}::${value}`,desired);
        state.boardPools.set(`${c}::${value}`,shuffle(pool));
      }
    }
  }
  function categories(){return [...new Set(state.normalQuestions.map(q=>q.category))];}
  function remainingBoardCount(c,v){return state.boardCounts.get(`${c}::${v}`)||0;}
  function nextBoardQuestion(c,v){
    const key=`${c}::${v}`;let remaining=remainingBoardCount(c,v);if(!remaining)return null;const pool=state.boardPools.get(key)||[];
    while(pool.length){const q=pool.pop();if(!state.usedQuestionIds.has(q.id)){state.boardCounts.set(key,remaining-1);state.usedQuestionIds.add(q.id);return q;}}
    state.boardCounts.set(key,0);return null;
  }
  function papaRemaining(){return state.papaBundles.filter(p=>!state.usedPapaBundleIds.has(p.id)).length;}
  function hasPapa(){return state.papaBundles.length>0;}
  function effectiveWinCondition(){
    const wc=state.settings.winCondition;
    if(!hasPapa() && (wc==="questions_and_papa"||wc==="questions_or_papa")) return "questions_only";
    return wc;
  }
  function gameComplete(){
    const s=state.settings,wc=effectiveWinCondition(); if(wc==="target_score")return state.teams.some(t=>t.score>=s.targetScore);
    if(wc==="questions_only")return state.normalAnswered>=s.normalQuestionLimit;
    if(wc==="questions_or_papa")return state.normalAnswered>=s.normalQuestionLimit || papaRemaining()===0;
    return state.normalAnswered>=s.normalQuestionLimit && papaRemaining()===0;
  }
  function papaCanBeChosen(index){if(!hasPapa()||!papaRemaining())return false;if(state.settings.winCondition==="questions_only"||state.settings.winCondition==="target_score")return false;if(state.normalAnswered>=state.settings.normalQuestionLimit)return true;const k=teamKey(index);return (state.papa.rotationUsage[k]||0)<(state.papa.rotationMax[k]||1);}
  function selectPapaBundle(){const available=state.papaBundles.filter(p=>!state.usedPapaBundleIds.has(p.id));if(!available.length||!papaCanBeChosen(state.currentTeamIndex))return null;const b=randomItem(available);state.usedPapaBundleIds.add(b.id);const k=teamKey(state.currentTeamIndex);if(state.normalAnswered<state.settings.normalQuestionLimit)state.papa.rotationUsage[k]=(state.papa.rotationUsage[k]||0)+1;addHistory("Papa bundle selected",`${team().name}: ${b.id}`);return b;}
  function choosePlayerForTeam(index){const t=state.teams[index];if(!t?.playerIds.length)return null;const k=teamKey(index);let order=state.papa.playerOrder[k]||[];if(!order.length||order.length!==t.playerIds.length||order.some(id=>!t.playerIds.includes(id))){order=shuffle(t.playerIds);state.papa.playerOrder[k]=order;state.papa.playerIndex[k]=0;}return order[(state.papa.playerIndex[k]||0)%order.length]||null;}
  function advanceTurn(){
    const old=state.currentTeamIndex,k=teamKey(old),p=state.currentPlayerId;if(p)state.papa.rotationPlayers[k]?.add(p);
    const ot=state.teams[old];if(ot?.playerIds.length&&state.papa.rotationPlayers[k]?.size>=ot.playerIds.length){state.papa.rotationPlayers[k].clear();state.papa.rotationUsage[k]=0;state.papa.rotationMax[k]=Math.random()<.5?1:2;state.papa.playerIndex[k]=0;addHistory("Player rotation reset",`${ot.name}: Papa allowance ${state.papa.rotationMax[k]}`);}else if(ot?.playerIds.length)state.papa.playerIndex[k]=(state.papa.playerIndex[k]+1)%ot.playerIds.length;
    state.currentTeamIndex=(state.currentTeamIndex+1)%state.teams.length;state.currentPlayerId=choosePlayerForTeam(state.currentTeamIndex);state.currentAnsweringPlayerId=state.currentPlayerId;
  }

  function resetForNewGame() {
    stopTimer(); state.gameStarted = false; state.currentQuestion = null; state.currentSource = null; state.currentEvent = null; state.currentEventTriggerChance = BASE_EVENT_CHANCE;
    state.currentEventValue = 0; state.lastMysteryEvent = null; state.usedQuestionIds.clear(); state.usedPapaBundleIds.clear(); state.normalAnswered = 0; state.currentTeamIndex = 0; state.eventTriggeredTeams.clear(); state.currentPlayerId = null; state.currentAnsweringPlayerId = null;
    state.answerLocked = false; state.resolutionComplete = false; state.stealAvailable = false; state.hintUsedThisQuestion = false; state.stealTeamIndex = null; state.wager = {active:false,locked:false,amount:0}; state.history = [];
    state.highValue50UsedPlayers.clear(); state.hintPenaltyChance = {}; state.playerStats = {}; state.activeCurses = []; state.selectedCursePlayerId = null; state.curseOverloadTriggered = false; state.penaltyActive = false; state.penaltySequence = null;
    state.representative = { category:null, questionIndex:0, winnings:0, safeWinnings:0, usedCategories:new Set(), runEnded:false, lives:3, maxLives:3, baseReviveAvailable:true, baseReviveUsed:false, lifelines:{fiftyFifty:"available",callAudience:"available"}, selectedLifeline:null, audienceUsed:false };
    state.timer = {id:null,remaining:0,running:false,paused:false,mode:null,expired:false};
    state.papa = {subIndex:0,values:[],correctCount:0,correctIndices:new Set(),rotationUsage:{},rotationMax:{},rotationPlayers:{},playerOrder:{},playerIndex:{}};
    for (const t of state.teams) t.score = 0;
  }

  function openSetup(mode) {
    state.mode = mode; if (els.setupMode) els.setupMode.textContent = mode === "jeopardy" ? "JEOPARDY SETUP" : "WHO WANTS TO BE A MILLIONAIRE SETUP";
    renderSetupSettings(); renderTeamLists(); showScreen(screens.setup); els.playerName?.focus();
  }

  function addPlayer(){
    const name=els.playerName.value.trim(),age=els.playerAge.value,teamId=els.playerTeam.value||null;if(!name)return toast("Enter a player name.");if(!age)return toast("Choose an age group.");if(state.players.some(p=>p.name.toLowerCase()===name.toLowerCase()))return toast("That player name is already used.");
    const p={id:`player-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,name,ageGroup:age,teamId};state.players.push(p);if(teamId)state.teams.find(t=>t.id===teamId)?.playerIds.push(p.id);state.selectedSetupPlayerId=p.id;els.playerName.value="";els.playerAge.value="";renderTeamLists();els.playerName.focus();
  }
  function setTeamCount(count) {
    count = clamp(Number(count) || 2, 2, 6);
    while (state.teams.length < count) {
      const i = state.teams.length; state.teams.push({id:`team-${i+1}`,name:defaultTeamName(i),playerIds:[],score:0});
    }
    while (state.teams.length > count) {
      const removed = state.teams.pop();
      for (const id of removed.playerIds) { const p = player(id); if (p) p.teamId = null; }
    }
    if (els.teamCount) els.teamCount.value = String(count);
    renderSetupSettings(); renderTeamLists();
  }

  function assignPlayer(id,teamId){const p=player(id);if(!p)return;state.teams.forEach(t=>t.playerIds=t.playerIds.filter(x=>x!==id));p.teamId=teamId||null;if(teamId)state.teams.find(t=>t.id===teamId)?.playerIds.push(id);state.selectedSetupPlayerId=id;renderTeamLists();}
  function renderSetupSettings() {
    if (els.questionLimit) els.questionLimit.value = String(state.settings.normalQuestionLimit);
    if (els.winCondition) {
      [...els.winCondition.options].forEach(o => { if (o.value === "questions_and_papa" || o.value === "questions_or_papa") o.hidden = !hasPapa(); });
      if (!hasPapa() && (state.settings.winCondition === "questions_and_papa" || state.settings.winCondition === "questions_or_papa")) state.settings.winCondition = "questions_only";
      els.winCondition.value = state.settings.winCondition;
    }
    if (els.targetScore) els.targetScore.value = String(state.settings.targetScore);
    els.targetScore?.closest("label")?.classList.toggle("hidden", state.settings.winCondition !== "target_score");
    renderValueRanges(); updatePlayerTeamOptions();
  }

  function syncSettings() {
    if (els.questionLimit) state.settings.normalQuestionLimit = clamp(parseInt(els.questionLimit.value,10) || 40,1,200);
    if (els.winCondition) state.settings.winCondition = els.winCondition.value;
    if (els.targetScore) state.settings.targetScore = clamp(parseInt(els.targetScore.value,10) || 10000,100,1000000);
  }

  function renderValueRanges(){if(!els.valueRangeBody)return;els.valueRangeBody.innerHTML=NORMAL_VALUES.map(v=>{const [a,b]=state.settings.valueRanges[v]||[2,2];return `<tr><th>${formatScore(v)}</th><td><input class="range-input value-min" data-value="${v}" type="number" min="0" max="60" value="${a}"></td><td><input class="range-input value-max" data-value="${v}" type="number" min="0" max="60" value="${b}"></td><td><span class="range-preview">${a===b?a:`${a}–${b}`} per category</span></td></tr>`;}).join("");}
  function syncValueRanges(){document.querySelectorAll(".range-input").forEach(i=>{const v=Number(i.dataset.value),minEl=document.querySelector(`.value-min[data-value="${v}"]`),maxEl=document.querySelector(`.value-max[data-value="${v}"]`);let a=clamp(parseInt(minEl.value,10)||0,0,60),b=clamp(parseInt(maxEl.value,10)||0,0,60);if(a>b)[a,b]=[b,a];state.settings.valueRanges[v]=[a,b];});renderValueRanges();}
  function renderTeamLists() {
    if (!els.playerCount || !els.teamsContainer || !els.unassigned) return;
    els.playerCount.textContent = String(state.players.length); if (els.teamCount) els.teamCount.value = String(state.teams.length);
    els.unassigned.innerHTML = "";
    const unassigned = state.players.filter(p => !p.teamId);
    if (!unassigned.length) els.unassigned.innerHTML = '<div class="empty-state">No unassigned players.</div>';
    unassigned.forEach(p => els.unassigned.appendChild(playerChip(p)));
    els.teamsContainer.innerHTML = "";
    state.teams.forEach((t,i) => {
      const panel = document.createElement("section"); panel.className = `team-panel ${state.selectedSetupPlayerId && t.playerIds.includes(state.selectedSetupPlayerId) ? "team-targeted" : ""}`; panel.dataset.teamId=t.id;
      panel.innerHTML = `<div class="panel-title"><input class="team-name-input" data-team-name="${t.id}" value="${escapeHtml(t.name)}" maxlength="24"><span class="team-number">TEAM ${i+1}</span><span class="badge">${t.playerIds.length}</span></div><div class="team-player-list" data-team-zone="${t.id}"></div>`;
      const list=panel.querySelector("[data-team-zone]");
      if(!t.playerIds.length) list.innerHTML='<div class="drop-hint">No players yet. Select a player and press the team number.</div>';
      t.playerIds.map(player).filter(Boolean).forEach(p=>list.appendChild(playerChip(p)));
      els.teamsContainer.appendChild(panel);
    });
    updatePlayerTeamOptions();
    const selected=player(state.selectedSetupPlayerId); if(selected&&els.playerTeam) els.playerTeam.value=selected.teamId||"";
    document.querySelectorAll("[data-team-name]").forEach(input=>input.addEventListener("input",()=>{const t=state.teams.find(x=>x.id===input.dataset.teamName);if(t){t.name=input.value||defaultTeamName(state.teams.indexOf(t));updatePlayerTeamOptions();}}));
    document.querySelectorAll("[data-team-zone]").forEach(zone=>{zone.ondragover=e=>e.preventDefault();zone.ondrop=e=>{e.preventDefault();assignPlayer(e.dataTransfer.getData("text/plain"),zone.dataset.teamZone);};});
  }

  function updatePlayerTeamOptions() {
    if (!els.playerTeam) return;
    const current = els.playerTeam.value;
    els.playerTeam.innerHTML = '<option value="">Unassigned</option>' + state.teams.map((t,i)=>`<option value="${t.id}">${escapeHtml(teamDisplay(i))}</option>`).join("");
    const selected=player(state.selectedSetupPlayerId); els.playerTeam.value=selected?.teamId || current || "";
  }

  function playerChip(p){const d=document.createElement("div");d.className=`player-chip ${state.selectedSetupPlayerId===p.id?"selected": ""}`;d.draggable=true;d.dataset.id=p.id;d.innerHTML=`<strong>${escapeHtml(p.name)}</strong><span>${escapeHtml(p.ageGroup)}</span><small>${p.teamId?escapeHtml(state.teams.find(t=>t.id===p.teamId)?.name||""):"Unassigned"}</small>`;d.onclick=()=>{state.selectedSetupPlayerId=p.id;renderTeamLists();toast(`${p.name} selected. Press 1–${state.teams.length} to assign.`);};d.ondragstart=e=>e.dataTransfer.setData("text/plain",p.id);return d;}

  function startGame() {
    syncSettings(); syncValueRanges();
    const valid = state.teams.filter(t => t.playerIds.length);
    if (state.players.length < 2) return toast("Add at least two players.");
    if (valid.length < 2) return toast("At least two teams need a player each.");
    state.gameStarted = true; state.currentTeamIndex=0; state.currentPlayerId=null; state.currentAnsweringPlayerId=null;
    initializeBoardPools();
    for (const t of state.teams) { const k=t.id; state.papa.rotationUsage[k]=0; state.papa.rotationMax[k]=Math.random()<.5?1:2; state.papa.rotationPlayers[k]=new Set(); state.papa.playerOrder[k]=shuffle(t.playerIds); state.papa.playerIndex[k]=0; state.hintPenaltyChance[k]=HINT_BASE_PENALTY_CHANCE; }
    state.currentPlayerId=choosePlayerForTeam(0); state.currentAnsweringPlayerId=state.currentPlayerId; state.eventChance=BASE_EVENT_CHANCE; state.mysteryUnlockChance=MYSTERY_UNLOCK_BASE_CHANCE; state.lastMysteryEvent=null; state.unlockedSpecialQuestionIds.clear();
    for (const p of state.players) state.playerStats[p.id]={attempts:0,correct:0,gained:0,lost:0,hints:0,fiftyFifty:0,penaltiesTriggered:0};
    addHistory("Game started",`${state.mode} • ${state.teams.length} teams • ${state.settings.normalQuestionLimit} normal questions`);
    if(state.mode==="jeopardy"){renderJeopardy();showScreen(screens.jeopardy);}else{renderRepresentativeMode();showScreen(screens.categories);}
  }

  function renderJeopardy() {
    renderJeopardyTopScores();
    renderScoreboard(els.jeopardyScoreboard); renderEffects(els.jeopardyEffects); renderCurseList(els.jeopardyCurses); renderLeaderboard(els.jeopardyLeaderboard); renderHistory(els.jeopardyHistory); renderTurnBanner();
    if(els.jeopardyProgress){
      const value=`${state.normalAnswered}/${state.settings.normalQuestionLimit}`;
      els.jeopardyProgress.innerHTML=`<span>QUESTIONS</span><strong>${value}</strong>`;
    }
    els.jeopardyBoard.innerHTML="";
    const complete=gameComplete();
    for(const c of categories()){
      const col=document.createElement("div"); col.className="board-column"; col.innerHTML=`<div class="board-category">${escapeHtml(c)}</div>`;
      for(const v of NORMAL_VALUES){
        const count=remainingBoardCount(c,v),b=document.createElement("button");
        b.type="button";b.className="board-cell";b.disabled=!count||state.normalAnswered>=state.settings.normalQuestionLimit||(state.settings.winCondition==="target_score"&&complete);
        b.innerHTML=`<strong>${formatScore(v)}</strong><span>${count} available</span>`;
        b.onclick=()=>openNormalQuestion(c,v);col.appendChild(b);
      }
      els.jeopardyBoard.appendChild(col);
    }
    if(els.jeopardyPapaMenuRow){
      els.jeopardyPapaMenuRow.replaceChildren();
      if(hasPapa()){
        const p=document.createElement("button");p.type="button";p.className="board-papa";p.disabled=!papaCanBeChosen(state.currentTeamIndex)||gameComplete();
        p.innerHTML=`<span>BIRTHDAY BOY • MENU</span><strong>${papaRemaining()} bundles left</strong><small>${state.normalAnswered>=state.settings.normalQuestionLimit?"Post-limit phase: remains until exhausted":`${escapeHtml(team()?.name||"Team")}: ${state.papa.rotationUsage[teamKey(state.currentTeamIndex)]||0}/${state.papa.rotationMax[teamKey(state.currentTeamIndex)]||1} uses`}</small>`;p.onclick=openPapaMenu;els.jeopardyPapaMenuRow.appendChild(p);
      }
    }
    updateSpecialQuestionButton();
  }

  function renderTurnBanner(){
    const t=team();
    const p=player(state.currentPlayerId);
    const playerName=p?.name||"Player";
    if(els.jeopardyTurn)els.jeopardyTurn.textContent=`${teamDisplay(t)} • ${playerName} • YOUR TURN`;
    if(els.repTurn)els.repTurn.textContent=`${teamDisplay(t)} • ${playerName} • TURN`;
  }

  function renderJeopardyTopScores(){
    const left=document.querySelector("#jeopardy-score-left"), right=document.querySelector("#jeopardy-score-right");
    if(!left||!right)return;
    const mid=Math.ceil(state.teams.length/2);
    const make=(indices)=>indices.map(i=>{
      const t=state.teams[i],d=document.createElement("div");
      d.className=`jeopardy-top-score ${i===state.currentTeamIndex?"active":""}`;
      const activePlayer=i===state.currentTeamIndex?player(state.currentPlayerId):null;
      d.innerHTML=`<span>${escapeHtml(teamDisplay(i))}${activePlayer?` • ${escapeHtml(activePlayer.name)}`:""}</span><strong>${formatScore(t.score)}</strong>`;
      return d;
    });
    left.replaceChildren(...make([...Array(mid).keys()]));
    right.replaceChildren(...make([...Array(state.teams.length-mid).keys()].map(i=>i+mid)));
  }

  function updateSpecialQuestionButton(){
    const b=els.jeopardyQuestionMenu;if(!b)return;
    const blocked=gameComplete();
    const unlocked=[...state.unlockedSpecialQuestionIds].filter(id=>state.specialQuestions.some(q=>q.id===id&&!state.usedQuestionIds.has(q.id)));
    b.querySelector("em")?.replaceChildren(document.createTextNode(`${unlocked.length}/${MYSTERY_QUESTION_POOL_SIZE} UNLOCKED`));
    b.disabled=blocked;
    b.title=blocked?"The game has already ended.":`Open the mystery question menu. ${unlocked.length}/${MYSTERY_QUESTION_POOL_SIZE} mystery questions unlocked.`;
  }

  function updateEndBanner(){ /* progress now lives in the dedicated board heading */ }

    function winConditionLabel(){const s=state.settings,wc=effectiveWinCondition();return wc==="target_score"?`first to ${formatScore(s.targetScore)}`:wc==="questions_only"?"question limit":wc==="questions_or_papa"?"question limit OR Papa exhausted":"question limit AND Papa exhausted";}
  function openNormalQuestion(c,v){if(state.normalAnswered>=state.settings.normalQuestionLimit)return toast("The normal question limit is complete.");if(gameComplete())return toast("The selected win condition has already been met.");const q=nextBoardQuestion(c,v);if(!q)return toast("No questions remain in that board cell.");openQuestion(q,"jeopardy");}

  function openSpecialQuestion(q){
    stopTimer();
    state.currentQuestion=q;state.currentSource="jeopardy_special";state.questionOwnerTeamIndex=state.currentTeamIndex;state.currentAnsweringPlayerId=state.currentPlayerId;
    state.answerLocked=false;state.resolutionComplete=false;state.stealAvailable=false;state.stealTeamIndex=null;state.wager={active:false,locked:false,amount:0};state.currentEvent=null;state.currentEventTriggerChance=0;state.currentEventValue=Number(q.score);state.timer.expired=false;state.hintUsedThisQuestion=false;state.usedQuestionIds.add(String(q.id));
    renderQuestionShell("JEOPARDY • MYSTERY",q.category,q.score);renderNormalAnswers(q);showScreen(screens.question);startTimer(120,"special");
    if(els.questionMysteryEvent){els.questionMysteryEvent.textContent="MYSTERY QUESTION • NO NORMAL EVENTS";els.questionMysteryEvent.disabled=true;}
    addHistory("Mystery question opened",`${teamDisplay(state.questionOwnerTeamIndex)} • ${formatScore(q.score)} • ${q.category} revealed`);
  }

  function mysteryNormalRemaining(){ return Math.max(0,state.settings.normalQuestionLimit-state.normalAnswered); }
  function mysteryUnlockCandidates(){ return state.specialQuestions.filter(q=>!state.usedQuestionIds.has(q.id)&&!state.unlockedSpecialQuestionIds.has(q.id)); }
  function applyMysteryUnlockMiss(){
    const remaining=mysteryNormalRemaining(), halfway=Math.max(1,Math.ceil(state.settings.normalQuestionLimit/2)), quarter=Math.max(1,Math.ceil(state.settings.normalQuestionLimit/4));
    let next=clamp(state.mysteryUnlockChance+MYSTERY_UNLOCK_RAMP,MYSTERY_UNLOCK_BASE_CHANCE,MYSTERY_UNLOCK_CAP);
    if(remaining<=halfway)next=Math.max(next,MYSTERY_UNLOCK_BASE_CHANCE);
    if(remaining<=quarter)next=Math.max(next,MYSTERY_QUARTER_MIN_CHANCE);
    state.mysteryUnlockChance=clamp(next,MYSTERY_UNLOCK_BASE_CHANCE,MYSTERY_UNLOCK_CAP);
  }
  function showMysteryUnlockPopup(unlockedAll=false){
    if(!els.mysteryUnlockModal)return;
    const remaining=[...state.unlockedSpecialQuestionIds].filter(id=>state.specialQuestions.some(q=>q.id===id&&!state.usedQuestionIds.has(q.id))).length;
    if(els.mysteryUnlockBody){
      els.mysteryUnlockBody.innerHTML=unlockedAll
        ? `<strong>All remaining mystery questions are now unlocked.</strong><span>${remaining} question${remaining===1?"":"s"} available in the menu.</span>`
        : `<strong>A mystery question has been unlocked.</strong><span>${remaining} mystery question${remaining===1?"":"s"} now available.</span>`;
    }
    els.mysteryUnlockModal.classList.remove("hidden");
  }
  function checkMysteryUnlock(){
    const candidates=mysteryUnlockCandidates();
    if(!candidates.length)return false;
    if(mysteryNormalRemaining()<=MYSTERY_AUTO_UNLOCK_REMAINING){
      for(const q of candidates)state.unlockedSpecialQuestionIds.add(q.id);
      state.mysteryUnlockChance=MYSTERY_UNLOCK_BASE_CHANCE;
      state.lastMysteryEvent={type:"unlock_all",count:state.unlockedSpecialQuestionIds.size,total:MYSTERY_QUESTION_POOL_SIZE,text:`All remaining mystery questions unlocked (${state.unlockedSpecialQuestionIds.size}/${MYSTERY_QUESTION_POOL_SIZE}).`};
      addHistory("Mystery event","All remaining mystery questions unlocked in the final 6-question window.");
      showMysteryUnlockPopup(true);
      updateSpecialQuestionButton();
      renderAll();
      return true;
    }
    const chance=clamp(state.mysteryUnlockChance,MYSTERY_UNLOCK_BASE_CHANCE,MYSTERY_UNLOCK_CAP);
    if(Math.random()<chance){
      const unlocked=randomItem(candidates);
      state.unlockedSpecialQuestionIds.add(unlocked.id);
      state.mysteryUnlockChance=MYSTERY_UNLOCK_BASE_CHANCE;
      const count=state.unlockedSpecialQuestionIds.size;
      state.lastMysteryEvent={type:"unlock",count,total:MYSTERY_QUESTION_POOL_SIZE,text:`Mystery question unlocked • ${count}/${MYSTERY_QUESTION_POOL_SIZE} available.`};
      addHistory("Mystery event",`Mystery question unlocked: ${unlocked.id} • trigger succeeded • ${count}/${MYSTERY_QUESTION_POOL_SIZE} unlocked`);
      showMysteryUnlockPopup(false);
      updateSpecialQuestionButton();
      renderAll();
      return true;
    }
    applyMysteryUnlockMiss();
    updateSpecialQuestionButton();
    return false;
  }
  function renderMysteryQuestionMenu(){
    const unlocked=shuffle([...state.unlockedSpecialQuestionIds].map(id=>state.specialQuestions.find(q=>q.id===id)).filter(Boolean).filter(q=>!state.usedQuestionIds.has(q.id)));
    const unlockedCount=Math.min(MYSTERY_QUESTION_POOL_SIZE,state.unlockedSpecialQuestionIds.size);
    const locked=Math.max(0,MYSTERY_QUESTION_POOL_SIZE-unlockedCount);
    let html=unlocked.map((q,i)=>`<button class="special-question-option" data-special-id="${escapeHtml(q.id)}" type="button"><span>MYSTERY ${i+1}</span><strong>${formatScore(q.score)}</strong><small>CATEGORY HIDDEN</small><em>8 ANSWERS • VERY HARD</em></button>`).join("");
    if(!unlocked.length){
      html=`<div class="special-question-empty"><strong>No unused mystery questions are available.</strong><span>${unlockedCount ? "All currently unlocked mystery questions have already been used." : "Open this menu again later. A hidden mystery-event unlock roll occurs only when the menu is opened."}</span><small>${locked}/${MYSTERY_QUESTION_POOL_SIZE} locked.</small></div>`;
    }
    html+=`<div class="special-question-lock-status"><strong>${unlockedCount}/${MYSTERY_QUESTION_POOL_SIZE} UNLOCKED</strong><span>${locked ? `${locked} mystery question${locked===1?"":"s"} remain locked.` : "All mystery questions are unlocked."}</span></div>`;
    els.jeopardyQuestionMenuBody.innerHTML=html;
    els.jeopardyQuestionMenuBody.querySelectorAll("[data-special-id]").forEach(btn=>btn.addEventListener("click",()=>{
      const q=state.specialQuestions.find(x=>String(x.id)===btn.dataset.specialId);
      if(!q)return;
      els.jeopardyQuestionMenuModal.classList.add("hidden");
      openSpecialQuestion(q);
    }));
  }
  function openJeopardyQuestionMenu(skipUnlockRoll=false){
    if(!els.jeopardyQuestionMenuModal||!els.jeopardyQuestionMenuBody)return;
    if(gameComplete())return toast("The game has already ended.");
    if(!skipUnlockRoll && checkMysteryUnlock())return;
    renderMysteryQuestionMenu();
    els.jeopardyQuestionMenuModal.classList.remove("hidden");
  }
  function openPapaMenu(){
    if(!els.papaMenuModal||!els.papaMenuBody)return;
    if(gameComplete())return showResults();
    if(!papaCanBeChosen(state.currentTeamIndex))return toast("Birthday Boy is unavailable for this team right now.");
    const unused=state.papaBundles.filter(p=>!state.usedPapaBundleIds.has(p.id));
    els.papaMenuBody.innerHTML=unused.length?unused.map((b,i)=>{const qs=Array.isArray(b.questions)?b.questions:[];const mins=qs.map(q=>Number(q.valueMin??100)).filter(Number.isFinite);const maxs=qs.map(q=>Number(q.valueMax??250)).filter(Number.isFinite);const lo=mins.length?Math.min(...mins):100;const hi=maxs.length?Math.max(...maxs):250;return `<button class="special-question-option papa-bundle-option" data-papa-id="${escapeHtml(b.id)}" type="button"><span>BUNDLE ${i+1}</span><strong>3 QUESTIONS</strong><small>${escapeHtml(b.section||"Birthday Boy")}</small><em>${formatScore(lo)}–${formatScore(hi)} EACH</em></button>`;}).join(""):`<div class="special-question-empty"><strong>No Birthday Boy bundles remain.</strong><span>The bundle pool is exhausted.</span></div>`;
    els.papaMenuBody.querySelectorAll("[data-papa-id]").forEach(btn=>btn.addEventListener("click",()=>{
      const b=state.papaBundles.find(x=>String(x.id)===btn.dataset.papaId);
      if(!b)return;
      els.papaMenuModal.classList.add("hidden");
      startPapaBundle(b);
    }));
    els.papaMenuModal.classList.remove("hidden");
  }
  function startPapaBundle(b){
    if(!b||state.usedPapaBundleIds.has(b.id)||!papaCanBeChosen(state.currentTeamIndex))return toast("That Birthday Boy bundle is no longer available.");
    state.usedPapaBundleIds.add(b.id);
    const k=teamKey(state.currentTeamIndex);
    if(state.normalAnswered<state.settings.normalQuestionLimit)state.papa.rotationUsage[k]=(state.papa.rotationUsage[k]||0)+1;
    addHistory("Papa bundle selected",`${team().name}: ${b.id}`);
    state.currentQuestion=b;state.currentSource="papa";state.questionOwnerTeamIndex=state.currentTeamIndex;state.currentAnsweringPlayerId=state.currentPlayerId;
    state.papa.subIndex=0;state.papa.values=b.questions.map(q=>randomInt(q.valueMin||100,q.valueMax||250));state.papa.correctCount=0;state.papa.correctIndices=new Set();state.currentEvent=null;state.wager={active:false,locked:false,amount:0};state.resolutionComplete=false;state.answerLocked=false;state.hintUsedThisQuestion=false;
    renderQuestionShell("PAPA",`${b.section||"Birthday Boy"} • 1/3`,state.papa.values[0]);renderPapaSubQuestion();showScreen(screens.question);startTimer(PAPA_TIMER_SECONDS,"papa");
  }

  function renderQuestionShell(mode,cat,score) {
    els.questionMode.textContent=mode; els.questionCategory.textContent=cat; els.questionScore.textContent=formatScore(score); els.questionText.textContent=state.currentQuestion?.question||"";
    const t=team(),p=player(state.currentAnsweringPlayerId||state.currentPlayerId);
    els.questionPlayer.textContent=`${teamDisplay(t)} • ${p?.name||"Player"}`;
    if(els.questionAnswerer)els.questionAnswerer.textContent=`${mode} • ${p?.name||"Player"}`;
    renderScoreboard(els.questionScoreboard); renderLeaderboard(els.questionLeaderboard); renderHistory(els.questionHistory); renderEffects(els.questionEffects); renderCurseList(els.questionCurses); hideExplanation();
    hideQuestionContinue(); els.questionActions.querySelectorAll(".runtime-box,.wager-status").forEach(x=>x.remove()); els.questionHint.classList.remove("hidden"); renderHintRiskPanels(); renderEventBanner(); renderRepresentativeStatus(els.questionWwtbamStatus); renderLifelineActions();
    if(els.questionMysteryEvent)els.questionMysteryEvent.disabled=false;
  }

  function openQuestion(question,source){
    if(!question)return;
    if(source==="jeopardy"&&gameComplete())return showResults();
    if(source==="jeopardy"&&question.papa)return startPapaBundle(question);
    state.currentQuestion=question;
    state.currentSource=source;
    state.questionOwnerTeamIndex=state.currentTeamIndex;
    state.currentAnsweringPlayerId=state.currentPlayerId;
    state.answerLocked=false;
    state.resolutionComplete=false;
    state.stealAvailable=false;
    state.stealTeamIndex=null;
    state.hintUsedThisQuestion=false;
    state.wager={active:false,locked:false,amount:0};
    state.currentEvent=null;
    state.currentEventTriggerChance=BASE_EVENT_CHANCE;
    state.currentEventValue=Number(question.score)||0;
    state.timer.expired=false;
    closeAllTransientOverlays();
    renderQuestionShell(source==="jeopardy"?"JEOPARDY":"WHO WANTS TO BE A MILLIONAIRE",question.category,source==="representative"?REPRESENTATIVE_LADDER[Math.max(0,state.representative.questionIndex-1)]:question.score);
    renderNormalAnswers(question);
    showScreen(screens.question);
    const seconds=source==="jeopardy"?(NORMAL_TIMER_SECONDS[Number(question.score)]||NORMAL_TIMER_SECONDS[250]):120;
    startTimer(seconds,source);
    if(source==="jeopardy")triggerEvent(Number(question.score), question.category);
    renderQuestionTimer();
    addHistory("Question opened",`${question.category} • ${formatScore(source==="representative"?REPRESENTATIVE_LADDER[Math.max(0,state.representative.questionIndex-1)]:question.score)}${source==="representative"?" • WWTBAM":""}`);
    renderTurnBanner();
  }

  function refreshHintButton(){
    const q=state.currentQuestion,pid=state.currentAnsweringPlayerId||state.currentPlayerId,value=Number(q?.score||0),isJeopardy=state.currentSource==="jeopardy",steal=state.stealAvailable;
    if(!els.questionHint)return;
    if(!isJeopardy||state.currentSource==="jeopardy_special"){els.questionHint.classList.add("hidden");els.questionHint.disabled=true;els.questionHint.classList.remove("hint-disabled-steal");return;}
    els.questionHint.classList.remove("hidden");
    els.questionHint.classList.toggle("hint-disabled-steal",steal);
    if(steal){
      els.questionHint.disabled=true;
      els.questionHint.textContent=Number(q?.score)>=HIGH_VALUE_MIN?"50/50 • STEAL":"💡 HINT • STEAL";
      els.questionHint.title="Hints are unavailable during a steal.";
      return;
    }
    if(value>=HIGH_VALUE_MIN){
      const risk=Math.round(clamp(FIFTY_BASE_PENALTY_CHANCE+currentPenaltyChance(state.questionOwnerTeamIndex)/2,FIFTY_BASE_PENALTY_CHANCE,FIFTY_CAP)*100);
      const available=!!pid&&!state.highValue50UsedPlayers.has(pid);
      els.questionHint.disabled=!available;els.questionHint.textContent=available?`50/50 • ${risk}%`:"50/50 • USED";els.questionHint.title=available?`One-time use for ${player(pid)?.name||"this player"}. ${risk}% penalty risk.`:"This player already used 50/50.";
      return;
    }
    const removable=[...els.answerGrid.children].some((b,i)=>i!==Number(q?.correctAnswer)&&!b.disabled&&!b.classList.contains("hint-removed"));
    const risk=Math.round(currentPenaltyChance(state.questionOwnerTeamIndex)*100);
    els.questionHint.disabled=!removable;els.questionHint.textContent=removable?`💡 HINT • ${risk}%`:`💡 NO WRONG ANSWERS`;els.questionHint.title=removable?`Remove one wrong answer. ${risk}% penalty chance.`:"All wrong answers have already been removed.";
  }

  function renderNormalAnswers(q) {
    els.answerGrid.innerHTML="";
    q.answers.forEach((a,i)=>{const b=document.createElement("button");b.type="button";b.className="answer-button";b.dataset.index=i;b.innerHTML=`<span class="answer-letter">${String.fromCharCode(65+i)}</span><span>${escapeHtml(a)}</span>`;b.onclick=()=>answerNormal(i,b);els.answerGrid.appendChild(b);});
    refreshHintButton();
    if(state.currentSource==="jeopardy_special"&&els.questionMysteryEvent){els.questionMysteryEvent.textContent="MYSTERY QUESTION • NO NORMAL EVENTS";els.questionMysteryEvent.disabled=true;}
    if(state.currentEvent?.effect?.type==="wager")renderWagerStatus();
  }
    function renderPapaSubQuestion(){const b=state.currentQuestion,sub=b.questions[state.papa.subIndex];if(!sub)return;state.answerLocked=false;els.questionCategory.textContent=`Papa • ${state.papa.subIndex+1}/3`;els.questionScore.textContent=formatScore(state.papa.values[state.papa.subIndex]);els.questionText.textContent=sub.question;els.questionPlayer.textContent=teamDisplay(state.currentTeamIndex);if(els.questionAnswerer)els.questionAnswerer.textContent=`PAPA • ${player(state.currentAnsweringPlayerId||state.currentPlayerId)?.name||"Player"}`;els.answerGrid.innerHTML="";sub.answers.forEach((a,i)=>{const bt=document.createElement("button");bt.type="button";bt.className="answer-button";bt.dataset.index=i;bt.innerHTML=`<span class="answer-letter">${String.fromCharCode(65+i)}</span><span>${escapeHtml(a)}</span>`;bt.onclick=()=>answerPapa(i,bt);els.answerGrid.appendChild(bt);});els.questionHint.disabled=true;els.questionHint.textContent="PAPA";hideExplanation();hideQuestionContinue();renderEventBanner();}
  function showQuestionContinue(label="Continue"){
    if(!els.questionContinue)return;
    els.questionContinue.textContent=label;
    els.questionContinue.disabled=false;
    els.questionContinue.classList.remove("hidden");
    els.questionContinue.setAttribute("aria-disabled","false");
  }
  function hideQuestionContinue(){
    if(!els.questionContinue)return;
    // Keep Continue visible at all times. It is simply unavailable until an answer is resolved.
    els.questionContinue.classList.remove("hidden");
    els.questionContinue.disabled=true;
    els.questionContinue.setAttribute("aria-disabled","true");
    els.questionContinue.textContent="Continue";
  }

  function answerPapa(i,b){if(state.answerLocked)return;stopTimer();state.answerLocked=true;const sub=state.currentQuestion.questions[state.papa.subIndex];[...els.answerGrid.children].forEach(x=>x.disabled=true);const ok=i===sub.correctAnswer;if(ok){b.classList.add("correct");state.papa.correctCount++;state.papa.correctIndices.add(state.papa.subIndex);}else{b.classList.add("incorrect");els.answerGrid.children[sub.correctAnswer]?.classList.add("reveal-correct");}const pid=state.currentAnsweringPlayerId||state.currentPlayerId;if(pid){state.playerStats[pid].attempts++;if(ok)state.playerStats[pid].correct++;}showExplanation(sub.note,sub.correctAnswer,sub.answers);addHistory(ok?"Papa correct":"Papa incorrect",`${team().name}: ${state.papa.subIndex+1}/3`);if(state.papa.subIndex<2){showQuestionContinue("Next Papa Question");}else finishPapaBundle();}
  function finishPapaBundle() {
    const total=state.papa.values.reduce((sum,v,i)=>sum+(state.papa.correctIndices.has(i)?v:0),0); const payout=state.papa.correctCount===3?total*2:total; applyScoreDelta(state.currentTeamIndex,payout,"Birthday Boy payout");
    const pid=state.currentAnsweringPlayerId||state.currentPlayerId; if(pid)state.playerStats[pid].gained+=payout; state.resolutionComplete=true;
    showQuestionContinue("Continue");renderScoreboard(els.questionScoreboard);renderQuestionTimer();addHistory("Birthday Boy result",`${team()?.name||"Team"}: ${state.papa.correctCount}/3 → +${formatScore(payout)}`);
  }

  function answerNormal(i,b) {
    if(state.answerLocked||!state.currentQuestion)return;
    if(state.currentSource==="representative")return answerRepresentative(i,b);
    if(state.currentEvent?.effect?.type==="wager"&&!state.wager.locked)return toast("Lock the wager before answering.");
    const q=state.currentQuestion; const steal=state.stealAvailable&&state.stealTeamIndex===state.currentTeamIndex; const answering=steal?state.stealTeamIndex:state.questionOwnerTeamIndex; const pid=state.currentAnsweringPlayerId||state.currentPlayerId; const remainingBefore=state.timer.remaining;
    stopTimer();state.answerLocked=true;[...els.answerGrid.children].forEach(x=>x.disabled=true);
    const ok=i===q.correctAnswer;if(pid)state.playerStats[pid].attempts++;b.classList.add(ok?"correct":"incorrect");if(!ok)els.answerGrid.children[q.correctAnswer]?.classList.add("reveal-correct");
    if(ok){const base=calculateCorrectAmount(q.score),amount=state.wager.locked?base+state.wager.amount:base;applyScoreDelta(answering,amount,steal?"Steal correct":"Correct");if(pid){state.playerStats[pid].correct++;state.playerStats[pid].gained+=amount;}addHistory(steal?"Steal correct":"Correct",`${teamDisplay(answering)}: +${formatScore(amount)}`);finishNormalResolution();return;}
    const loss=Number(q.score)+(state.wager.locked?state.wager.amount:0);applyScoreDelta(answering,-loss,steal?"Steal wrong":"Wrong");if(pid)state.playerStats[pid].lost+=loss;addHistory(steal?"Steal wrong":"Wrong",`${teamDisplay(answering)}: -${formatScore(loss)}`);
    if(!steal&&!state.hintUsedThisQuestion&&Number(q.score)<HIGH_VALUE_MIN&&state.teams.length>=2){state.stealAvailable=true;state.stealTeamIndex=(state.questionOwnerTeamIndex+1)%state.teams.length;state.currentTeamIndex=state.stealTeamIndex;state.currentAnsweringPlayerId=choosePlayerForTeam(state.stealTeamIndex);renderStealPrompt();startStealTimer(remainingBefore);return;}
    finishNormalResolution();
  }

  function answerRepresentative(i,b){
    if(state.answerLocked||!state.currentQuestion)return;stopTimer();state.answerLocked=true;[...els.answerGrid.children].forEach(x=>x.disabled=true);const q=state.currentQuestion,pid=state.currentAnsweringPlayerId||state.currentPlayerId,ok=i===q.correctAnswer;if(pid)state.playerStats[pid].attempts++;b.classList.add(ok?"correct":"incorrect");if(!ok)els.answerGrid.children[q.correctAnswer]?.classList.add("reveal-correct");
    if(ok){const amount=calculateCorrectAmount(q.score),prev=state.representative.winnings;state.representative.winnings=amount;addHistory("WWTBAM correct",`${teamDisplay(state.currentTeamIndex)}: +${formatScore(Math.max(0,amount-prev))}`);state.representative.safeWinnings=Math.max(state.representative.safeWinnings,REPRESENTATIVE_SAFE[state.representative.questionIndex-1]||0);applyScoreDelta(state.currentTeamIndex,amount-prev,"WWTBAM payout");if(pid){state.playerStats[pid].correct++;state.playerStats[pid].gained+=Math.max(0,amount-prev);}showExplanation(q.note,q.correctAnswer,q.answers);showQuestionContinue(state.representative.questionIndex>=10?"Finish Run":"Continue");renderRepresentativeStatus(els.questionWwtbamStatus);return;}
    const safe=state.representative.safeWinnings,delta=safe-state.representative.winnings;applyScoreDelta(state.currentTeamIndex,delta,"WWTBAM wrong");addHistory("WWTBAM wrong",`${teamDisplay(state.currentTeamIndex)}: ${delta>=0?"+":""}${formatScore(delta)}`);state.representative.winnings=safe;if(pid)state.playerStats[pid].lost+=Math.max(0,-delta);loseRepresentativeLife("Wrong answer");showExplanation(q.note,q.correctAnswer,q.answers);showQuestionContinue("Continue");renderRepresentativeStatus(els.questionWwtbamStatus);renderEffects(els.repEffects);
  }

  function finishNormalResolution(){
    state.stealAvailable=false;state.stealTeamIndex=null;state.resolutionComplete=true;if(state.currentSource!=="jeopardy_special")state.normalAnswered++;
    showExplanation(state.currentQuestion.note,state.currentQuestion.correctAnswer,state.currentQuestion.answers);
    renderScoreboard(els.questionScoreboard);renderQuestionTimer();refreshHintButton();renderHintRiskPanels();renderEffects(els.questionEffects);
    showQuestionContinue("Continue");
  }

  function renderStealPrompt(){
    els.questionActions.querySelector(".runtime-steal")?.remove();
    const box=document.createElement("div");box.className="runtime-box runtime-steal";box.innerHTML=`<strong>${escapeHtml(teamDisplay(state.currentTeamIndex))} • STEAL</strong><span>10 seconds added. Correct earns the question value. Wrong loses the question value.</span>`;els.questionActions.prepend(box);
    const p=player(state.currentAnsweringPlayerId);els.questionPlayer.textContent=teamDisplay(state.currentTeamIndex);if(els.questionAnswerer)els.questionAnswerer.textContent=`STEAL • ${p?.name||"Player"}`;
    [...els.answerGrid.children].forEach(b=>{b.disabled=false;b.classList.remove("incorrect","correct","reveal-correct");});
    state.answerLocked=false;renderScoreboard(els.questionScoreboard);renderHintRiskPanels();refreshHintButton();
  }

  function calculateCorrectAmount(value){let amount=state.currentSource==="representative"?REPRESENTATIVE_LADDER[Math.max(0,state.representative.questionIndex-1)]:Number(value);const e=state.currentEvent?.effect;if(e?.type==="flat_bonus")amount+=randomInt(Number(e.min)||0,Number(e.max)||0);if(e?.type==="score_multiplier")amount=Math.round(amount*randomFloat(Number(e.min)||1,Number(e.max)||1));if(e?.type==="double_or_nothing")amount*=2;return Math.round(amount);}
  function getWagerMax(){return Math.min(Number(state.currentQuestion?.score||0),1000,Math.max(0,Number(team()?.score||0)));}
  function renderWagerStatus(){
    els.questionActions.querySelector(".wager-status")?.remove();
    if(state.currentEvent?.effect?.type!=="wager"||!state.wager.locked)return;
    const d=document.createElement("div");d.className="wager-status";d.innerHTML=`<strong>WAGER LOCKED</strong><span>${formatScore(state.wager.amount)} risked on this question.</span>`;els.questionActions.prepend(d);
  }
  function renderEventWagerControls(){
    if(state.currentEvent?.effect?.type!=="wager"){
      els.eventWagerControls?.classList.add("hidden");return;
    }
    const max=getWagerMax();
    els.eventWagerControls?.classList.remove("hidden");
    if(els.eventWagerInput){els.eventWagerInput.max=String(max);els.eventWagerInput.value=state.wager.locked?String(state.wager.amount):"0";els.eventWagerInput.disabled=state.wager.locked;}
    if(els.eventWagerLock){els.eventWagerLock.disabled=state.wager.locked;els.eventWagerLock.textContent=state.wager.locked?`Locked ${formatScore(state.wager.amount)}`:"Lock Wager";}
    if(els.eventWagerLimit)els.eventWagerLimit.textContent=`Maximum ${formatScore(max)} • whole numbers only`;
  }
  function lockEventWager(){
    if(state.currentEvent?.effect?.type!=="wager")return;
    const max=getWagerMax(),n=Number(els.eventWagerInput?.value);
    if(!Number.isInteger(n)||n<0||n>max)return toast(`Enter a whole number from $0 to ${formatScore(max)}.`);
    state.wager={active:true,locked:true,amount:n};
    renderEventWagerControls();renderWagerStatus();renderEventBanner();
    if(els.eventClose){els.eventClose.disabled=false;els.eventClose.textContent="Continue";}
    addHistory("Wager locked",`${teamDisplay(state.questionOwnerTeamIndex)}: ${formatScore(n)}`);toast(`Wager locked at ${formatScore(n)}.`);
    els.eventWagerInput?.blur();
  }

  function triggerEvent(value,category="") {
    if(!state.events.length)return;
    const teamIndex=state.questionOwnerTeamIndex ?? state.currentTeamIndex;
    const teamId=teamKey(teamIndex);
    const triggerChance=clamp(Number(state.eventChance)||BASE_EVENT_CHANCE,BASE_EVENT_CHANCE,EVENT_CAP);

    // A team that has already received an event must first pass a 50/50 fairness gate
    // before the normal event-trigger roll is made again. This gate is per team and
    // remains active for the rest of the game after that team's first event.
    if(state.eventTriggeredTeams.has(teamId) && Math.random() >= 0.5){
      state.eventChance=clamp(triggerChance+EVENT_RAMP,BASE_EVENT_CHANCE,EVENT_CAP);
      addHistory("Event fairness gate",`${teamDisplay(teamIndex)} failed the 50/50 repeat-event gate`);
      return;
    }

    if(Math.random()>=triggerChance){
      state.eventChance=clamp(triggerChance+EVENT_RAMP,BASE_EVENT_CHANCE,EVENT_CAP);
      return;
    }
    const eligible=state.events.map(e=>({e,w:Math.max(0,eventWeight(e,Number(value),category))})).filter(x=>x.w>0);
    if(!eligible.length)return;
    let total=eligible.reduce((sum,x)=>sum+x.w,0),r=Math.random()*total,chosen=eligible[eligible.length-1].e;
    for(const x of eligible){r-=x.w;if(r<=0){chosen=x.e;break;}}
    state.currentEvent=chosen;
    state.currentEventTriggerChance=triggerChance;
    state.currentEventValue=Number(value);
    state.eventChance=BASE_EVENT_CHANCE;
    state.eventTriggeredTeams.add(teamId);
    addHistory("Event triggered",`${chosen.name} on ${formatScore(value)} • ${Math.round(triggerChance*100)}% trigger chance`);
    showEventOverlay(chosen);
  }

  function eventWeight(e,v,category="") {
    const type=e.effect?.type;
    const mult=["score_multiplier","double_or_nothing"].includes(type);
    let base=e.weightByValue&&Number.isFinite(Number(e.weightByValue[v]))?Number(e.weightByValue[v]):(mult?({250:10,500:8,750:6,1000:4,1250:2,1500:1}[v]||1):({250:5,500:5,750:5,1000:4,1250:3,1500:2}[v]||2));

    // Multiplier-style events fall off sharply as the question becomes more valuable.
    if(mult){
      const multiplierPenalty={250:1.15,500:1.05,750:0.90,1000:0.65,1250:0.45,1500:0.30}[v]||0.30;
      base*=multiplierPenalty;
      if(String(category).trim().toLowerCase()==="philosophy")base*=0.45;
    }

    // Wager remains a deliberate 2nd/3rd-tier outcome on $1,000+ questions rather
    // than collapsing in weight as the question value rises.
    if(type==="wager"){
      const wagerWeight={250:6,500:6,750:5.5,1000:3.2,1250:2.6,1500:2.2}[v]??3;
      return wagerWeight;
    }
    return base;
  }
  function eventEffectText(e){const x=e.effect||{};if(x.type==="wager")return"Set a wager before answering.";if(x.type==="score_multiplier")return`Correct payout: ×${x.min}–×${x.max}`;if(x.type==="flat_bonus")return`Correct payout: +$${x.min}–$${x.max}`;if(x.type==="double_or_nothing")return"Correct payout is doubled.";return"Active for this question.";}
  function showEventOverlay(e){
    state.timer.paused=true;els.eventTitle.textContent=e.name||"Event";els.eventDescription.textContent=e.description||"";els.eventEffect.textContent=eventEffectText(e);
    if(els.eventTriggerChance)els.eventTriggerChance.textContent="Event triggered on this question.";
    state.wager={active:false,locked:false,amount:0};
    renderEventWagerControls();
    if(els.eventClose){els.eventClose.disabled=e.effect?.type==="wager";els.eventClose.textContent=e.effect?.type==="wager"?"Lock a wager to continue":"Continue";}
    els.eventOverlay.classList.remove("hidden");
  }

  function closeEventOverlay(){
    if(state.currentEvent?.effect?.type==="wager"&&!state.wager.locked){toast("Lock a whole-number wager before continuing.");els.eventWagerInput?.focus();return;}
    els.eventOverlay.classList.add("hidden");
    if(state.timer.running&&!state.answerLocked)state.timer.paused=false;
  }
  function renderEventBanner(){
    if(!els.questionMysteryEvent)return;
    if(state.currentSource==="jeopardy_special"){els.questionMysteryEvent.textContent="MYSTERY QUESTION • NO EVENTS";els.questionMysteryEvent.disabled=true;return;}
    if(state.currentSource==="papa"){els.questionMysteryEvent.textContent="BIRTHDAY BOY • NO NORMAL EVENTS";els.questionMysteryEvent.disabled=true;return;}
    els.questionMysteryEvent.disabled=false;
    if(!state.currentEvent){els.questionMysteryEvent.textContent="EVENT";els.questionMysteryEvent.dataset.active="false";return;}
    const wagerLocked=state.currentEvent.effect?.type==="wager"&&state.wager.locked;
    els.questionMysteryEvent.textContent=wagerLocked?`EVENT • ${state.currentEvent.name} • WAGER ${formatScore(state.wager.amount)}`:`EVENT • ${state.currentEvent.name}`;els.questionMysteryEvent.dataset.active="true";
  }

  function currentPenaltyChance(teamIndex){return clamp(Number(state.hintPenaltyChance[teamKey(teamIndex)]??HINT_BASE_PENALTY_CHANCE),HINT_BASE_PENALTY_CHANCE,HINT_PENALTY_CAP);}
  function advancePenaltyChance(teamIndex){const k=teamKey(teamIndex),now=currentPenaltyChance(teamIndex);state.hintPenaltyChance[k]=clamp(now+0.10,HINT_BASE_PENALTY_CHANCE,HINT_PENALTY_CAP);}
  function useHint(){
    const q=state.currentQuestion,pid=state.currentAnsweringPlayerId||state.currentPlayerId;
    if(!q||state.answerLocked||state.stealAvailable)return;
    if(state.currentSource!=="jeopardy")return;
    if(Number(q.score)>=HIGH_VALUE_MIN)return useHighValue5050();
    if(!pid)return;
    const teamIndex=state.questionOwnerTeamIndex,chance=currentPenaltyChance(teamIndex);
    const removable=[...els.answerGrid.children].filter((b,i)=>i!==Number(q.correctAnswer)&&!b.disabled&&!b.classList.contains("hint-removed"));
    if(!removable.length){refreshHintButton();return toast("There are no more wrong answers to remove.");}
    const target=randomItem(removable);target.classList.add("hint-removed");target.disabled=true;state.hintUsedThisQuestion=true;state.playerStats[pid].hints++;
    addHistory("Hint used",`${player(pid)?.name||"Player"}: ${Math.round(chance*100)}% penalty chance`);
    if(Math.random()<chance){
      state.playerStats[pid].penaltiesTriggered++;toast(`Hint penalty triggered at ${Math.round(chance*100)}%. Spin the penalty wheel.`);triggerPenalty(state.teams[teamIndex],player(pid));
    }else{
      const increase=randomInt(10,16)/100;state.hintPenaltyChance[teamKey(teamIndex)]=clamp(chance+increase,HINT_BASE_PENALTY_CHANCE,HINT_PENALTY_CAP);
      toast(`Hint succeeded. Normal penalty chance increased by ${Math.round(increase*100)}% to ${Math.round(currentPenaltyChance(teamIndex)*100)}%.`);
    }
    refreshHintButton();renderHintRiskPanels();
  }

  function useHighValue5050(){
    const q=state.currentQuestion,pid=state.currentAnsweringPlayerId||state.currentPlayerId;
    if(!q||state.answerLocked||state.currentSource!=="jeopardy"||Number(q.score)<HIGH_VALUE_MIN||!pid)return;
    if(state.highValue50UsedPlayers.has(pid))return toast("This player has already used their one-time 50/50.");
    state.highValue50UsedPlayers.add(pid);
    const actual=currentPenaltyChance(state.questionOwnerTeamIndex);
    const risk=clamp(FIFTY_BASE_PENALTY_CHANCE+(actual/2),FIFTY_BASE_PENALTY_CHANCE,FIFTY_CAP);
    const wrong=shuffle([0,1,2,3].filter(i=>i!==q.correctAnswer)).slice(0,2);
    wrong.forEach(i=>{els.answerGrid.children[i]?.classList.add("hint-removed");if(els.answerGrid.children[i])els.answerGrid.children[i].disabled=true;});
    state.playerStats[pid].fiftyFifty++;
    addHistory("50/50 used",`${player(pid)?.name||"Player"}: ${Math.round(risk*100)}% penalty risk (50% + half of ${Math.round(actual*100)}%)`);
    if(Math.random()<risk){
      state.hintPenaltyChance[teamKey(state.questionOwnerTeamIndex)]=HINT_BASE_PENALTY_CHANCE;
      state.playerStats[pid].penaltiesTriggered++;
      toast(`50/50 penalty triggered at ${Math.round(risk*100)}%. Spin the penalty wheel.`);
      triggerPenalty(state.teams[state.questionOwnerTeamIndex],player(pid));
    }else{
      advancePenaltyChance(state.questionOwnerTeamIndex);
      toast(`50/50 succeeded. Normal penalty chance is now ${Math.round(currentPenaltyChance(state.questionOwnerTeamIndex)*100)}%.`);
    }
    refreshHintButton();renderHintRiskPanels();
  }

  function renderHintRiskPanels(){
    if(!els.hintRiskContainer)return;
    els.hintRiskContainer.innerHTML=""; const idx=state.questionOwnerTeamIndex??state.currentTeamIndex; const t=state.teams[idx]; if(!t)return;
    const normal=Math.round(currentPenaltyChance(idx)*100); const highRisk=Math.round(clamp(FIFTY_BASE_PENALTY_CHANCE+currentPenaltyChance(idx)/2,FIFTY_BASE_PENALTY_CHANCE,FIFTY_CAP)*100); const p=player(state.currentAnsweringPlayerId||state.currentPlayerId);
    const mode=state.currentSource==="jeopardy"&&state.currentQuestion?(Number(state.currentQuestion.score)>=HIGH_VALUE_MIN?`50/50 risk ${highRisk}%`:`Hint penalty chance ${normal}%`):`Penalty chance ${normal}%`;
    const d=document.createElement("div");d.className="mechanic-card";d.innerHTML=`<span>${escapeHtml(teamDisplay(idx))}${p?` • ${escapeHtml(p.name)}`:""}</span><strong>${mode}</strong><small>Risk is applied only when the corresponding mechanic is used.</small>`;els.hintRiskContainer.appendChild(d);
  }

  async function triggerPenalty(targetTeam,triggeringPlayer){
    if(!targetTeam?.playerIds?.length)return toast("No eligible player for the penalty wheel.");if(state.penaltyActive)return;
    state.penaltyActive=true;state.timer.paused=true;const players=targetTeam.playerIds.map(player).filter(Boolean),trigger=triggeringPlayer||player(state.currentAnsweringPlayerId)||players[0],others=players.filter(p=>p.id!==trigger.id);
    const entries=players.map(p=>({value:p,name:p.name,weight:p.id===trigger.id?(players.length===1?100:70):(players.length===1?0:30/others.length)}));const affected=weightedChoice(entries);const type=weightedChoice([{value:"curse",name:"CURSE",weight:50},{value:"punishment",name:"PUNISHMENT",weight:50}]);state.penaltySequence={trigger,affected,type,team:targetTeam,entries};await runPenaltySequence();
  }

  function weightedChoice(items){const total=items.reduce((s,x)=>s+x.weight,0);let r=Math.random()*total;for(const x of items){r-=x.weight;if(r<0)return x.value;}return items.at(-1).value;}
  async function runPenaltySequence(){const s=state.penaltySequence;showPenaltyCutscene("Penalty triggered","PENALTY","⚠",`${s.trigger.name} triggered a penalty.`,"");await spinWheel(s.entries,s.affected,"AFFECTED PLAYER","70% to the triggering player • 30% shared by teammates");showPenaltyCutscene("Player selected","PLAYER","🎯",s.affected.name,"The wheel selected the affected player.");await new Promise(r=>setTimeout(r,500));await spinWheel([{value:"curse",name:"CURSE",weight:50},{value:"punishment",name:"PUNISHMENT",weight:50}],s.type,"PENALTY TYPE","50% Curse • 50% Punishment");let result;if(s.type==="curse")result=revealCurse(s.affected,s.team);else result=revealPunishment(s.affected,s.team);if(!result)result=revealPunishment(s.affected,s.team);showPenaltyCutscene("Result",s.type.toUpperCase(),s.type==="curse"?"☠":"!",result.name,result.description||result.effect||"");els.penaltyClose.classList.remove("hidden");}
  function showPenaltyCutscene(stage,type,icon,title,effect){els.penaltyStage.textContent=stage;els.penaltyType.textContent=type;els.penaltyIcon.textContent=icon;els.penaltyTitle.textContent=title;els.penaltyDescription.textContent=effect||"";els.penaltyEffect.textContent="";els.penaltyOverlay.classList.remove("hidden");els.penaltyClose.classList.add("hidden");}
  function closePenalty(){els.penaltyOverlay.classList.add("hidden");state.penaltyActive=false;state.penaltySequence=null;if(state.timer.running&&!state.answerLocked)state.timer.paused=false;renderAll();}
  function buildWheel(entries,target,title){
    const wrap=document.createElement("div");wrap.className="wheel-stage";const canvas=document.createElement("canvas");canvas.width=620;canvas.height=620;canvas.className="penalty-wheel-canvas";const ctx=canvas.getContext("2d"),cx=310,cy=310,r=276,slice=Math.PI*2/entries.length;let angle=-Math.PI/2;const total=entries.reduce((a,e)=>a+e.weight,0)||1;
    entries.forEach((e,i)=>{ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,r,angle,angle+slice);ctx.closePath();ctx.fillStyle=i%2?"#24395f":"#5a3158";ctx.fill();ctx.strokeStyle="#ffffff88";ctx.lineWidth=2;ctx.stroke();ctx.save();ctx.translate(cx,cy);ctx.rotate(angle+slice/2);ctx.textAlign="right";ctx.textBaseline="middle";ctx.fillStyle="#fff";ctx.font="900 20px system-ui";ctx.fillText(String(e.name||e.value).slice(0,18),r-28,-8);ctx.font="800 14px system-ui";ctx.fillStyle="#ffffffb8";ctx.fillText(`${Math.round(e.weight/total*100)}%`,r-28,16);ctx.restore();angle+=slice;});ctx.beginPath();ctx.arc(cx,cy,r+2,0,Math.PI*2);ctx.strokeStyle="#ffffff55";ctx.lineWidth=7;ctx.stroke();ctx.beginPath();ctx.arc(cx,cy,67,0,Math.PI*2);ctx.fillStyle="#0b1221";ctx.fill();ctx.strokeStyle="#fff";ctx.lineWidth=3;ctx.stroke();ctx.fillStyle="#fff";ctx.textAlign="center";ctx.font="900 17px system-ui";ctx.fillText(title,cx,cy);
    const pointer=document.createElement("div");pointer.className="wheel-pointer";pointer.textContent="▼";wrap.append(canvas,pointer);return {wrap,canvas};
  }
  async function spinWheel(entries,target,title,subtitle){const box=document.createElement("div");box.className="wheel-overlay-inner";box.innerHTML=`<div class="wheel-heading">${escapeHtml(title)}</div><div class="wheel-subtitle">${escapeHtml(subtitle)}</div>`;const v=buildWheel(entries,target,title);box.appendChild(v.wrap);els.penaltyEffectHost.innerHTML="";els.penaltyEffectHost.appendChild(box);els.penaltyOverlay.classList.remove("hidden");const idx=Math.max(0,entries.findIndex(e=>(e.value?.id||e.value)===(target?.id||target))),deg=360/entries.length,pad=Math.min(8,deg*.12),targetAngle=idx*deg+pad+Math.random()*Math.max(1,deg-pad*2),rotation=6*360+(360-targetAngle);v.canvas.style.transform="rotate(0deg)";v.canvas.offsetHeight;v.canvas.style.transition="transform 3.3s cubic-bezier(.08,.72,.15,1)";v.canvas.style.transform=`rotate(${rotation}deg)`;await new Promise(r=>setTimeout(r,3450));}
  function revealCurse(p,t){
    if(!state.curses.length)return null; const c=randomItem(state.curses); const active={curseId:c.id,targetPlayer:p.id,teamId:t.id,displayText:`${p.name}: ${c.name}`};
    if(c.id==="forbidden-word")active.displayText+=` — Forbidden word: "${randomItem(["okay","literally","bro","actually","really"])}"`;
    if(c.id==="nickname")active.displayText+=` — Must be called "${randomItem(["Captain","Boss","Chief","Professor","Legend"])}"`;
    state.activeCurses.push(active);addHistory("Curse applied",active.displayText);
    if(state.activeCurses.length>=15&&!state.curseOverloadTriggered){state.curseOverloadTriggered=true;for(const t of state.teams){const k=t.id;state.hintPenaltyChance[k]=clamp(currentPenaltyChance(state.teams.indexOf(t))+0.10,HINT_BASE_PENALTY_CHANCE,HINT_PENALTY_CAP);}addHistory("Curse overload",`${state.activeCurses.length} active curses • all teams +10 percentage points to normal penalty chance`);toast("CURSE OVERLOAD: 15 active curses. Every team’s penalty chance increased by 10%.");}
    renderCurseLists();return{name:c.name,description:c.description,effect:active.displayText};
  }

  function revealPunishment(p,t){const pool=state.punishments.filter(x=>Array.isArray(x.ageGroups)&&x.ageGroups.includes(p.ageGroup));if(!pool.length)return{name:"No eligible punishment",description:"No punishment matched this player's age group."};const x=randomItem(pool);addHistory("Punishment applied",`${p.name}: ${x.name}`);return{name:x.name,description:x.description,effect:`${p.name} • ${x.description||"Punishment"}`};}

  function showExplanation(note,correct,answers){els.explanationText.textContent=String(note||"").trim()||`Correct answer: ${answers?.[correct]||"Unknown"}`;els.explanation.classList.remove("hidden");}
  function hideExplanation(){els.explanation.classList.add("hidden");els.explanationText.textContent="";}
  function renderEffects(container){
    if(!container)return;
    const cards=[];
    // Both teams' penalty chances remain visible at all times so the host can see the
    // risk for either team without having to switch the active team.
    state.teams.forEach((t,i)=>{
      cards.push(`<div class="effect-card"><strong>${escapeHtml(teamDisplay(i))}</strong><span>Hint penalty chance ${Math.round(currentPenaltyChance(i)*100)}%</span><small>Risk is applied only when the corresponding mechanic is used.</small></div>`);
    });
    // Normal Events are question-scoped and therefore disappear as soon as the question is left.
    if(state.currentEvent && state.currentSource==="jeopardy")cards.push(`<div class="effect-card"><strong>EVENT • ${escapeHtml(state.currentEvent.name)}</strong><span>${escapeHtml(eventEffectText(state.currentEvent))}</span><small>Question-scoped • triggered at ${Math.round(state.currentEventTriggerChance*100)}%</small></div>`);
    // Mystery Events are separate from normal Events. Their persistent record is only the unlock result/count.
    const mysteryCount=Math.min(MYSTERY_QUESTION_POOL_SIZE,state.unlockedSpecialQuestionIds.size);
    if(state.mode==="jeopardy"){
      const mysteryText=state.lastMysteryEvent?.text||"No mystery-question unlock has triggered yet.";
      cards.push(`<div class="effect-card"><strong>MYSTERY STATUS • ${mysteryCount}/${MYSTERY_QUESTION_POOL_SIZE} UNLOCKED</strong><span>${escapeHtml(mysteryText)}</span><small>Unlock roll occurs only when the Mystery Question menu is opened.</small></div>`);
    }
    if(state.mode==="representative")cards.push(`<div class="effect-card"><strong>WWTBAM</strong><span>${state.representative.lives} lives</span><small>Base revive: ${state.representative.baseReviveAvailable?"READY":"USED"}</small></div>`);
    container.innerHTML=cards.join("")||'<div class="empty-state">No active effects.</div>';
  }
  function curseDetailsHtml(c){
    const p=player(c.targetPlayer); const t=state.teams.find(x=>x.id===c.teamId);
    const definition=state.curses.find(x=>x.id===c.curseId);
    return `<div class="curse-detail-card"><span class="eyebrow">ACTIVE CURSE</span><h2>${escapeHtml(definition?.name||c.curseId||"Curse")}</h2><p>${escapeHtml(definition?.description||"This curse remains active for the game and cannot be manually removed.")}</p><div class="curse-detail-meta"><strong>${escapeHtml(p?.name||"Unknown player")}</strong><span>${escapeHtml(t?teamDisplay(t):"Unassigned")}</span></div><div class="curse-detail-effect">${escapeHtml(c.displayText)}</div><small>Curses cannot be manually broken.</small></div>`;
  }
  function openCurseDetails(c=null){
    const target=c||state.activeCurses.find(x=>x.targetPlayer===state.selectedCursePlayerId)||state.activeCurses[0];
    const modal=document.querySelector("#curse-details-modal"),body=document.querySelector("#curse-details-body");
    if(!modal||!body)return;
    if(target) body.innerHTML=curseDetailsHtml(target);
    else body.innerHTML='<div class="empty-state">No active curses.</div>';
    modal.classList.remove("hidden");
  }
  function renderCurseList(){
    const containers=[els.jeopardyCurses,els.repCurses,els.questionCurses].filter(Boolean); containers.forEach(container=>{
      container.innerHTML="";
      const heading=container.closest(".sidebar-section")?.querySelector(".sidebar-heading-row span");
      if(heading) heading.textContent=state.activeCurses.length?`ACTIVE • ${state.activeCurses.length}`:"ACTIVE";
      if(!state.activeCurses.length){container.innerHTML='<div class="empty-state">No active curses.</div>';return;}
      state.activeCurses.forEach(c=>{const d=document.createElement("button");d.type="button";d.className="curse-row";d.innerHTML=`<strong>${escapeHtml(c.displayText)}</strong><small>${escapeHtml(player(c.targetPlayer)?.name||"Player")} • ${escapeHtml(teamDisplayById(c.teamId))}</small>`;d.onclick=()=>openCurseDetails(c);container.appendChild(d);});
      const view=document.createElement("button");view.type="button";view.className="curse-view-button";view.textContent=`View Curse Details (${state.activeCurses.length})`;view.onclick=()=>openCurseDetails();container.appendChild(view);
    });
  }
  function renderCurseLists(){ renderCurseList(); }

  function startTimer(seconds,mode="normal"){
    stopTimer(); state.timer.remaining=Math.max(0,Math.ceil(Number(seconds)||0)); state.timer.mode=mode; state.timer.running=true; state.timer.paused=false; state.timer.expired=false; renderQuestionTimer();
    state.timer.id=setInterval(()=>{if(!state.timer.running||state.timer.paused)return;state.timer.remaining=Math.max(0,state.timer.remaining-1);if(state.timer.remaining<=0){state.timer.running=false;state.timer.expired=true;state.timer.paused=false;renderQuestionTimer();if(state.timer.id)clearInterval(state.timer.id);state.timer.id=null;handleTimeout();return;}renderQuestionTimer();},1000);
  }

  function startStealTimer(remainingBeforeAnswer){ const base=Math.max(0,Number(remainingBeforeAnswer ?? state.timer.remaining)); startTimer(base+10,"steal"); }

  function stopTimer(){if(state.timer.id)clearInterval(state.timer.id);state.timer.id=null;state.timer.running=false;state.timer.paused=false;}

  function renderQuestionTimer(){
    let t=$("#runtime-timer");if(!t){t=document.createElement("div");t.id="runtime-timer";t.className="runtime-timer";els.questionActions?.prepend(t);}if(!t)return;
    const total=Math.max(0,Number(state.timer.remaining)||0),mm=String(Math.floor(total/60)).padStart(2,"0"),ss=String(total%60).padStart(2,"0");t.textContent=`TIME ${mm}:${ss}`;t.classList.toggle("warning",state.timer.running&&total<=10);t.classList.toggle("expired",state.timer.expired);
  }

  function renderQuestionTimerText(){ renderQuestionTimer(); }

  function handleTimeout(){
    if(!state.currentQuestion||state.answerLocked)return; state.answerLocked=true; [...els.answerGrid.children].forEach(b=>b.disabled=true); const q=state.currentQuestion;
    if(state.currentSource==="papa"){ addHistory("Birthday Boy timeout",`${teamDisplay(state.questionOwnerTeamIndex)}: ${state.papa.correctCount}/3 before timeout`);showExplanation(q.questions[state.papa.subIndex]?.note,q.questions[state.papa.subIndex]?.correctAnswer,q.questions[state.papa.subIndex]?.answers); if(state.papa.subIndex<2){showQuestionContinue("Next Birthday Boy Question");}else finishPapaBundle();renderQuestionTimer();return; }
    if(state.currentSource==="representative"){ showExplanation(q.note,q.correctAnswer,q.answers); loseRepresentativeLife("Time expired"); showQuestionContinue(state.representative.runEnded?"Finish Run":"Continue");renderRepresentativeStatus(els.questionWwtbamStatus);return; }
    if(state.stealAvailable){state.stealAvailable=false;state.stealTeamIndex=null;addHistory("Steal timeout",teamDisplay(state.currentTeamIndex));toast("Steal time expired.");finishNormalResolution();return;}
    applyScoreDelta(state.questionOwnerTeamIndex,-Number(q.score),"Timeout");addHistory("Timeout",`${teamDisplay(state.questionOwnerTeamIndex)}: -${formatScore(q.score)}`);const pid=state.currentAnsweringPlayerId||state.currentPlayerId;if(pid){state.playerStats[pid].attempts++;state.playerStats[pid].lost+=Number(q.score);}state.resolutionComplete=true;state.normalAnswered++;showExplanation(q.note,q.correctAnswer,q.answers);showQuestionContinue("Continue");renderScoreboard(els.questionScoreboard);renderQuestionTimer();
  }

  function forceEndQuestion(){
    if(!state.currentQuestion||state.answerLocked)return;
    const q=state.currentQuestion,source=state.currentSource;
    state.usedQuestionIds.add(String(q.id));
    stopTimer();closeAllTransientOverlays();
    state.currentQuestion=null;state.currentSource=null;state.currentEvent=null;state.currentEventTriggerChance=BASE_EVENT_CHANCE;state.currentEventValue=0;
    state.answerLocked=true;state.resolutionComplete=false;state.stealAvailable=false;state.stealTeamIndex=null;state.wager={active:false,locked:false,amount:0};
    addHistory("Question force-ended",`${q.category} • ${formatScore(q.score)} • permanently used; no score or question progress`);
    toast("Question force-ended. It is permanently used and did not affect the score.");
    if(source==="representative"){
      state.representative.questionIndex=Math.max(0,state.representative.questionIndex-1);
      renderRepresentativeMode();showScreen(screens.categories);
    }else{
      renderJeopardy();showScreen(screens.jeopardy);
    }
  }

  function continueQuestion(){
    if(!state.currentQuestion||!state.answerLocked)return;
    closeEventOverlay();
    if(!state.currentQuestion)return;
    if(state.currentSource==="papa"){if(state.papa.subIndex<2){const rem=Math.max(1,state.timer.remaining);state.papa.subIndex++;state.answerLocked=false;hideQuestionContinue();renderPapaSubQuestion();startTimer(rem,"papa");return;}state.currentQuestion=null;state.currentSource=null;stopTimer();finishIfComplete();return;}
    const wasRep=state.currentSource==="representative"; const repFinished=state.representative.runEnded||state.representative.questionIndex>=10; state.currentQuestion=null;state.currentSource=null;stopTimer();
    if(wasRep){if(repFinished)return finishRepresentativeRun("run ended");return openRepresentativeQuestion();}
    if(gameComplete())return showResults();advanceTurn();renderJeopardy();showScreen(screens.jeopardy);
  }

  function finishIfComplete(){if(gameComplete())showResults();else{advanceTurn();renderJeopardy();showScreen(screens.jeopardy);}}

  function renderScoreboard(container){if(!container)return;container.innerHTML="";state.teams.forEach((t,i)=>{const d=document.createElement("div");d.className=`score-card ${i===state.currentTeamIndex?"active":""}`;d.innerHTML=`<div class="score-card-head"><span>${escapeHtml(teamDisplay(i))}</span><strong>${formatScore(t.score)}</strong></div>`;d.addEventListener("click",()=>{state.currentTeamIndex=i;renderScoreboard(container);renderCurseLists();renderHintRiskPanels();});container.appendChild(d);});}

  function statRows(){return state.players.map(p=>{const s=state.playerStats[p.id]||{attempts:0,correct:0,gained:0,lost:0,hints:0,fiftyFifty:0,penaltiesTriggered:0};return{p,s,accuracy:s.attempts?100*s.correct/s.attempts:0,team:playerTeamLabel(p)};});}

  function renderLeaderboard(container){if(!container)return;const rows=[...state.teams].sort((a,b)=>b.score-a.score);container.innerHTML=`<div class="leaderboard-compact">${rows.map((t,i)=>`<div class="leader-row"><span>${i+1}</span><span>${escapeHtml(teamDisplay(t))}</span><strong>${formatScore(t.score)}</strong></div>`).join("")}</div><button class="leaderboard-open" type="button">Open Detailed Leaderboard</button>`;container.querySelector(".leaderboard-open")?.addEventListener("click",openLeaderboardModal);}

  function detailedLeaderboardHtml(){
    const rows=statRows();
    const make=(title,sort,fmt,filter=()=>true)=>{const x=rows.filter(filter).sort(sort);return `<section class="detail-board"><h3>${title}</h3>${x.length?x.map((r,i)=>`<div class="detail-row"><span>${i+1}</span><div><strong>${escapeHtml(r.p.name)}</strong><small>${escapeHtml(r.team)}</small></div><span>${fmt(r)}</span></div>`).join(""):"<div class='empty-state'>No data yet.</div>"}</section>`;};
    const teamBoards=state.teams.map((t,i)=>{const members=t.playerIds.map(player).filter(Boolean);return `<section class="detail-board team-detail"><h3>${escapeHtml(teamDisplay(i))}</h3><div class="team-stat-line"><span>Score</span><strong>${formatScore(t.score)}</strong></div><details><summary>Players ${members.length}</summary><div class="team-member-list">${members.length?members.map(p=>`<button type="button" class="team-member" data-player-detail="${p.id}"><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.ageGroup)}</small></button>`).join(""):"<div class='empty-state'>No players.</div>"}</div></details></section>`;}).join("");
    return `<div class="detail-grid">${teamBoards}${make("CONTRIBUTION",(a,b)=>b.s.gained-a.s.gained,r=>formatScore(r.s.gained),r=>r.s.gained>0)}${make("ACCURACY",(a,b)=>b.accuracy-a.accuracy,r=>`${r.accuracy.toFixed(1)}%`,r=>r.s.attempts>0)}${make("MOST LOST",(a,b)=>b.s.lost-a.s.lost,r=>`-${formatScore(r.s.lost).slice(1)}`,r=>r.s.lost>0)}${make("MOST HINTS USED",(a,b)=>b.s.hints-a.s.hints,r=>String(r.s.hints),r=>r.s.hints>0)}</div>`;
  }

  function openLeaderboardModal(){if(!els.leaderboardModal)return;els.leaderboardModalBody.innerHTML=detailedLeaderboardHtml();els.leaderboardModal.classList.remove("hidden");els.leaderboardModalBody.querySelectorAll("[data-player-detail]").forEach(b=>b.addEventListener("click",()=>{const p=player(b.dataset.playerDetail);state.selectedCursePlayerId=p?.id||null;toast(p?`${p.name} selected.`:"Player selected.");renderCurseLists();}));}

  function closeLeaderboardModal(){els.leaderboardModal?.classList.add("hidden");}
  function openRosterModal(){if(!els.rosterModal)return;els.rosterBody.innerHTML=state.teams.map((t,i)=>{const members=t.playerIds.map(player).filter(Boolean);return `<section class="roster-team"><h2>${escapeHtml(teamDisplay(i))}</h2>${members.length?members.map(p=>`<div class="roster-player"><strong>${escapeHtml(p.name)}</strong><span>${escapeHtml(p.ageGroup)}</span></div>`).join(""):"<div class='empty-state'>No players assigned.</div>"}</section>`;}).join("")+(()=>{const u=state.players.filter(p=>!p.teamId);return u.length?`<section class="roster-team"><h2>Unassigned</h2>${u.map(p=>`<div class="roster-player"><strong>${escapeHtml(p.name)}</strong><span>${escapeHtml(p.ageGroup)}</span></div>`).join("")}</section>`:"";})();els.rosterModal.classList.remove("hidden");}
  function closeRosterModal(){els.rosterModal?.classList.add("hidden");}
  function openEventWeightsModal(){if(!els.eventWeightsModal||!els.eventWeightsBody)return;els.eventWeightsBody.innerHTML=NORMAL_VALUES.map(v=>`<section class="weight-tier"><h3>${formatScore(v)}</h3>${state.events.map(e=>`<div class="weight-row"><span>${escapeHtml(e.name||e.id)}</span><strong>${eventWeight(e,v)}</strong></div>`).join("")||'<div class="empty-state">No events loaded.</div>'}</section>`).join("");els.eventWeightsModal.classList.remove("hidden");}
  function closeEventWeightsModal(){els.eventWeightsModal?.classList.add("hidden");}
  function renderHistory(container){if(!container)return;container.innerHTML=state.history.slice(0,18).map(h=>`<div class="history-row"><strong>${escapeHtml(h.type)}</strong><span>${escapeHtml(h.text)}</span><small>${escapeHtml(h.time)}</small></div>`).join("")||'<div class="empty-state">No history yet.</div>';}
  function renderHistoryAll(){renderHistory(els.jeopardyHistory);renderHistory(els.repHistory);renderHistory(els.questionHistory);}
  function renderAll(){renderJeopardyTopScores();renderScoreboard(els.jeopardyScoreboard);renderScoreboard(els.repScoreboard);renderScoreboard(els.questionScoreboard);renderEffects(els.jeopardyEffects);renderEffects(els.repEffects);renderEffects(els.questionEffects);renderCurseLists();renderLeaderboard(els.jeopardyLeaderboard);renderLeaderboard(els.repLeaderboard);renderLeaderboard(els.questionLeaderboard);renderHistoryAll();renderHintRiskPanels();renderRepresentativeStatus(els.repStatus);renderRepresentativeStatus(els.questionWwtbamStatus);renderLifelineActions();}

  function renderRepresentativeMode(){
    renderScoreboard(els.repScoreboard);renderLeaderboard(els.repLeaderboard);renderHistory(els.repHistory);renderEffects(els.repEffects);renderCurseList();renderRepresentativeStatus(els.repStatus);
    renderTurnBanner();els.repGrid.innerHTML="";
    for(const c of categories()){const b=document.createElement("button");b.type="button";b.className="category-button";b.disabled=state.representative.usedCategories.has(c);b.innerHTML=`<span>${escapeHtml(c)}</span><small>${b.disabled?"Completed":"Start 10-question run"}</small>`;if(!b.disabled)b.onclick=()=>startRepresentativeRun(c);els.repGrid.appendChild(b);}
  }
  function lifelineStateLabel(status){
    return ({available:"AVAILABLE",used:"USED",broken:"BROKEN",broken_after_use:"BROKEN • USED"})[status] || String(status||"").toUpperCase();
  }
  function renderRepresentativeStatus(container){
    if(!container)return;
    const isRep = state.mode === "representative" && (container === els.repStatus || state.currentSource === "representative");
    if(!isRep){container.innerHTML="";container.classList.add("hidden");return;}
    container.classList.remove("hidden");
    const r=state.representative;
    container.innerHTML=`<div class="wwt-status-grid"><div class="lifeline-card ${r.lifelines.fiftyFifty} ${r.selectedLifeline==="fiftyFifty"?"selected":""}" data-lifeline="fiftyFifty" tabindex="0" role="button"><strong>50/50</strong><span>${lifelineStateLabel(r.lifelines.fiftyFifty)}</span></div><div class="lifeline-card ${r.lifelines.callAudience} ${r.selectedLifeline==="callAudience"?"selected":""}" data-lifeline="callAudience" tabindex="0" role="button"><strong>Call Audience</strong><span>${lifelineStateLabel(r.lifelines.callAudience)}</span></div><div class="life-card"><strong>${r.lives}/${r.maxLives}</strong><span>LIVES</span></div><div class="life-card"><strong>${r.baseReviveAvailable?"READY":"USED"}</strong><span>BASE REVIVE</span></div></div><div class="status-help">Click one lifeline to select it. Press <b>Enter</b> to use the selected lifeline or <b>B</b> to break it as host.</div>`;
    container.querySelectorAll("[data-lifeline]").forEach(b=>b.addEventListener("click",()=>{r.selectedLifeline=b.dataset.lifeline;renderRepresentativeStatus(container);renderLifelineActions();}));
  }
  function useRepresentative5050(){
    if(state.currentSource!=="representative"||state.answerLocked)return; const r=state.representative;if(r.lifelines.fiftyFifty!=="available")return toast("50/50 is no longer available.");const q=state.currentQuestion;const wrong=shuffle([0,1,2,3].filter(i=>i!==q.correctAnswer)).slice(0,2);wrong.forEach(i=>{els.answerGrid.children[i]?.classList.add("hint-removed");if(els.answerGrid.children[i])els.answerGrid.children[i].disabled=true;});r.lifelines.fiftyFifty="used";r.selectedLifeline=null;addHistory("WWTBAM 50/50 used",`${player(state.currentAnsweringPlayerId||state.currentPlayerId)?.name||"Player"}`);renderRepresentativeStatus(els.questionWwtbamStatus);renderLifelineActions();
  }
  function useCallAudience(){
    if(state.currentSource!=="representative"||state.answerLocked)return; const r=state.representative;if(r.lifelines.callAudience!=="available")return toast("Call Audience is no longer available.");const q=state.currentQuestion;const correct=q.correctAnswer;const weights=[randomInt(5,15),randomInt(5,15),randomInt(5,15),randomInt(5,15)];weights[correct]+=35;const total=weights.reduce((a,b)=>a+b,0);const votes=weights.map(x=>Math.round(100*x/total));const diff=100-votes.reduce((a,b)=>a+b,0);votes[correct]+=diff;r.lifelines.callAudience="used";r.audienceUsed=true;addHistory("WWTBAM Call Audience used",`${player(state.currentAnsweringPlayerId||state.currentPlayerId)?.name||"Player"}`);if(els.audienceBody)els.audienceBody.innerHTML=`<div class="audience-question">Audience poll</div>${votes.map((v,i)=>`<div class="audience-row"><strong>${String.fromCharCode(65+i)}</strong><div><span style="width:${v}%"></span></div><b>${v}%</b></div>`).join("")}`;els.audienceOverlay?.classList.remove("hidden");renderRepresentativeStatus(els.questionWwtbamStatus);renderLifelineActions();
  }
  function breakRepresentativeLifeline(){
    const r=state.representative,type=r.selectedLifeline;if(!type)return toast("Select a WWTBAM lifeline first.");
    const status=r.lifelines[type],label=type==="fiftyFifty"?"50/50":"Call Audience";
    if(status==="available"){
      r.lifelines[type]="broken";
      addHistory("WWTBAM lifeline broken",`${label} • available lifeline lost`);
      toast(`${label} is broken.`);
    }else if(status==="used"){
      r.lifelines[type]="broken_after_use";
      loseRepresentativeLife(`${label} was already used when broken`);
      toast(`${label} was already used. One life was consumed.`);
    }else{
      toast(`${label} has already been removed from play.`);
    }
    r.selectedLifeline=null;renderRepresentativeStatus(els.repStatus);renderRepresentativeStatus(els.questionWwtbamStatus);renderLifelineActions();
  }
  function loseRepresentativeLife(reason){
    const r=state.representative; if(r.lives>1){r.lives--;addHistory("WWTBAM life lost",`${reason} • ${r.lives} lives remain`);return;}
    if(r.baseReviveAvailable){r.baseReviveAvailable=false;r.baseReviveUsed=true;r.lives=1;addHistory("WWTBAM base revive",`${reason} • revived to 1 life`);return;}
    r.lives=1;addHistory("WWTBAM life floor",`${reason} • lives remain at 1`);
  }
  function renderLifelineActions(){
    if(!els.lifelineActions)return;
    if(state.currentSource!=="representative"){els.lifelineActions.innerHTML="";return;}
    els.lifelineActions.innerHTML='<div class="status-help lifeline-help">Select a lifeline above • <b>Enter</b> use • <b>B</b> break</div>';
  }
  function startRepresentativeRun(c){if(state.representative.usedCategories.has(c))return;state.representative.usedCategories.add(c);state.representative.category=c;state.representative.questionIndex=0;state.representative.winnings=0;state.representative.safeWinnings=0;state.representative.runEnded=false;state.representative.lives=3;state.representative.maxLives=3;state.representative.baseReviveAvailable=true;state.representative.baseReviveUsed=false;state.representative.lifelines={fiftyFifty:"available",callAudience:"available"};state.representative.selectedLifeline=null;state.representative.audienceUsed=false;openRepresentativeQuestion();}

  function openRepresentativeQuestion(){
    if(state.representative.questionIndex>=10)return finishRepresentativeRun("completed");const avail=state.normalQuestions.filter(q=>q.category===state.representative.category&&!state.usedQuestionIds.has(q.id));if(!avail.length)return finishRepresentativeRun("no questions remain");
    const sorted=[...avail].sort((a,b)=>a.score-b.score);const q=sorted[Math.min(sorted.length-1,Math.floor((state.representative.questionIndex/9)*(sorted.length-1)))];state.representative.questionIndex++;state.usedQuestionIds.add(q.id);openQuestion(q,"representative");renderRepresentativeLadder();
  }

  function renderRepresentativeLadder(){const host=$("#representative-question-ladder");if(!host)return;host.innerHTML=`<div class="millionaire-ladder-panel"><strong>Question ${state.representative.questionIndex}/10</strong><div class="ladder-grid">${REPRESENTATIVE_LADDER.map((v,i)=>`<span class="${i===state.representative.questionIndex-1?"current":""}">${formatScore(v)}</span>`).join("")}</div></div>`;}
  function finishRepresentativeRun(reason){state.representative.runEnded=true;state.currentQuestion=null;state.currentSource=null;stopTimer();closeAllTransientOverlays();addHistory("WWTBAM run ended",`${reason}; ${formatScore(state.representative.winnings)} • ${state.representative.lives} lives`);if(state.representative.usedCategories.size>=categories().length)return showResults();advanceTurn();renderRepresentativeMode();showScreen(screens.categories);}

  function renderResults(){const rs=$("#results-summary");if(rs)rs.textContent=`${winConditionLabel()} • ${state.normalAnswered}/${state.settings.normalQuestionLimit} normal questions completed`;els.resultsList.innerHTML="";[...state.teams].sort((a,b)=>b.score-a.score).forEach((t,i)=>{const d=document.createElement("div");d.className="result-row";d.innerHTML=`<span>${i+1}</span><strong>${escapeHtml(teamDisplay(t))}</strong><b>${formatScore(t.score)}</b>`;els.resultsList.appendChild(d);});}

  function showResults(){stopTimer();closeEventOverlay();state.gameStarted=false;renderResults();showScreen(screens.results);}


  function deductForBrokenCurse(teamIndex){
    const t=state.teams[teamIndex];if(!t)return;
    t.score-=500;
    addHistory("Host curse deduction",`${t.name}: -$500`);
    toast(`${t.name} deducted $500 for a broken curse.`);
    renderAll();
    if(screens.jeopardy?.classList.contains("active"))renderJeopardy();
    if(screens.question?.classList.contains("active")){renderScoreboard(els.questionScoreboard);renderLeaderboard(els.questionLeaderboard);renderHistory(els.questionHistory);}
  }

  function bind(){
    els.buttonJeopardy?.addEventListener("click",()=>{resetForNewGame();openSetup("jeopardy");});
    els.buttonRepresentative?.addEventListener("click",()=>{resetForNewGame();openSetup("representative");});
    els.addPlayer?.addEventListener("click",addPlayer);els.playerName?.addEventListener("keydown",e=>{if(e.key==="Enter")addPlayer();});els.playerTeam?.addEventListener("change",()=>{if(state.selectedSetupPlayerId)assignPlayer(state.selectedSetupPlayerId,els.playerTeam.value||null);});els.teamCount?.addEventListener("change",()=>setTeamCount(els.teamCount.value));els.questionLimit?.addEventListener("change",syncSettings);els.winCondition?.addEventListener("change",()=>{syncSettings();renderSetupSettings();});els.targetScore?.addEventListener("change",syncSettings);els.valueRangeBody?.addEventListener("change",syncValueRanges);
    els.setupBack?.addEventListener("click",()=>showScreen(screens.menu));els.startGame?.addEventListener("click",startGame);els.setupViewRoster?.addEventListener("click",openRosterModal);els.jeopardyViewRoster?.addEventListener("click",openRosterModal);els.repViewRoster?.addEventListener("click",openRosterModal);
    els.jeopardyQuestionMenu?.addEventListener("click",()=>openJeopardyQuestionMenu(false));els.jeopardyQuestionMenuClose?.addEventListener("click",()=>els.jeopardyQuestionMenuModal?.classList.add("hidden"));
    els.papaMenuClose?.addEventListener("click",()=>els.papaMenuModal?.classList.add("hidden"));
    els.hostHelpButton?.addEventListener("click",()=>els.hostHelpModal?.classList.remove("hidden"));els.hostHelpClose?.addEventListener("click",()=>els.hostHelpModal?.classList.add("hidden"));
    els.mysteryUnlockClose?.addEventListener("click",()=>{els.mysteryUnlockModal?.classList.add("hidden");openJeopardyQuestionMenu(true);});
    els.eventWagerLock?.addEventListener("click",lockEventWager);els.eventWagerInput?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();lockEventWager();}});
    els.jeopardyMenu?.addEventListener("click",()=>{stopTimer();showScreen(screens.menu);});els.repMenu?.addEventListener("click",()=>{stopTimer();showScreen(screens.menu);});els.questionContinue?.addEventListener("click",continueQuestion);els.questionHint?.addEventListener("click",useHint);
    els.resultsAgain?.addEventListener("click",()=>{resetForNewGame();openSetup(state.mode||"jeopardy");});els.resultsMenu?.addEventListener("click",()=>{resetForNewGame();showScreen(screens.menu);});els.eventClose?.addEventListener("click",closeEventOverlay);els.penaltyClose?.addEventListener("click",closePenalty);els.leaderboardModalClose?.addEventListener("click",closeLeaderboardModal);els.rosterClose?.addEventListener("click",closeRosterModal);els.eventWeightsClose?.addEventListener("click",closeEventWeightsModal);els.audienceClose?.addEventListener("click",()=>els.audienceOverlay?.classList.add("hidden"));els.curseDetailsClose?.addEventListener("click",()=>els.curseDetailsModal?.classList.add("hidden"));
    document.addEventListener("keydown",handleKeyboard);
  }

  function handleKeyboard(e){
    if(e.key==="Escape"){if(!els.leaderboardModal?.classList.contains("hidden")){closeLeaderboardModal();return;}if(!els.rosterModal?.classList.contains("hidden")){closeRosterModal();return;}if(!els.eventWeightsModal?.classList.contains("hidden")){closeEventWeightsModal();return;}if(!els.jeopardyQuestionMenuModal?.classList.contains("hidden")){els.jeopardyQuestionMenuModal.classList.add("hidden");return;}if(!els.papaMenuModal?.classList.contains("hidden")){els.papaMenuModal.classList.add("hidden");return;}if(!els.mysteryUnlockModal?.classList.contains("hidden")){els.mysteryUnlockModal.classList.add("hidden");return;}if(!els.hostHelpModal?.classList.contains("hidden")){els.hostHelpModal.classList.add("hidden");return;}if(!els.audienceOverlay?.classList.contains("hidden")){els.audienceOverlay.classList.add("hidden");return;}if(!els.curseDetailsModal?.classList.contains("hidden")){els.curseDetailsModal.classList.add("hidden");return;}if(!els.penaltyOverlay?.classList.contains("hidden")&&state.penaltyActive)return;if(!els.eventOverlay?.classList.contains("hidden")){closeEventOverlay();return;}}
    const activeSetup=screens.setup?.classList.contains("active"),activeQ=screens.question?.classList.contains("active"),activeJ=screens.jeopardy?.classList.contains("active"),activeR=screens.categories?.classList.contains("active"); if(!activeSetup&&!activeQ&&!activeJ&&!activeR)return;
    if(!e.repeat&&(e.key.toLowerCase()==="l")){openLeaderboardModal();return;}
    if(!e.repeat&&(e.key.toLowerCase()==="t")){openRosterModal();return;}
    if(!e.repeat&&(e.key.toLowerCase()==="o")){openEventWeightsModal();return;}
    const tag=e.target?.tagName;if(!activeSetup&&!(["INPUT","TEXTAREA","SELECT"].includes(tag))&&e.shiftKey&&/^[1-6]$/.test(e.key)&& (activeJ||activeQ||activeR)){
      const idx=Number(e.key)-1;
      if(idx<state.teams.length){e.preventDefault();deductForBrokenCurse(idx);return;}
    }
    if(activeSetup){const tag=e.target?.tagName;if(["INPUT","TEXTAREA","SELECT"].includes(tag))return;if(e.key>="1"&&e.key<="6"&&state.selectedSetupPlayerId){const n=Number(e.key);if(n<=state.teams.length){assignPlayer(state.selectedSetupPlayerId,teamKey(n-1));toast(`${player(state.selectedSetupPlayerId)?.name||"Player"} → ${teamDisplay(n-1)}`);}}return;}
    if(activeQ&&!e.repeat&&!e.shiftKey&&e.key.toLowerCase()==="f"&&!(["INPUT","TEXTAREA","SELECT"].includes(tag))){forceEndQuestion();return;}
    if((activeR||activeQ)&&state.currentSource==="representative"&&!e.repeat&&e.key==="Enter"&&state.representative.selectedLifeline){if(state.representative.selectedLifeline==="fiftyFifty")useRepresentative5050();else if(state.representative.selectedLifeline==="callAudience")useCallAudience();return;}
    if((activeR||activeQ)&&state.currentSource==="representative"&&e.key.toLowerCase()==="b"&&!e.repeat){breakRepresentativeLifeline();return;}
    if(activeQ&&!e.repeat&&!e.shiftKey&&["Enter","c"].includes(e.key)&&state.currentQuestion&&state.answerLocked&&!state.penaltyActive&&(!els.eventOverlay||els.eventOverlay.classList.contains("hidden"))){e.preventDefault();continueQuestion();return;}
    if(state.answerLocked)return;
    const map={"1":0,q:0,"2":1,w:1,"3":2,a:2,"4":3,s:3};
    if(state.currentSource==="jeopardy_special"){map["5"]=4;map["6"]=5;map["7"]=6;map["8"]=7;}
    const k=e.key.toLowerCase();if(activeQ&&k in map){const b=els.answerGrid.children[map[k]];if(b&&!b.disabled)b.click();}
  }

  function initialRender(){setTeamCount(2);renderSetupSettings();renderTeamLists();showScreen(screens.menu);}

  Promise.all([loadData()]).then(()=>{bind();initialRender();}).catch(e=>{console.error(e);document.body.innerHTML='<main style="padding:40px;font-family:system-ui;color:white;background:#080b16;min-height:100vh"><h1>Game data failed to load</h1><p>Required question data could not be loaded. No fallback question pool was used.</p></main>';});
})();
