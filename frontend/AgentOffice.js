// Curvature Labs - 游戏主逻辑
// 依赖: layout.js（必须在这个之前加载）

// 检测浏览器是否支持 WebP
let supportsWebP = false;

// 方法 1: 使用 canvas 检测
function checkWebPSupport() {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    if (canvas.getContext && canvas.getContext('2d')) {
      resolve(canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0);
    } else {
      resolve(false);
    }
  });
}

// 方法 2: 使用 image 检测（备用）
function checkWebPSupportFallback() {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = 'data:image/webp;base64,UklGRkoAAABXRUJQVlA4WAoAAAAQAAAAAAAAAAAAQUxQSAwAAAABBxAR/Q9ERP8DAABWUDggGAAAADABAJ0BKgEAAQADADQlpAADcAD++/1QAA==';
  });
}

// 获取文件扩展名（根据 WebP 支持情况 + 布局配置的 forcePng）
function getExt(pngFile) {
  // star-working-spritesheet.png 太宽了，WebP 不支持，始终用 PNG
  if (pngFile === 'star-working-spritesheet.png') {
    return '.png';
  }
  // 如果布局配置里强制用 PNG，就用 .png
  if (LAYOUT.forcePng && LAYOUT.forcePng[pngFile.replace(/\.(png|webp)$/, '')]) {
    return '.png';
  }
  return supportsWebP ? '.webp' : '.png';
}

const config = {
  type: Phaser.AUTO,
  width: LAYOUT.game.width,
  height: LAYOUT.game.height,
  parent: 'game-container',
  pixelArt: true,
  physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
  scene: { preload: preload, create: create, update: update }
};

let totalAssets = 0;
let loadedAssets = 0;
let loadingProgressBar, loadingProgressContainer, loadingOverlay, loadingText;

// Memo 相关函数
async function loadMemo() {
  const memoDate = document.getElementById('memo-date');
  const memoContent = document.getElementById('memo-content');

  try {
    const response = await fetch('/yesterday-memo?t=' + Date.now(), { cache: 'no-store' });
    const data = await response.json();

    if (data.success && data.memo) {
      memoDate.textContent = data.date || '';
      memoContent.innerHTML = data.memo.replace(/\n/g, '<br>');
    } else {
      memoContent.innerHTML = '<div id="memo-placeholder">暂无昨日日记</div>';
    }
  } catch (e) {
    console.error('加载 memo 失败:', e);
    memoContent.innerHTML = '<div id="memo-placeholder">加载失败</div>';
  }
}

// 更新加载进度
function updateLoadingProgress() {
  loadedAssets++;
  const percent = Math.min(100, Math.round((loadedAssets / totalAssets) * 100));
  if (loadingProgressBar) {
    loadingProgressBar.style.width = percent + '%';
  }
  if (loadingText) {
    loadingText.textContent = `正在加载 Curvature Labs 像素办公室... ${percent}%`;
  }
}

// 隐藏加载界面
function hideLoadingOverlay() {
  setTimeout(() => {
    if (loadingOverlay) {
      loadingOverlay.style.transition = 'opacity 0.5s ease';
      loadingOverlay.style.opacity = '0';
      setTimeout(() => {
        loadingOverlay.style.display = 'none';
      }, 500);
    }
  }, 300);
}

const STATES = {
  idle: { name: '待命', area: 'breakroom' },
  writing: { name: '整理文档', area: 'writing' },
  researching: { name: '搜索信息', area: 'researching' },
  executing: { name: '执行任务', area: 'writing' },
  syncing: { name: '同步备份', area: 'writing' },
  error: { name: '出错了', area: 'error' }
};

const BUBBLE_TEXTS = {
  idle: [
    '待命中：耳朵竖起来了',
    '我在这儿，随时可以开工',
    '先把桌面收拾干净再说',
    '呼——给大脑放个风',
    '今天也要优雅地高效',
    '等待，是为了更准确的一击',
    '咖啡还热，灵感也还在',
    '我在后台给你加 Buff',
    '状态：静心 / 充电',
    '小猫说：慢一点也没关系'
  ],
  writing: [
    '进入专注模式：勿扰',
    '先把关键路径跑通',
    '我来把复杂变简单',
    '把 bug 关进笼子里',
    '写到一半，先保存',
    '把每一步都做成可回滚',
    '今天的进度，明天的底气',
    '先收敛，再发散',
    '让系统变得更可解释',
    '稳住，我们能赢'
  ],
  researching: [
    '我在挖证据链',
    '让我把信息熬成结论',
    '找到了：关键在这里',
    '先把变量控制住',
    '我在查：它为什么会这样',
    '把直觉写成验证',
    '先定位，再优化',
    '别急，先画因果图'
  ],
  executing: [
    '执行中：不要眨眼',
    '把任务切成小块逐个击破',
    '开始跑 pipeline',
    '一键推进：走你',
    '让结果自己说话',
    '先做最小可行，再做最美版本'
  ],
  syncing: [
    '同步中：把今天锁进云里',
    '备份不是仪式，是安全感',
    '写入中…别断电',
    '把变更交给时间戳',
    '云端对齐：咔哒',
    '同步完成前先别乱动',
    '把未来的自己从灾难里救出来',
    '多一份备份，少一份后悔'
  ],
  error: [
    '警报响了：先别慌',
    '我闻到 bug 的味道了',
    '先复现，再谈修复',
    '把日志给我，我会说人话',
    '错误不是敌人，是线索',
    '把影响面圈起来',
    '先止血，再手术',
    '我在：马上定位根因',
    '别怕，这种我见多了',
    '报警中：让问题自己现形'
  ],
  cat: [
    '喵~',
    '咕噜咕噜…',
    '尾巴摇一摇',
    '晒太阳最开心',
    '有人来看我啦',
    '我是这个办公室的吉祥物',
    '伸个懒腰',
    '今天的罐罐准备好了吗',
    '呼噜呼噜',
    '这个位置视野最好'
  ]
};

let game, star, sofa, serverroom, areas = {}, currentState = 'idle', pendingDesiredState = null, statusText, lastFetch = 0, lastBlink = 0, lastBubble = 0, targetX = 660, targetY = 170, bubble = null, typewriterText = '', typewriterTarget = '', typewriterIndex = 0, lastTypewriter = 0, syncAnimSprite = null, catBubble = null;
let isMoving = false;
let waypoints = [];
let lastWanderAt = 0;
let coordsOverlay, coordsDisplay, coordsToggle;
let showCoords = false;
const FETCH_INTERVAL = 2000;
const BLINK_INTERVAL = 2500;
const BUBBLE_INTERVAL = 8000;
const CAT_BUBBLE_INTERVAL = 18000;
let lastCatBubble = 0;
const TYPEWRITER_DELAY = 50;
let agents = {}; // agentId -> sprite/container
let lastAgentsFetch = 0;
const AGENTS_FETCH_INTERVAL = 2500;

// agent 颜色配置
const AGENT_COLORS = {
  star: 0xffd700,
  npc1: 0x00aaff,
  agent_nika: 0xff69b4,
  default: 0x94a3b8
};

// agent 名字颜色
const NAME_TAG_COLORS = {
  approved: 0x22c55e,
  pending: 0xf59e0b,
  rejected: 0xef4444,
  offline: 0x64748b,
  default: 0x1f2937
};

