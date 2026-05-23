
(() => {
  // ---- Level unlock persistence ----
  const UNLOCK_KEY = 'hundpatrullen_unlocked';
  function loadUnlocked() {
    try {
      const saved = JSON.parse(localStorage.getItem(UNLOCK_KEY));
      if (Array.isArray(saved)) return saved;
    } catch {}
    return [0]; // Bara Övningsbana och nivå 1 (Staden) låst upp från start
  }
  function saveUnlocked() {
    try { localStorage.setItem(UNLOCK_KEY, JSON.stringify(unlockedLevels)); } catch {}
  }
  let unlockedLevels = loadUnlocked();

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const TILE = 40;
  const COLS = 20;
  const ROWS = 12;
  const W = COLS * TILE;
  const H = ROWS * TILE;

  // ---- Levels ----
  // Each path is a list of waypoints in grid coordinates. Segments must be axis-aligned.
  const LEVELS = [
    {
      name: 'Övningsbana',
      desc: 'Vi går igenom grunderna för hur du matar hundarna.',
      isTutorial: true,
      path: [
        [-1, 2], [12, 2], [12, 5], [4, 5],
        [4, 9], [20, 9]
      ],
      gold: 100, lives: 10, hpMult: 1.0, maxWaves: 1,
    },
    {
      name: 'Staden',
      desc: 'Slingrande bana med gott om tid att mata hundarna. Nybörjarbana!',
      path: [
        [-1, 1], [18, 1], [18, 11], [0, 11], [0, 3],
        [16, 3], [16, 9], [3, 9], [3, 6], [20, 6]
      ],
      gold: 100, lives: 10, hpMult: 1.0,
    },
    {
      name: 'Skogen',
      desc: 'Raka sträckor med snäva hörn. Rätt placering lönar sig.',
      path: [
        [-1, 1], [16, 1], [16, 6], [2, 6], [2, 10],
        [12, 10], [12, 3], [20, 3]
      ],
      gold: 100, lives: 10, hpMult: 1.0,
    },
    {
      name: 'Parken',
      desc: 'Lite kortare väg och fler svängar. Kräver lite mer planering.',
      path: [
        [-1, 2], [4, 2], [4, 6], [9, 6], [9, 1], [14, 1],
        [14, 9], [5, 9], [5, 11], [20, 11]
      ],
      gold: 100, lives: 10, hpMult: 1.0,
    },
    {
      name: 'Bryggan',
      desc: 'Kort och komplex bana med massor av hundar. Bara för experter!',
      path: [
        [2, -1], [2, 10], [6, 10], [6, 1], [10, 1],
        [10, 10], [14, 10], [14, 1], [18, 1], [18, 12]
      ],
      gold: 100, lives: 10, hpMult: 1.0,
    },
    {
      name: 'Sjön',
      desc: 'Klurig sjöbana med snabba hundar och tajt placering.',
      path: [
        [-1, 6], [3, 6], [3, 2], [8, 2], [8, 4],
        [13, 4], [13, 1], [17, 1], [17, 8],
        [11, 8], [11, 7], [6, 7], [6, 9], [-1, 9]
      ],
      gold: 100, lives: 10, hpMult: 1.0,
    },
  ];

  // ---- Tower types ----
  const TOWER_TYPES = {
    basic: {
      key: 'basic', name: 'Hundgodis', cost: 50,
      range: 110, damage: 13, fireRate: 0.7, projectileSpeed: 380,
      color: '#f5a623', baseColor: '#7a4a10',
      desc: 'Kastar små godisbitar',
    },
    sniper: {
      key: 'sniper', name: 'Hundkorv', cost: 100,
      range: 240, damage: 55, fireRate: 1.7, projectileSpeed: 320,
      color: '#e03030', baseColor: '#7a1010',
      desc: 'Stora smaskiga korvar',
    },
    cannon: {
      key: 'cannon', name: 'Hundkex', cost: 120,
      range: 105, damage: 22, fireRate: 1.3, projectileSpeed: 290,
      splash: 55,
      color: '#4ade80', baseColor: '#14532d',
      desc: 'Sprider goda hundkex',
    },
    frost: {
      key: 'frost', name: 'Hundben', cost: 75,
      range: 100, damage: 0, fireRate: 0.8, projectileSpeed: 340,
      slow: { factor: 0.45, duration: 1.6 },
      color: '#67e8f9', baseColor: '#155e75',
      desc: 'Saktar ned ivriga hundar',
    },
  };
  const TOWER_ORDER = ['basic', 'sniper', 'cannon', 'frost'];

  // ---- Tutorial guidance system ----
  let currentPath = null;
  let tutSteps = null;
  let tutStep  = 0;

  function tutCurrent() {
    if (!tutSteps || tutStep >= tutSteps.length) return null;
    return tutSteps[tutStep];
  }

  // Returns true and advances if the action matches the current step, else false.
  function tutAdvance(type, data) {
    const s = tutCurrent();
    if (!s || s.type !== type) return false;
    if (type === 'select' && data !== s.towerKey) return false;
    if (type === 'place'  && (data.cx !== s.cx || data.cy !== s.cy)) return false;
    tutStep++;
    updateTutorial();
    return true;
  }

  function updateTutorial() {
    const msgEl  = document.getElementById('tutMsg');
    const msgTxt = document.getElementById('tutMsgText');
    const step   = tutCurrent();
    if (!msgEl) return;

    if (step) {
      msgEl.classList.remove('hidden');
      // re-trigger fade animation
      msgEl.style.animation = 'none';
      requestAnimationFrame(() => { msgEl.style.animation = ''; });
      msgTxt.textContent = step.msg;
    } else {
      msgEl.classList.add('hidden');
    }

    // Tower buttons: highlight target, lock others
    TOWER_ORDER.forEach(key => {
      const el = document.getElementById('btn-' + key);
      if (!el) return;
      const isTarget = step && step.type === 'select' && step.towerKey === key;
      const shouldLock = step && (step.type !== 'select' || (step.type === 'select' && !isTarget));
      el.classList.toggle('tut-highlight', isTarget);
      el.classList.toggle('tut-locked',    shouldLock);
    });

    // Start Wave button: highlight only on wave step
    const startBtn = document.getElementById('startBtn');
    if (startBtn) {
      startBtn.classList.toggle('tut-highlight', step?.type === 'wave');
    }
    // Info button: highlight on info step
    const infoBtn = document.getElementById('infoBtn');
    if (infoBtn) {
      infoBtn.classList.toggle('tut-highlight', step?.type === 'info');
    }
  }

  function tutInit(lvl) {
    if (!lvl.isTutorial) { tutSteps = null; tutStep = 0; updateTutorial(); return; }
    tutSteps = [
      {
        type: 'select', towerKey: 'basic',
        msg: '🐾 Steg 1: Du har 100 💰 guld att köpa matare för. Välj "Hundgodis" (kostar 50 guld) – klicka på den i matarväljaren ovan!'
      },
      {
        type: 'place', cx: 8, cy: 3,
        msg: '📍 Steg 2: Klicka på den markerade rutan för att placera mataren. 50 guld dras från ditt saldo!'
      },
      {
        type: 'place', cx: 9, cy: 7,
        msg: '📍 Steg 3: Bra! Du har 50 guld kvar – placera en matare till. Du tjänar guld varje gång en hund blir mätt!'
      },
      {
        type: 'wave',
        msg: '▶ Steg 4: Perfekt! Starta vågen. Ju fler hundar som mättas, desto mer guld tjänar du – till fler matare i nästa våg!'
      },
      {
        type: 'info',
        msg: '📖 Steg 5: Klicka på ℹ️-knappen uppe till höger för att läsa hela spelguiden!'
      },
    ];
    tutStep = 0;
    updateTutorial();
  }

  // ---- Path data (rebuilt per level) ----
  let pathCells = [];
  let pathSet = new Set();
  let waypoints = [];

  function loadPath(path) {
    pathCells = path.slice();
    pathSet = new Set();
    for (let i = 0; i < pathCells.length - 1; i++) {
      const [x1, y1] = pathCells[i];
      const [x2, y2] = pathCells[i + 1];
      if (x1 === x2) {
        const [a, b] = [Math.min(y1, y2), Math.max(y1, y2)];
        for (let y = a; y <= b; y++) pathSet.add(`${x1},${y}`);
      } else {
        const [a, b] = [Math.min(x1, x2), Math.max(x1, x2)];
        for (let x = a; x <= b; x++) pathSet.add(`${x},${y1}`);
      }
    }
    waypoints = pathCells.map(([cx, cy]) => ({
      x: cx * TILE + TILE / 2,
      y: cy * TILE + TILE / 2
    }));
  }

  // ---- Dog sprites ----
  // Draw small stylized icons of Henrik's three dogs. r = body radius in px.
  // opts: { mouthOpen, nowSec, facingAngle }
  // Face direction is +y in local coords. facingAngle=atan2(dy,dx), default π/2 (facing down).
  function drawDog(ctx, x, y, r, kind, opts) {
    const mouthOpen   = opts && opts.mouthOpen  || false;
    const nowSec      = opts && opts.nowSec     || 0;
    const facingAngle = (opts && opts.facingAngle != null) ? opts.facingAngle : Math.PI / 2;
    const rot = facingAngle - Math.PI / 2;

    // === TAIL (drawn before body so it sits behind) ===
    {
      const wag = Math.sin(nowSec * (kind === 'cavalier' ? 7 : 9));
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      if (kind === 'cavalier') {
        const tipX = wag * r * 0.9;
        ctx.strokeStyle = '#1f1410';
        ctx.lineWidth = 3.5; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.6);
        ctx.bezierCurveTo(wag * r * 0.3, -r * 0.95, tipX * 0.7, -r * 1.35, tipX, -r * 1.6);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(80,45,15,0.5)';
        ctx.lineWidth = 1.5;
        for (let i = 1; i <= 3; i++) {
          const f = i / 3.5;
          const px = wag * r * 0.28 * f, py = -(r * 0.6 + r * 0.9 * f);
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px + r * 0.22 * (wag >= 0 ? 0.8 : -0.8), py - r * 0.08);
          ctx.stroke();
        }
      } else {
        const tipX = wag * r * 0.65;
        ctx.strokeStyle = kind === 'cream' ? '#c9a978' : '#a0521e';
        ctx.lineWidth = 5.5; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.7);
        ctx.bezierCurveTo(tipX * 0.4, -r * 0.95, tipX * 0.85, -r * 1.22, tipX, -r * 1.48);
        ctx.stroke();
        ctx.fillStyle = kind === 'cream' ? '#e8d3a4' : '#c87030';
        ctx.beginPath(); ctx.arc(tipX, -r * 1.48, r * 0.3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    // === BODY (rotated to face direction of movement) ===
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    // All coords below are in local space, (0,0) = dog center.
    // Face is toward +y, back/tail toward -y.

    if (kind === 'cavalier') {
      ctx.fillStyle = '#1f1410';
      ctx.beginPath(); ctx.ellipse(-r * 0.85, r * 0.25, r * 0.55, r * 0.95, -0.35, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse( r * 0.85, r * 0.25, r * 0.55, r * 0.95,  0.35, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8a4a25';
      ctx.beginPath(); ctx.ellipse(-r * 0.85, r * 0.6, r * 0.32, r * 0.5, -0.35, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse( r * 0.85, r * 0.6, r * 0.32, r * 0.5,  0.35, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fafafa';
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8a4a25';
      ctx.beginPath(); ctx.ellipse(-r * 0.42, -r * 0.05, r * 0.3, r * 0.32, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse( r * 0.42, -r * 0.05, r * 0.3, r * 0.32, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(-r * 0.38, -r * 0.05, r * 0.13, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc( r * 0.38, -r * 0.05, r * 0.13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath(); ctx.arc(0, r * 0.35, r * 0.18, 0, Math.PI * 2); ctx.fill();
      if (mouthOpen) {
        ctx.fillStyle = '#c03050';
        ctx.beginPath(); ctx.arc(0, r * 0.52, r * 0.22, 0, Math.PI); ctx.fill();
        ctx.fillStyle = '#e88aa0';
        ctx.beginPath(); ctx.ellipse(0, r * 0.63, r * 0.18, r * 0.14, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillRect(-r * 0.16, r * 0.42, r * 0.1, r * 0.1);
        ctx.fillRect( r * 0.06, r * 0.42, r * 0.1, r * 0.1);
      } else {
        ctx.fillStyle = '#e88aa0';
        ctx.beginPath(); ctx.ellipse(0, r * 0.65, r * 0.16, r * 0.22, 0, 0, Math.PI * 2); ctx.fill();
      }

    } else if (kind === 'cream') {
      ctx.fillStyle = '#c9a978';
      ctx.beginPath(); ctx.moveTo(-r * 0.55, -r * 0.55); ctx.lineTo(-r * 1.05, -r * 1.25); ctx.lineTo(-r * 0.15, -r * 0.85); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo( r * 0.55, -r * 0.55); ctx.lineTo( r * 1.05, -r * 1.25); ctx.lineTo( r * 0.15, -r * 0.85); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e8d3a4';
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f4e6c4';
      ctx.beginPath(); ctx.ellipse(0, r * 0.3, r * 0.55, r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(-r * 0.32, -r * 0.1, r * 0.13, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc( r * 0.32, -r * 0.1, r * 0.13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath(); ctx.arc(0, r * 0.2, r * 0.14, 0, Math.PI * 2); ctx.fill();
      if (mouthOpen) {
        ctx.fillStyle = '#c03050';
        ctx.beginPath(); ctx.arc(0, r * 0.36, r * 0.18, 0, Math.PI); ctx.fill();
        ctx.fillStyle = '#e88aa0';
        ctx.beginPath(); ctx.ellipse(0, r * 0.45, r * 0.14, r * 0.11, 0, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = '#e88aa0';
        ctx.beginPath(); ctx.ellipse(0, r * 0.5, r * 0.13, r * 0.18, 0, 0, Math.PI * 2); ctx.fill();
      }

    } else {
      ctx.fillStyle = '#a0521e';
      ctx.beginPath(); ctx.moveTo(-r * 0.55, -r * 0.55); ctx.lineTo(-r * 1.05, -r * 1.25); ctx.lineTo(-r * 0.15, -r * 0.85); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo( r * 0.55, -r * 0.55); ctx.lineTo( r * 1.05, -r * 1.25); ctx.lineTo( r * 0.15, -r * 0.85); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#c87030';
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e08a48';
      ctx.beginPath(); ctx.ellipse(0, r * 0.3, r * 0.5, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c47a92';
      ctx.fillRect(-r * 0.85, r * 0.45, r * 1.7, r * 0.28);
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(-r * 0.32, -r * 0.1, r * 0.13, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc( r * 0.32, -r * 0.1, r * 0.13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath(); ctx.arc(0, r * 0.2, r * 0.14, 0, Math.PI * 2); ctx.fill();
      if (mouthOpen) {
        ctx.fillStyle = '#c03050';
        ctx.beginPath(); ctx.arc(0, r * 0.36, r * 0.18, 0, Math.PI); ctx.fill();
        ctx.fillStyle = '#e88aa0';
        ctx.beginPath(); ctx.ellipse(0, r * 0.45, r * 0.14, r * 0.11, 0, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = '#e88aa0';
        ctx.beginPath(); ctx.ellipse(0, r * 0.5, r * 0.13, r * 0.18, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  // ---- Rabbit sprite ----
  function drawRabbit(ctx, rabbit, nowSec) {
    const { x, y, angle, hopPhase } = rabbit;
    const hop = 0.82 + Math.abs(Math.sin(hopPhase)) * 0.2;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle - Math.PI / 2);
    ctx.scale(hop, hop);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath(); ctx.ellipse(0, 3, 9, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    // Tail (back = -y)
    ctx.fillStyle = '#e8e0d6';
    ctx.beginPath(); ctx.arc(0, -10, 4.5, 0, Math.PI * 2); ctx.fill();
    // Body
    ctx.fillStyle = '#b89878';
    ctx.beginPath(); ctx.ellipse(0, 0, 7, 10, 0, 0, Math.PI * 2); ctx.fill();
    // Head (front = +y)
    ctx.fillStyle = '#b89878';
    ctx.beginPath(); ctx.arc(0, 11, 5.5, 0, Math.PI * 2); ctx.fill();
    // Ears (pointing backward in local coords)
    ctx.fillStyle = '#b89878';
    ctx.beginPath(); ctx.ellipse(-3.5, -3, 2.5, 8.5, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse( 3.5, -3, 2.5, 8.5,  0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d98aaa';
    ctx.beginPath(); ctx.ellipse(-3.5, -3, 1.2, 5.5, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse( 3.5, -3, 1.2, 5.5,  0.2, 0, Math.PI * 2); ctx.fill();
    // Eyes
    ctx.fillStyle = '#c04070';
    ctx.beginPath(); ctx.arc(-2.5, 9.5, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc( 2.5, 9.5, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e080a0';
    ctx.beginPath(); ctx.arc(0, 12, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // ---- Bird sprite (top-down view) ----
  function drawBird(ctx, bird) {
    const { x, y, wingPhase, vx } = bird;
    const sweep = Math.sin(wingPhase) * 0.38; // vingsveepvinkel fram/bak
    ctx.save();
    ctx.translate(x, y);
    if (vx < 0) ctx.scale(-1, 1); // spegla om den flyger åt vänster
    // Markskugga
    ctx.fillStyle = 'rgba(0,0,0,0.13)';
    ctx.beginPath(); ctx.ellipse(2, 3, 20, 8, 0, 0, Math.PI * 2); ctx.fill();
    // Vänster vinge (negativt y-håll, sveper med flaxfas)
    ctx.save();
    ctx.rotate(sweep);
    ctx.fillStyle = '#6a9cc8';
    ctx.beginPath(); ctx.ellipse(0, -13, 5, 15, 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4a7ab0';
    ctx.beginPath(); ctx.ellipse(0, -21, 3, 5, 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // Höger vinge
    ctx.save();
    ctx.rotate(-sweep);
    ctx.fillStyle = '#6a9cc8';
    ctx.beginPath(); ctx.ellipse(0, 13, 5, 15, -0.12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4a7ab0';
    ctx.beginPath(); ctx.ellipse(0, 21, 3, 5, -0.12, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // Stjärt (bakom kroppen, mot -x)
    ctx.fillStyle = '#3a608a';
    ctx.beginPath();
    ctx.moveTo(-9, 0); ctx.lineTo(-16, -4); ctx.lineTo(-13, 0); ctx.lineTo(-16, 4); ctx.closePath();
    ctx.fill();
    // Kropp
    ctx.fillStyle = '#4a7ab0';
    ctx.beginPath(); ctx.ellipse(0, 0, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
    // Huvud
    ctx.fillStyle = '#3a5a90';
    ctx.beginPath(); ctx.arc(8, 0, 3.5, 0, Math.PI * 2); ctx.fill();
    // Näbb
    ctx.fillStyle = '#e0a820';
    ctx.beginPath(); ctx.moveTo(11, -0.6); ctx.lineTo(15, 0); ctx.lineTo(11, 0.6); ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ---- Hydrant sprite ----
  function drawHydrant(ctx, hyd, nowSec) {
    const { x, y, bornAt } = hyd;
    const appear = Math.min(1, (nowSec - bornAt) * 3);
    ctx.save();
    ctx.globalAlpha = appear;
    ctx.translate(x, y);
    ctx.fillStyle = '#c02020';
    ctx.fillRect(-7, 2, 14, 10);
    ctx.beginPath(); ctx.arc(0, -2, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#900';
    ctx.beginPath(); ctx.arc(0, -9, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c02020';
    ctx.fillRect(-13, -4, 5, 4); ctx.fillRect(8, -4, 5, 4);
    ctx.fillStyle = 'rgba(255,180,180,0.4)';
    ctx.beginPath(); ctx.ellipse(-2, -4, 3, 4, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(0, 13, 8, 3, 0, 0, Math.PI * 2); ctx.fill();

    // Vattenstråle – animerade droppar i ett solfjäderformat mönster
    const numDrops = 8;
    for (let i = 0; i < numDrops; i++) {
      const t = ((nowSec * 2.8 + i * (1 / numDrops)) % 1); // fas 0→1
      const spreadAngle = (i / (numDrops - 1) - 0.5) * 1.3; // -0.65..+0.65 rad
      const spd = 14 + (i % 3) * 3;
      const sx = Math.sin(spreadAngle) * spd * t;
      const sy = -12 - Math.cos(spreadAngle) * spd * t + 9 * t * t; // parabelkurva
      const r  = Math.max(0.15, 2.2 - t * 2.0);
      ctx.globalAlpha = appear * (1 - t) * 0.88;
      ctx.fillStyle = i % 2 === 0 ? '#55c8ff' : '#99deff';
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ---- Bark speech bubble ----
  const BARK_WORDS = ['Voff! 🐾', 'Bjeff!', 'Woof!', 'Voff voff!'];
  function drawBarkBubble(ctx, x, y, word) {
    const pad = 5;
    ctx.font = 'bold 11px -apple-system, sans-serif';
    const tw = ctx.measureText(word).width;
    const bw = tw + pad * 2, bh = 17;
    // Clamp to canvas bounds
    let bx = x + 14;
    let by = y - 36;
    if (bx + bw > W - 4) bx = x - bw - 14;
    if (bx < 4) bx = 4;
    if (by < 4) by = y + 8;
    if (by + bh > H - 4) by = y - bh - 8;
    ctx.fillStyle = 'rgba(255,255,255,0.93)';
    roundRect(ctx, bx, by, bw, bh, 5); ctx.fill();
    ctx.strokeStyle = 'rgba(100,80,140,0.45)';
    ctx.lineWidth = 1;
    roundRect(ctx, bx, by, bw, bh, 5); ctx.stroke();
    // Pratpil riktad mot hunden (x,y är hundens position)
    const tailOnLeft = bx + bw / 2 > x; // bubblan är till höger → pil på vänster sida
    const tailAtBottom = by + bh / 2 < y; // bubblan är ovanför → pil pekar nedåt
    ctx.fillStyle = 'rgba(255,255,255,0.93)';
    ctx.beginPath();
    if (tailAtBottom && tailOnLeft) {
      ctx.moveTo(bx + 5, by + bh); ctx.lineTo(bx - 6, by + bh + 8); ctx.lineTo(bx + 14, by + bh);
    } else if (tailAtBottom && !tailOnLeft) {
      ctx.moveTo(bx + bw - 14, by + bh); ctx.lineTo(bx + bw + 6, by + bh + 8); ctx.lineTo(bx + bw - 5, by + bh);
    } else if (!tailAtBottom && tailOnLeft) {
      ctx.moveTo(bx + 5, by); ctx.lineTo(bx - 6, by - 8); ctx.lineTo(bx + 14, by);
    } else {
      ctx.moveTo(bx + bw - 14, by); ctx.lineTo(bx + bw + 6, by - 8); ctx.lineTo(bx + bw - 5, by);
    }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#3a1a5a';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(word, bx + pad, by + bh / 2);
  }

  // ---- Tower & projectile sprites ----
  function drawBone(ctx, x, y, scale, angle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    ctx.fillStyle = '#fafafa';
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 0.6;
    // Two knobs at each end
    ctx.beginPath(); ctx.arc(-7, -2.6, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(-7, 2.6, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(7, -2.6, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(7, 2.6, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Shaft
    ctx.fillRect(-7, -2.4, 14, 4.8);
    ctx.beginPath();
    ctx.moveTo(-7, -2.4); ctx.lineTo(7, -2.4);
    ctx.moveTo(-7, 2.4); ctx.lineTo(7, 2.4);
    ctx.stroke();
    ctx.restore();
  }

  function drawTower(ctx, t) {
    const type = TOWER_TYPES[t.type];
    // Shared shadow / pedestal
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(t.x, t.y + 12, 13, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = type.baseColor;
    ctx.beginPath();
    ctx.arc(t.x, t.y + 4, 12, 0, Math.PI * 2);
    ctx.fill();

    if (t.type === 'basic') {
      // Hundgodis-matare: en godispåse som kastar smågodbitar
      const x = t.x, y = t.y;
      // Påse (rund, brun)
      ctx.fillStyle = '#c47c2a';
      roundRect(ctx, x - 7, y - 11, 14, 16, 4); ctx.fill();
      ctx.strokeStyle = '#7a4a10';
      ctx.lineWidth = 1;
      roundRect(ctx, x - 7, y - 11, 14, 16, 4); ctx.stroke();
      // Highlight på påsen
      ctx.fillStyle = '#e0a050';
      roundRect(ctx, x - 5, y - 9, 5, 8, 2); ctx.fill();
      // Knut överst
      ctx.fillStyle = '#7a4a10';
      ctx.beginPath(); ctx.arc(x, y - 12, 3, 0, Math.PI * 2); ctx.fill();
      // Godbitar som trillar ur (3 cirklar)
      ctx.fillStyle = '#f5c04a';
      ctx.beginPath(); ctx.arc(x - 4, y - 15, 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 1, y - 17, 2.0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 5, y - 14, 1.8, 0, Math.PI * 2); ctx.fill();
    } else if (t.type === 'sniper') {
      // Hundkorv-matare: en korvkatapult (röd)
      const x = t.x, y = t.y;
      // Bas
      ctx.fillStyle = '#7a1010';
      ctx.fillRect(x - 8, y + 1, 16, 5);
      // Arm
      ctx.strokeStyle = '#c02020';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x - 2, y + 3); ctx.lineTo(x + 6, y - 9); ctx.stroke();
      // Korven längst ut — röd, avlång med ändar
      ctx.save();
      ctx.translate(x + 8, y - 11);
      ctx.rotate(0.4);
      ctx.fillStyle = '#e03030';
      ctx.beginPath(); ctx.ellipse(0, 0, 6, 2.8, 0, 0, Math.PI * 2); ctx.fill();
      // Ändknoppar
      ctx.fillStyle = '#b01818';
      ctx.beginPath(); ctx.arc(-5.5, 0, 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(5.5, 0, 2.2, 0, Math.PI * 2); ctx.fill();
      // Glans
      ctx.fillStyle = 'rgba(255,180,180,0.55)';
      ctx.beginPath(); ctx.ellipse(-1, -1, 3, 1.2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // Pivot
      ctx.fillStyle = '#500808';
      ctx.beginPath(); ctx.arc(x - 2, y + 3, 2.5, 0, Math.PI * 2); ctx.fill();
    } else if (t.type === 'cannon') {
      // Hundkex-matare: en grön kastare med kex
      const x = t.x, y = t.y;
      // Lådkropp (grön)
      ctx.fillStyle = '#166534';
      roundRect(ctx, x - 8, y - 6, 16, 12, 3); ctx.fill();
      ctx.strokeStyle = '#14532d';
      ctx.lineWidth = 1;
      roundRect(ctx, x - 8, y - 6, 16, 12, 3); ctx.stroke();
      // Öppning (mörkare)
      ctx.fillStyle = '#0f3d20';
      roundRect(ctx, x - 5, y - 4, 10, 8, 2); ctx.fill();
      // Tre fyrkantiga kex som flyger upp
      const kexPositions = [[-5, -13], [0, -15], [5, -13]];
      for (const [kx, ky] of kexPositions) {
        ctx.fillStyle = '#d4a057';
        roundRect(ctx, x + kx - 3, y + ky - 3, 6, 6, 1); ctx.fill();
        ctx.strokeStyle = '#8b5e20';
        ctx.lineWidth = 0.7;
        roundRect(ctx, x + kx - 3, y + ky - 3, 6, 6, 1); ctx.stroke();
        // Prick på kexet
        ctx.fillStyle = '#a07030';
        ctx.beginPath(); ctx.arc(x + kx, y + ky, 1, 0, Math.PI * 2); ctx.fill();
      }
    } else if (t.type === 'frost') {
      // Bone launcher: a small dish with a bone on top
      const x = t.x, y = t.y;
      // Dish
      ctx.fillStyle = '#155e75';
      ctx.beginPath();
      ctx.ellipse(x, y + 2, 11, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0e4a5c';
      ctx.fillRect(x - 9, y - 1, 18, 4);
      // Bone resting on top
      drawBone(ctx, x, y - 5, 1.05, -0.25);
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawProjectile(ctx, p, nowSec) {
    // Compute direction toward target for motion-aligned drawing
    let ang = 0, ux = 1, uy = 0;
    if (p.target) {
      const dx = p.target.x - p.x;
      const dy = p.target.y - p.y;
      const len = Math.hypot(dx, dy);
      if (len > 0.001) {
        ang = Math.atan2(dy, dx);
        ux = dx / len; uy = dy / len;
      }
    }
    if (p.typeKey === 'basic') {
      // Liten rund godisbit — amber/guld med rörelsespår
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(ang);
      // Spår (svagare cirklar bakom)
      ctx.fillStyle = 'rgba(245,192,74,0.25)';
      ctx.beginPath(); ctx.ellipse(-7, 0, 5, 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(245,192,74,0.45)';
      ctx.beginPath(); ctx.ellipse(-3.5, 0, 3.5, 2.5, 0, 0, Math.PI * 2); ctx.fill();
      // Godiset (rund pellet)
      ctx.fillStyle = '#f5a623';
      ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
      // Mörk ring för textur
      ctx.strokeStyle = '#c47c2a';
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.stroke();
      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.beginPath(); ctx.arc(-1.2, -1.4, 1.2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else if (p.typeKey === 'sniper') {
      // Hundkorv — kurvig korv som roterar i luften
      const korvRot = nowSec * 5;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(korvRot);
      ctx.scale(0.33, 0.33);
      ctx.lineCap = 'round';
      const korvCurve = () => {
        ctx.beginPath();
        ctx.moveTo(-15, 7);
        ctx.bezierCurveTo(-14, -6, 12, -10, 15, 1);
      };
      // Kontur
      ctx.strokeStyle = '#c03050';
      ctx.lineWidth = 15;
      korvCurve(); ctx.stroke();
      // Fyllning
      ctx.strokeStyle = '#f07080';
      ctx.lineWidth = 11;
      korvCurve(); ctx.stroke();
      // Knutar
      ctx.fillStyle = '#c03050';
      ctx.beginPath(); ctx.ellipse(-15, 7, 3.5, 5, 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(15, 1, 3.5, 5, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else if (p.typeKey === 'cannon') {
      // Hundkex — tre kex som startar tätt och sprider sig i olika riktningar
      const tang = nowSec * 4;
      const age = nowSec - (p.born || nowSec);
      const spread = Math.min(age * 40, 13); // 0 → 13px under ~0.3s
      // Vinkelrät mot flygriktningen (för sidospridning)
      const px = -Math.sin(ang), py = Math.cos(ang);
      const kexOff = [
        [ px * spread,          py * spread         ],  // sprider åt vänster om flygriktningen
        [-px * spread,         -py * spread         ],  // sprider åt höger
        [-ux * spread * 0.8,   -uy * spread * 0.8   ],  // faller lite bakåt
      ];
      ctx.save();
      ctx.translate(p.x, p.y);
      for (const [kx, ky] of kexOff) {
        ctx.save();
        ctx.translate(kx, ky);
        ctx.rotate(-tang * 0.5);
        ctx.fillStyle = '#d4a057';
        roundRect(ctx, -3.5, -3.5, 7, 7, 1.2); ctx.fill();
        ctx.strokeStyle = '#8b5e20';
        ctx.lineWidth = 0.7;
        roundRect(ctx, -3.5, -3.5, 7, 7, 1.2); ctx.stroke();
        // Prick
        ctx.fillStyle = '#a07030';
        ctx.beginPath(); ctx.arc(0, 0, 1.0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    } else if (p.typeKey === 'frost') {
      // Spinning bone
      drawBone(ctx, p.x, p.y, 0.6, nowSec * 10);
    }
  }

  // ---- Game state ----
  const state = {
    levelIndex: -1,
    gold: 0,
    lives: 0,
    wave: 0,
    maxWaves: 10,
    towers: [],
    enemies: [],
    projectiles: [],
    droppedBones: [],
    poops: [],
    popups: [],
    spawnQueue: [],
    spawnTimer: 0,
    waveActive: false,
    over: false,
    won: false,
    hover: null,
    selectedType: 'basic',
    fx: [],
    hpMult: 1,
    speed: 1,
    rabbit: null,
    nextRabbitAt: 8,
    scentTrail: null,
    nextScentAt: 12,
    bird: null,
    nextBirdAt: 14,
    hydrant: null,
    nextHydrantAt: 10,
    hydrant2: null,
    nextHydrant2At: 16,
  };

  // Accumulated game-time (scaled by state.speed) and current nowSec for applyDamage
  let gameTime = 0;
  let currentNowSec = 0;

  function makeWave(n) {
    const final = n >= 10;
    const ramp = Math.pow(1.34, Math.max(0, n - 1)) * (final ? 0.78 : 1);
    const count = 6 + n * 2;
    const enemies = [];
    const tankCount = n >= 4 ? Math.floor((n - 2) / 2) : 0;
    for (let i = 0; i < count; i++) {
      const isFast = n >= 2 && i % 3 === 0;
      const isTank = i >= count - tankCount;
      const baseHp = isTank
          ? Math.round(95 * Math.pow(1.5, Math.max(0, n - 4)) * (final ? 0.78 : 1))
          : isFast ? Math.round(14 * ramp)
                   : Math.round(24 * ramp);
      enemies.push({
        hp: Math.round(baseHp * state.hpMult),
        speed: isFast ? Math.min(190, 125 + n * 6)
              : isTank ? 42 + n * 2
              : Math.min(150, 68 + n * 6),
        radius: isTank ? 16 : isFast ? 9 : 12,
        kind: isTank ? 'cavalier' : isFast ? 'red' : 'cream',
        gold: isTank ? 28 : isFast ? 5 : 8,
      });
    }
    return enemies;
  }

  function spawnEnemy(template) {
    const initAngle = waypoints.length > 1
      ? Math.atan2(waypoints[1].y - waypoints[0].y, waypoints[1].x - waypoints[0].x)
      : Math.PI / 2;
    state.enemies.push({
      ...template,
      maxHp: template.hp,
      x: waypoints[0].x,
      y: waypoints[0].y,
      wpIndex: 1,
      slowUntil: 0,
      slowFactor: 1,
      facingAngle: initAngle,
      mouthOpenUntil: 0,
      nextBarkAt: gameTime + 8 + Math.random() * 14,
      barkUntil: 0,
      barkWord: '',
      chaseUntil: 0,
      nextBusinessAt: gameTime + 18 + Math.random() * 22,
      businessUntil: 0,
      nextScratchAt: gameTime + 28 + Math.random() * 35,
      scratchUntil: 0,
      nextSneezeAt: gameTime + 55 + Math.random() * 60,
      sneezeUntil: 0,
      nextTailAt: gameTime + 90 + Math.random() * 90,
      tailUntil: 0,
      tailSpin: 0,
      sniffUntil: 0,
      sniffedScent: false,
      sniffDone: false,
      sniffPtIdx: 0,
      returningToPath: false,
      returnWpIdx: 1,
      birdJumpUntil: 0,
      birdJumpPhase: 0,
      peeUntil: 0,
      nextHydrantPeeAt: 0,
      drinkFillRate: 0,
      drinkTarget: null,      // { x, y, hx, hy } → rör sig hit, börjar dricka vid ankomst
      pendingPoop: null,
      sniffBuddyUntil: 0,
      scentCrossingPtIdx: -1,
      sniffStartPtIdx: 0,
      sniffReverse: false,
      chaseStartX: -1,
      chaseStartY: -1,
      chaseStartWpIdx: -1,
      chaseReturnTarget: null, // { x, y, wpIdx } → beräknas vid jaktavslut
      wasOccupied: false,
    });
  }

  let bgMusicEl = null; // hoistd för musikstyrning från spelfunktioner

  function startWave() {
    if (state.levelIndex < 0 || state.waveActive || state.over) return;
    if (state.wave >= state.maxWaves) return;
    state.wave++;
    state.spawnQueue = makeWave(state.wave);
    state.spawnTimer = 0;
    state.waveActive = true;
    // Starta musik vid första vågen, låt den sedan spela i loop tills game-over/klar
    if (bgMusicEl && !bgMusicEl.muted && bgMusicEl.paused) { bgMusicEl.play().catch(()=>{}); }
    updateHUD();
  }

  function tryPlaceTower(mx, my) {
    if (state.over || state.levelIndex < 0) return;
    const cx = Math.floor(mx / TILE);
    const cy = Math.floor(my / TILE);
    if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return;
    if (pathSet.has(`${cx},${cy}`)) return;
    if (state.towers.some(t => t.cx === cx && t.cy === cy)) return;
    if (state.hydrant  && state.hydrant.cx  === cx && state.hydrant.cy  === cy) return;
    if (state.hydrant2 && state.hydrant2.cx === cx && state.hydrant2.cy === cy) return;
    // Tutorial: only allow placing on the designated cell
    const s = tutCurrent();
    if (s && s.type === 'place' && (cx !== s.cx || cy !== s.cy)) return;
    if (s && s.type !== 'place' && s !== null) return; // no placing during select/wave steps
    const type = TOWER_TYPES[state.selectedType];
    if (state.gold < type.cost) return;
    state.gold -= type.cost;
    state.towers.push({
      cx, cy,
      x: cx * TILE + TILE / 2,
      y: cy * TILE + TILE / 2,
      type: type.key,
      cooldown: 0,
    });
    tutAdvance('place', { cx, cy });
    updateHUD();
  }

  function applyDamage(enemy, dmg, sourceType) {
    if (enemy.dead) return;
    enemy.hp -= dmg;
    if (sourceType && sourceType.slow) {
      // Distraherade hundar tar inte emot nya ben
      const distracted = enemy.chaseUntil > currentNowSec ||
                         (enemy.sniffedScent && !enemy.sniffDone) ||
                         enemy.birdJumpUntil > currentNowSec ||
                         enemy.businessUntil > currentNowSec ||
                         enemy.returningToPath || enemy.chaseStartX >= 0;
      if (!distracted) {
        enemy.slowUntil = currentNowSec + sourceType.slow.duration;
        enemy.slowFactor = sourceType.slow.factor;
      }
    }
    // Open mouth when hit by a treat
    enemy.mouthOpenUntil = currentNowSec + 0.45;
    if (enemy.hp <= 0) {
      enemy.dead = true;
      state.gold += enemy.gold;
      updateHUD();
    }
  }

  function update(dt, nowSec) {
    currentNowSec = nowSec;
    if (state.over || state.levelIndex < 0) return;

    if (state.waveActive && state.spawnQueue.length > 0) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        spawnEnemy(state.spawnQueue.shift());
        state.spawnTimer = Math.max(0.18, 0.65 - state.wave * 0.05);
      }
    }

    // ---- Rabbit spawning ----
    if (!state.rabbit && !state.scentTrail && !state.bird && state.waveActive && !state.over) {
      state.nextRabbitAt -= dt;
      if (state.nextRabbitAt <= 0) {
        // Pick a random edge to enter from
        const side = Math.floor(Math.random() * 4); // 0=top,1=right,2=bottom,3=left
        let rx, ry, rvx, rvy;
        const speed = 140 + Math.random() * 20;
        if (side === 0)      { rx = W * (0.2 + Math.random() * 0.6); ry = -16; rvx = (Math.random() - 0.5) * 60; rvy = speed; }
        else if (side === 1) { rx = W + 16; ry = H * (0.2 + Math.random() * 0.6); rvx = -speed; rvy = (Math.random() - 0.5) * 60; }
        else if (side === 2) { rx = W * (0.2 + Math.random() * 0.6); ry = H + 16; rvx = (Math.random() - 0.5) * 60; rvy = -speed; }
        else                 { rx = -16; ry = H * (0.2 + Math.random() * 0.6); rvx = speed; rvy = (Math.random() - 0.5) * 60; }
        state.rabbit = { x: rx, y: ry, vx: rvx, vy: rvy, angle: Math.atan2(rvy, rvx), hopPhase: 0, fleeing: false };
        state.nextRabbitAt = 8 + Math.random() * 8;
      }
    }

    // ---- Rabbit movement ----
    if (state.rabbit) {
      const rb = state.rabbit;
      rb.x += rb.vx * dt;
      rb.y += rb.vy * dt;
      rb.hopPhase += dt * 9;
      // Check if any dog is chasing it → rabbit flees faster
      const anyChasing = state.enemies.some(e => e.chaseUntil > nowSec);
      const targetSpeed = anyChasing ? 320 : 150;
      const curSpeed = Math.hypot(rb.vx, rb.vy);
      if (curSpeed > 0) {
        const scale = targetSpeed / curSpeed;
        rb.vx += (rb.vx * scale - rb.vx) * Math.min(1, dt * 3);
        rb.vy += (rb.vy * scale - rb.vy) * Math.min(1, dt * 3);
        rb.angle = Math.atan2(rb.vy, rb.vx);
      }
      // Remove rabbit when it leaves the canvas
      const margin = 40;
      if (rb.x < -margin || rb.x > W + margin || rb.y < -margin || rb.y > H + margin) {
        state.rabbit = null;
        // Dogs stop chasing when rabbit disappears
        for (const e of state.enemies) e.chaseUntil = 0;
      }
    }

    // ---- Bird spawning & movement ----
    if (!state.bird && !state.rabbit && !state.scentTrail && state.waveActive && !state.over) {
      state.nextBirdAt -= dt;
      if (state.nextBirdAt <= 0) {
        const fromLeft = Math.random() < 0.5;
        const bY = H * (0.1 + Math.random() * 0.5);
        state.bird = { x: fromLeft ? -20 : W + 20, y: bY,
          vx: fromLeft ? 160 + Math.random() * 60 : -(160 + Math.random() * 60),
          wingPhase: 0 };
        state.nextBirdAt = 18 + Math.random() * 16;
      }
    }
    if (state.bird) {
      const b = state.bird;
      b.x += b.vx * dt;
      b.wingPhase += dt * 8;
      for (const e of state.enemies) {
        if (e.dead) continue;
        // Fullständig ledig-kontroll för fågelhopp (utanför per-enemy-loopen)
        const _eFree = nowSec > e.chaseUntil && nowSec > e.birdJumpUntil &&
            !(e.sniffedScent && !e.sniffDone) && !e.returningToPath &&
            nowSec > (e.peeUntil||0) && e.chaseStartX < 0 &&
            nowSec > e.businessUntil && nowSec > e.scratchUntil &&
            nowSec > e.sneezeUntil && nowSec > e.tailUntil &&
            nowSec >= (e.sniffBuddyUntil||0);
        if (Math.abs(b.x - e.x) < 100 && Math.abs(b.y - e.y) < 80 && _eFree) {
          // Ben faller till marken när hunden skäller på fågeln
          if (nowSec < e.slowUntil) {
            const _fa = e.facingAngle ?? 0;
            state.droppedBones.push({ x: e.x + Math.cos(_fa) * e.radius * 0.58,
              y: e.y + Math.sin(_fa) * e.radius * 0.58,
              angle: _fa + Math.PI / 2,
              life: Math.max(2.5, e.slowUntil - nowSec) });
            e.slowUntil = 0; e.slowFactor = 1;
          }
          e.birdJumpUntil = nowSec + 0.9;
          e.birdJumpPhase = 0;
          e.facingAngle = Math.atan2(b.y - e.y, b.x - e.x); // vrid mot fågeln
          e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.10); // trött av hoppandet → +10% hunger
          if (nowSec > e.barkUntil) { e.barkWord = 'Voff! 🐾'; e.barkUntil = nowSec + 1.1; }
        }
      }
      if (b.x < -40 || b.x > W + 40) state.bird = null;
    }

    // ---- Hydrant spawning & expiry (dubbla vattenpostplatser) ----
    function spawnHydrantIfReady(slot, otherHyd, timerKey, slotKey) {
      if (state[slotKey] || !state.waveActive || state.over) return;
      state[timerKey] -= dt;
      if (state[timerKey] > 0) return;
      const cands = [];
      for (const key of pathSet) {
        const [pcx, pcy] = key.split(',').map(Number);
        for (const [dcx, dcy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
          const nx = pcx + dcx, ny = pcy + dcy;
          if (nx >= 0 && ny >= 0 && nx < COLS && ny < ROWS
              && !pathSet.has(nx + ',' + ny)
              && !state.towers.some(t => t.cx === nx && t.cy === ny)
              && !(otherHyd && otherHyd.cx === nx && otherHyd.cy === ny)) {
            cands.push({ cx: nx, cy: ny });
          }
        }
      }
      if (cands.length > 0) {
        const pick = cands[Math.floor(Math.random() * cands.length)];
        const adjCenters = [];
        for (const [dcx, dcy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
          const nx = pick.cx + dcx, ny = pick.cy + dcy;
          if (pathSet.has(nx + ',' + ny))
            adjCenters.push({ x: nx * TILE + TILE / 2, y: ny * TILE + TILE / 2 });
        }
        state[slotKey] = { cx: pick.cx, cy: pick.cy,
          x: pick.cx * TILE + TILE / 2, y: pick.cy * TILE + TILE / 2,
          bornAt: nowSec, expiresAt: nowSec + 22 + Math.random() * 14, adjCenters };
      }
      state[timerKey] = 6 + Math.random() * 8;
    }
    spawnHydrantIfReady(1, state.hydrant2,  'nextHydrantAt',  'hydrant');
    spawnHydrantIfReady(2, state.hydrant,   'nextHydrant2At', 'hydrant2');
    // Ta bort vattenpost bara om ingen hund är på väg dit eller dricker
    for (const _hKey of ['hydrant', 'hydrant2']) {
      const _hyd = state[_hKey];
      if (!_hyd || nowSec <= _hyd.expiresAt) continue;
      const _inUse = state.enemies.some(e =>
        !e.dead && (
          (e.drinkTarget && e.drinkTarget.hx === _hyd.x && e.drinkTarget.hy === _hyd.y) ||
          (nowSec < (e.peeUntil||0) && Math.hypot(e.x - _hyd.x, e.y - _hyd.y) < TILE * 2)
        )
      );
      if (!_inUse) state[_hKey] = null;
    }
    // Hundar som passerar nära en vattenpost dricker kort (30% chans)
    for (const activeHyd of [state.hydrant, state.hydrant2]) {
      if (!activeHyd) continue;
      for (const e of state.enemies) {
        if (e.dead || nowSec < (e.nextHydrantPeeAt||0)) continue;
        // Fullständig ledighetskontroll för hydrant
        if (nowSec < e.businessUntil || e.returningToPath) continue;
        if (e.sniffedScent && !e.sniffDone) continue;
        if (nowSec < (e.birdJumpUntil||0)) continue;
        if (nowSec > e.chaseUntil === false || e.chaseStartX >= 0) continue; // jagar/återvänder från kanin
        if (nowSec < e.scratchUntil || nowSec < e.sneezeUntil || nowSec < e.tailUntil) continue;
        if (nowSec < (e.sniffBuddyUntil||0)) continue;
        if (nowSec < e.slowUntil) continue; // ben i munnen → dricker inte
        // Sätt drinkTarget om hunden är inom räckhåll, framåt i rörelseriktningen, och inte redan på väg dit
        if (!e.drinkTarget) {
          const _fwdX = Math.cos(e.facingAngle), _fwdY = Math.sin(e.facingAngle);
          // Välj närmsta adjCenter som ligger framåt (dot > 0) och inom räckhåll
          let _bestC = null, _bestDist = Infinity;
          if (activeHyd.adjCenters) {
            for (const c of activeHyd.adjCenters) {
              const _cdx = c.x - e.x, _cdy = c.y - e.y;
              const _dist = Math.hypot(_cdx, _cdy);
              if (_dist < TILE * 1.5 && (_fwdX * _cdx + _fwdY * _cdy) > 0 && _dist < _bestDist) {
                _bestDist = _dist; _bestC = c;
              }
            }
          }
          if (_bestC) {
            // Cooldown sätts oavsett om hunden dricker eller ej — ett försök per passage
            e.nextHydrantPeeAt = nowSec + 3;
            if (Math.random() < 0.30) {
              e.nextHydrantPeeAt = nowSec + 10; // längre cooldown om hunden faktiskt dricker
              // Hitta rätt wpIdx för drinkTarget-rutan (undviker backande efter drickande)
              const _bestGx = Math.floor(_bestC.x / TILE), _bestGy = Math.floor(_bestC.y / TILE);
              let _hydWpIdx = waypoints.length - 1;
              for (let _si = 0; _si < pathCells.length - 1; _si++) {
                const [_sx1, _sy1] = pathCells[_si], [_sx2, _sy2] = pathCells[_si + 1];
                const _onSeg = (_sx1 === _sx2)
                  ? (_sx1 === _bestGx && _bestGy >= Math.min(_sy1,_sy2) && _bestGy <= Math.max(_sy1,_sy2))
                  : (_sy1 === _bestGy && _bestGx >= Math.min(_sx1,_sx2) && _bestGx <= Math.max(_sx1,_sx2));
                if (_onSeg) { _hydWpIdx = _si + 1; break; }
              }
              e.drinkTarget = { x: _bestC.x, y: _bestC.y, hx: activeHyd.x, hy: activeHyd.y, wpIdx: _hydWpIdx };
            }
          }
        }
      }
    }

    // ---- Hundar nossar på varandra (vid korsning eller nära möte) ----
    for (let i = 0; i < state.enemies.length; i++) {
      const a = state.enemies[i];
      if (a.dead || nowSec < (a.sniffBuddyUntil||0) || nowSec < a.businessUntil ||
          nowSec < a.chaseUntil || nowSec < a.sniffUntil || nowSec < (a.peeUntil||0) ||
          (a.sniffedScent && !a.sniffDone) || a.returningToPath || a.chaseStartX >= 0 ||
          nowSec < a.scratchUntil || nowSec < a.sneezeUntil || nowSec < a.tailUntil ||
          nowSec < (a.birdJumpUntil||0)) continue;
      for (let j = i + 1; j < state.enemies.length; j++) {
        const b = state.enemies[j];
        if (b.dead || nowSec < (b.sniffBuddyUntil||0) || nowSec < b.businessUntil ||
            nowSec < b.chaseUntil || nowSec < b.sniffUntil || nowSec < (b.peeUntil||0) ||
            (b.sniffedScent && !b.sniffDone) || b.returningToPath || b.chaseStartX >= 0 ||
            nowSec < b.scratchUntil || nowSec < b.sneezeUntil || nowSec < b.tailUntil ||
            nowSec < (b.birdJumpUntil||0)) continue;
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        // Nosa bara när de rör sig i olika riktningar (korsande banor)
        const afwdX = Math.cos(a.facingAngle), afwdY = Math.sin(a.facingAngle);
        const bfwdX = Math.cos(b.facingAngle), bfwdY = Math.sin(b.facingAngle);
        const alignDot = Math.abs(afwdX * bfwdX + afwdY * bfwdY); // 0=vinkelrätt, 1=parallellt
        const dx2 = b.x - a.x, dy2 = b.y - a.y;
        const ux = dist > 0 ? dx2 / dist : 0, uy = dist > 0 ? dy2 / dist : 0;
        const aApp = afwdX * ux + afwdY * uy;   // rör sig a mot b?
        const bApp = -(bfwdX * ux + bfwdY * uy); // rör sig b mot a?
        if (dist < 30 && alignDot < 0.45 && aApp > 0.40 && bApp > 0.40 && Math.random() < 0.015) {
          const dur = 1.0 + Math.random() * 0.8;
          a.sniffBuddyUntil = nowSec + dur;
          b.sniffBuddyUntil = nowSec + dur;
          // Face each other
          a.facingAngle = Math.atan2(b.y - a.y, b.x - a.x);
          b.facingAngle = Math.atan2(a.y - b.y, a.x - b.x);
        }
      }
    }

    // ---- Scent trail spawning & expiry ----
    if (!state.scentTrail && !state.rabbit && !state.bird && state.waveActive && !state.over) {
      state.nextScentAt -= dt;
      if (state.nextScentAt <= 0) {
        // Kattspår: A och B = gröna tiles i banordning, ej bland 8 första/sista
        // Bygg en ordnad lista av tiles längs banan (i banordning, inga dubletter)
        const _ordTiles = [];
        { const _seen = new Set();
          for (let _ci = 0; _ci < pathCells.length - 1; _ci++) {
            const [_cx1, _cy1] = pathCells[_ci], [_cx2, _cy2] = pathCells[_ci + 1];
            const _dxt = Math.sign(_cx2 - _cx1), _dyt = Math.sign(_cy2 - _cy1);
            let _tx = _cx1, _ty = _cy1;
            while (_tx !== _cx2 || _ty !== _cy2) {
              const _k = `${_tx},${_ty}`;
              if (!_seen.has(_k) && _tx >= 0 && _tx < COLS && _ty >= 0 && _ty < ROWS)
                { _seen.add(_k); _ordTiles.push({ gx: _tx, gy: _ty }); }
              _tx += _dxt; _ty += _dyt;
            }
          }
          const [_lx, _ly] = pathCells[pathCells.length - 1];
          const _lk = `${_lx},${_ly}`;
          if (!_seen.has(_lk) && _lx >= 0 && _lx < COLS && _ly >= 0 && _ly < ROWS)
            _ordTiles.push({ gx: _lx, gy: _ly });
        }
        // Tillåtna tiles: exkludera 8 första och 8 sista
        const _pathTiles = _ordTiles.length > 16 ? _ordTiles.slice(8, -8) : _ordTiles;
        if (_pathTiles.length >= 2) {
          // Startpunkt A: slumpmässig grön tile ur tillåtna
          const _aIdx = Math.floor(Math.random() * _pathTiles.length);
          const _aT = _pathTiles[_aIdx];
          // Slutpunkt B: annan grön tile, ej samma kolumn OCH ej samma rad
          const _bCandidates = _pathTiles.filter(t => t.gx !== _aT.gx && t.gy !== _aT.gy);
          if (_bCandidates.length > 0) {
            const _bT = _bCandidates[Math.floor(Math.random() * _bCandidates.length)];
            const x1 = _aT.gx * TILE + TILE / 2, y1 = _aT.gy * TILE + TILE / 2;
            const x2 = _bT.gx * TILE + TILE / 2, y2 = _bT.gy * TILE + TILE / 2;
            const angle = Math.atan2(y2 - y1, x2 - x1);
            const totalLen = Math.hypot(x2 - x1, y2 - y1);
            const step = 26, points = [];
            for (let d = 0; d <= totalLen; d += step) {
              const t = d / totalLen;
              const side = points.length % 2 === 0 ? -1 : 1;
              const perpX = -Math.sin(angle) * side * 6;
              const perpY =  Math.cos(angle) * side * 6;
              points.push({ x: x1 + (x2 - x1) * t + perpX, y: y1 + (y2 - y1) * t + perpY });
            }
            const readyAt = nowSec + points.length * 0.10 + 0.5;
            state.scentTrail = { points, angle, bornAt: nowSec, readyAt,
              expiresAt: nowSec + 10 + Math.random() * 4, noticedCount: 0,
              aTile: _aT, bTile: _bT };
            state.nextScentAt = 14 + Math.random() * 10;
          }
        }
      }
    }
    if (state.scentTrail && nowSec > state.scentTrail.expiresAt) {
      const _anyFollowing = state.enemies.some(_e => _e.sniffedScent && !_e.sniffDone);
      if (!_anyFollowing) state.scentTrail = null;
    }

    for (const e of state.enemies) {
      if (e.wpIndex >= waypoints.length) continue;

      // ---- Natural hunger (mättnad minskar sakta över tid) ----
      const isJumping     = nowSec < (e.birdJumpUntil  || 0);
      const isSniffBuddy  = nowSec < (e.sniffBuddyUntil || 0);
      // isOccupied: primär aktivitet pågår (blockerar allt annat)
      const isOccupied = e.chaseUntil > nowSec || isJumping || (e.sniffedScent && !e.sniffDone) || e.returningToPath || nowSec < (e.peeUntil||0) || e.chaseStartX >= 0 || nowSec < e.businessUntil || isSniffBuddy;
      // isFree: ingen aktivitet alls pågår
      const isFree = !isOccupied && nowSec > e.businessUntil && nowSec > e.scratchUntil && nowSec > e.sneezeUntil && nowSec > e.tailUntil && !isSniffBuddy;
      const stopped = nowSec < e.businessUntil || nowSec < e.sniffUntil || nowSec < e.scratchUntil || nowSec < e.sneezeUntil || nowSec < e.tailUntil || isJumping || isSniffBuddy || nowSec < (e.peeUntil||0);
      // Frys sekundära aktivitetstimers under primär aktivitet
      if (isOccupied) {
        e.nextBusinessAt += dt;
        e.nextScratchAt  += dt;
        e.nextSneezeAt   += dt;
        e.nextTailAt     += dt;
        e.nextBarkAt     += dt;
        if (e.drinkTarget) e.drinkTarget = null; // avbryt vattenpost-rörelse vid primär aktivitet
      }
      // Cooldown direkt efter att primär aktivitet avslutas
      if (!isOccupied && e.wasOccupied) {
        const _cd = 1.5 + Math.random() * 1.5;
        e.nextBusinessAt = Math.max(e.nextBusinessAt, nowSec + _cd);
        e.nextScratchAt  = Math.max(e.nextScratchAt,  nowSec + _cd);
        e.nextSneezeAt   = Math.max(e.nextSneezeAt,   nowSec + _cd);
        e.nextTailAt     = Math.max(e.nextTailAt,     nowSec + _cd);
      }
      e.wasOccupied = isOccupied;
      const hungerRate = stopped ? 0.038 : 0.007;
      e.hp = Math.min(e.maxHp, e.hp + e.maxHp * hungerRate * dt);
      // Drickande fyller successivt mättnadsindikator
      if ((e.drinkFillRate||0) > 0) {
        if (nowSec < (e.peeUntil||0)) { e.hp = Math.max(0, e.hp - e.drinkFillRate * dt); }
        else { e.drinkFillRate = 0; }
      }

      // ---- Fågelhopp (uppdatera fas) ----
      if (nowSec < e.birdJumpUntil) e.birdJumpPhase += dt * Math.PI * 3.5;

      // (Hydrantbesök hanteras nu via peeUntil på banan, ingen avvikelse)

      // ---- Toalettpauser (slumpmässigt) ----
      if (nowSec >= e.nextBusinessAt && isFree) {
        const bDur = 1.6 + Math.random() * 1.4;
        e.businessUntil = nowSec + bDur;
        e.nextBusinessAt = nowSec + 20 + Math.random() * 25;
        // Spara position för bajsobjektet som spawnas när hunden är klar
        e.pendingPoop = { dogX: e.x, dogY: e.y, fa: e.facingAngle ?? 0, r: e.radius };
      }
      // Spawna persistent bajsobjekt när hunden är klar
      if (e.pendingPoop && nowSec > e.businessUntil && e.businessUntil > 0) {
        const pp = e.pendingPoop;
        const px = pp.dogX - Math.cos(pp.fa) * pp.r * 1.7;
        const py = pp.dogY - Math.sin(pp.fa) * pp.r * 1.7;
        const life = 4.5 + Math.random() * 2.5;
        state.poops.push({ x: px, y: py, life, maxLife: life, r: pp.r, collected: false, dead: false });
        e.pendingPoop = null;
      }

      // ---- Kliande (hälften så ofta som toalett, slumpmässigt) ----
      if (nowSec >= e.nextScratchAt && isFree) {
        e.scratchUntil  = nowSec + 1.0 + Math.random() * 0.8;
        e.nextScratchAt = nowSec + 40 + Math.random() * 50;
      }

      // ---- Nysning (sällsynt) ----
      if (nowSec >= e.nextSneezeAt && isFree) {
        e.sneezeUntil  = nowSec + 0.55;
        e.nextSneezeAt = nowSec + 80 + Math.random() * 100;
        if (nowSec > e.barkUntil) { e.barkWord = 'Atjoo! 🤧'; e.barkUntil = nowSec + 1.2; }
      }

      // ---- Svansjakt (väldigt sällsynt) ----
      if (nowSec >= e.nextTailAt && isFree) {
        e.tailUntil  = nowSec + 1.4;
        e.tailSpin   = 0;
        e.nextTailAt = nowSec + 120 + Math.random() * 150;
      }

      // ---- Luktstig — hunden detekterar spåret vid startpunkt A ----
      if (state.scentTrail && state.scentTrail.aTile && !e.sniffedScent &&
          state.scentTrail.noticedCount < 2 && isFree) {
        const sc = state.scentTrail;
        // Hunden detekterar KUN när den befinner sig på tile A
        const _eGx = Math.floor(e.x / TILE);
        const _eGy = Math.floor(e.y / TILE);
        if (_eGx === sc.aTile.gx && _eGy === sc.aTile.gy && nowSec >= sc.readyAt) {
          // Ben faller till marken när hunden börjar följa spåret
          if (nowSec < e.slowUntil) {
            const _fa = e.facingAngle ?? 0;
            state.droppedBones.push({ x: e.x + Math.cos(_fa) * e.radius * 0.58,
              y: e.y + Math.sin(_fa) * e.radius * 0.58,
              angle: _fa + Math.PI / 2,
              life: Math.max(2.5, e.slowUntil - nowSec) });
            e.slowUntil = 0; e.slowFactor = 1;
          }
          e.sniffUntil      = nowSec + 30.0;
          e.sniffedScent    = true;
          e.sniffDone       = false;
          e.sniffPtIdx      = 0; // alltid från spårets början (A)
          e.scentCrossingPtIdx = sc.points.length - 1; // B = sista punkten
          sc.noticedCount++;
          if (nowSec > e.barkUntil) { e.barkWord = '🐾 ?'; e.barkUntil = nowSec + 1.6; }
        }
      }
      // Nosandet tog timeout → återvänd till närmaste framåt-waypoint
      if (e.sniffedScent && !e.sniffDone && nowSec > e.sniffUntil) {
        e.sniffDone = true;
        // Sök ALLA waypoints (ej bara från wpIndex) — hunden kan vara på annat segment
        let bestIdx = 0, bestDist = Infinity;
        for (let i = 0; i < waypoints.length - 1; i++) {
          const d = Math.hypot(waypoints[i].x - e.x, waypoints[i].y - e.y);
          if (d < bestDist) { bestDist = d; bestIdx = i; }
        }
        // Peka framåt från närmaste waypoint
        e.returningToPath = true; e.returnWpIdx = Math.min(bestIdx + 1, waypoints.length - 1);
      }

      // ---- Random skällande ----
      if (nowSec >= e.nextBarkAt && !isOccupied) {
        e.barkWord  = BARK_WORDS[Math.floor(Math.random() * BARK_WORDS.length)];
        e.barkUntil = nowSec + 1.3;
        e.nextBarkAt = nowSec + 10 + Math.random() * 16;
      }

      // ---- Kanin-notis ----
      if (state.rabbit && isFree) {
        const rdx = state.rabbit.x - e.x, rdy = state.rabbit.y - e.y;
        if (Math.hypot(rdx, rdy) < 90) {
          e.chaseUntil = nowSec + 2.5;
          // Spara startposition för återvändning efter jakten
          if (e.chaseStartX < 0) { e.chaseStartX = e.x; e.chaseStartY = e.y; e.chaseStartWpIdx = e.wpIndex; }
          // Ben faller till marken när hunden rusar iväg
          if (nowSec < e.slowUntil) {
            const _fa = e.facingAngle ?? 0;
            state.droppedBones.push({ x: e.x + Math.cos(_fa) * e.radius * 0.58,
              y: e.y + Math.sin(_fa) * e.radius * 0.58,
              angle: _fa + Math.PI / 2,
              life: Math.max(2.5, e.slowUntil - nowSec) });
            e.slowUntil = 0; e.slowFactor = 1;
          }
          if (nowSec > e.barkUntil) { e.barkWord = 'Bjeff!'; e.barkUntil = nowSec + 1.0; }
        }
      }

      // ---- Rörelse ----
      // Toalett-, klia-, nys-, hopp-, svansstopp eller kompis-nosning
      if (nowSec < e.businessUntil || nowSec < e.scratchUntil || nowSec < e.sneezeUntil || isJumping || isSniffBuddy || nowSec < (e.peeUntil||0)) continue;
      // Svansjakt: hunden snurrar runt sin egen axel
      if (nowSec < e.tailUntil) {
        e.tailSpin += dt * Math.PI * 2.5; // ~1.25 varv per sekund
        e.facingAngle = e.tailSpin;
        continue;
      }
      // Nosande — hunden följer spåret i kattens riktning till korsningspunkten
      if (nowSec < e.sniffUntil && e.sniffedScent && !e.sniffDone) {
        if (state.scentTrail) {
          const pts = state.scentTrail.points;
          const sniffSpeed = e.speed * 1.20;
          const stopIdx = e.scentCrossingPtIdx >= 0 ? e.scentCrossingPtIdx : pts.length - 1;
          while (e.sniffPtIdx < stopIdx &&
                 Math.hypot(pts[e.sniffPtIdx].x - e.x, pts[e.sniffPtIdx].y - e.y) < 10) {
            e.sniffPtIdx++;
          }
          // Från sista spårpunkten: sikta på exakt centrum av B-tile
          const _atEnd = e.sniffPtIdx >= stopIdx;
          const _bCtr = (_atEnd && state.scentTrail && state.scentTrail.bTile)
            ? { x: state.scentTrail.bTile.gx * TILE + TILE / 2,
                y: state.scentTrail.bTile.gy * TILE + TILE / 2 }
            : null;
          const tgt = _bCtr || pts[Math.min(e.sniffPtIdx, stopIdx)];
          const sdx = tgt.x - e.x, sdy = tgt.y - e.y, sdist = Math.hypot(sdx, sdy);
          if (sdist > 0.5) {
            e.facingAngle = Math.atan2(sdy, sdx);
            e.x += (sdx / sdist) * sniffSpeed * dt;
            e.y += (sdy / sdist) * sniffSpeed * dt;
          }

          // Framme vid B → hitta B:s segment och fortsätt banan därifrån
          if (e.scentCrossingPtIdx >= 0 && e.sniffPtIdx >= e.scentCrossingPtIdx && sdist < 6) {
            const _bT = state.scentTrail ? state.scentTrail.bTile : null;
            const _bGx = _bT ? _bT.gx : Math.floor(pts[e.scentCrossingPtIdx].x / TILE);
            const _bGy = _bT ? _bT.gy : Math.floor(pts[e.scentCrossingPtIdx].y / TILE);
            let targetWpIdx = -1;
            for (let _si = 0; _si < pathCells.length - 1; _si++) {
              const [x1, y1] = pathCells[_si];
              const [x2, y2] = pathCells[_si + 1];
              let onSeg = false;
              if (y1 === y2 && _bGy === y1) {
                onSeg = _bGx >= Math.min(x1, x2) && _bGx <= Math.max(x1, x2);
              } else if (x1 === x2 && _bGx === x1) {
                onSeg = _bGy >= Math.min(y1, y2) && _bGy <= Math.max(y1, y2);
              }
              if (onSeg) { targetWpIdx = _si + 1; break; }
            }
            if (targetWpIdx < 0) {
              let minDist = Infinity;
              for (let _wi = 0; _wi < waypoints.length - 1; _wi++) {
                const _d = Math.hypot(waypoints[_wi].x - (_bT ? _bT.gx * TILE + TILE/2 : e.x),
                                      waypoints[_wi].y - (_bT ? _bT.gy * TILE + TILE/2 : e.y));
                if (_d < minDist) { minDist = _d; targetWpIdx = _wi + 1; }
              }
            }
            e.wpIndex = Math.min(targetWpIdx, waypoints.length - 1);
            e.sniffUntil = 0; e.sniffDone = true;
            // Försvinn omedelbart om ingen annan hund fortfarande följer spåret
            if (state.scentTrail) {
              const _stillOn = state.enemies.some(_f => _f !== e && _f.sniffedScent && !_f.sniffDone);
              if (!_stillOn) state.scentTrail.expiresAt = nowSec;
            }
          }

          // Utanför skärmen ELLER nått slutet av spåret utan korsning
          // → gå direkt till närmaste waypoint (ingen bakåtlöpning längs spåret)
          const _offScreen = e.x < -10 || e.x > W + 10 || e.y < -10 || e.y > H + 10;
          const _reachedEnd = e.scentCrossingPtIdx < 0 && e.sniffPtIdx >= stopIdx && sdist < 20;
          if (_offScreen || _reachedEnd) {
            e.sniffUntil = 0; e.sniffDone = true;
            let _bestWp = 0, _bestDist = Infinity;
            for (let _wi = 0; _wi < waypoints.length - 1; _wi++) {
              const _d = Math.hypot(waypoints[_wi].x - e.x, waypoints[_wi].y - e.y);
              if (_d < _bestDist) { _bestDist = _d; _bestWp = _wi; }
            }
            e.returningToPath = true;
            e.returnWpIdx = Math.min(_bestWp + 1, waypoints.length - 1);
          }
        }
        continue;
      }

      // Nosandet tog slut utan att hunden hittade banan → promenera tillbaka (ingen teleport)
      if (e.returningToPath) {
        const rWp = waypoints[e.returnWpIdx];
        const rdx = rWp.x - e.x, rdy = rWp.y - e.y, rdist = Math.hypot(rdx, rdy);
        if (rdist < 16) {
          e.returningToPath = false; e.wpIndex = e.returnWpIdx;
          e.x = rWp.x; e.y = rWp.y;
        } else {
          e.facingAngle = Math.atan2(rdy, rdx);
          e.x += (rdx / rdist) * e.speed * dt;
          e.y += (rdy / rdist) * e.speed * dt;
        }
        continue;
      }

      // ---- Kanin-återvändning: springer till närmsta gröna ruta ----
      if (e.chaseStartX >= 0 && nowSec >= e.chaseUntil) {
        // Beräkna returmål första framen (lazy init)
        if (!e.chaseReturnTarget) {
          const _cgx = Math.floor(e.x / TILE), _cgy = Math.floor(e.y / TILE);
          let _nearDist = Infinity, _nearGx = _cgx, _nearGy = _cgy;
          for (const _key of pathSet) {
            const _ki = _key.indexOf(',');
            const _pgx = +_key.slice(0, _ki), _pgy = +_key.slice(_ki + 1);
            const _d = Math.hypot(_pgx - _cgx, _pgy - _cgy);
            if (_d < _nearDist) { _nearDist = _d; _nearGx = _pgx; _nearGy = _pgy; }
          }
          // Hitta rätt waypoint-index: vilken segment innehåller rutan?
          let _wpIdx = waypoints.length - 1;
          for (let _si = 0; _si < pathCells.length - 1; _si++) {
            const [_sx1, _sy1] = pathCells[_si], [_sx2, _sy2] = pathCells[_si + 1];
            const _onSeg = (_sx1 === _sx2)
              ? (_sx1 === _nearGx && _nearGy >= Math.min(_sy1, _sy2) && _nearGy <= Math.max(_sy1, _sy2))
              : (_sy1 === _nearGy && _nearGx >= Math.min(_sx1, _sx2) && _nearGx <= Math.max(_sx1, _sx2));
            if (_onSeg) { _wpIdx = _si + 1; break; }
          }
          e.chaseReturnTarget = { x: _nearGx * TILE + TILE / 2, y: _nearGy * TILE + TILE / 2, wpIdx: _wpIdx };
        }
        const _rt = e.chaseReturnTarget;
        const _rtdx = _rt.x - e.x, _rtdy = _rt.y - e.y;
        const _rtdist = Math.hypot(_rtdx, _rtdy);
        if (_rtdist < 6) {
          // Framme — snappa exakt till tile-centern och fortsätt
          e.x = _rt.x; e.y = _rt.y;
          e.wpIndex = _rt.wpIdx;
          e.chaseStartX = -1; e.chaseStartY = -1;
          e.chaseReturnTarget = null;
          // Fall through → normal waypoint-rörelse startar direkt
        } else {
          e.facingAngle = Math.atan2(_rtdy, _rtdx);
          e.x += (_rtdx / _rtdist) * e.speed * dt;
          e.y += (_rtdy / _rtdist) * e.speed * dt;
          continue;
        }
      }

      // ---- drinkTarget: gå till tile-centern intill vattenposten, börja dricka vid ankomst ----
      // Vänta med att följa drinkTarget tills hunden är på rätt segment (undviker hörngenande)
      if (e.drinkTarget && e.wpIndex >= e.drinkTarget.wpIdx) {
        const _dtdx = e.drinkTarget.x - e.x, _dtdy = e.drinkTarget.y - e.y;
        const _dtdist = Math.hypot(_dtdx, _dtdy);
        if (_dtdist < 3) {
          // Framme! Snappa, vänd mot vattenposten, starta drickande
          e.x = e.drinkTarget.x; e.y = e.drinkTarget.y;
          e.facingAngle = Math.atan2(e.drinkTarget.hy - e.y, e.drinkTarget.hx - e.x);
          if (e.drinkTarget.wpIdx !== undefined) e.wpIndex = Math.max(e.wpIndex, e.drinkTarget.wpIdx);
          const drinkDur = 1.2 + Math.random() * 0.8;
          e.peeUntil = nowSec + drinkDur;
          e.drinkFillRate = e.maxHp * 0.18 / drinkDur;
          if (nowSec > e.barkUntil) { e.barkWord = 'Slurp! 💧'; e.barkUntil = nowSec + drinkDur; }
          e.drinkTarget = null;
        } else {
          // Rör sig mot drinkTarget med normal hastighet (ingen slow-faktor)
          const _dtmove = e.speed * dt;
          e.facingAngle = Math.atan2(_dtdy, _dtdx);
          e.x += (_dtdx / _dtdist) * _dtmove;
          e.y += (_dtdy / _dtdist) * _dtmove;
        }
        continue;
      }

      let tx, ty;
      if (state.rabbit && nowSec < e.chaseUntil) {
        tx = state.rabbit.x; ty = state.rabbit.y;
      } else {
        const wp = waypoints[e.wpIndex];
        tx = wp.x; ty = wp.y;
      }
      const dx = tx - e.x, dy = ty - e.y;
      const dist = Math.hypot(dx, dy);
      const slow = nowSec < e.slowUntil ? e.slowFactor : 1;
      const move = e.speed * slow * dt;
      if (dist > 0) e.facingAngle = Math.atan2(dy, dx);
      if (move >= dist) {
        e.x = tx; e.y = ty;
        if (!(state.rabbit && nowSec < e.chaseUntil)) e.wpIndex++;
      } else {
        e.x += (dx / dist) * move;
        e.y += (dy / dist) * move;
      }
    }

    for (const e of state.enemies) {
      if (e.wpIndex >= waypoints.length) {
        e.dead = true;
        state.lives -= e.radius >= 14 ? 2 : 1;
      }
    }

    for (const t of state.towers) {
      const type = TOWER_TYPES[t.type];
      t.cooldown -= dt;
      if (t.cooldown > 0) continue;
      let target = null;
      let bestProgress = -1;
      for (const e of state.enemies) {
        if (e.dead) continue;
        // Immun mot torn: primär aktivitet pågår
        if (e.sniffedScent && !e.sniffDone) continue;
        if (nowSec < e.chaseUntil || nowSec < (e.birdJumpUntil||0)) continue;
        if (e.returningToPath || e.chaseStartX >= 0) continue;
        const d = Math.hypot(e.x - t.x, e.y - t.y);
        if (d <= type.range) {
          const wp = waypoints[Math.min(e.wpIndex, waypoints.length - 1)];
          const progress = e.wpIndex * 10000 - Math.hypot(wp.x - e.x, wp.y - e.y);
          if (progress > bestProgress) {
            bestProgress = progress;
            target = e;
          }
        }
      }
      if (target) {
        state.projectiles.push({
          x: t.x, y: t.y,
          target,
          damage: type.damage,
          speed: type.projectileSpeed,
          typeKey: t.type,
          born: nowSec,
        });
        t.cooldown = type.fireRate;
      }
    }

    for (const p of state.projectiles) {
      if (p.dead) continue;
      const tgt = p.target;
      if (!tgt || tgt.dead || tgt.hp <= 0) { p.dead = true; continue; }
      const dx = tgt.x - p.x;
      const dy = tgt.y - p.y;
      const d = Math.hypot(dx, dy);
      const move = p.speed * dt;
      if (move >= d) {
        const sourceType = TOWER_TYPES[p.typeKey];
        if (sourceType.splash) {
          for (const e of state.enemies) {
            if (e.dead) continue;
            const dd = Math.hypot(e.x - tgt.x, e.y - tgt.y);
            if (dd <= sourceType.splash) applyDamage(e, p.damage, sourceType);
          }
          p.boom = { x: tgt.x, y: tgt.y, r: sourceType.splash, life: 0.25 };
        } else {
          applyDamage(tgt, p.damage, sourceType);
        }
        p.dead = true;
      } else {
        p.x += (dx / d) * move;
        p.y += (dy / d) * move;
      }
    }

    state.enemies = state.enemies.filter(e => !e.dead);
    for (const fx of state.fx) fx.life -= dt;
    state.fx = state.fx.filter(f => f.life > 0);
    for (const b of state.droppedBones) b.life -= dt;
    state.droppedBones = state.droppedBones.filter(b => b.life > 0);
    // Bajs-förfall + straff för missat bajs
    for (const p of state.poops) {
      if (p.collected || p.dead) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.dead = true;
        state.gold = Math.max(0, state.gold - 8);
        state.popups.push({ x: p.x, y: p.y - 12, text: '-8 💰', color: '#ef4444', life: 1.8, vy: -28 });
        updateHUD();
      }
    }
    state.poops = state.poops.filter(p => !p.dead && !p.collected);
    // Popup-rörelse (flytande text)
    for (const p of state.popups) { p.life -= dt; p.y += p.vy * dt; }
    state.popups = state.popups.filter(p => p.life > 0);
    for (const p of state.projectiles) {
      if (p.dead && p.boom) state.fx.push(p.boom);
    }
    state.projectiles = state.projectiles.filter(p => !p.dead);

    if (state.waveActive && state.spawnQueue.length === 0 && state.enemies.length === 0) {
      state.waveActive = false;
      state.gold += 25 + state.wave * 2;
      if (state.wave >= state.maxWaves) {
        state.over = true;
        state.won = true;
        if (bgMusicEl) bgMusicEl.pause();
        if (typeof gtag === 'function') gtag('event', 'level_complete', { level_name: LEVELS[state.levelIndex].name, level_index: state.levelIndex });
        const isLast = state.levelIndex === LEVELS.length - 1;
        // Unlock next level
        if (!isLast) {
          const nextIdx = state.levelIndex + 1;
          if (!unlockedLevels.includes(nextIdx)) {
            unlockedLevels.push(nextIdx);
            saveUnlocked();
          }
        }
        showOverlay('Seger! 🎉',
          isLast
            ? `Du klarade alla nivåer — du är en sann hundpatrull-mästare!`
            : `${LEVELS[state.levelIndex].name} klarad! Nivå ${state.levelIndex + 1} låst upp!`,
          { showNext: !isLast });
      }
      updateHUD();
    }

    if (state.lives <= 0 && !state.over) {
      state.lives = 0;
      state.over = true;
      if (bgMusicEl) bgMusicEl.pause();
      if (typeof gtag === 'function') gtag('event', 'level_fail', { level_name: LEVELS[state.levelIndex].name, level_index: state.levelIndex, wave_reached: state.wave });
      showOverlay('Spelet är slut 🐾', 'Du lämnade för många hundar hungriga.', {});
    }

    updateHUD();
  }

  function draw(nowSec) {
    if (state.levelIndex < 0) return;
    ctx.fillStyle = '#cce4f0';
    ctx.fillRect(0, 0, W, H);

    for (let cx = 0; cx < COLS; cx++) {
      for (let cy = 0; cy < ROWS; cy++) {
        const onPath = pathSet.has(`${cx},${cy}`);
        if (onPath) {
          ctx.fillStyle = '#90c878';
        } else {
          ctx.fillStyle = (cx + cy) % 2 === 0 ? '#c8dff0' : '#bbd4e8';
        }
        ctx.fillRect(cx * TILE, cy * TILE, TILE, TILE);
      }
    }

    
    // ---- Entry arrow at path start ────────────────────────────────────────
    if (currentPath && currentPath.length >= 2) {
      const p0 = currentPath[0], p1 = currentPath[1];
      const dx = p1[0] - p0[0], dy = p1[1] - p0[1];
      const len = Math.sqrt(dx*dx + dy*dy) || 1;
      const nx = dx/len, ny = dy/len;
      // Entry tile: first fully on-screen cell along the path
      const ex = (p0[0] < 0 ? 0 : p0[0] >= COLS ? COLS-1 : p0[0]);
      const ey = (p0[1] < 0 ? 0 : p0[1] >= ROWS ? ROWS-1 : p0[1]);
      const cx2 = ex * TILE + TILE/2, cy2 = ey * TILE + TILE/2;
      const as = 11; // arrow size
      ctx.save();
      ctx.translate(cx2, cy2);
      ctx.rotate(Math.atan2(ny, nx));
      ctx.beginPath();
      ctx.moveTo(as, 0);
      ctx.lineTo(-as, -as*0.65);
      ctx.lineTo(-as*0.3, 0);
      ctx.lineTo(-as, as*0.65);
      ctx.closePath();
      ctx.fillStyle = 'rgba(30,120,60,0.35)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(15,70,30,0.45)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }
    ctx.strokeStyle = 'rgba(120,90,180,0.10)';
    ctx.lineWidth = 1;
    for (let cx = 0; cx <= COLS; cx++) {
      ctx.beginPath();
      ctx.moveTo(cx * TILE, 0);
      ctx.lineTo(cx * TILE, H);
      ctx.stroke();
    }
    for (let cy = 0; cy <= ROWS; cy++) {
      ctx.beginPath();
      ctx.moveTo(0, cy * TILE);
      ctx.lineTo(W, cy * TILE);
      ctx.stroke();
    }

    if (state.hover && !state.over) {
      const { cx, cy } = state.hover;
      const type = TOWER_TYPES[state.selectedType];
      const blocked = pathSet.has(`${cx},${cy}`) || state.towers.some(t => t.cx === cx && t.cy === cy);
      const canAfford = state.gold >= type.cost;
      const ok = !blocked && canAfford;
      ctx.fillStyle = ok ? 'rgba(110,193,255,0.22)' : 'rgba(239,106,106,0.25)';
      ctx.fillRect(cx * TILE, cy * TILE, TILE, TILE);
      if (ok) {
        ctx.beginPath();
        ctx.arc(cx * TILE + TILE/2, cy * TILE + TILE/2, type.range, 0, Math.PI * 2);
        ctx.strokeStyle = type.color + 'cc';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        if (type.splash) {
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(cx * TILE + TILE/2, cy * TILE + TILE/2, type.splash, 0, Math.PI * 2);
          ctx.strokeStyle = type.color + '88';
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }

    // Tutorial: pulsing highlight on target cell
    const tutS = tutCurrent();
    if (tutS && tutS.type === 'place') {
      const pulse = 0.5 + 0.5 * Math.sin(nowSec * 5);
      const { cx: tcx, cy: tcy } = tutS;
      ctx.fillStyle = `rgba(245,200,0,${0.25 + 0.25 * pulse})`;
      ctx.fillRect(tcx * TILE, tcy * TILE, TILE, TILE);
      ctx.strokeStyle = `rgba(200,140,0,${0.7 + 0.3 * pulse})`;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(tcx * TILE + 1, tcy * TILE + 1, TILE - 2, TILE - 2);
      // Arrow pointing down toward the cell
      const ax = tcx * TILE + TILE / 2, ay = tcy * TILE - 8;
      ctx.fillStyle = `rgba(200,130,0,${0.8 + 0.2 * pulse})`;
      ctx.beginPath();
      ctx.moveTo(ax, ay + 10);
      ctx.lineTo(ax - 7, ay);
      ctx.lineTo(ax + 7, ay);
      ctx.closePath();
      ctx.fill();
    }

    for (const t of state.towers) drawTower(ctx, t);

    // ---- Kattspår tvärs över planen ----
    if (state.scentTrail) {
      const sc = state.scentTrail;
      const age = nowSec - sc.bornAt;
      const lifeLeft = sc.expiresAt - nowSec;
      const _anyOnTrail = state.enemies.some(_e => _e.sniffedScent && !_e.sniffDone);
      const fadeOut = _anyOnTrail ? 1.0 : Math.min(1, lifeLeft * 0.6);
      const fwdX = Math.cos(sc.angle), fwdY = Math.sin(sc.angle);
      const perpX = -Math.sin(sc.angle), perpY = Math.cos(sc.angle);
      ctx.save();
      ctx.fillStyle = '#6b4226';
      sc.points.forEach((p, i) => {
        const printAge = age - i * 0.10; // varje tass dyker upp i tur och ordning
        if (printAge < 0) return;
        const a = Math.min(1, printAge * 4) * fadeOut * 0.70;
        if (a <= 0) return;
        ctx.globalAlpha = a;
        const s = 5.5;
        // Huvuddyna (oval, längs rörelseriktningen)
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, s * 0.55, s * 0.45, sc.angle + Math.PI / 2, 0, Math.PI * 2);
        ctx.fill();
        // 4 tåbönor framför huvuddynan
        const toes = [
          [ fwdX*s*1.2 - perpX*s*0.55,  fwdY*s*1.2 - perpY*s*0.55 ],
          [ fwdX*s*1.2 + perpX*s*0.55,  fwdY*s*1.2 + perpY*s*0.55 ],
          [ fwdX*s*0.65 - perpX*s*1.0,  fwdY*s*0.65 - perpY*s*1.0 ],
          [ fwdX*s*0.65 + perpX*s*1.0,  fwdY*s*0.65 + perpY*s*1.0 ],
        ];
        for (const [tx, ty] of toes) {
          ctx.beginPath(); ctx.arc(p.x + tx, p.y + ty, s * 0.28, 0, Math.PI * 2); ctx.fill();
        }
      });
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // Draw rabbit (behind dogs)
    // Persistent bajsobjekt på banan (klickbara)
    ctx.font = '18px serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const p of state.poops) {
      if (p.collected || p.dead) continue;
      const fade = p.life < 3 ? p.life / 3 : 1;
      const pulse = 1 + Math.sin(nowSec * 5) * 0.07;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.font = `${Math.round(p.r * pulse)}px serif`;
      ctx.fillText('💩', p.x, p.y);
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // Fallna ben på marken
    for (const b of state.droppedBones) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, b.life * 0.55);
      drawBone(ctx, b.x, b.y, 0.62, b.angle);
      ctx.globalAlpha = 1;
      ctx.restore();
    }
    if (state.rabbit) drawRabbit(ctx, state.rabbit, nowSec);
    if (state.bird) drawBird(ctx, state.bird);
    if (state.hydrant)  drawHydrant(ctx, state.hydrant,  nowSec);
    if (state.hydrant2) drawHydrant(ctx, state.hydrant2, nowSec);

    for (const e of state.enemies) {
      const isSlow    = nowSec < e.slowUntil;
      const chewing   = isSlow && Math.sin(nowSec * 7) > 0;
      const mouthOpen = (nowSec < (e.mouthOpenUntil || 0)) || chewing;
      const isBusiness  = nowSec < (e.businessUntil || 0);
      const isSniffing  = nowSec < (e.sniffUntil || 0);
      const isScratching  = nowSec < (e.scratchUntil || 0);
      const isSneezing    = nowSec < (e.sneezeUntil    || 0);
      const isTailChase   = nowSec < (e.tailUntil     || 0);
      const isSniffBuddy2 = nowSec < (e.sniffBuddyUntil || 0);

      // Toalett-huk: hundar kryper ihop lite
      const drawScale = isBusiness ? 0.82 : 1;
      const jumpOffset = nowSec < (e.birdJumpUntil || 0)
        ? -Math.abs(Math.sin(e.birdJumpPhase)) * e.radius * 1.6 : 0;
      const drawY = (isBusiness ? e.y + e.radius * 0.18 : e.y) + jumpOffset;
      // Klia-skak: hunden gungar lite i sidled
      const scratchWobble = isScratching ? Math.sin(nowSec * 22) * e.radius * 0.14 : 0;
      const drawX = e.x + scratchWobble;

      ctx.save();
      if (drawScale !== 1) {
        ctx.translate(drawX, drawY);
        ctx.scale(drawScale, drawScale);
        ctx.translate(-drawX, -drawY);
      }
      const sneezeNudge = isSneezing ? Math.sin(nowSec * 55) * 0.35 : 0;
      drawDog(ctx, drawX, drawY, e.radius, e.kind, {
        mouthOpen: mouthOpen || isSniffing || isSneezing || isSniffBuddy2,
        nowSec,
        facingAngle: (e.facingAngle != null ? e.facingAngle : Math.PI / 2) + sneezeNudge,
      });
      ctx.restore();

      // Klia-effekt: blinkande skraplinjer till sidan av hunden
      if (isScratching) {
        const fa = e.facingAngle != null ? e.facingAngle : Math.PI / 2;
        const sideAngle = fa + Math.PI / 2;
        const sx = e.x + Math.cos(sideAngle) * e.radius * 1.1;
        const sy = e.y + Math.sin(sideAngle) * e.radius * 1.1;
        ctx.save();
        ctx.strokeStyle = '#7a3a10';
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
          const phase = (nowSec * 18 + i * 1.05) % (Math.PI * 2);
          const alpha = Math.max(0, Math.sin(phase)) * 0.72;
          if (alpha < 0.06) continue;
          ctx.globalAlpha = alpha;
          const px = sx + Math.cos(fa) * (i - 1) * e.radius * 0.45;
          const py = sy + Math.sin(fa) * (i - 1) * e.radius * 0.45;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px + Math.cos(sideAngle) * e.radius * 0.55,
                     py + Math.sin(sideAngle) * e.radius * 0.55);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.restore();
      }

      if (isSlow) {
        ctx.strokeStyle = '#67e8f9';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius + 3, 0, Math.PI * 2);
        ctx.stroke();
        // Ben i munnen — rör sig med käken när hunden mumsar
        const fa = e.facingAngle != null ? e.facingAngle : Math.PI / 2;
        const jawOffset = chewing ? e.radius * 0.11 : 0;
        const boneDist  = e.radius * 0.58 + jawOffset;
        drawBone(ctx, e.x + Math.cos(fa) * boneDist, e.y + Math.sin(fa) * boneDist,
                 e.radius / 18, fa + Math.PI / 2);
      }

      // 💩 bakom hunden på banan (inte ovanför)
      if (isBusiness && nowSec > (e.businessUntil - 1.0)) {
        const fa = e.facingAngle != null ? e.facingAngle : Math.PI / 2;
        const poopX = e.x - Math.cos(fa) * e.radius * 1.7;
        const poopY = e.y - Math.sin(fa) * e.radius * 1.7;
        ctx.font = `${Math.round(e.radius * 1.05)}px serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.globalAlpha = Math.min(1, (nowSec - (e.businessUntil - 1.0)) * 2.5);
        ctx.fillText('💩', poopX, poopY);
        ctx.globalAlpha = 1;
      }

      // Bark/sniff-bubbla
      if (nowSec < (e.barkUntil || 0) && e.barkWord) {
        drawBarkBubble(ctx, e.x, e.y - e.radius, e.barkWord);
      }

      // Mätthetsbar — färgen varnar när mättnaden är låg
      const w = e.radius * 2.4;
      const hpFrac  = Math.max(0, e.hp / e.maxHp);
      const fillFrac = 1 - hpFrac;
      const barColor = fillFrac < 0.35 ? '#f87171' : fillFrac < 0.65 ? '#facc15' : '#4ade80';
      ctx.fillStyle = '#2a1a08';
      ctx.fillRect(e.x - w/2, e.y - e.radius - 10, w, 4);
      ctx.fillStyle = barColor;
      ctx.fillRect(e.x - w/2, e.y - e.radius - 10, w * fillFrac, 4);
    }

    for (const p of state.projectiles) drawProjectile(ctx, p, nowSec);

    // Flytande resultat-popups
    for (const p of state.popups) {
      const a = Math.min(1, p.life * 1.4);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.font = 'bold 15px -apple-system, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = p.color;
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 4;
      ctx.fillText(p.text, p.x, p.y);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    for (const f of state.fx) {
      const a = Math.max(0, f.life / 0.25);
      ctx.strokeStyle = `rgba(251,146,60,${a})`;
      ctx.lineWidth = 3 * a + 1;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r * (1.05 - a * 0.1), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function updateHUD() {
    document.querySelector('#gold .val').textContent = state.gold;
    document.querySelector('#lives .val').textContent = state.lives;
    document.querySelector('#wave .val').textContent = `${state.wave} / ${state.maxWaves}`;
    document.querySelector('#levelName .val').textContent =
      state.levelIndex >= 0 ? LEVELS[state.levelIndex].name : '—';
    const btn = document.getElementById('startBtn');
    const allDone = state.wave >= state.maxWaves && !state.waveActive;
    const hasNext = state.levelIndex >= 0 && state.levelIndex < LEVELS.length - 1;
    if (allDone && state.won && hasNext) {
      btn.disabled = false;
      btn.textContent = 'Nästa nivå';
    } else if (allDone && state.won) {
      btn.disabled = true;
      btn.textContent = '🏆 Mästare!';
    } else {
      const tutBlock = tutCurrent() !== null && tutCurrent().type !== 'wave';
      btn.disabled = state.levelIndex < 0 || state.waveActive || state.over || state.wave >= state.maxWaves || tutBlock;
      btn.textContent = state.waveActive ? `Våg ${state.wave}` : `Våg ${state.wave + 1}`;
    }
    document.getElementById('resetBtn').disabled = state.levelIndex < 0;
    for (const key of TOWER_ORDER) {
      const el = document.getElementById('btn-' + key);
      if (!el) continue;
      const t = TOWER_TYPES[key];
      el.disabled = state.levelIndex < 0;
      el.classList.toggle('cant-afford', state.gold < t.cost && state.levelIndex >= 0);
      el.classList.toggle('selected', key === state.selectedType);
    }
  }

  function buildPicker() {
    const root = document.getElementById('picker');
    root.innerHTML = '';
    TOWER_ORDER.forEach((key, idx) => {
      const t = TOWER_TYPES[key];
      const b = document.createElement('button');
      b.className = 'tower-btn';
      b.id = 'btn-' + key;
      b.style.setProperty('--c', t.color);
      b.innerHTML = `
        <canvas class="icon" width="40" height="40"></canvas>
        <div class="info">
          <span class="name">${t.name}</span>
          <span class="desc">${t.desc}</span>
          <span class="cost">${t.cost} guld</span>
        </div>
      `;
      const ic = b.querySelector('canvas.icon');
      const ictx = ic.getContext('2d');
      // Draw the tower icon centered — drawTower expects a pseudo-tower object
      drawTower(ictx, { x: 20, y: 18, type: key });
      b.addEventListener('click', () => {
        const s = tutCurrent();
        if (s && s.type === 'select' && key !== s.towerKey) return; // block wrong tower
        if (s && s.type !== 'select') return; // block all changes during place/wave steps
        state.selectedType = key;
        tutAdvance('select', key);
        updateHUD();
      });
      root.appendChild(b);
    });
  }

  function drawLevelPreview(canvasEl, path) {
    const c = canvasEl.getContext('2d');
    const cw = canvasEl.width, ch = canvasEl.height;
    c.fillStyle = '#cce4f0';
    c.fillRect(0, 0, cw, ch);
    // scale grid coords (with off-screen entries) to canvas
    // xMax = COLS+1 so that x=COLS (right-side exit) maps to ~94% of cw, not off-screen
    const xMin = -1.5, xMax = COLS + 1, yMin = -0.5, yMax = ROWS + 0.5;
    const sx = cw / (xMax - xMin);
    const sy = ch / (yMax - yMin);
    const toX = gx => (gx + 0.5 - xMin) * sx;
    const toY = gy => (gy + 0.5 - yMin) * sy;
    c.strokeStyle = '#90c878';
    c.lineWidth = 6;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(toX(path[0][0]), toY(path[0][1]));
    for (let i = 1; i < path.length; i++) c.lineTo(toX(path[i][0]), toY(path[i][1]));
    c.stroke();
    // start/end dots
    c.fillStyle = '#4ade80';
    c.beginPath(); c.arc(toX(path[0][0]), toY(path[0][1]), 4, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#f97316';
    const last = path[path.length - 1];
    c.beginPath(); c.arc(toX(last[0]), toY(last[1]), 4, 0, Math.PI * 2); c.fill();
  }

  function buildLevelGrid() {
    const root = document.getElementById('levelGrid');
    root.innerHTML = '';
    LEVELS.forEach((lvl, i) => {
      const unlocked = unlockedLevels.includes(i);
      const tag = lvl.isTutorial ? 'Tutorial' : `Nivå ${i}`;
      const waveLabel = lvl.maxWaves ? `${lvl.maxWaves} vågor` : '10 vågor';
      const card = document.createElement('button');
      card.className = 'level-card' + (unlocked ? '' : ' locked') + (lvl.isTutorial ? ' tutorial-card' : '');
      if (unlocked) {
        card.innerHTML = `
          <div class="lvl-tag">${tag}</div>
          <div class="lvl-name">${lvl.name}</div>
          <canvas width="200" height="120"></canvas>
          <div class="lvl-desc">${lvl.desc}</div>
        `;
        const canv = card.querySelector('canvas');
        requestAnimationFrame(() => drawLevelPreview(canv, lvl.path));
        card.addEventListener('click', () => loadLevel(i));
      } else {
        card.innerHTML = `
          <div class="lvl-tag">${tag}</div>
          <div class="lvl-name">${lvl.name}</div>
          <div class="lvl-preview-wrap">
            <canvas width="200" height="120"></canvas>
            <div class="lock-overlay">🔒</div>
          </div>
          <div class="lock-hint">Klara alla vågor på Nivå ${i - 1} för att låsa upp banan</div>
        `;
        const canv = card.querySelector('canvas');
        requestAnimationFrame(() => drawLevelPreview(canv, lvl.path));
      }
      root.appendChild(card);
    });
  }

  function showOverlay(title, msg, opts) {
    document.getElementById('overlayTitle').textContent = title;
    document.getElementById('overlayMsg').textContent = msg;
    document.getElementById('overlay').style.display = 'flex';
    document.getElementById('nextLevelBtn').classList.toggle('hidden', !opts || !opts.showNext);
  }
  function hideOverlay() {
    document.getElementById('overlay').style.display = 'none';
  }

  function loadLevel(idx) {
    state.levelIndex = idx;
    const lvl = LEVELS[idx];
    if (typeof gtag === 'function') gtag('event', 'level_start', { level_name: lvl.name, level_index: idx });
    currentPath = lvl.path;
    loadPath(lvl.path);
    state.hpMult = lvl.hpMult;
    state.maxWaves = lvl.maxWaves || 10;
    tutInit(lvl);
    state.gold = lvl.gold;
    state.lives = lvl.lives;
    state.wave = 0;
    state.towers = [];
    state.enemies = [];
    state.projectiles = [];
    state.spawnQueue = [];
    state.fx = [];
    state.droppedBones = [];
    state.poops = [];
    state.popups = [];
    state.waveActive = false;
    state.over = false;
    state.won = false;
    state.selectedType = 'basic';
    state.speed = 1;
    state.rabbit = null;
    state.nextRabbitAt = 8 + Math.random() * 6;
    state.scentTrail = null;
    state.nextScentAt = 12 + Math.random() * 8;
    state.bird = null;
    state.nextBirdAt = 14 + Math.random() * 10;
    state.hydrant  = null;
    state.hydrant2 = null;
    state.nextHydrantAt  = 10 + Math.random() * 8;
    state.nextHydrant2At = 16 + Math.random() * 8;
    gameTime = 0;
    if (bgMusicEl) { bgMusicEl.pause(); bgMusicEl.currentTime = 0; }
    updateSpeedButtons();
    hideOverlay();
    document.getElementById('levelSelect').classList.add('hidden');
    document.getElementById('wrap').classList.remove('hidden');
    document.getElementById('hud').classList.remove('hidden');
    document.getElementById('picker').classList.remove('hidden');
    document.getElementById('legend').classList.remove('hidden');
    updateHUD();
  }

  function reset() {
    if (state.levelIndex < 0) return;
    loadLevel(state.levelIndex);
  }

  function showLevelSelect() {
    state.levelIndex = -1;
    state.over = false;
    hideOverlay();
    buildLevelGrid(); // Rebuild to reflect any newly unlocked levels
    document.getElementById('levelSelect').classList.remove('hidden');
    document.getElementById('wrap').classList.add('hidden');
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('picker').classList.add('hidden');
    document.getElementById('tutMsg').classList.add('hidden');
    document.getElementById('legend').classList.add('hidden');
    tutSteps = null; tutStep = 0; updateTutorial();
    updateHUD();
  }

  // Input
  canvas.addEventListener('mousemove', e => {
    const r = canvas.getBoundingClientRect();
    const mx = (e.clientX - r.left) * (canvas.width / r.width);
    const my = (e.clientY - r.top) * (canvas.height / r.height);
    state.hover = { cx: Math.floor(mx / TILE), cy: Math.floor(my / TILE) };
  });
  canvas.addEventListener('mouseleave', () => { state.hover = null; });
  canvas.addEventListener('click', e => {
    const r = canvas.getBoundingClientRect();
    const mx = (e.clientX - r.left) * (canvas.width / r.width);
    const my = (e.clientY - r.top) * (canvas.height / r.height);
    // Kolla om man klickar på bajs
    for (const p of state.poops) {
      if (p.collected || p.dead) continue;
      if (Math.hypot(mx - p.x, my - p.y) < 18) {
        p.collected = true;
        state.gold += 10;
        state.popups.push({ x: p.x, y: p.y - 12, text: '+10 💰', color: '#22c55e', life: 1.8, vy: -28 });
        updateHUD();
        return;
      }
    }
    tryPlaceTower(mx, my);
  });
  function advanceOrStart() {
    const s = tutCurrent();
    if (s && s.type !== 'wave') return; // block until wave step reached
    tutAdvance('wave', null);
    if (state.won && state.wave >= state.maxWaves && state.levelIndex < LEVELS.length - 1) {
      loadLevel(state.levelIndex + 1);
    } else {
      startWave();
    }
  }
  document.getElementById('startBtn').addEventListener('click', advanceOrStart);
  document.getElementById('restartBtn').addEventListener('click', reset);
  document.getElementById('resetBtn').addEventListener('click', () => {
    if (state.wave === 0 && !state.waveActive) { reset(); return; }
    if (confirm('Starta om nivån? Ditt framsteg försvinner.')) reset();
  });
  document.getElementById('infoBtn').addEventListener('click', () => {
    openManual();
    tutAdvance('info');
  });
  document.getElementById('closeManual').addEventListener('click', closeManual);
  document.getElementById('manualOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('manualOverlay')) closeManual();
  });
  document.getElementById('levelsBtn').addEventListener('click', () => {
    const hasProgress = (state.waveActive || state.wave > 0) && !state.over;
    if (hasProgress) {
      const wasMusicPlaying = bgMusicEl && !bgMusicEl.paused;
      if (wasMusicPlaying) bgMusicEl.pause();
      if (!confirm('Lämna nivån? Ditt framsteg försvinner.')) {
        if (wasMusicPlaying) bgMusicEl.play().catch(() => {});
        return;
      }
    }
    showLevelSelect();
  });
  document.getElementById('nextLevelBtn').addEventListener('click', () => {
    if (state.levelIndex < LEVELS.length - 1) loadLevel(state.levelIndex + 1);
  });
  document.getElementById('backToLevelsBtn').addEventListener('click', showLevelSelect);
  document.addEventListener('keydown', e => {
    if (state.levelIndex < 0) return;
    if (e.code === 'Space') {
      e.preventDefault();
      const s = tutCurrent();
      if (!s || s.type === 'wave') advanceOrStart();
      return;
    }
    if (tutCurrent()) return; // block shortcut keys during tutorial
    if (e.key >= '1' && e.key <= '4') {
      const idx = parseInt(e.key, 10) - 1;
      if (TOWER_ORDER[idx]) { state.selectedType = TOWER_ORDER[idx]; updateHUD(); }
    }
  });

  function updateSpeedButtons() {
    document.querySelectorAll('.speed-btn').forEach(b => {
      b.classList.toggle('active', parseInt(b.dataset.speed) === state.speed);
    });
  }
  document.querySelectorAll('.speed-btn').forEach(b => {
    b.addEventListener('click', () => { state.speed = parseInt(b.dataset.speed); updateSpeedButtons(); });
  });

  buildPicker();
  buildLevelGrid();
  showLevelSelect();

  // ---- Music (deferas tills DOM är klar) ----
  window.addEventListener('DOMContentLoaded', () => {
    bgMusicEl = document.getElementById('bgMusic');
    if (!bgMusicEl) return;
    bgMusicEl.volume = 0.45;
    // Musik startas av startWave() — ingen auto-play vid sidladdning
    const muteBtn = document.getElementById('muteBtn');
    if (muteBtn) muteBtn.addEventListener('click', () => {
      bgMusicEl.muted = !bgMusicEl.muted;
      muteBtn.textContent = bgMusicEl.muted ? '🔇' : '🔊';
      muteBtn.classList.toggle('muted', bgMusicEl.muted);
    });
  });

  let last = performance.now();
  let gamePaused = false;
  let manualMusicWasPlaying = false;

  function openManual() {
    const duringWave = state.waveActive && !state.over;
    if (duringWave) {
      gamePaused = true;
      manualMusicWasPlaying = bgMusicEl && !bgMusicEl.paused;
      if (manualMusicWasPlaying) bgMusicEl.pause();
    }
    document.getElementById('manualOverlay').classList.add('open');
  }
  function closeManual() {
    document.getElementById('manualOverlay').classList.remove('open');
    if (gamePaused) {
      gamePaused = false;
      if (manualMusicWasPlaying && bgMusicEl && !bgMusicEl.muted) bgMusicEl.play().catch(() => {});
      manualMusicWasPlaying = false;
      last = performance.now(); // nollställ last för att undvika tidsshopp
    }
  }

  function loop(now) {
    if (gamePaused) { last = now; requestAnimationFrame(loop); return; }
    const rawDt = Math.min(0.05, (now - last) / 1000);
    const dt = rawDt * state.speed;
    gameTime += dt;
    last = now;
    update(dt, gameTime);
    draw(gameTime);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
