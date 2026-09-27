/* ===== Constants ===== */
let FOCUS_TIME = 25 * 60;
const SHORT_BREAK = 5 * 60;
const LONG_BREAK = 15 * 60;
const SESSIONS_BEFORE_LONG = 4;

const STORAGE_KEYS = {
  tasks: 'sfd_tasks',
  streak: 'sfd_streak',
  distractions: 'sfd_distractions',
  focusMinutes: 'sfd_focusMinutes',
  soundOn: 'sfd_soundOn'
};

/* ===== State ===== */
let timeLeft = FOCUS_TIME;
let totalTime = FOCUS_TIME;
let isRunning = false;
let isFocus = true;
let sessionCount = 0;
let timerInterval = null;
let soundOn = true;

let tasks = [];
let streakData = { count: 0, lastDate: null };
let distractions = [];
let focusMinutesToday = { date: null, minutes: 0 };

/* ===== DOM ===== */
const timeDisplay = document.getElementById('timeDisplay');
const progressCircle = document.getElementById('progressCircle');
const sessionTypeEl = document.getElementById('sessionType');
const sessionCountEl = document.getElementById('sessionCount');
const startPauseBtn = document.getElementById('startPauseBtn');
const resetBtn = document.getElementById('resetBtn');
const taskForm = document.getElementById('taskForm');
const taskInput = document.getElementById('taskInput');
const taskList = document.getElementById('taskList');
const emptyState = document.getElementById('emptyState');
const completedCountEl = document.getElementById('completedCount');
const pendingCountEl = document.getElementById('pendingCount');
const streakCountEl = document.getElementById('streakCount');
const streakHint = document.getElementById('streakHint');
const flameEl = document.getElementById('flame');
const distractBtn = document.getElementById('distractBtn');
const distractCountEl = document.getElementById('distractCount');
const distractMessage = document.getElementById('distractMessage');
const sessionEndSound = document.getElementById('sessionEndSound');
const durationPicker = document.getElementById('durationPicker');
const todayStat = document.getElementById('todayStat');
const soundToggle = document.getElementById('soundToggle');

const CIRCUMFERENCE = 2 * Math.PI * 108;

/* ===== Helpers ===== */
function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
function todayKey() { return new Date().toISOString().slice(0, 10); }
function loadJSON(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
}
function saveJSON(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

/* ===== Timer ===== */
function updateProgress() {
  const progress = totalTime > 0 ? timeLeft / totalTime : 0;
  const offset = CIRCUMFERENCE * (1 - progress);
  progressCircle.style.strokeDasharray = CIRCUMFERENCE;
  progressCircle.style.strokeDashoffset = offset;
}

function updateTimerUI() {
  timeDisplay.textContent = formatTime(timeLeft);
  updateProgress();
  if (isFocus) {
    sessionTypeEl.textContent = 'Focus';
    sessionTypeEl.classList.remove('break');
    progressCircle.classList.remove('break');
    sessionCountEl.textContent = `Session ${Math.min(sessionCount + 1, SESSIONS_BEFORE_LONG)} of ${SESSIONS_BEFORE_LONG}`;
  } else {
    const isLong = totalTime === LONG_BREAK;
    sessionTypeEl.textContent = isLong ? 'Long Break' : 'Short Break';
    sessionTypeEl.classList.add('break');
    progressCircle.classList.add('break');
    sessionCountEl.textContent = isLong ? 'Take a real rest' : 'Quick recharge';
  }
}

function setDuration(min) {
  if (isRunning) return;
  FOCUS_TIME = min * 60;
  if (isFocus) { timeLeft = FOCUS_TIME; totalTime = FOCUS_TIME; updateTimerUI(); }
  [...durationPicker.children].forEach(b => b.classList.toggle('active', +b.dataset.min === min));
}

function startTimer() {
  if (isRunning) return;
  isRunning = true;
  startPauseBtn.textContent = 'Pause';
  [...durationPicker.children].forEach(b => b.disabled = true);

  timerInterval = setInterval(() => {
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      isRunning = false;
      startPauseBtn.textContent = 'Start';
      onSessionEnd();
      return;
    }
    timeLeft--;
    if (isFocus) trackFocusMinute();
    updateTimerUI();
  }, 1000);
}