// breakroom / writing / error 区域的 agent 分布位置（多 agent 时错开）
const AREA_POSITIONS = {
  breakroom: [
    { x: 620, y: 180 },
    { x: 560, y: 220 },
    { x: 680, y: 210 },
    { x: 540, y: 170 },
    { x: 700, y: 240 },
    { x: 600, y: 250 },
    { x: 650, y: 160 },
    { x: 580, y: 200 }
  ],
  writing: [
    { x: 760, y: 320 },
    { x: 830, y: 280 },
    { x: 690, y: 350 },
    { x: 770, y: 260 },
    { x: 850, y: 340 },
    { x: 720, y: 300 },
    { x: 800, y: 370 },
    { x: 750, y: 240 }
  ],
  error: [
    { x: 180, y: 260 },
    { x: 120, y: 220 },
    { x: 240, y: 230 },
    { x: 160, y: 200 },
    { x: 220, y: 270 },
    { x: 140, y: 250 },
    { x: 200, y: 210 },
    { x: 260, y: 260 }
  ]
};


// 状态控制栏函数（用于测试）
function setState(state, detail) {
  fetch('/set_state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state, detail })
  }).then(() => fetchStatus());
}

// 初始化：先检测 WebP 支持，再启动游戏
async function initGame() {
  try {
    supportsWebP = await checkWebPSupport();
  } catch (e) {
    try {
      supportsWebP = await checkWebPSupportFallback();
    } catch (e2) {
      supportsWebP = false;
    }
  }

  console.log('WebP 支持:', supportsWebP);
  new Phaser.Game(config);
}

function preload() {
  loadingOverlay = document.getElementById('loading-overlay');
  loadingProgressBar = document.getElementById('loading-progress-bar');
  loadingText = document.getElementById('loading-text');
  loadingProgressContainer = document.getElementById('loading-progress-container');

  // 从 LAYOUT 读取总资源数量（避免 magic number）
  totalAssets = LAYOUT.totalAssets || 15;
  loadedAssets = 0;

  this.load.on('filecomplete', () => {
    updateLoadingProgress();
  });

  this.load.on('complete', () => {
    hideLoadingOverlay();
  });

  this.load.image('office_bg', '/static/office_bg_small' + (supportsWebP ? '.webp' : '.png') + '?v={{VERSION_TIMESTAMP}}');
  this.load.spritesheet('star_idle', '/static/star-idle-spritesheet' + getExt('star-idle-spritesheet.png'), { frameWidth: 128, frameHeight: 128 });
  this.load.spritesheet('star_researching', '/static/star-researching-spritesheet' + getExt('star-researching-spritesheet.png'), { frameWidth: 128, frameHeight: 105 });

  this.load.image('sofa_idle', '/static/sofa-idle' + getExt('sofa-idle.png'));
  this.load.spritesheet('sofa_busy', '/static/sofa-busy-spritesheet' + getExt('sofa-busy-spritesheet.png'), { frameWidth: 256, frameHeight: 256 });

  this.load.spritesheet('plants', '/static/plants-spritesheet' + getExt('plants-spritesheet.png'), { frameWidth: 160, frameHeight: 160 });
  this.load.spritesheet('posters', '/static/posters-spritesheet' + getExt('posters-spritesheet.png'), { frameWidth: 160, frameHeight: 160 });
  this.load.spritesheet('coffee_machine', '/static/coffee-machine-spritesheet' + getExt('coffee-machine-spritesheet.png'), { frameWidth: 230, frameHeight: 230 });
  this.load.spritesheet('serverroom', '/static/serverroom-spritesheet' + getExt('serverroom-spritesheet.png'), { frameWidth: 180, frameHeight: 251 });

  this.load.spritesheet('error_bug', '/static/error-bug-spritesheet-grid' + (supportsWebP ? '.webp' : '.png'), { frameWidth: 180, frameHeight: 180 });
  this.load.spritesheet('cats', '/static/cats-spritesheet' + (supportsWebP ? '.webp' : '.png'), { frameWidth: 160, frameHeight: 160 });
  this.load.image('desk', '/static/desk' + getExt('desk.png'));
  this.load.spritesheet('star_working', '/static/star-working-spritesheet-grid' + (supportsWebP ? '.webp' : '.png'), { frameWidth: 230, frameHeight: 144 });
  this.load.spritesheet('sync_anim', '/static/sync-animation-spritesheet-grid' + (supportsWebP ? '.webp' : '.png'), { frameWidth: 256, frameHeight: 256 });
  this.load.image('memo_bg', '/static/memo-bg' + (supportsWebP ? '.webp' : '.png'));

  // 新办公桌：强制 PNG（透明）
  this.load.image('desk_v2', '/static/desk-v2.png');
  this.load.spritesheet('flowers', '/static/flowers-spritesheet' + (supportsWebP ? '.webp' : '.png'), { frameWidth: 65, frameHeight: 65 });
}

