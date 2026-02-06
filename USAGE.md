# Agent Logger for OpenClaw

Comprehensive structured JSON logging for autonomous agent operations.

## Quick Start

The hook is already installed and running. Logs are written to:

```
~/.openclaw/logs/agent.log
```

## Log Format

Single-line JSON entries (JSONL):

```json
{"timestamp":"2026-02-05T23:43:05.309Z","level":"INFO","component":"agent","message":"Agent bootstrap started","action":"bootstrap","phase":"start","context":{"correlation_id":"427d16297a46376c","session_key":"agent:main:main"}}
```

## Fields

| Field | Description |
|-------|-------------|
| `timestamp` | ISO 8601 UTC timestamp |
| `level` | DEBUG, INFO, WARN, ERROR, FATAL |
| `component` | Source: command, agent, llm_caller, telegram_handler, cron_scheduler, subagent_manager |
| `message` | Human-readable description |
| `action` | The specific action (new, bootstrap, complete, etc.) |
| `phase` | Lifecycle: start, progress, complete, failed |
| `context.correlation_id` | Links related operations together |

## Viewing Logs

```bash
# Live tail (pretty printed)
tail -f ~/.openclaw/logs/agent.log | jq .

# Recent entries
tail -20 ~/.openclaw/logs/agent.log | jq .

# Filter by component
jq 'select(.component == "llm_caller")' ~/.openclaw/logs/agent.log

# Filter by correlation ID
jq 'select(.context.correlation_id == "427d16297a46376c")' ~/.openclaw/logs/agent.log

# Count errors
grep '"level":"ERROR"' ~/.openclaw/logs/agent.log | wc -l
```

## Events Logged

| Event Type | Actions | Description |
|------------|---------|-------------|
| command | new, reset, stop | User commands via Telegram/web |
| agent | bootstrap, ready, error | Agent lifecycle |
| llm | start, complete, error | LLM API calls with token counts |
| telegram | message, callback | Telegram interactions |
| cron | trigger, complete, error | Scheduled tasks |
| subagent | spawn, complete, error | Subagent operations |

## Configuration

Located in `~/.openclaw/openclaw.json`:

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

### Disable Logging

```bash
openclaw hooks disable agent-logger
```

Or edit config and set `"enabled": false`.

## Log Rotation

Manual rotation:

```bash
mv ~/.openclaw/logs/agent.log ~/.openclaw/logs/agent.log.$(date +%Y%m%d)
```

## Correlation ID Tracking

Each session gets a unique correlation ID. Use it to trace an entire operation:

```bash
CORR_ID="427d16297a46376c"
jq "select(.context.correlation_id == \"$CORR_ID\")" ~/.openclaw/logs/agent.log
```

New correlation IDs are generated on `/new` or `/reset` commands.

## Files

```
~/.openclaw/workspace/hooks/agent-logger/
├── handler.js   # Main hook implementation
├── HOOK.md      # OpenClaw hook metadata
└── README.md    # This file
```

## Troubleshooting

**No logs appearing?**
```bash
journalctl --user -u openclaw.service | grep agent-logger
# Should see: "Registered hook: agent-logger -> command, agent, llm, ..."
```

**Restart after changes:**
```bash
systemctl --user restart openclaw.service
```

## License

MIT
