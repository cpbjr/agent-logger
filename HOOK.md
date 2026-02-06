---
name: agent-logger
description: "Comprehensive structured JSON logging for autonomous agent operations"
homepage: https://github.com/WhitePineTech/agent-logger
metadata:
  {
    "openclaw":
      {
        "emoji": "📊",
        "events": ["command", "agent", "llm", "subagent", "telegram", "cron"],
        "install": [{ "id": "workspace", "kind": "workspace", "label": "Workspace Hook" }],
      },
  }
---

# Agent Logger Hook

Comprehensive structured logging system for OpenClaw autonomous agents. Writes single-line JSON entries to `~/.openclaw/logs/agent.log` with correlation IDs, action lifecycle tracking, and detailed context.

## What It Does

For every agent operation:

1. **Generates correlation IDs** - Track operations across components
2. **Logs action lifecycle** - start/progress/complete/failed phases
3. **Captures context** - Tokens, costs, durations, sender info
4. **Writes JSONL format** - Single-line JSON for easy parsing

## Output Format

Log entries are written in JSONL (JSON Lines) format:

```json
{"timestamp":"2026-02-05T14:30:00.000Z","level":"INFO","component":"command","message":"Command: new","action":"new","context":{"correlation_id":"a1b2c3d4e5f6g7h8","session_key":"agent:main:main","sender_id":"8176021301","source":"telegram"}}
{"timestamp":"2026-02-05T14:30:01.000Z","level":"INFO","component":"llm_caller","message":"LLM complete: xai/grok-4-1-fast","action":"complete","phase":"complete","context":{"correlation_id":"a1b2c3d4e5f6g7h8","model":"xai/grok-4-1-fast","prompt_tokens":1500,"completion_tokens":500,"total_tokens":2000,"duration_ms":2345}}
```

## Log Entry Fields

| Field | Description |
|-------|-------------|
| `timestamp` | ISO 8601 UTC timestamp |
| `level` | DEBUG, INFO, WARN, ERROR, FATAL |
| `component` | Source component (llm_caller, telegram_handler, etc.) |
| `message` | Human-readable description |
| `action` | The action being performed |
| `phase` | Lifecycle phase: start, progress, complete, failed |
| `context` | Additional structured data |

## Context Fields

| Field | Description |
|-------|-------------|
| `correlation_id` | Unique ID linking related operations |
| `session_key` | Agent session identifier |
| `model` | LLM model used |
| `prompt_tokens` | Input token count |
| `completion_tokens` | Output token count |
| `duration_ms` | Operation duration in milliseconds |
| `error` | Error message if failed |

## Events Logged

- **command** - User commands (/new, /reset, /stop)
- **agent** - Agent lifecycle (bootstrap, ready, error)
- **llm** - LLM API calls (start, complete, error)
- **subagent** - Subagent operations
- **telegram** - Telegram message handling
- **cron** - Scheduled task execution

## Log File Location

`~/.openclaw/logs/agent.log`

## Viewing Logs

```bash
# Recent logs
tail -f ~/.openclaw/logs/agent.log | jq .

# Filter by component
cat ~/.openclaw/logs/agent.log | jq 'select(.component == "llm_caller")'

# Filter by correlation ID
cat ~/.openclaw/logs/agent.log | jq 'select(.context.correlation_id == "a1b2c3d4")'

# Count errors
cat ~/.openclaw/logs/agent.log | jq 'select(.level == "ERROR")' | wc -l

# LLM token usage
cat ~/.openclaw/logs/agent.log | jq 'select(.component == "llm_caller" and .phase == "complete") | .context.total_tokens' | paste -sd+ | bc
```

## Configuration

Enable in `~/.openclaw/openclaw.json`:

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

## Disabling

```bash
openclaw hooks disable agent-logger
```

Or set `"enabled": false` in config.