function create() {
  game = this;
  this.add.image(640, 360, 'office_bg');

  // === 沙发（来自 LAYOUT）===
  sofa = this.add.sprite(
    LAYOUT.furniture.sofa.x,
    LAYOUT.furniture.sofa.y,
    'sofa_busy'
  ).setOrigin(LAYOUT.furniture.sofa.origin.x, LAYOUT.furniture.sofa.origin.y);
  sofa.setDepth(LAYOUT.furniture.sofa.depth);

  this.anims.create({
    key: 'sofa_busy',
    frames: this.anims.generateFrameNumbers('sofa_busy', { start: 0, end: 47 }),
    frameRate: 12,
    repeat: -1
  });

  areas = LAYOUT.areas;

  this.anims.create({
    key: 'star_idle',
    frames: this.anims.generateFrameNumbers('star_idle', { start: 0, end: 29 }),
    frameRate: 12,
    repeat: -1
  });
  this.anims.create({
    key: 'star_researching',
    frames: this.anims.generateFrameNumbers('star_researching', { start: 0, end: 95 }),
    frameRate: 12,
    repeat: -1
  });

  star = game.physics.add.sprite(areas.breakroom.x, areas.breakroom.y, 'star_idle');
  star.setOrigin(0.5);
  star.setScale(1.4);
  star.setAlpha(0.95);
  star.setDepth(20);
  star.setVisible(false);
  star.anims.stop();

  if (game.textures.exists('sofa_busy')) {
    sofa.setTexture('sofa_busy');
    sofa.anims.play('sofa_busy', true);
  }

  // === 牌匾（来自 LAYOUT）===
  const plaqueX = LAYOUT.plaque.x;
  const plaqueY = LAYOUT.plaque.y;
  const plaqueBg = game.add.rectangle(plaqueX, plaqueY, LAYOUT.plaque.width, LAYOUT.plaque.height, 0x5d4037);
  plaqueBg.setStrokeStyle(3, 0x3e2723);
  const plaqueText = game.add.text(plaqueX, plaqueY, '海辛小龙虾的办公室', {
    fontFamily: 'ArkPixel, monospace',
    fontSize: '18px',
    fill: '#ffd700',
    fontWeight: 'bold',
    stroke: '#000',
    strokeThickness: 2
  }).setOrigin(0.5);
  game.add.text(plaqueX - 190, plaqueY, '⭐', { fontFamily: 'ArkPixel, monospace', fontSize: '20px' }).setOrigin(0.5);
  game.add.text(plaqueX + 190, plaqueY, '⭐', { fontFamily: 'ArkPixel, monospace', fontSize: '20px' }).setOrigin(0.5);

  // === 植物们（来自 LAYOUT）===
  const plantFrameCount = 16;
  for (let i = 0; i < LAYOUT.furniture.plants.length; i++) {
    const p = LAYOUT.furniture.plants[i];
    const randomPlantFrame = Math.floor(Math.random() * plantFrameCount);
    const plant = game.add.sprite(p.x, p.y, 'plants', randomPlantFrame).setOrigin(0.5);
    plant.setDepth(p.depth);
    plant.setInteractive({ useHandCursor: true });
    window[`plantSprite${i === 0 ? '' : i + 1}`] = plant;
    plant.on('pointerdown', (() => {
      const next = Math.floor(Math.random() * plantFrameCount);
      plant.setFrame(next);
    }));
  }

  // === 海报（来自 LAYOUT）===
  const postersFrameCount = 32;
  const randomPosterFrame = Math.floor(Math.random() * postersFrameCount);
  const poster = game.add.sprite(LAYOUT.furniture.poster.x, LAYOUT.furniture.poster.y, 'posters', randomPosterFrame).setOrigin(0.5);
  poster.setDepth(LAYOUT.furniture.poster.depth);
  poster.setInteractive({ useHandCursor: true });
  window.posterSprite = poster;
  window.posterFrameCount = postersFrameCount;
  poster.on('pointerdown', () => {
    const next = Math.floor(Math.random() * window.posterFrameCount);
    window.posterSprite.setFrame(next);
  });

  // === 小猫（来自 LAYOUT）===
  const catsFrameCount = 16;
  const randomCatFrame = Math.floor(Math.random() * catsFrameCount);
  const cat = game.add.sprite(LAYOUT.furniture.cat.x, LAYOUT.furniture.cat.y, 'cats', randomCatFrame).setOrigin(LAYOUT.furniture.cat.origin.x, LAYOUT.furniture.cat.origin.y);
  cat.setDepth(LAYOUT.furniture.cat.depth);
  cat.setInteractive({ useHandCursor: true });
  window.catSprite = cat;
  window.catsFrameCount = catsFrameCount;
  cat.on('pointerdown', () => {
    const next = Math.floor(Math.random() * window.catsFrameCount);
    window.catSprite.setFrame(next);
  });

  // === 咖啡机（来自 LAYOUT）===
  this.anims.create({
    key: 'coffee_machine',
    frames: this.anims.generateFrameNumbers('coffee_machine', { start: 0, end: 95 }),
    frameRate: 12.5,
    repeat: -1
  });
  const coffeeMachine = this.add.sprite(
    LAYOUT.furniture.coffeeMachine.x,
    LAYOUT.furniture.coffeeMachine.y,
    'coffee_machine'
  ).setOrigin(LAYOUT.furniture.coffeeMachine.origin.x, LAYOUT.furniture.coffeeMachine.origin.y);
  coffeeMachine.setDepth(LAYOUT.furniture.coffeeMachine.depth);
  coffeeMachine.anims.play('coffee_machine', true);

  // === 服务器区（来自 LAYOUT）===
  this.anims.create({
    key: 'serverroom_on',
    frames: this.anims.generateFrameNumbers('serverroom', { start: 0, end: 39 }),
    frameRate: 6,
    repeat: -1
  });
  serverroom = this.add.sprite(
    LAYOUT.furniture.serverroom.x,
    LAYOUT.furniture.serverroom.y,
    'serverroom',
    0
  ).setOrigin(LAYOUT.furniture.serverroom.origin.x, LAYOUT.furniture.serverroom.origin.y);
  serverroom.setDepth(LAYOUT.furniture.serverroom.depth);
  serverroom.anims.stop();
  serverroom.setFrame(0);

  // === 新办公桌（来自 LAYOUT，强制透明 PNG）===
  const desk = this.add.image(
    LAYOUT.furniture.desk.x,
    LAYOUT.furniture.desk.y,
    'desk_v2'
  ).setOrigin(LAYOUT.furniture.desk.origin.x, LAYOUT.furniture.desk.origin.y);
  desk.setDepth(LAYOUT.furniture.desk.depth);

  // === 花盆（来自 LAYOUT）===
  const flowerFrameCount = 16;
  const randomFlowerFrame = Math.floor(Math.random() * flowerFrameCount);
  const flower = this.add.sprite(
    LAYOUT.furniture.flower.x,
    LAYOUT.furniture.flower.y,
    'flowers',
    randomFlowerFrame
  ).setOrigin(LAYOUT.furniture.flower.origin.x, LAYOUT.furniture.flower.origin.y);
  flower.setScale(LAYOUT.furniture.flower.scale || 1);
  flower.setDepth(LAYOUT.furniture.flower.depth);
  flower.setInteractive({ useHandCursor: true });
  window.flowerSprite = flower;
  window.flowerFrameCount = flowerFrameCount;
  flower.on('pointerdown', () => {
    const next = Math.floor(Math.random() * window.flowerFrameCount);
    window.flowerSprite.setFrame(next);
  });

  // === Star 在桌前工作（来自 LAYOUT）===
  this.anims.create({
    key: 'star_working',
    frames: this.anims.generateFrameNumbers('star_working', { start: 0, end: 191 }),
    frameRate: 12,
    repeat: -1
  });
  this.anims.create({
    key: 'error_bug',
    frames: this.anims.generateFrameNumbers('error_bug', { start: 0, end: 95 }),
    frameRate: 12,
    repeat: -1
  });

  // === 错误 bug（来自 LAYOUT）===
  const errorBug = this.add.sprite(
    LAYOUT.furniture.errorBug.x,
    LAYOUT.furniture.errorBug.y,
    'error_bug',
    0
  ).setOrigin(LAYOUT.furniture.errorBug.origin.x, LAYOUT.furniture.errorBug.origin.y);
  errorBug.setDepth(LAYOUT.furniture.errorBug.depth);
  errorBug.setVisible(false);
  errorBug.setScale(LAYOUT.furniture.errorBug.scale);
  errorBug.anims.play('error_bug', true);
  window.errorBug = errorBug;
  window.errorBugDir = 1;

  const starWorking = this.add.sprite(
    LAYOUT.furniture.starWorking.x,
    LAYOUT.furniture.starWorking.y,
    'star_working',
    0
  ).setOrigin(LAYOUT.furniture.starWorking.origin.x, LAYOUT.furniture.starWorking.origin.y);
  starWorking.setVisible(false);
  starWorking.setScale(LAYOUT.furniture.starWorking.scale);
  starWorking.setDepth(LAYOUT.furniture.starWorking.depth);
  window.starWorking = starWorking;

  // === 同步动画（来自 LAYOUT）===
  this.anims.create({
    key: 'sync_anim',
    frames: this.anims.generateFrameNumbers('sync_anim', { start: 1, end: 52 }),
    frameRate: 12,
    repeat: -1
  });
  syncAnimSprite = this.add.sprite(
    LAYOUT.furniture.syncAnim.x,
    LAYOUT.furniture.syncAnim.y,
    'sync_anim',
    0
  ).setOrigin(LAYOUT.furniture.syncAnim.origin.x, LAYOUT.furniture.syncAnim.origin.y);
  syncAnimSprite.setDepth(LAYOUT.furniture.syncAnim.depth);
  syncAnimSprite.anims.stop();
  syncAnimSprite.setFrame(0);

  window.starSprite = star;

  statusText = document.getElementById('status-text');
  coordsOverlay = document.getElementById('coords-overlay');
  coordsDisplay = document.getElementById('coords-display');
  coordsToggle = document.getElementById('coords-toggle');

  coordsToggle.addEventListener('click', () => {
    showCoords = !showCoords;
    coordsOverlay.style.display = showCoords ? 'block' : 'none';
    coordsToggle.textContent = showCoords ? '隐藏坐标' : '显示坐标';
    coordsToggle.style.background = showCoords ? '#e94560' : '#333';
  });

  game.input.on('pointermove', (pointer) => {
    if (!showCoords) return;
    const x = Math.max(0, Math.min(config.width - 1, Math.round(pointer.x)));
    const y = Math.max(0, Math.min(config.height - 1, Math.round(pointer.y)));
    coordsDisplay.textContent = `${x}, ${y}`;
    coordsOverlay.style.left = (pointer.x + 18) + 'px';
    coordsOverlay.style.top = (pointer.y + 18) + 'px';
  });

  loadMemo();
  fetchStatus();
  // fetchAgents(); removed to prevent deleting WS agents
  initWebSocket();

  // 可选调试：仅在显式开启 debug 模式时渲染测试用尼卡 agent
  let debugAgents = false;
  try {
    if (typeof window !== 'undefined') {
      if (window.STAR_OFFICE_DEBUG_AGENTS === true) {
        debugAgents = true;
      } else if (window.location && window.location.search && typeof URLSearchParams !== 'undefined') {
        const sp = new URLSearchParams(window.location.search);
        if (sp.get('debugAgents') === '1') {
          debugAgents = true;
        }
      }
    }
  } catch (e) {
    debugAgents = false;
  }

  if (debugAgents) {
    const testNika = {
      agentId: 'agent_nika',
      name: '尼卡',
      isMain: false,
      state: 'writing',
      detail: '在画像素画...',
      area: 'writing',
      authStatus: 'approved',
      updated_at: new Date().toISOString(), project_name: (payload.task_context && payload.task_context.project_name) ? payload.task_context.project_name : 'Agent Workspace'
    };
    renderAgent(testNika);

    window.testNikaState = 'writing';
    window.testNikaTimer = setInterval(() => {
      const states = ['idle', 'writing', 'researching', 'executing'];
      const areas = { idle: 'breakroom', writing: 'writing', researching: 'writing', executing: 'writing' };
      window.testNikaState = states[Math.floor(Math.random() * states.length)];
      const testAgent = {
        agentId: 'agent_nika',
        name: '尼卡',
        isMain: false,
        state: window.testNikaState,
        detail: '在画像素画...',
        area: areas[window.testNikaState],
        authStatus: 'approved',
        updated_at: new Date().toISOString(), project_name: (payload.task_context && payload.task_context.project_name) ? payload.task_context.project_name : 'Agent Workspace'
      };
      renderAgent(testAgent);
    }, 5000);
  }
}

