// --- NAVIGATION LOGIC ---
function openScreen(screenId) {
    document.querySelectorAll('.screen').forEach(el => {
        el.classList.add('hidden');
        el.classList.remove('fade-in');
    });
    const activeScreen = document.getElementById(screenId);
    activeScreen.classList.remove('hidden');
    activeScreen.classList.add('fade-in');
}

// --- FOCUS MODE LOGIC ---
let timerInterval;
let timeLeft = 25 * 60;
let totalTime = 25 * 60;
let isTimerRunning = false;

const circle = document.querySelector('.progress-ring__circle');
const radius = circle.r.baseVal.value;
const circumference = radius * 2 * Math.PI;
circle.style.strokeDasharray = `${circumference} ${circumference}`;
circle.style.strokeDashoffset = 0;

function updateTimerDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    document.getElementById('time-display').innerText = 
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    const offset = circumference - (timeLeft / totalTime) * circumference;
    circle.style.strokeDashoffset = offset;
}

function toggleTimer() {
    const btn = document.getElementById('start-btn');
    if (isTimerRunning) {
        clearInterval(timerInterval);
        btn.innerText = 'Resume';
    } else {
        if(timeLeft <= 0) resetTimer(); // Auto reset if starting from 0
        timerInterval = setInterval(() => {
            timeLeft--;
            updateTimerDisplay();
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                isTimerRunning = false;
                btn.innerText = 'Start';
                playBeep();
                setTimeout(() => alert("Focus Session Complete! Great job!"), 100);
            }
        }, 1000);
        btn.innerText = 'Pause';
    }
    isTimerRunning = !isTimerRunning;
}

function resetTimer() {
    clearInterval(timerInterval);
    isTimerRunning = false;
    document.getElementById('start-btn').innerText = 'Start';
    let customMins = parseInt(document.getElementById('custom-time').value) || 25;
    totalTime = customMins * 60;
    timeLeft = totalTime;
    updateTimerDisplay();
}

function playBeep() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
    } catch(e) { console.log("Audio not supported"); }
}

// Initialize Timer Display
updateTimerDisplay();


// --- SPACESHIP GAME LOGIC ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let gameLoop, player, bullets, enemies, particles, stars, score, lives, gameActive;

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);

class Player {
    constructor() {
        this.width = 40; this.height = 40;
        this.x = canvas.width / 2;
        this.y = canvas.height - 80;
        this.speed = 7; this.dx = 0;
    }
    draw() {
        ctx.save();
        ctx.shadowBlur = 15; ctx.shadowColor = "#06b6d4";
        ctx.fillStyle = "#06b6d4";
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - this.height/2);
        ctx.lineTo(this.x + this.width/2, this.y + this.height/2);
        ctx.lineTo(this.x - this.width/2, this.y + this.height/2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
    update() {
        this.x += this.dx;
        // Boundary check
        if (this.x < this.width/2) this.x = this.width/2;
        if (this.x > canvas.width - this.width/2) this.x = canvas.width - this.width/2;
        this.draw();
    }
}

class Bullet {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.radius = 4; this.speed = 10;
    }
    draw() {
        ctx.save();
        ctx.shadowBlur = 10; ctx.shadowColor = "#fde047";
        ctx.fillStyle = "#fde047";
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    update() { this.y -= this.speed; this.draw(); }
}

class Enemy {
    constructor() {
        this.radius = Math.random() * 15 + 15;
        this.x = Math.random() * (canvas.width - this.radius*2) + this.radius;
        this.y = -this.radius;
        // Speed increases slightly with score
        this.speed = Math.random() * 2 + 2 + (score * 0.05); 
    }
    draw() {
        ctx.save();
        ctx.shadowBlur = 15; ctx.shadowColor = "#ef4444";
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    update() { this.y += this.speed; this.draw(); }
}

class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y;
        this.radius = Math.random() * 3 + 1;
        this.dx = (Math.random() - 0.5) * 8;
        this.dy = (Math.random() - 0.5) * 8;
        this.color = color;
        this.life = 1;
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    update() {
        this.x += this.dx; this.y += this.dy;
        this.life -= 0.03;
        this.draw();
    }
}

class Star {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2;
        this.speed = Math.random() * 0.5 + 0.1;
    }
    update() {
        this.y += this.speed;
        if(this.y > canvas.height) { this.y = 0; this.x = Math.random() * canvas.width; }
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.fillRect(this.x, this.y, this.size, this.size);
    }
}

