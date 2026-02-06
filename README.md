# Agent Logger

> Comprehensive structured JSON logging for autonomous agent systems

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)

**Agent Logger** provides comprehensive structured logging for autonomous agent systems like [OpenClaw](https://github.com/anthropics/openclaw). Track agent operations, LLM API calls, and system events with correlation IDs, action lifecycle tracking, and detailed context—all in clean, parseable JSONL format.

## Features

- ✨ **Single-line JSON** - Easy to parse, grep, and analyze
- 🔗 **Correlation IDs** - Track operations across components
- 📊 **Action Lifecycle** - start → progress → complete/failed
- 🤖 **LLM Context** - Token counts, costs, durations
- 🎯 **Zero Dependencies** - Uses Node.js built-ins only
- 🔌 **Hook-based** - Integrates via OpenClaw's hook system

## Quick Start

### Installation

Copy the hook to your OpenClaw workspace:

```bash
mkdir -p ~/.openclaw/workspace/hooks/agent-logger
cd ~/.openclaw/workspace/hooks/agent-logger
curl -O https://raw.githubusercontent.com/WhitePineTech/agent-logger/main/handler.js
curl -O https://raw.githubusercontent.com/WhitePineTech/agent-logger/main/HOOK.md
```

### Enable the Hook

Add to `~/.openclaw/openclaw.json`:

```json
{
  "hooks": {
    "internal": {
      "enabled": true,
      "entries": {
        "agent-logger": { "enabled": true }
      }
    }
  }
}
```

Restart OpenClaw:

```bash
systemctl --user restart openclaw.service
```

### Verify

```bash
journalctl --user -u openclaw.service | grep agent-logger
# Should see: "Registered hook: agent-logger -> command, agent, llm, ..."
```

## Log Format

Logs are written to `~/.openclaw/logs/agent.log` as single-line JSON (JSONL):

```json
{"timestamp":"2026-02-05T23:43:05.309Z","level":"INFO","component":"llm_caller","message":"LLM complete: xai/grok-4-1-fast","action":"complete","phase":"complete","context":{"correlation_id":"427d16297a46376c","model":"xai/grok-4-1-fast","prompt_tokens":1500,"completion_tokens":500,"total_tokens":2000,"duration_ms":2345}}
```

### Fields

| Field | Description |
|-------|-------------|
| `timestamp` | ISO 8601 UTC timestamp |
| `level` | DEBUG, INFO, WARN, ERROR, FATAL |
| `component` | agent, llm_caller, telegram_handler, cron_scheduler, subagent_manager |
| `message` | Human-readable description |
| `action` | Specific action (new, complete, error, etc.) |
| `phase` | Lifecycle: start, progress, complete, failed |
| `context` | Structured data (correlation_id, tokens, errors, etc.) |

## Usage

### View Logs

```bash
# Live tail
tail -f ~/.openclaw/logs/agent.log | jq .

# Filter by component
jq 'select(.component == "llm_caller")' ~/.openclaw/logs/agent.log

# Filter by correlation ID
jq 'select(.context.correlation_id == "427d16297a46376c")' ~/.openclaw/logs/agent.log

# Count errors
grep '"level":"ERROR"' ~/.openclaw/logs/agent.log | wc -l
```

### Correlation ID Tracking

Each agent session gets a unique correlation ID that links all related operations:

```bash
# Find all operations for a session
CORR_ID=$(jq -r 'select(.action == "bootstrap") | .context.correlation_id' ~/.openclaw/logs/agent.log | head -1)
jq "select(.context.correlation_id == \"$CORR_ID\")" ~/.openclaw/logs/agent.log
```

## Events Logged

| Event Type | Actions | Context Fields |
|------------|---------|----------------|
| **command** | new, reset, stop | sender_id, source |
| **agent** | bootstrap, ready, error | workspace_dir, error |
| **llm** | start, complete, error | model, tokens, duration_ms, cost_estimate |
| **telegram** | message, callback | sender_id, chat_id, message_type |
| **cron** | trigger, complete, error | task_id, schedule, next_run |
| **subagent** | spawn, complete, error | subagent_id, parent_agent_id, task |

## Use Cases

### LLM Cost Tracking

```bash
# Total tokens used
jq -r 'select(.component == "llm_caller" and .phase == "complete") | .context.total_tokens' \
  ~/.openclaw/logs/agent.log | paste -sd+ | bc
```

### Performance Monitoring

```bash
# Average LLM response time
jq -r 'select(.component == "llm_caller" and .phase == "complete") | .context.duration_ms' \
  ~/.openclaw/logs/agent.log | awk '{sum+=$1; count++} END {print sum/count "ms"}'
```

### Error Analysis

```bash
# Most common errors
jq -r 'select(.level == "ERROR") | .message' ~/.openclaw/logs/agent.log | \
  sort | uniq -c | sort -nr
```

## Configuration

Customize behavior by modifying `handler.js`:

```javascript
// Change log file location
const LOG_FILE = path.join(stateDir, "logs", "custom-agent.log");

// Add custom context fields
context: {
  ...baseEntry.context,
  custom_field: "custom_value"
}
```

## Log Rotation

Logs don't auto-rotate. Set up manual rotation:

```bash
# Rotate with timestamp
mv ~/.openclaw/logs/agent.log ~/.openclaw/logs/agent.log.$(date +%Y%m%d)

# Or use logrotate
cat > /etc/logrotate.d/openclaw-agent << 'EOF'
/home/openclaw/.openclaw/logs/agent.log {
    daily
    rotate 7
    compress
    missingok
    notifempty
    copytruncate
}
EOF
```

## Architecture

```
┌─────────────┐
│   OpenClaw  │
└──────┬──────┘
       │ triggers events
       ↓
┌─────────────────┐
│  Hook System    │
└──────┬──────────┘
       │ calls
       ↓
┌─────────────────┐      ┌──────────────────┐
│  agent-logger   │─────→│  agent.log       │
│  handler.js     │      │  (JSONL format)  │
└─────────────────┘      └──────────────────┘
       │
       ├─ Correlation ID generation
       ├─ Context enrichment
       └─ Single-line JSON writing
```

## Requirements

- **Node.js** >= 18.0.0
- **OpenClaw** with hook system support
- No external dependencies

## Files

```
agent-logger/
├── handler.js      # Main hook implementation
├── HOOK.md         # OpenClaw hook metadata
├── USAGE.md        # Detailed usage guide
├── package.json    # Package metadata
├── LICENSE         # MIT License
└── README.md       # This file
```

## Troubleshooting

**Hook not loading?**
```bash
journalctl --user -u openclaw.service | grep -E "(hook|error)"
```

**No logs appearing?**
- Check hook is enabled in `openclaw.json`
- Trigger an event (send `/new` to agent)
- Verify log directory exists: `ls ~/.openclaw/logs/`

**Syntax errors?**
```bash
node --input-type=module -e "import('file:///home/openclaw/.openclaw/workspace/hooks/agent-logger/handler.js')"
```

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Dashboard

Generate a beautiful HTML dashboard from your agent logs:

```bash
node generate-dashboard.js > dashboard.html
# Open in browser
```

**Features:**
- Summary cards: Total entries, today's activity, errors, LLM tokens, unique sessions
- Events breakdown by component
- Recent events table (sortable-ish)
- Responsive design, auto date in title ("Bud's Dashboard - Friday, February 6, 2026")
- Generated: timestamp

Perfect for quick glances at agent health/activity.

## License

MIT License - see [LICENSE](LICENSE) file for details

## Related Projects

- [OpenClaw](https://github.com/anthropics/openclaw) - Autonomous agent system
- [tslog](https://tslog.js.org/) - TypeScript logger (used internally by OpenClaw)

## Authors

Built by [White Pine Tech](https://github.com/WhitePineTech)

---

**📊 Start logging your agents today!**