function update(time) {
  
  

  const effectiveStateForServer = pendingDesiredState || currentState;
  if (serverroom) {
    if (effectiveStateForServer === 'idle') {
      if (serverroom.anims.isPlaying) {
        serverroom.anims.stop();
        serverroom.setFrame(0);
      }
    } else {
      if (!serverroom.anims.isPlaying || serverroom.anims.currentAnim?.key !== 'serverroom_on') {
        serverroom.anims.play('serverroom_on', true);
      }
    }
  }

  if (window.errorBug) {
    if (effectiveStateForServer === 'error') {
      window.errorBug.setVisible(true);
      if (!window.errorBug.anims.isPlaying || window.errorBug.anims.currentAnim?.key !== 'error_bug') {
        window.errorBug.anims.play('error_bug', true);
      }
      const leftX = LAYOUT.furniture.errorBug.pingPong.leftX;
      const rightX = LAYOUT.furniture.errorBug.pingPong.rightX;
      const speed = LAYOUT.furniture.errorBug.pingPong.speed;
      const dir = window.errorBugDir || 1;
      window.errorBug.x += speed * dir;
      window.errorBug.y = LAYOUT.furniture.errorBug.y;
      if (window.errorBug.x >= rightX) {
        window.errorBug.x = rightX;
        window.errorBugDir = -1;
      } else if (window.errorBug.x <= leftX) {
        window.errorBug.x = leftX;
        window.errorBugDir = 1;
      }
    } else {
      window.errorBug.setVisible(false);
      window.errorBug.anims.stop();
    }
  }

  if (syncAnimSprite) {
    if (effectiveStateForServer === 'syncing') {
      if (!syncAnimSprite.anims.isPlaying || syncAnimSprite.anims.currentAnim?.key !== 'sync_anim') {
        syncAnimSprite.anims.play('sync_anim', true);
      }
    } else {
      if (syncAnimSprite.anims.isPlaying) syncAnimSprite.anims.stop();
      syncAnimSprite.setFrame(0);
    }
  }

  if (time - lastBubble > BUBBLE_INTERVAL) {
    showBubble();
    lastBubble = time;
  }
  if (time - lastCatBubble > CAT_BUBBLE_INTERVAL) {
    showCatBubble();
    lastCatBubble = time;
  }

  if (typewriterIndex < typewriterTarget.length && time - lastTypewriter > TYPEWRITER_DELAY) {
    typewriterText += typewriterTarget[typewriterIndex];
    statusText.textContent = typewriterText;
    typewriterIndex++;
    lastTypewriter = time;
  }

  moveStar(time);
}

function normalizeState(s) {
  if (!s) return 'idle';
  if (s === 'working') return 'writing';
  if (s === 'run' || s === 'running') return 'executing';
  if (s === 'sync') return 'syncing';
  if (s === 'research') return 'researching';
  return s;
}

function fetchStatus() {
  fetch('/status')
    .then(response => response.json())
    .then(data => {
      const nextState = normalizeState(data.state);
      const stateInfo = STATES[nextState] || STATES.idle;
      const changed = (pendingDesiredState === null) && (nextState !== currentState);
      const nextLine = '[' + stateInfo.name + '] ' + (data.detail || '...');
      caspAgentCache['main'] = { name: 'Main Orchestrator', isMain: true, state: nextState, detail: detail, project_name: (payload.task_context && payload.task_context.project_name) ? payload.task_context.project_name : 'Global' };
    if (changed) {
        typewriterTarget = nextLine;
        typewriterText = '';
        typewriterIndex = 0;

        pendingDesiredState = null;
        currentState = nextState;

        if (nextState === 'idle') {
          if (game.textures.exists('sofa_busy')) {
            sofa.setTexture('sofa_busy');
            sofa.anims.play('sofa_busy', true);
          }
          star.setVisible(false);
          star.anims.stop();
          if (window.starWorking) {
            window.starWorking.setVisible(false);
            window.starWorking.anims.stop();
          }
        } else if (nextState === 'error') {
          sofa.anims.stop();
          sofa.setTexture('sofa_idle');
          star.setVisible(false);
          star.anims.stop();
          if (window.starWorking) {
            window.starWorking.setVisible(false);
            window.starWorking.anims.stop();
          }
        } else if (nextState === 'syncing') {
          sofa.anims.stop();
          sofa.setTexture('sofa_idle');
          star.setVisible(false);
          star.anims.stop();
          if (window.starWorking) {
            window.starWorking.setVisible(false);
            window.starWorking.anims.stop();
          }
        } else {
          sofa.anims.stop();
          sofa.setTexture('sofa_idle');
          star.setVisible(false);
          star.anims.stop();
          if (window.starWorking) {
            window.starWorking.setVisible(true);
            window.starWorking.anims.play('star_working', true);
          }
        }

        if (serverroom) {
          if (nextState === 'idle') {
            serverroom.anims.stop();
            serverroom.setFrame(0);
          } else {
            serverroom.anims.play('serverroom_on', true);
          }
        }

        if (syncAnimSprite) {
          if (nextState === 'syncing') {
            if (!syncAnimSprite.anims.isPlaying || syncAnimSprite.anims.currentAnim?.key !== 'sync_anim') {
              syncAnimSprite.anims.play('sync_anim', true);
            }
          } else {
            if (syncAnimSprite.anims.isPlaying) syncAnimSprite.anims.stop();
            syncAnimSprite.setFrame(0);
          }
        }
      } else {
        if (!typewriterTarget || typewriterTarget !== nextLine) {
          typewriterTarget = nextLine;
          typewriterText = '';
          typewriterIndex = 0;
        }
      }
    })
    .catch(error => {
      typewriterTarget = '连接失败，正在重试...';
      typewriterText = '';
      typewriterIndex = 0;
    });
}