function initGame() {
    resizeCanvas();
    document.getElementById('game-over').classList.add('hidden');
    player = new Player();
    bullets = []; enemies = []; particles = [];
    stars = Array(100).fill().map(() => new Star());
    score = 0; lives = 3; gameActive = true;
    document.getElementById('score').innerText = score;
    updateLivesUI();
    animate();
}

function stopGame() {
    gameActive = false;
    cancelAnimationFrame(gameLoop);
}

function updateLivesUI() {
    document.getElementById('lives').innerText = '❤️'.repeat(lives);
}

function createExplosion(x, y, color) {
    for(let i=0; i<15; i++) particles.push(new Particle(x, y, color));
}

function animate() {
    if(!gameActive) return;
    gameLoop = requestAnimationFrame(animate);
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)"; // Trail effect
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    stars.forEach(star => star.update());
    player.update();

    // Spawn Enemies
    if (Math.random() < 0.03) enemies.push(new Enemy());

    // Update Particles
    particles.forEach((p, i) => {
        if(p.life <= 0) particles.splice(i, 1);
        else p.update();
    });

    // Update Bullets
    bullets.forEach((b, bIdx) => {
        b.update();
        if(b.y < 0) bullets.splice(bIdx, 1);
    });

    // Update Enemies & Collisions
    enemies.forEach((enemy, eIdx) => {
        enemy.update();

        // Hit Player
        const distPlayer = Math.hypot(player.x - enemy.x, player.y - enemy.y);
        if (distPlayer - enemy.radius - player.width/3 < 0) {
            createExplosion(player.x, player.y, "#06b6d4");
            enemies.splice(eIdx, 1);
            lives--;
            updateLivesUI();
            if(lives <= 0) {
                gameActive = false;
                document.getElementById('game-over').classList.remove('hidden');
                document.getElementById('final-score').innerText = score;
            }
        }

        // Hit Bottom
        if(enemy.y > canvas.height + enemy.radius) enemies.splice(eIdx, 1);

        // Hit Bullet
        bullets.forEach((bullet, bIdx) => {
            const dist = Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y);
            if (dist - enemy.radius - bullet.radius < 0) {
                createExplosion(enemy.x, enemy.y, "#ef4444");
                enemies.splice(eIdx, 1);
                bullets.splice(bIdx, 1);
                score += 10;
                document.getElementById('score').innerText = score;
            }
        });
    });
}

// Controls
window.addEventListener('keydown', (e) => {
    if(!gameActive) return;
    if(e.code === 'ArrowLeft') player.dx = -player.speed;
    if(e.code === 'ArrowRight') player.dx = player.speed;
    if(e.code === 'Space') {
        bullets.push(new Bullet(player.x, player.y - player.height/2));
    }
});

window.addEventListener('keyup', (e) => {
    if(e.code === 'ArrowLeft' || e.code === 'ArrowRight') player.dx = 0;
});

// Touch Controls for Mobile
canvas.addEventListener('touchmove', (e) => {
    if(!gameActive) return;
    e.preventDefault();
    player.x = e.touches[0].clientX;
}, {passive: false});

canvas.addEventListener('touchstart', (e) => {
    if(!gameActive) return;
    // Tap to shoot
    bullets.push(new Bullet(player.x, player.y - player.height/2));
});


// --- SMART SEARCH LOGIC ---
function setSearch(text) {
    document.getElementById('search-input').value = text;
    performSearch();
}

function handleSearchKey(e) {
    if (e.key === 'Enter') performSearch();
}

function performSearch() {
    let query = document.getElementById('search-input').value.trim();
    if (!query) return;

    // Smart Detection Keywords
    const recipeKeywords = ['kaise banti', 'how to make', 'recipe', 'banane ka tarika', 'kaise banaye'];
    let isRecipeSearch = recipeKeywords.some(keyword => query.toLowerCase().includes(keyword));

    // Append 'recipe' if it looks like a food query but doesn't have the word 'recipe'
    if (isRecipeSearch && !query.toLowerCase().includes('recipe')) {
        query += " recipe";
    }

    // UI Animation
    document.getElementById('search-loading').classList.remove('hidden');
    
    // Simulate processing delay for premium feel
    setTimeout(() => {
        window.open('https://www.google.com/search?q=' + encodeURIComponent(query), '_blank');
        document.getElementById('search-loading').classList.add('hidden');
        document.getElementById('search-input').value = ''; // clear after search
    }, 800);
}