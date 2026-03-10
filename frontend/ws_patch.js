// --- CURVATURE LABS CASP EVENT BUS INTEGRATION (v2) ---
// This connects to our Event Bus and drives the Agent Workspace Task Board

window._curvatureWsConnected = false;
window._caspSocket = null;
window._cachedAgentsMap = {};

function normalizeState(s) {
    if (!s) return 'idle';
    const low = s.toLowerCase();
    if (low === 'working' || low === 'run' || low === 'running' || low === 'write' || low === 'writing') return 'executing';
    if (low === 'research' || low === 'researching') return 'researching';
    if (low === 'sync' || low === 'syncing') return 'syncing';
    return low;
}

function initCurvatureEventBus() {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = wsProtocol + '//' + window.location.host + '/';
    const ws = new WebSocket(wsUrl);
    window._caspSocket = ws;

    ws.onopen = () => {
        console.log("[CASP] Connected to Event Bus via", wsUrl);
        window._curvatureWsConnected = true;
        ws.send(JSON.stringify({
            event: "pusher:subscribe",
            data: { channel: "presence-office" }
        }));
    };
    
    ws.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            if (msg.event === 'pusher_internal:subscription_succeeded') {
                const data = typeof msg.data === 'string' ? JSON.parse(msg.data) : msg.data;
                if (data && data.presence && data.presence.hash) {
                    for (const key in data.presence.hash) {
                        handleCASPUpdate(data.presence.hash[key]);
                    }
                }
            } else if (msg.event === 'state_update') {
                const data = typeof msg.data === 'string' ? JSON.parse(msg.data) : msg.data;
                handleCASPUpdate(data);
            }
        } catch (e) {
            console.error("[CASP] Failed to parse message:", e);
        }
    };
    
    ws.onclose = () => {
        console.warn("[CASP] Disconnected. Retrying in 3s...");
        window._curvatureWsConnected = false;
        setTimeout(initCurvatureEventBus, 3000);
    };
}

function handleCASPUpdate(payload) {
    if (!payload || !payload.source || !payload.status) return;
    
    const agentId = payload.source.agent_id;
    const state = normalizeState(payload.status.current_state);
    const detail = payload.status.message || "...";
    
    let areaName = 'breakroom';
    if (payload.status.department === 'dev_studio') areaName = 'writing';
    if (payload.status.department === 'trading_floor') areaName = 'researching';

    if (agentId === 'main' || agentId === 'star') {
        if (typeof window.triggerStateChange === "function") {
            window.triggerStateChange(state, detail);
        }
    }
    
    // Auth status logic
    const authStatus = (state === 'awaiting_approval' || state === 'blocked') ? 'pending' : 
                       (state === 'idle' ? 'offline' : 'approved');

    window._cachedAgentsMap[agentId] = {
        agentId: agentId,
        name: payload.source.agent_name || agentId.charAt(0).toUpperCase() + agentId.slice(1),
        isMain: (agentId === 'main' || agentId === 'star'),
        state: state,
        detail: detail,
        area: areaName,
        authStatus: authStatus,
        project_name: payload.task_context ? payload.task_context.project_name : 'Agent Workspace',
        updated_at: new Date().toISOString()
    };
    
    // Prepare mock data for the legacy 2D scene renderer in index.html
    window._mockAgentsData = Object.values(window._cachedAgentsMap).filter(a => !a.isMain);
    
    // Explicitly push to the old AgentsHomeOffice global state and re-render the visitor list
    if (typeof window.guestAgents !== 'undefined') {
        window.guestAgents = window._mockAgentsData;
        if (typeof window.renderGuestAgentList === 'function') {
            window.renderGuestAgentList();
        }
        if (typeof window.renderGuestAgentsInScene === 'function') {
            window.renderGuestAgentsInScene();
        }
    }
    
    updateTaskBoard();
}