function moveStar(time) {
  const effectiveState = pendingDesiredState || currentState;
  const stateInfo = STATES[effectiveState] || STATES.idle;
  const baseTarget = areas[stateInfo.area] || areas.breakroom;

  const dx = targetX - star.x;
  const dy = targetY - star.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const speed = 1.4;
  const wobble = Math.sin(time / 200) * 0.8;

  if (dist > 3) {
    star.x += (dx / dist) * speed;
    star.y += (dy / dist) * speed;
    star.setY(star.y + wobble);
    isMoving = true;
  } else {
    if (waypoints && waypoints.length > 0) {
      waypoints.shift();
      if (waypoints.length > 0) {
        targetX = waypoints[0].x;
        targetY = waypoints[0].y;
        isMoving = true;
      } else {
        if (pendingDesiredState !== null) {
          isMoving = false;
          currentState = pendingDesiredState;
          pendingDesiredState = null;

          if (currentState === 'idle') {
            star.setVisible(false);
            star.anims.stop();
            if (window.starWorking) {
              window.starWorking.setVisible(false);
              window.starWorking.anims.stop();
            }
          } else {
            star.setVisible(false);
            star.anims.stop();
            if (window.starWorking) {
              window.starWorking.setVisible(true);
              window.starWorking.anims.play('star_working', true);
            }
          }
        }
      }
    } else {
      if (pendingDesiredState !== null) {
        isMoving = false;
        currentState = pendingDesiredState;
        pendingDesiredState = null;

        if (currentState === 'idle') {
          star.setVisible(false);
          star.anims.stop();
          if (window.starWorking) {
            window.starWorking.setVisible(false);
            window.starWorking.anims.stop();
          }
          if (game.textures.exists('sofa_busy')) {
            sofa.setTexture('sofa_busy');
            sofa.anims.play('sofa_busy', true);
          }
        } else {
          star.setVisible(false);
          star.anims.stop();
          if (window.starWorking) {
            window.starWorking.setVisible(true);
            window.starWorking.anims.play('star_working', true);
          }
          sofa.anims.stop();
          sofa.setTexture('sofa_idle');
        }
      }
    }
  }
}

function showBubble() {
  if (bubble) { bubble.destroy(); bubble = null; }
  const texts = BUBBLE_TEXTS[currentState] || BUBBLE_TEXTS.idle;
  if (currentState === 'idle') return;

  let anchorX = star.x;
  let anchorY = star.y;
  if (currentState === 'syncing' && syncAnimSprite && syncAnimSprite.visible) {
    anchorX = syncAnimSprite.x;
    anchorY = syncAnimSprite.y;
  } else if (currentState === 'error' && window.errorBug && window.errorBug.visible) {
    anchorX = window.errorBug.x;
    anchorY = window.errorBug.y;
  } else if (!star.visible && window.starWorking && window.starWorking.visible) {
    anchorX = window.starWorking.x;
    anchorY = window.starWorking.y;
  }

  const text = texts[Math.floor(Math.random() * texts.length)];
  const bubbleY = anchorY - 70;
  const bg = game.add.rectangle(anchorX, bubbleY, text.length * 10 + 20, 28, 0xffffff, 0.95);
  bg.setStrokeStyle(2, 0x000000);
  const txt = game.add.text(anchorX, bubbleY, text, { fontFamily: 'ArkPixel, monospace', fontSize: '12px', fill: '#000', align: 'center' }).setOrigin(0.5);
  bubble = game.add.container(0, 0, [bg, txt]);
  bubble.setDepth(1200);
  setTimeout(() => { if (bubble) { bubble.destroy(); bubble = null; } }, 3000);
}

function showCatBubble() {
  if (!window.catSprite) return;
  if (window.catBubble) { window.catBubble.destroy(); window.catBubble = null; }
  const texts = BUBBLE_TEXTS.cat || ['喵~', '咕噜咕噜…'];
  const text = texts[Math.floor(Math.random() * texts.length)];
  const anchorX = window.catSprite.x;
  const anchorY = window.catSprite.y - 60;
  const bg = game.add.rectangle(anchorX, anchorY, text.length * 10 + 20, 24, 0xfffbeb, 0.95);
  bg.setStrokeStyle(2, 0xd4a574);
  const txt = game.add.text(anchorX, anchorY, text, { fontFamily: 'ArkPixel, monospace', fontSize: '11px', fill: '#8b6914', align: 'center' }).setOrigin(0.5);
  window.catBubble = game.add.container(0, 0, [bg, txt]);
  window.catBubble.setDepth(2100);
  setTimeout(() => { if (window.catBubble) { window.catBubble.destroy(); window.catBubble = null; } }, 4000);
}

function fetchAgents() {
  fetch('/agents?t=' + Date.now(), { cache: 'no-store' })
    .then(response => response.json())
    .then(data => {
      if (!Array.isArray(data)) return;
      // 重置位置计数器
      // 按区域分配不同位置索引，避免重叠
      const areaSlots = { breakroom: 0, writing: 0, error: 0 };
      for (let agent of data) {
        const area = agent.area || 'breakroom';
        agent._slotIndex = areaSlots[area] || 0;
        areaSlots[area] = (areaSlots[area] || 0) + 1;
        renderAgent(agent);
      }
      // 移除不再存在的 agent
      const currentIds = new Set(data.map(a => a.agentId));
      for (let id in agents) {
        if (!currentIds.has(id)) {
          if (agents[id]) {
            agents[id].destroy();
            delete agents[id];
          }
        }
      }
    })
    .catch(error => {
      console.error('拉取 agents 失败:', error);
    });
}

function getAreaPosition(area, slotIndex) {
  const positions = AREA_POSITIONS[area] || AREA_POSITIONS.breakroom;
  const idx = (slotIndex || 0) % positions.length;
  return positions[idx];
}