function pauseTimer() {
  if (!isRunning) return;
  isRunning = false;
  clearInterval(timerInterval);
  timerInterval = null;
  startPauseBtn.textContent = 'Start';
  [...durationPicker.children].forEach(b => b.disabled = false);
}

function resetTimer() {
  pauseTimer();
  isFocus = true;
  sessionCount = 0;
  timeLeft = FOCUS_TIME;
  totalTime = FOCUS_TIME;
  updateTimerUI();
}

function onSessionEnd() {
  [...durationPicker.children].forEach(b => b.disabled = false);
  if (soundOn) {
    try { sessionEndSound.currentTime = 0; sessionEndSound.play().catch(() => {}); } catch (_) {}
  }
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(isFocus ? 'Focus session complete!' : 'Break over — time to focus', {
      body: isFocus ? 'Great work. Take a short break.' : 'Ready for the next session?'
    });
  }

  if (isFocus) {
    recordFocusSession();
    sessionCount++;
    if (sessionCount >= SESSIONS_BEFORE_LONG) {
      isFocus = false; timeLeft = LONG_BREAK; totalTime = LONG_BREAK; sessionCount = 0;
    } else {
      isFocus = false; timeLeft = SHORT_BREAK; totalTime = SHORT_BREAK;
    }
  } else {
    isFocus = true; timeLeft = FOCUS_TIME; totalTime = FOCUS_TIME;
  }
  updateTimerUI();
}

/* ===== Today's focused minutes ===== */
function loadFocusMinutes() {
  focusMinutesToday = loadJSON(STORAGE_KEYS.focusMinutes, { date: todayKey(), minutes: 0 });
  if (focusMinutesToday.date !== todayKey()) focusMinutesToday = { date: todayKey(), minutes: 0 };
  renderFocusMinutes();
}
let secondsAccum = 0;
function trackFocusMinute() {
  secondsAccum++;
  if (secondsAccum >= 60) {
    secondsAccum = 0;
    focusMinutesToday.minutes++;
    saveJSON(STORAGE_KEYS.focusMinutes, focusMinutesToday);
    renderFocusMinutes();
  }
}
function renderFocusMinutes() { todayStat.textContent = `${focusMinutesToday.minutes} min focused today`; }

/* ===== Streak ===== */
function loadStreak() { streakData = loadJSON(STORAGE_KEYS.streak, { count: 0, lastDate: null }); renderStreak(); }

function recordFocusSession() {
  const today = todayKey();
  if (streakData.lastDate === today) return;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = yesterday.toISOString().slice(0, 10);
  streakData.count = streakData.lastDate === yesterdayKey ? streakData.count + 1 : 1;
  streakData.lastDate = today;
  saveJSON(STORAGE_KEYS.streak, streakData);
  renderStreak();
  flameEl.classList.add('pulse');
  setTimeout(() => flameEl.classList.remove('pulse'), 650);
}

function renderStreak() {
  streakCountEl.textContent = streakData.count;
  if (streakData.count === 0) streakHint.textContent = 'Complete a focus session today to start your streak';
  else if (streakData.lastDate === todayKey()) streakHint.textContent = 'Keep it going — you already focused today!';
  else streakHint.textContent = 'Don\u2019t break the chain — start a focus session';
}

/* ===== Tasks ===== */
function loadTasks() { tasks = loadJSON(STORAGE_KEYS.tasks, []); renderTasks(); }
function saveTasks() { saveJSON(STORAGE_KEYS.tasks, tasks); }

