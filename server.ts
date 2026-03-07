// dashboard/server.ts — Real-time web dashboard for ZeroClaw Claude

import express, { Request, Response } from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { loadConfig } from '../config.js';
import { jobs, runs, memory } from '../db.js';
import { runAgent } from '../agent/runner.js';
import { scheduleJob, unscheduleJob } from '../scheduler/index.js';
import { log } from '../daemon/logger.js';
import type { CronJob } from '../types.js';

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ZeroClaw Claude — Dashboard</title>
  <style>
    :root {
      --bg:      #0d1117; --bg2: #161b22; --bg3: #21262d;
      --border:  #30363d; --text: #e6edf3; --muted: #7d8590;
      --accent:  #f78166; --blue: #58a6ff; --green: #3fb950;
      --yellow:  #d29922; --red: #f85149;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: var(--bg); color: var(--text); font-family: -apple-system, 'Segoe UI', monospace; font-size: 14px; }
    .topbar { background: var(--bg2); border-bottom: 1px solid var(--border); padding: 12px 24px; display: flex; align-items: center; gap: 16px; }
    .topbar .logo { font-size: 18px; font-weight: 700; color: var(--accent); }
    .topbar .dot  { width: 8px; height: 8px; border-radius: 50%; background: var(--green); animation: pulse 2s infinite; }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
    .topbar .uptime { color: var(--muted); font-size: 12px; }
    nav { background: var(--bg2); border-bottom: 1px solid var(--border); display: flex; gap: 0; }
    nav a { padding: 10px 20px; color: var(--muted); text-decoration: none; font-size: 13px; cursor: pointer; border-bottom: 2px solid transparent; }
    nav a.active { color: var(--text); border-bottom-color: var(--accent); }
    .container { max-width: 1200px; margin: 0 auto; padding: 24px; }
    .grid4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
    .card  { background: var(--bg2); border: 1px solid var(--border); border-radius: 8px; padding: 16px; }
    .card h3 { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 8px; }
    .card .val { font-size: 28px; font-weight: 700; }
    .card .val.green  { color: var(--green); }
    .card .val.blue   { color: var(--blue); }
    .card .val.yellow { color: var(--yellow); }
    .card .val.accent { color: var(--accent); }
    .section { background: var(--bg2); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 24px; }
    .section-header { padding: 16px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
    .section-header h2 { font-size: 15px; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px 20px; text-align: left; border-bottom: 1px solid var(--border); }
    th { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .05em; }
    tr:last-child td { border-bottom: none; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
    .badge.green  { background: #1a3a2a; color: var(--green); }
    .badge.red    { background: #3a1a1a; color: var(--red); }
    .badge.yellow { background: #3a2a10; color: var(--yellow); }
    .badge.blue   { background: #0d2a3a; color: var(--blue); }
    .btn { padding: 6px 14px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg3); color: var(--text); cursor: pointer; font-size: 12px; }
    .btn:hover { background: var(--border); }
    .btn.danger { border-color: var(--red); color: var(--red); }
    .btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
    #log-container { font-family: monospace; font-size: 12px; height: 400px; overflow-y: auto; padding: 16px; background: #000; border-radius: 0 0 8px 8px; }
    .log-line { margin-bottom: 2px; color: var(--muted); }
    .log-line.info  { color: var(--text); }
    .log-line.error { color: var(--red); }
    .log-line.warn  { color: var(--yellow); }
    .chat-input { display: flex; gap: 8px; padding: 16px 20px; border-top: 1px solid var(--border); }
    .chat-input input { flex: 1; background: var(--bg3); border: 1px solid var(--border); border-radius: 6px; padding: 8px 12px; color: var(--text); font-size: 14px; }
    .chat-input input:focus { outline: none; border-color: var(--accent); }
    #chat-messages { padding: 16px 20px; min-height: 200px; max-height: 500px; overflow-y: auto; }
    .msg { margin-bottom: 12px; }
    .msg.user .bubble { background: var(--bg3); border-radius: 8px; padding: 10px 14px; display: inline-block; max-width: 80%; }
    .msg.assistant .bubble { background: #1a2a1a; border-radius: 8px; padding: 10px 14px; display: inline-block; max-width: 90%; white-space: pre-wrap; }
    .msg .label { font-size: 11px; color: var(--muted); margin-bottom: 4px; }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
  </style>
</head>
<body>
<div class="topbar">
  <div class="logo">⚡ ZeroClaw Claude</div>
  <div class="dot" id="status-dot"></div>
  <span class="uptime" id="uptime-text">Loading...</span>
</div>

<nav>
  <a class="active" onclick="showTab('overview', this)">Overview</a>
  <a onclick="showTab('jobs', this)">Cron Jobs</a>
  <a onclick="showTab('runs', this)">Run History</a>
  <a onclick="showTab('chat', this)">Live Chat</a>
  <a onclick="showTab('logs', this)">Logs</a>
  <a onclick="showTab('memory', this)">Memory</a>
</nav>

<div class="container">

  <!-- OVERVIEW -->
  <div id="tab-overview" class="tab-content active">
    <div class="grid4">
      <div class="card"><h3>Total Runs</h3><div class="val blue" id="stat-runs">—</div></div>
      <div class="card"><h3>Success Rate</h3><div class="val green" id="stat-success">—</div></div>
      <div class="card"><h3>Tokens Used</h3><div class="val yellow" id="stat-tokens">—</div></div>
      <div class="card"><h3>Active Jobs</h3><div class="val accent" id="stat-jobs">—</div></div>
    </div>
    <div class="section">
      <div class="section-header"><h2>Recent Runs</h2></div>
      <table><thead><tr><th>Time</th><th>Source</th><th>Prompt</th><th>Model</th><th>Duration</th><th>Status</th></tr></thead>
      <tbody id="recent-runs"></tbody></table>
    </div>
  </div>

  <!-- JOBS -->
  <div id="tab-jobs" class="tab-content">
    <div class="section">
      <div class="section-header">
        <h2>Cron Jobs</h2>
        <button class="btn primary" onclick="openAddJob()">+ Add Job</button>
      </div>
      <table><thead><tr><th>Name</th><th>Schedule</th><th>Timezone</th><th>Last Run</th><th>Enabled</th><th>Actions</th></tr></thead>
      <tbody id="jobs-table"></tbody></table>
    </div>
  </div>

  <!-- RUNS -->
  <div id="tab-runs" class="tab-content">
    <div class="section">
      <div class="section-header"><h2>Run History</h2></div>
      <table><thead><tr><th>Time</th><th>Source</th><th>Prompt</th><th>Response</th><th>Duration</th><th>Tokens</th><th>Status</th></tr></thead>
      <tbody id="all-runs"></tbody></table>
    </div>
  </div>

  <!-- CHAT -->
  <div id="tab-chat" class="tab-content">
    <div class="section">
      <div class="section-header"><h2>Live Chat with Claude</h2></div>
      <div id="chat-messages"></div>
      <div class="chat-input">
        <input id="chat-input" placeholder="Ask Claude anything..." onkeydown="if(event.key==='Enter') sendChat()">
        <button class="btn primary" onclick="sendChat()">Send</button>
      </div>
    </div>
  </div>

  <!-- LOGS -->
  <div id="tab-logs" class="tab-content">
    <div class="section">
      <div class="section-header"><h2>Live Logs</h2><button class="btn" onclick="document.getElementById('log-container').innerHTML=''">Clear</button></div>
      <div id="log-container"></div>
    </div>
  </div>

  <!-- MEMORY -->
  <div id="tab-memory" class="tab-content">
    <div class="section">
      <div class="section-header"><h2>Memory Entries</h2></div>
      <table><thead><tr><th>Content</th><th>Salience</th><th>Age</th></tr></thead>
      <tbody id="memory-table"></tbody></table>
    </div>
  </div>

</div>

<script>
const ws = new WebSocket('ws://' + location.host + '/ws');
const startTime = Date.now();

ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.type === 'stats')   updateStats(msg.data);
  if (msg.type === 'runs')    updateRuns(msg.data);
  if (msg.type === 'jobs')    updateJobs(msg.data);
  if (msg.type === 'log')     appendLog(msg.data);
  if (msg.type === 'memory')  updateMemory(msg.data);
  if (msg.type === 'chat')    appendChat('assistant', msg.data);
};

function showTab(name, el) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  el.classList.add('active');
  ws.send(JSON.stringify({ type: 'load', tab: name }));
}

function updateStats(s) {
  document.getElementById('stat-runs').textContent    = s.totalRuns;
  document.getElementById('stat-success').textContent = (s.successRate * 100).toFixed(0) + '%';
  document.getElementById('stat-tokens').textContent  = (s.totalTokensIn + s.totalTokensOut).toLocaleString();
  document.getElementById('stat-jobs').textContent    = s.activeJobs;
  const up = Math.floor((Date.now() - startTime) / 1000);
  const h = Math.floor(up / 3600), m = Math.floor((up % 3600) / 60);
  document.getElementById('uptime-text').textContent = 'Uptime ' + h + 'h ' + m + 'm';
}

function updateRuns(rows) {
  const fmt = (ts) => ts ? new Date(ts).toLocaleTimeString() : '—';
  const tbody = (id) => document.getElementById(id);
  const html = rows.map(r => \`<tr>
    <td>\${fmt(r.startedAt)}</td><td><span class="badge \${r.source==='telegram'?'blue':r.source==='cron'?'yellow':'green'}">\${r.source}</span></td>
    <td style="max-width:200px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">\${r.prompt.slice(0,60)}</td>
    <td>\${r.model.replace('claude-','')}</td>
    <td>\${r.durationMs}ms</td>
    <td><span class="badge \${r.success?'green':'red'}">\${r.success?'OK':'ERR'}</span></td>
  </tr>\`).join('');
  if (tbody('recent-runs')) tbody('recent-runs').innerHTML = html;
  if (tbody('all-runs'))    tbody('all-runs').innerHTML   = html;
}

function updateJobs(jobList) {
  const html = jobList.map(j => \`<tr>
    <td>\${j.name}</td><td><code>\${j.schedule}</code></td><td>\${j.timezone}</td>
    <td>\${j.lastRun ? new Date(j.lastRun).toLocaleString() : 'Never'}</td>
    <td><span class="badge \${j.enabled?'green':'red'}">\${j.enabled?'On':'Off'}</span></td>
    <td><button class="btn" onclick="toggleJob('\${j.id}',\${!j.enabled})">\${j.enabled?'Disable':'Enable'}</button>
        <button class="btn danger" onclick="deleteJob('\${j.id}')">Delete</button></td>
  </tr>\`).join('');
  document.getElementById('jobs-table').innerHTML = html || '<tr><td colspan="6" style="color:var(--muted);text-align:center;padding:24px">No jobs. Add one!</td></tr>';
}

function updateMemory(mems) {
  const html = mems.map(m => \`<tr>
    <td style="max-width:500px">\${m.content.slice(0,200)}</td>
    <td>\${(m.salience * 100).toFixed(0)}%</td>
    <td>\${timeAgo(m.createdAt)}</td>
  </tr>\`).join('');
  document.getElementById('memory-table').innerHTML = html;
}

function appendLog(line) {
  const el = document.getElementById('log-container');
  const lvl = line.includes('[ERROR]') ? 'error' : line.includes('[WARN]') ? 'warn' : 'info';
  el.innerHTML += \`<div class="log-line \${lvl}">\${line}</div>\`;
  el.scrollTop = el.scrollHeight;
}

function appendChat(role, text) {
  const el = document.getElementById('chat-messages');
  el.innerHTML += \`<div class="msg \${role}"><div class="label">\${role}</div><div class="bubble">\${text}</div></div>\`;
  el.scrollTop = el.scrollHeight;
}

async function sendChat() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  appendChat('user', text);
  ws.send(JSON.stringify({ type: 'chat', text }));
}

function toggleJob(id, enabled) {
  fetch('/api/jobs/' + id, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ enabled }) });
}
function deleteJob(id) {
  if (!confirm('Delete job?')) return;
  fetch('/api/jobs/' + id, { method: 'DELETE' });
}
function openAddJob() {
  const name     = prompt('Job name:');
  if (!name) return;
  const schedule = prompt('Cron schedule (e.g. "0 9 * * *"):');
  if (!schedule) return;
  const jobPrompt = prompt('Prompt for Claude:');
  if (!jobPrompt) return;
  const tz = prompt('Timezone:', 'UTC');
  fetch('/api/jobs', { method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ name, schedule, prompt: jobPrompt, timezone: tz || 'UTC', model: 'claude-sonnet-4-6', enabled: true })
  });
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return s + 's ago';
  if (s < 3600) return Math.floor(s/60) + 'm ago';
  return Math.floor(s/3600) + 'h ago';
}

// Initial load
ws.onopen = () => ws.send(JSON.stringify({ type: 'load', tab: 'overview' }));
setInterval(() => ws.readyState === 1 && ws.send(JSON.stringify({ type: 'ping' })), 5000);
</script>
</body>
</html>`;

let server: http.Server | null = null;
let wss: WebSocketServer | null = null;
const clients = new Set<WebSocket>();

export function startDashboard(): void {
  const config = loadConfig();
  const port   = config.dashboardPort;

  const app = express();
  app.use(express.json());

  // ── Serve dashboard ─────────────────────────────────────────────────────────
  app.get('/', (_req: Request, res: Response) => {
    res.send(DASHBOARD_HTML);
  });

  // ── REST API ────────────────────────────────────────────────────────────────

  app.get('/api/stats', (_req, res) => {
    const s = runs.stats();
    res.json({
      totalRuns:     s.total,
      successRate:   s.successRate,
      totalTokensIn: s.tokensIn,
      totalTokensOut: s.tokensOut,
      activeJobs:    jobs.list().filter(j => j.enabled).length,
      memoryEntries: memory.count(),
      lastRun:       s.lastRun,
    });
  });

  app.get('/api/jobs', (_req, res) => res.json(jobs.list()));

  app.post('/api/jobs', (req, res) => {
    const job = jobs.create(req.body as Omit<CronJob, 'id' | 'createdAt' | 'lastRun' | 'nextRun'>);
    scheduleJob(job);
    broadcast('jobs', jobs.list());
    res.json(job);
  });

  app.patch('/api/jobs/:id', (req, res) => {
    jobs.update(req.params.id, req.body);
    const { refreshJob } = require('../scheduler/index.js');
    refreshJob(req.params.id);
    broadcast('jobs', jobs.list());
    res.json({ ok: true });
  });

  app.delete('/api/jobs/:id', (req, res) => {
    unscheduleJob(req.params.id);
    jobs.delete(req.params.id);
    broadcast('jobs', jobs.list());
    res.json({ ok: true });
  });

  app.get('/api/runs', (_req, res) => res.json(runs.list(100)));

  // ── HTTP + WebSocket ─────────────────────────────────────────────────────────

  server = http.createServer(app);
  wss    = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    clients.add(ws);

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === 'load') {
          const tab = msg.tab;
          if (tab === 'overview') {
            ws.send(JSON.stringify({ type: 'stats', data: await getStats() }));
            ws.send(JSON.stringify({ type: 'runs',  data: runs.list(20) }));
          }
          if (tab === 'jobs')   ws.send(JSON.stringify({ type: 'jobs',   data: jobs.list() }));
          if (tab === 'memory') ws.send(JSON.stringify({ type: 'memory', data: memory.search(50) }));
          if (tab === 'runs')   ws.send(JSON.stringify({ type: 'runs',   data: runs.list(100) }));
        }

        if (msg.type === 'chat') {
          const result = await runAgent(msg.text, { source: 'manual', resumeSession: true });
          ws.send(JSON.stringify({ type: 'chat', data: result.response }));
        }

      } catch (err: any) {
        log.error(`Dashboard WS error: ${err.message}`);
      }
    });

    ws.on('close', () => clients.delete(ws));
  });

  server.listen(port, '127.0.0.1', () => {
    log.info(`Dashboard: http://127.0.0.1:${port}`);
  });
}

export function stopDashboard(): void {
  wss?.close();
  server?.close();
}

export function broadcastLog(line: string): void {
  broadcast('log', line);
}

function broadcast(type: string, data: unknown): void {
  const payload = JSON.stringify({ type, data });
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload).catch(() => {});
    }
  }
}

async function getStats() {
  const s = runs.stats();
  return {
    totalRuns:      s.total,
    successRate:    s.successRate,
    totalTokensIn:  s.tokensIn,
    totalTokensOut: s.tokensOut,
    activeJobs:     jobs.list().filter(j => j.enabled).length,
    memoryEntries:  memory.count(),
    lastRun:        s.lastRun,
  };
}