function renderAgent(agent) {
  const agentId = agent.agentId;
  const name = agent.name || 'Agent';
  const area = agent.area || 'breakroom';
  const authStatus = agent.authStatus || 'pending';
  const isMain = !!agent.isMain;

  // 获取这个 agent 在区域里的位置
  const pos = getAreaPosition(area, agent._slotIndex || 0);
  const baseX = pos.x;
  const baseY = pos.y;

  // 颜色
  const bodyColor = AGENT_COLORS[agentId] || AGENT_COLORS.default;
  const nameColor = NAME_TAG_COLORS[authStatus] || NAME_TAG_COLORS.default;

  // 透明度（离线/待批准/拒绝时变半透明）
  let alpha = 1;
  if (authStatus === 'pending') alpha = 0.7;
  if (authStatus === 'rejected') alpha = 0.4;
  if (authStatus === 'offline') alpha = 0.5;

  if (!agents[agentId]) {
    // 新建 agent
    const container = game.add.container(baseX, baseY);
    container.setDepth(1200 + (isMain ? 100 : 0)); // 放到最顶层！

    // 像素小人：用星星图标，更明显
    const starIcon = game.add.text(0, 0, '⭐', {
      fontFamily: 'ArkPixel, monospace',
      fontSize: '32px'
    }).setOrigin(0.5);
    starIcon.name = 'starIcon';

    // 名字标签（漂浮）
    const nameTag = game.add.text(0, -36, name, {
      fontFamily: 'ArkPixel, monospace',
      fontSize: '14px',
      fill: '#' + nameColor.toString(16).padStart(6, '0'),
      stroke: '#000',
      strokeThickness: 3,
      backgroundColor: 'rgba(255,255,255,0.95)'
    }).setOrigin(0.5);
    nameTag.name = 'nameTag';


    // 状态小点（绿色/黄色/红色）
    let dotColor = 0x64748b;
    if (authStatus === 'approved') dotColor = 0x22c55e;
    if (authStatus === 'pending') dotColor = 0xf59e0b;
    if (authStatus === 'rejected') dotColor = 0xef4444;
    if (authStatus === 'offline') dotColor = 0x94a3b8;
    const statusDot = game.add.circle(20, -20, 5, dotColor, alpha);
    statusDot.setStrokeStyle(2, 0x000000, alpha);
    statusDot.name = 'statusDot';

    container.add([starIcon, statusDot, nameTag]);
    
    // ======== 新增: RPG 交互逻辑 ========
    container.setSize(64, 64);
    container.setInteractive({ useHandCursor: true });
    container.on('pointerdown', (pointer) => {
      const currentAgent = caspAgentCache[agentId] || agent;
      if (currentAgent.authStatus === 'pending' || currentAgent.state === 'awaiting_approval') {
        showHitlPopup(currentAgent, pointer);
      } else {
        // 普通状态点击展示一句气泡
        showAgentBubble(container, currentAgent);
      }
    });
    // ====================================
    
    agents[agentId] = container;

  } else {
    // 更新 agent
    const container = agents[agentId];
    container.setPosition(baseX, baseY);
    container.setAlpha(alpha);
    container.setDepth(1200 + (isMain ? 100 : 0));

    // 更新名字和颜色（如果变化）
    const nameTag = container.getAt(2);
    if (nameTag && nameTag.name === 'nameTag') {
      nameTag.setText(name);
      nameTag.setFill('#' + (NAME_TAG_COLORS[authStatus] || NAME_TAG_COLORS.default).toString(16).padStart(6, '0'));
    }
    // 更新状态点颜色
    const statusDot = container.getAt(1);
    if (statusDot && statusDot.name === 'statusDot') {
      let dotColor = 0x64748b;
      if (authStatus === 'approved') dotColor = 0x22c55e;
      if (authStatus === 'pending') dotColor = 0xf59e0b;
      if (authStatus === 'rejected') dotColor = 0xef4444;
      if (authStatus === 'offline') dotColor = 0x94a3b8;
      statusDot.fillColor = dotColor;
    }
  }
}

// 启动游戏
initGame();


// --- CASP WebSocket Integration ---
let caspSocket = null;
let caspAgentCache = {};

function initWebSocket() {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = wsProtocol + '//' + window.location.host + '/';
  caspSocket = new WebSocket(wsUrl);

  caspSocket.onopen = () => {
    console.log('Connected to Curvature CASP Event Bus');
    // Mimic pusher protocol subscription
    // Wait for connection_established before subscribing, but send it now anyway
  };

  caspSocket.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.event === 'pusher:connection_established') {
        caspSocket.send(JSON.stringify({
          event: 'pusher:subscribe',
          data: { channel: 'presence-office' }
        }));
      
      } else if (msg.event === 'pusher_internal:subscription_succeeded') {
        console.log('Subscribed to CASP presence-office channel', typeof msg.data, msg.data); if (typeof msg.data === 'string') { try { msg.data = JSON.parse(msg.data); } catch(e){} }
        if (msg.data && msg.data.presence && msg.data.presence.hash) {
          const hash = msg.data.presence.hash;
          for (const key in hash) {
            handleCaspStateUpdate(hash[key]);
          }
        }
      } else if (msg.event === 'state_update') {

        handleCaspStateUpdate(msg.data);
      }
    } catch (e) {
      console.error('WebSocket message parsing error:', e);
    }
  };

  caspSocket.onclose = () => {
    console.log('Disconnected from CASP Event Bus, reconnecting in 5s...');
    setTimeout(initWebSocket, 5000);
  };
}

function handleCaspStateUpdate(payload) {
  if (!payload || !payload.source || !payload.status) return;
  
  const agentId = payload.source.agent_id;
  const state = normalizeState(payload.status.current_state);
  const detail = payload.status.message || '...';
  
  let areaName = 'breakroom';
  if (payload.status.department === 'dev_studio') areaName = 'writing';
  if (payload.status.department === 'trading_floor') areaName = 'researching';

  // 如果是主智能体 (main)
  if (agentId === 'main') {
    const nextState = state;
    const stateInfo = STATES[nextState] || STATES.idle;
    const nextLine = '[' + stateInfo.name + '] ' + detail;
    const changed = (pendingDesiredState === null) && (nextState !== currentState);
    
    caspAgentCache['main'] = { name: 'Main Orchestrator', isMain: true, state: nextState, detail: detail, project_name: (payload.task_context && payload.task_context.project_name) ? payload.task_context.project_name : 'Global' };
    if (changed) {
      typewriterTarget = nextLine;
      typewriterText = '';
      typewriterIndex = 0;
      pendingDesiredState = nextState;
      // Also update standard fetchStatus logic
      if (nextState === 'idle') {
        if (game.textures.exists('sofa_busy')) {
          sofa.setTexture('sofa_busy');
          sofa.anims.play('sofa_busy', true);
        }
        if (star) { star.setVisible(false); star.anims.stop(); }
        if (window.starWorking) { window.starWorking.setVisible(false); window.starWorking.anims.stop(); }
      } else if (nextState === 'error') {
        sofa.anims.stop(); sofa.setTexture('sofa_idle');
        if (star) { star.setVisible(false); star.anims.stop(); }
        if (window.starWorking) { window.starWorking.setVisible(false); window.starWorking.anims.stop(); }
      } else if (nextState === 'syncing') {
        sofa.anims.stop(); sofa.setTexture('sofa_idle');
        if (star) { star.setVisible(false); star.anims.stop(); }
        if (window.starWorking) { window.starWorking.setVisible(false); window.starWorking.anims.stop(); }
      } else {
        sofa.anims.stop(); sofa.setTexture('sofa_idle');
        if (star) { star.setVisible(false); star.anims.stop(); }
        if (window.starWorking) { window.starWorking.setVisible(true); window.starWorking.anims.play('star_working', true); }
      }
      
      if (serverroom) {
        if (nextState === 'idle') { serverroom.anims.stop(); serverroom.setFrame(0); }
        else { serverroom.anims.play('serverroom_on', true); }
      }
      
      if (syncAnimSprite) {
        if (nextState === 'syncing') {
          if (!syncAnimSprite.anims.isPlaying || syncAnimSprite.anims.currentAnim?.key !== 'sync_anim') {
            syncAnimSprite.anims.play('sync_anim', true);
          }
        } else {
          if (syncAnimSprite.anims.isPlaying) syncAnimSprite.anims.stop();
          syncAnimSprite.setFrame(0);
        }
      }
    } else {
      if (!typewriterTarget || typewriterTarget !== nextLine) {
        typewriterTarget = nextLine;
        typewriterText = '';
        typewriterIndex = 0;
      }
    }
    if (typeof updateTaskBoard === 'function') updateTaskBoard();
    return;
  }

  // 其他子智能体
  const stateStr = payload.status.current_state || 'idle';
  const authStatus = (stateStr === 'awaiting_approval' || stateStr === 'blocked') ? 'pending' : 
                     (stateStr === 'idle' ? 'offline' : 'approved');
                     
  const agentData = {
    agentId: agentId,
    name: payload.source.agent_name || (agentId.charAt(0).toUpperCase() + agentId.slice(1)),
    isMain: false,
    state: stateStr,
    detail: detail,
    area: areaName,
    authStatus: authStatus,
    updated_at: new Date().toISOString(), project_name: (payload.task_context && payload.task_context.project_name) ? payload.task_context.project_name : 'Agent Workspace'
  };

  caspAgentCache[agentId] = agentData;
  
  // 给 agent 分配位置 slot (复用 AREA_POSITIONS 的错开逻辑)
  const areaSlots = { breakroom: 0, writing: 0, error: 0 };
  for (let id in caspAgentCache) {
    const a = caspAgentCache[id];
    const area = a.area || 'breakroom';
    if (a._slotIndex === undefined) {
      a._slotIndex = areaSlots[area] || 0;
    }
    areaSlots[area] = (areaSlots[area] || 0) + 1;
  }

  renderAgent(caspAgentCache[agentId]);
  if (typeof updateTaskBoard === 'function') updateTaskBoard();
}