function renderTasks() {
  taskList.innerHTML = '';
  const completed = tasks.filter(t => t.done).length;
  completedCountEl.textContent = completed;
  pendingCountEl.textContent = tasks.length - completed;

  if (tasks.length === 0) { emptyState.classList.remove('hidden'); return; }
  emptyState.classList.add('hidden');

  tasks.forEach((task, index) => {
    const li = document.createElement('li');
    li.className = 'task-item' + (task.done ? ' completed' : '');
    li.innerHTML = `
      <button class="task-check" aria-label="Toggle complete">
        <svg viewBox="0 0 24 24" fill="none"><polyline points="20 6 9 17 4 12"/></svg>
      </button>
      <span class="task-text">${escapeHtml(task.text)}</span>
      <button class="task-delete" aria-label="Delete task">×</button>
    `;
    li.querySelector('.task-check').addEventListener('click', () => toggleTask(index));
    li.querySelector('.task-delete').addEventListener('click', () => deleteTask(index, li));
    taskList.appendChild(li);
  });
}

function escapeHtml(str) { const div = document.createElement('div'); div.textContent = str; return div.innerHTML; }

function addTask(text) {
  const trimmed = text.trim();
  if (!trimmed) return;
  tasks.unshift({ text: trimmed, done: false, id: Date.now() });
  saveTasks(); renderTasks();
}
function toggleTask(index) { tasks[index].done = !tasks[index].done; saveTasks(); renderTasks(); }
function deleteTask(index, el) {
  el.classList.add('removing');
  setTimeout(() => { tasks.splice(index, 1); saveTasks(); renderTasks(); }, 250);
}

/* ===== Distractions ===== */
function loadDistractions() {
  const all = loadJSON(STORAGE_KEYS.distractions, []);
  const today = todayKey();
  distractions = all.filter(ts => ts.startsWith(today));
  saveJSON(STORAGE_KEYS.distractions, distractions);
  renderDistractions();
}
function logDistraction() {
  distractions.push(new Date().toISOString());
  saveJSON(STORAGE_KEYS.distractions, distractions);
  renderDistractions();
  distractBtn.textContent = 'Logged ✓';
  setTimeout(() => { distractBtn.innerHTML = '<span>I got distracted</span>'; }, 900);
}
function renderDistractions() {
  const count = distractions.length;
  distractCountEl.textContent = count;
  let msg = '';
  if (count >= 8) msg = 'Try turning off notifications and putting your phone away.';
  else if (count >= 5) msg = 'A few distractions are normal — reset and refocus.';
  else if (count >= 3) msg = 'Notice the pattern. What\u2019s pulling you away?';
  distractMessage.textContent = msg;
  distractMessage.classList.toggle('visible', msg !== '');
}

/* ===== Sound toggle ===== */
function loadSound() {
  soundOn = loadJSON(STORAGE_KEYS.soundOn, true);
  soundToggle.textContent = soundOn ? '🔊' : '🔇';
  soundToggle.classList.toggle('muted', !soundOn);
}
soundToggle.addEventListener('click', () => {
  soundOn = !soundOn;
  saveJSON(STORAGE_KEYS.soundOn, soundOn);
  soundToggle.textContent = soundOn ? '🔊' : '🔇';
  soundToggle.classList.toggle('muted', !soundOn);
});

/* ===== Event Listeners ===== */
startPauseBtn.addEventListener('click', () => {
  if (isRunning) { pauseTimer(); }
  else {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
    startTimer();
  }
});
resetBtn.addEventListener('click', resetTimer);

taskForm.addEventListener('submit', (e) => {
  e.preventDefault();
  addTask(taskInput.value);
  taskInput.value = '';
  taskInput.focus();
});

distractBtn.addEventListener('click', logDistraction);

durationPicker.addEventListener('click', (e) => {
  const btn = e.target.closest('.dur-btn');
  if (btn) setDuration(+btn.dataset.min);
});

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && document.activeElement !== taskInput) {
    e.preventDefault();
    startPauseBtn.click();
  }
});

/* ===== Init ===== */
function init() {
  progressCircle.style.strokeDasharray = CIRCUMFERENCE;
  loadSound();
  loadTasks();
  loadStreak();
  loadDistractions();
  loadFocusMinutes();
  updateTimerUI();
}
init();