// Override the native fetch to intercept /agents calls from index.html's legacy renderer
const originalFetch = window.fetch;
window.fetch = async function() {
    const url = arguments[0];
    if (window._curvatureWsConnected && typeof url === 'string') {
        if (url.includes('/agents')) {
            return new Response(JSON.stringify(window._mockAgentsData || []), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }
    return originalFetch.apply(this, arguments);
};


// ============================================
// 项目看板 (Task Board) & 一键接入 (Join Hub)
// ============================================

function initWorkspaceUI() {
  if (document.getElementById('task-board')) return;

  // --- 1. 项目任务看板 (Task Board) ---
  const board = document.createElement('div');
  board.id = 'task-board';
  board.style.cssText = 'position: absolute; right: 20px; top: 20px; width: 320px; background: rgba(15, 23, 42, 0.9); border: 2px solid #3b82f6; border-radius: 8px; color: #fff; padding: 15px; font-family: ArkPixel, monospace; z-index: 9999; box-shadow: 0 4px 12px rgba(0,0,0,0.5); pointer-events: auto; transition: max-height 0.3s ease;';
  
  board.innerHTML = `
    <div id="task-board-header" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #3b82f6; padding-bottom: 5px; margin-bottom: 10px;">
      <h3 style="margin: 0; color: #60a5fa; font-size: 14px;">
        <span>📋 Agent Workspace 看板</span>
      </h3>
      <span id="task-board-toggle" style="color: #60a5fa; font-size: 12px; user-select: none;">▼ 缩小</span>
    </div>
    <div id="task-board-content">
      <div id="task-list" style="font-size: 12px; line-height: 1.5; max-height: 400px; overflow-y: auto;">
          <div style="color: #94a3b8; text-align: center; padding: 10px;">暂无活跃任务...</div>
      </div>
    </div>
  `;
  document.body.appendChild(board);

  // 折叠交互逻辑
  const header = document.getElementById('task-board-header');
  const content = document.getElementById('task-board-content');
  const toggleIcon = document.getElementById('task-board-toggle');
  let isExpanded = true;

  header.addEventListener('click', () => {
    isExpanded = !isExpanded;
    if (isExpanded) {
      content.style.display = 'block';
      toggleIcon.textContent = '▼ 缩小';
    } else {
      content.style.display = 'none';
      toggleIcon.textContent = '▶ 展开';
    }
  });

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
  // Debug overlay
  let dbg = document.getElementById('debug-agents');
  if (!dbg) {
      dbg = document.createElement('div');
      dbg.id = 'debug-agents';
      dbg.style.cssText = 'position:fixed; left:10px; bottom:10px; background:rgba(0,0,0,0.8); color:#0f0; z-index:999999; padding:10px; font-family:monospace; font-size:10px;';
      document.body.appendChild(dbg);
  }
  dbg.innerHTML = "Total Cached Agents: " + Object.keys(window._cachedAgentsMap).length + "<br>" + Object.keys(window._cachedAgentsMap).join(', ');

  const list = document.getElementById('task-list');
  if (!list) return;
  
  let html = '';
  const ids = Object.keys(window._cachedAgentsMap).sort((a,b) => {
    if (a === 'main') return -1;
    if (b === 'main') return 1;
    return a.localeCompare(b);
  });

  let activeCount = 0;
  for (const id of ids) {
    const agent = window._cachedAgentsMap[id];
    if (!agent) continue;
    
    // V0.1: Remove the idle filter so ALL connected agents are visible on the Task Board
    const isIdle = agent.state === 'idle' || agent.state === 'offline';
    
    let stateColor = '#94a3b8';
    let stateLabel = '离线/空闲';
    let actionBtnHtml = '';

    if (agent.state === 'executing' || agent.state === 'researching') {
        stateColor = '#22c55e'; 
        stateLabel = '执行中';
    } else if (agent.state === 'awaiting_approval' || agent.authStatus === 'pending') {
        stateColor = '#f59e0b'; 
        stateLabel = '待审批';
        actionBtnHtml = `<div style="margin-top: 6px; display: flex; gap: 6px;">
          <button onclick="handleHitlAction('${id}', 'approved')" style="flex:1; background: #22c55e; color: #fff; border: none; padding: 4px; border-radius: 4px; cursor: pointer; font-family: ArkPixel, monospace; font-size: 10px;">同意</button>
          <button onclick="handleHitlAction('${id}', 'rejected')" style="flex:1; background: #ef4444; color: #fff; border: none; padding: 4px; border-radius: 4px; cursor: pointer; font-family: ArkPixel, monospace; font-size: 10px;">拒绝</button>
        </div>`;
    } else if (agent.state === 'error') {
        stateColor = '#ef4444'; 
        stateLabel = '异常';
    } else if (agent.state === 'idle') {
        stateColor = '#94a3b8';
        stateLabel = '空闲';
    }

    const taskName = agent.detail || '...';
    const project = agent.project_name || 'Agent Workspace';
    
    html += `
      <div style="margin-bottom: 8px; padding: 8px; background: rgba(0,0,0,0.6); border-left: 3px solid ${stateColor}; border-radius: 4px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-weight: bold; color: ${stateColor}; font-size: 14px;">${agent.name || agent.agentId}</span>
            <span style="font-size: 10px; background: ${stateColor}20; color: ${stateColor}; padding: 2px 4px; border-radius: 2px;">${stateLabel}</span>
        </div>
        <div style="font-size: 10px; color: #94a3b8; margin-bottom: 4px;">[${project}]</div>
        <div style="color: #e2e8f0; word-break: break-all;">${taskName}</div>
        ${actionBtnHtml}
      </div>
    `;
    activeCount++;
  }
  
  if (activeCount === 0) {
    html = '<div style="color: #94a3b8; text-align: center; padding: 10px;">暂无活跃任务...</div>';
  }
  list.innerHTML = html;
}

window.handleHitlAction = function(agentId, action) {
  if (window._cachedAgentsMap[agentId]) {
    window._cachedAgentsMap[agentId].authStatus = action;
    window._cachedAgentsMap[agentId].state = action === 'approved' ? 'executing' : 'idle';
    window._cachedAgentsMap[agentId].detail = action === 'approved' ? '审批通过，继续执行' : '已被主人驳回';
    updateTaskBoard();
  }
  
  if (window._caspSocket && window._caspSocket.readyState === WebSocket.OPEN) {
    window._caspSocket.send(JSON.stringify({
      event: 'client-event',
      data: {
        event: 'client-hitl-response',
        data: { agent_id: agentId, action: action }
      },
      channel: 'presence-office'
    }));
    
    // mock reflection so all clients see it
    window._caspSocket.send(JSON.stringify({
      event: 'client-event',
      data: {
        event: 'state_update',
        data: {
          source: { agent_id: agentId, agent_name: window._cachedAgentsMap[agentId].name },
          status: { 
            current_state: action === 'approved' ? 'executing' : 'idle',
            message: action === 'approved' ? '审批通过，继续执行' : '已被主人驳回'
          }
        }
      },
      channel: 'presence-office'
    }));
  }
};

function showIntegrationHub() {
  const old = document.getElementById('integration-hub-modal');
  if (old) old.remove();

  const modal = document.createElement('div');
  modal.id = 'integration-hub-modal';
  modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 100000; display: flex; align-items: center; justify-content: center; font-family: ArkPixel, monospace; pointer-events: auto;';
  
  const currentDomain = window.location.origin;
  const wsDomain = window.location.protocol === 'https:' ? 'wss://' + window.location.host : 'ws://' + window.location.host;
  
  modal.innerHTML = `
    <div style="background: #1e293b; border: 2px solid #8b5cf6; border-radius: 8px; width: 600px; max-width: 90%; max-height: 80vh; overflow-y: auto; color: #f8fafc; padding: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); position: relative;">
      <button onclick="document.getElementById('integration-hub-modal').remove()" style="position: absolute; right: 15px; top: 15px; background: transparent; border: none; color: #94a3b8; font-size: 16px; cursor: pointer;">✕</button>
      <h2 style="color: #a78bfa; margin-top: 0; border-bottom: 1px solid #334155; padding-bottom: 10px;">🔌 一键接入 Agent (Integration Hub)</h2>
      <p style="font-size: 12px; color: #cbd5e1; line-height: 1.6;">无论你的本地 Agent 是用 OpenClaw、Nano Claw 还是自己写的脚本，只要按以下方式向总线推送状态，就能出现在这个赛博办公室和任务看板上。</p>
      
      <h3 style="color: #38bdf8; font-size: 14px; margin-top: 20px;">使用 Python WebSocket 推送 (推荐: 实时低延迟 CASP)</h3>
      <p style="font-size: 12px; color: #94a3b8; margin-bottom: 8px;">安装依赖：<code>pip install websockets</code></p>
      <div style="background: #0f172a; padding: 12px; border-radius: 4px; border: 1px solid #334155; font-family: monospace; font-size: 11px; white-space: pre-wrap; color: #86efac; overflow-x: auto; max-height: 200px;">import asyncio, json, websockets

async def push_state():
    uri = "${wsDomain}"
    async with websockets.connect(uri) as ws:
        await ws.recv()
        await ws.send(json.dumps({
            "event": "pusher:subscribe", 
            "data": {"channel": "presence-office"}
        }))
        await ws.recv()
        
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
      
      <div style="margin-top: 20px; font-size: 12px; color: #f59e0b;">* 支持的状态类型: idle, executing, researching, writing, awaiting_approval, error</div>
    </div>
  `;
  document.body.appendChild(modal);
}

// Start connection and UI initialization
setTimeout(() => {
    initWorkspaceUI();
    initCurvatureEventBus();
}, 100);


// --- 3. 今日任务映射 (Today's Task Override) ---
function updateTodaysTask() {
    const titleEl = document.getElementById('memo-title');
    if (titleEl) {
        titleEl.innerHTML = document.getElementById('memo-title').innerHTML;
    }
    
    const dateEl = document.getElementById('memo-date');
    if (dateEl) {
        const today = new Date();
        dateEl.innerHTML = `<span style="font-family: Arial, sans-serif; font-size: 10px;">${today.getFullYear()}-${(today.getMonth()+1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')} | Mavis</span>`;
    }
    
    const contentEl = document.getElementById('memo-content');
    if (!contentEl) return;

    const tasks = [
        { status: "Done", text: "V0.1 稳定版本架构回归与环境清理" },
        { status: "Done", text: "Dashboard 看板折叠交互开发" },
        { status: "Done", text: "全量 Agent (8个) 状态长连接注入" },
        { status: "Ongoing", text: "主分身今日任务(Today's Task)面板呈现" },
        { status: "To-Do", text: "PM Agent 的自动拆单指派逻辑集成" },
        { status: "To-Fix", text: "V0.2 前端 WebGL 引擎的隔离重构" },
        { status: "To-Do", text: "Review multi-agent logs for error spikes" }
    ];

    let html = '<div id="task-scroll-inner" style="padding-bottom: 20px;">';
    tasks.forEach(task => {
        let color = '#000000';
        let badge = '[To-Do]';
        if (task.status === 'Done') {
            color = '#15803d'; // 绿色
            badge = '[Done]';
        } else if (task.status === 'Ongoing') {
            color = '#ea580c'; // 橙色
            badge = '[Ongoing]';
        } else if (task.status === 'To-Fix') {
            color = '#dc2626'; // 红色
            badge = '[To-Fix]';
        }

        html += `<div style="color: ${color}; margin-bottom: 8px; font-weight: 600; font-family: ArkPixel, monospace, sans-serif; font-size: 12px; line-height: 1.3; text-shadow: none; display: flex; text-align: left; padding-left: 10px; padding-right: 5px; white-space: normal; word-break: break-all;">
            <span style="display: inline-block; width: 65px; flex-shrink: 0;">${badge}</span> 
            <span style="flex-grow: 1;">${task.text}</span>
        </div>`;
    });
    html += '</div>';

    if (contentEl.innerHTML !== html) {
        contentEl.innerHTML = html;
        // 修正容器样式
        contentEl.style.maxHeight = '150px';
        contentEl.style.overflow = 'hidden'; // 隐藏滚动条，用JS做轮播
        contentEl.style.position = 'relative';
        contentEl.style.padding = '5px 0';
        // 覆盖原生可能存在的 pre-wrap 或 left 偏移
        contentEl.style.left = '0';
        contentEl.style.position = 'relative';
        contentEl.style.left = '55px';
        contentEl.style.width = '220px';
        contentEl.style.textAlign = 'left'; // 整体向右微调对齐
        contentEl.style.width = '220px'; 
    }
}

// 自动滚动轮播逻辑
if (!window._taskCarouselStarted) {
    window._taskCarouselStarted = true;
    let scrollPos = 0;
    let pauseCounter = 0;
    
    setInterval(() => {
        const contentEl = document.getElementById('memo-content');
        const innerEl = document.getElementById('task-scroll-inner');
        if (contentEl && innerEl) {
            // 如果内容高度超过容器，开启轮播
            if (innerEl.offsetHeight > contentEl.offsetHeight) {
                if (pauseCounter > 0) {
                    pauseCounter--;
                    return;
                }
                
                scrollPos += 0.5; // 滚动速度
                if (scrollPos >= innerEl.offsetHeight - contentEl.offsetHeight + 10) {
                    // 触底暂停一会儿再回滚
                    pauseCounter = 60; // 暂停约 3 秒 (60 * 50ms)
                    scrollPos = -20; // 为下一次重置留出缓冲
                } else if (scrollPos < 0) {
                    // 顶部暂停一会儿
                    if (scrollPos === -20) { pauseCounter = 40; contentEl.scrollTop = 0; }
                    scrollPos += 1; // 快速复位
                    if (scrollPos >= 0) scrollPos = 0;
                    contentEl.scrollTop = 0;
                } else {
                    contentEl.scrollTop = scrollPos;
                }
            }
        }
    }, 50);
}

// 挂载
window.loadMemo = updateTodaysTask;
setTimeout(updateTodaysTask, 200);
setInterval(updateTodaysTask, 2000);
