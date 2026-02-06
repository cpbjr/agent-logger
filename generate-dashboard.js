#!/usr/bin/env node
/**
 * Generate HTML dashboard from agent.log
 * Usage: node generate-dashboard.js > dashboard.html
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const stateDir = process.env.OPENCLAW_STATE_DIR?.trim() || path.join(os.homedir(), '.openclaw');
const LOG_FILE = path.join(stateDir, 'logs', 'agent.log');

try {
  const data = fs.readFileSync(LOG_FILE, 'utf8').trim();
  const logs = data.split('\n').map(line => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  }).filter(Boolean);

  // Stats
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const todayLogs = logs.filter(l => l.timestamp?.startsWith(todayStr));

  const stats = {
    total: logs.length,
    today: todayLogs.length,
    errors: logs.filter(l => l.level === 'ERROR').length,
    llmTokens: logs.reduce((sum, l) => sum + (l.context?.total_tokens || 0), 0),
    uniqueCorrelations: new Set(logs.map(l => l.context?.correlation_id)).size,
  };

  // By component
  const byComponent = logs.reduce((acc, l) => {
    acc[l.component || 'unknown'] = (acc[l.component || 'unknown'] || 0) + 1;
    return acc;
  }, {});

  // Recent 100
  const recent = logs.slice(-100);

  const titleDate = now.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Bud's Dashboard</title>
  <style>
    * { box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; 
      max-width: 1400px; margin: 0 auto; padding: 2rem; line-height: 1.6; color: #333;
    }
    h1 { 
      font-size: 2.5rem; margin-bottom: 0.5rem; color: #1a1a1a;
      border-bottom: 3px solid #007acc; padding-bottom: 0.5rem;
    }
    .subtitle { font-size: 1.2rem; color: #666; margin-bottom: 2rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
    .card { 
      background: white; padding: 1.5rem; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.07); 
      border-left: 5px solid #007acc;
    }
    .stat-big { font-size: 2.5rem; font-weight: bold; color: #007acc; margin: 0; }
    .stat-label { color: #666; margin: 0; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.5px; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    th { background: #f8f9fa; padding: 1rem 0.75rem; text-align: left; font-weight: 600; border-bottom: 2px solid #e9ecef; }
    td { padding: 0.75rem; border-bottom: 1px solid #e9ecef; }
    tr:hover { background: #f8f9fa; }
    .error { color: #dc3545; }
    .time { font-family: 'SF Mono', Monaco, monospace; font-size: 0.85rem; color: #666; }
    @media (max-width: 768px) { body { padding: 1rem; } .grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <h1>Bud's Dashboard</h1>
  <p class="subtitle">${titleDate} &middot; ${now.toLocaleTimeString()}</p>

  <div class="grid">
    <div class="card">
      <p class="stat-label">Total Entries</p>
      <p class="stat-big">${stats.total.toLocaleString()}</p>
    </div>
    <div class="card">
      <p class="stat-label">Today's Activity</p>
      <p class="stat-big">${stats.today}</p>
    </div>
    <div class="card">
      <p class="stat-label">Errors</p>
      <p class="stat-big">${stats.errors}</p>
    </div>
    <div class="card">
      <p class="stat-label">LLM Tokens</p>
      <p class="stat-big">${stats.llmTokens.toLocaleString()}</p>
    </div>
    <div class="card">
      <p class="stat-label">Unique Sessions</p>
      <p class="stat-big">${stats.uniqueCorrelations}</p>
    </div>
  </div>

  <div class="card">
    <h2>Events by Component</h2>
    <ul style="columns: 2; list-style: none; padding: 0;">
      ${Object.entries(byComponent).sort(([,a],[,b]) => b-a).map(([comp, count]) => 
        `<li style="margin: 0.25rem 0;"><strong>${comp}:</strong> ${count}</li>`
      ).join('')}
    </ul>
  </div>

  <div class="card">
    <h2>Recent Events (last 100)</h2>
    <table>
      <thead>
        <tr>
          <th>Time</th>
          <th>Component</th>
          <th>Level</th>
          <th>Action</th>
          <th>Message</th>
        </tr>
      </thead>
      <tbody>
        ${recent.map(l => {
          const time = new Date(l.timestamp).toLocaleString('en-US', { 
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', 
            hour12: true 
          });
          return `
          <tr>
            <td class="time">${time}</td>
            <td>${l.component || 'N/A'}</td>
            <td class="${l.level === 'ERROR' ? 'error' : ''}">${l.level}</td>
            <td>${l.action || 'N/A'}</td>
            <td>${l.message}</td>
          </tr>`;
        }).reverse().join('')}
      </tbody>
    </table>
  </div>

  <footer style="margin-top: 3rem; padding-top: 2rem; border-top: 1px solid #eee; color: #999; font-size: 0.9rem;">
    Generated by agent-logger v1.0 &middot; Logs: ${LOG_FILE}
  </footer>
</body>
</html>`;

  console.log(html);
} catch (err) {
  console.error('Error generating dashboard:', err.message);
  process.exit(1);
}