// ======== HITL 审批交互弹窗 ========
function showHitlPopup(agent, pointer) {
  // 移除旧弹窗
  const old = document.getElementById('hitl-popup');
  if (old) old.remove();

  const popup = document.createElement('div');
  popup.id = 'hitl-popup';
  popup.style.position = 'absolute';
  // 转换相对游戏画布坐标到全屏 DOM 坐标
  const canvas = document.querySelector('canvas');
  const rect = canvas.getBoundingClientRect();
  const scaleX = rect.width / config.width;
  const scaleY = rect.height / config.height;
  
  popup.style.left = (rect.left + pointer.x * scaleX + 20) + 'px';
  popup.style.top = (rect.top + pointer.y * scaleY - 60) + 'px';
  popup.style.width = '240px';
  popup.style.background = 'rgba(20, 20, 20, 0.95)';
  popup.style.border = '2px solid #f59e0b';
  popup.style.borderRadius = '8px';
  popup.style.padding = '12px';
  popup.style.color = '#fff';
  popup.style.fontFamily = 'ArkPixel, monospace';
  popup.style.fontSize = '12px';
  popup.style.zIndex = '10000';
  popup.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';

  popup.innerHTML = `
    <div style="font-size: 14px; font-weight: bold; color: #f59e0b; margin-bottom: 8px;">
      [请求审批] ${agent.name}
    </div>
    <div style="margin-bottom: 12px; line-height: 1.4;">
      ${agent.detail || '等待主人确认下一步操作...'}
    </div>
    <div style="display: flex; gap: 8px;">
      <button id="hitl-approve" style="flex:1; background: #22c55e; color: #fff; border: none; padding: 6px; border-radius: 4px; cursor: pointer; font-family: ArkPixel, monospace;">同意</button>
      <button id="hitl-reject" style="flex:1; background: #ef4444; color: #fff; border: none; padding: 6px; border-radius: 4px; cursor: pointer; font-family: ArkPixel, monospace;">拒绝</button>
    </div>
  `;
  document.body.appendChild(popup);

  // 点击外部关闭弹窗
  setTimeout(() => {
    const closeHandler = (e) => {
      if (!popup.contains(e.target)) {
        popup.remove();
        document.removeEventListener('pointerdown', closeHandler);
      }
    };
    document.addEventListener('pointerdown', closeHandler);
  }, 100);

  document.getElementById('hitl-approve').onclick = () => {
    handleHitlAction(agent.agentId, 'approved');
    popup.remove();
  };
  document.getElementById('hitl-reject').onclick = () => {
    handleHitlAction(agent.agentId, 'rejected');
    popup.remove();
  };
}

function handleHitlAction(agentId, action) {
  console.log(`HITL Action: ${action} for ${agentId}`);
  // 1. 本地乐观更新 UI
  if (caspAgentCache[agentId]) {
    caspAgentCache[agentId].authStatus = action;
    caspAgentCache[agentId].state = action === 'approved' ? 'executing' : 'idle';
    caspAgentCache[agentId].detail = action === 'approved' ? '审批通过，继续执行' : '已被主人驳回';
    renderAgent(caspAgentCache[agentId]);
  if (typeof updateTaskBoard === 'function') updateTaskBoard();
  }
  
  // 2. 发送客户端事件到总线 (mock remote agent receiving the approval)
  if (caspSocket && caspSocket.readyState === WebSocket.OPEN) {
    caspSocket.send(JSON.stringify({
      event: 'client-event',
      data: {
        event: 'client-hitl-response',
        data: { agent_id: agentId, action: action }
      },
      channel: 'presence-office'
    }));
    
    // 为了立刻看到全局效果，我们直接伪造一个该 agent 的 state_update 广播包发回去
    caspSocket.send(JSON.stringify({
      event: 'client-event',
      data: {
        event: 'state_update',
        data: {
          source: { agent_id: agentId, agent_name: caspAgentCache[agentId].name },
          status: { 
            current_state: action === 'approved' ? 'executing' : 'idle',
            message: action === 'approved' ? '审批通过，继续执行' : '已被主人驳回'
          }
        }
      },
      channel: 'presence-office'
    }));
  }
}

function showAgentBubble(container, agent) {
  // 简单的普通气泡
  const texts = BUBBLE_TEXTS[agent.state] || BUBBLE_TEXTS.idle;
  const text = texts[Math.floor(Math.random() * texts.length)];
  
  const bg = game.add.rectangle(0, -70, text.length * 10 + 20, 24, 0xffffff, 0.95);
  bg.setStrokeStyle(2, 0x000000);
  const txt = game.add.text(0, -70, text, { fontFamily: 'ArkPixel, monospace', fontSize: '11px', fill: '#000', align: 'center' }).setOrigin(0.5);
  
  const bubble = game.add.container(container.x, container.y, [bg, txt]);
  bubble.setDepth(2000);
  setTimeout(() => bubble.destroy(), 3000);
}
// ====================================


// ============================================
// 项目看板 (Task Board) & 一键接入 (Join Hub)
// ============================================

function initWorkspaceUI() {
  // --- 1. 项目任务看板 (Task Board) ---
  const board = document.createElement('div');
  board.id = 'task-board';
  board.style.cssText = 'position: absolute; right: 20px; top: 20px; width: 280px; background: rgba(15, 23, 42, 0.85); border: 2px solid #3b82f6; border-radius: 8px; color: #fff; padding: 15px; font-family: ArkPixel, monospace; z-index: 9999; box-shadow: 0 4px 12px rgba(0,0,0,0.5); pointer-events: auto;';
  board.innerHTML = `
    <h3 style="margin: 0 0 10px 0; color: #60a5fa; font-size: 14px; border-bottom: 1px solid #3b82f6; padding-bottom: 5px; display: flex; justify-content: space-between;">
      <span>📋 Agent Workspace 看板</span>
    </h3>
    <div id="task-list" style="font-size: 12px; line-height: 1.5; max-height: 400px; overflow-y: auto;">
        <div style="color: #94a3b8; text-align: center; padding: 10px;">暂无活跃任务...</div>
    </div>
  `;
  document.body.appendChild(board);

  // --- 2. 一键接入入口按钮 (Integration Hub) ---
  const joinBtn = document.createElement('div');
  joinBtn.style.cssText = 'position: absolute; right: 20px; bottom: 20px; background: #8b5cf6; color: #fff; padding: 10px 15px; border-radius: 6px; font-family: ArkPixel, monospace; font-size: 13px; cursor: pointer; z-index: 9999; box-shadow: 0 4px 6px rgba(0,0,0,0.3); border: 1px solid #7c3aed; transition: all 0.2s;';
  joinBtn.innerHTML = '🔌 一键接入本地 Agent';
  joinBtn.onmouseover = () => joinBtn.style.transform = 'translateY(-2px)';
  joinBtn.onmouseout = () => joinBtn.style.transform = 'translateY(0)';
  joinBtn.onclick = showIntegrationHub;
  document.body.appendChild(joinBtn);
}

function updateTaskBoard() {
  const list = document.getElementById('task-list');
  if (!list) return;
  
  let html = '';
  // 先排序：main 优先，其余按名字
  const ids = Object.keys(caspAgentCache).sort((a,b) => {
    if (a === 'main') return -1;
    if (b === 'main') return 1;
    return a.localeCompare(b);
  });

  let activeCount = 0;
  for (const id of ids) {
    const agent = caspAgentCache[id];
    // 只展示非 idle/offline 的活跃任务
    if (!agent) continue;
    const isIdle = agent.state === 'idle' || agent.state === 'offline';
    if (isIdle && id !== 'main') continue; // 主节点闲置也展示一下作为占位
    
    let stateColor = '#94a3b8'; // default
    let stateLabel = '离线/空闲';
    if (agent.state === 'executing' || agent.state === 'working' || agent.state === 'writing' || agent.state === 'researching') {
        stateColor = '#22c55e'; // green
        stateLabel = '执行中';
    } else if (agent.state === 'awaiting_approval' || agent.authStatus === 'pending') {
        stateColor = '#f59e0b'; // yellow
        stateLabel = '待审批';
    } else if (agent.state === 'error') {
        stateColor = '#ef4444'; // red
        stateLabel = '异常';
    } else if (agent.state === 'idle') {
        stateColor = '#94a3b8';
        stateLabel = '空闲';
    }

    const taskName = agent.detail || '...';
    const project = agent.project_name || 'Agent Workspace';
    
    html += `
      <div style="margin-bottom: 8px; padding: 8px; background: rgba(0,0,0,0.4); border-left: 3px solid ${stateColor}; border-radius: 4px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-weight: bold; color: ${stateColor};">${agent.name || agent.agentId}</span>
            <span style="font-size: 10px; background: ${stateColor}20; color: ${stateColor}; padding: 2px 4px; border-radius: 2px;">${stateLabel}</span>
        </div>
        <div style="font-size: 10px; color: #94a3b8; margin-bottom: 2px;">[${project}]</div>
        <div style="color: #e2e8f0; word-break: break-all;">${taskName}</div>
      </div>
    `;
    activeCount++;
  }
  
  if (activeCount === 0) {
    html = '<div style="color: #94a3b8; text-align: center; padding: 10px;">暂无活跃任务...</div>';
  }
  list.innerHTML = html;
}

function showIntegrationHub() {
  const old = document.getElementById('integration-hub-modal');
  if (old) old.remove();

  const modal = document.createElement('div');
  modal.id = 'integration-hub-modal';
  modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 100000; display: flex; align-items: center; justify-content: center; font-family: ArkPixel, monospace;';
  
  const currentDomain = window.location.origin;
  const wsDomain = window.location.protocol === 'https:' ? 'wss://' + window.location.host : 'ws://' + window.location.host;
  
  modal.innerHTML = `
    <div style="background: #1e293b; border: 2px solid #8b5cf6; border-radius: 8px; width: 600px; max-width: 90%; max-height: 80vh; overflow-y: auto; color: #f8fafc; padding: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); position: relative;">
      <button onclick="document.getElementById('integration-hub-modal').remove()" style="position: absolute; right: 15px; top: 15px; background: transparent; border: none; color: #94a3b8; font-size: 16px; cursor: pointer;">✕</button>
      <h2 style="color: #a78bfa; margin-top: 0; border-bottom: 1px solid #334155; padding-bottom: 10px;">🔌 一键接入 Agent (Integration Hub)</h2>
      <p style="font-size: 12px; color: #cbd5e1; line-height: 1.6;">无论你的本地 Agent 是用 OpenClaw、Nano Claw 还是自己写的 Python 脚本构建，只要按以下方式向总线推送状态，就能在这个可视化办公室里出现。</p>
      
      <h3 style="color: #38bdf8; font-size: 14px; margin-top: 20px;">方法一：直接向后端 API 推送 (HTTP POST)</h3>
      <div style="background: #0f172a; padding: 12px; border-radius: 4px; border: 1px solid #334155; font-family: monospace; font-size: 11px; white-space: pre-wrap; word-break: break-all; color: #a5b4fc;">curl -X POST ${currentDomain}/agent-push \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "your_local_bot",
    "name": "测试小助手",
    "state": "executing",
    "detail": "正在执行检索任务...",
    "joinKey": "default-key"
  }'</div>

      <h3 style="color: #38bdf8; font-size: 14px; margin-top: 20px;">方法二：使用 Python WebSocket 推送 (实时低延迟 CASP)</h3>
      <p style="font-size: 12px; color: #94a3b8; margin-bottom: 8px;">安装依赖：<code>pip install websockets</code></p>
      <div style="background: #0f172a; padding: 12px; border-radius: 4px; border: 1px solid #334155; font-family: monospace; font-size: 11px; white-space: pre-wrap; color: #86efac; overflow-x: auto; max-height: 200px;">import asyncio, json, websockets

async def push_state():
    uri = "${wsDomain}"
    async with websockets.connect(uri) as ws:
        # 1. 握手订阅
        await ws.recv()
        await ws.send(json.dumps({
            "event": "pusher:subscribe", 
            "data": {"channel": "presence-office"}
        }))
        await ws.recv()
        
        # 2. 推送 CASP 状态协议
        payload = {
            "event": "state_update",
            "channel": "presence-office",
            "data": {
                "source": { "agent_id": "python_bot", "agent_name": "Python 助手" },
                "status": { "current_state": "researching", "message": "分析数据中" },
                "task_context": { "project_name": "Agent Workspace" }
            }
        }
        await ws.send(json.dumps(payload))
        print("推送成功！")

asyncio.run(push_state())</div>
      
      <div style="margin-top: 20px; font-size: 12px; color: #f59e0b;">* 支持的状态类型 (state): idle, executing, researching, writing, awaiting_approval, error</div>
    </div>
  `;
  document.body.appendChild(modal);
}

// Ensure init is called
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWorkspaceUI);
} else {
  initWorkspaceUI();
}
