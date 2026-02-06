/**
 * Agent Logger Hook - Comprehensive structured logging for OpenClaw
 *
 * Logs all agent operations to ~/.openclaw/logs/agent.log in JSONL format
 * with correlation IDs, action lifecycle tracking, and LLM context.
 */
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

// Log file path and rotation settings
const stateDir = process.env.OPENCLAW_STATE_DIR?.trim() || path.join(os.homedir(), ".openclaw");
const LOG_FILE = path.join(stateDir, "logs", "agent.log");
const MAX_LOG_SIZE_MB = 100;
const MAX_LOG_AGE_DAYS = 7;

// In-memory correlation tracking
const correlationMap = new Map();

/**
 * Generate a short correlation ID
 */
function generateCorrelationId() {
  return crypto.randomBytes(8).toString("hex");
}

/**
 * Get or create correlation ID for a session
 */
function getCorrelationId(sessionKey) {
  if (!correlationMap.has(sessionKey)) {
    correlationMap.set(sessionKey, generateCorrelationId());
  }
  return correlationMap.get(sessionKey);
}

/**
 * Check if log file needs rotation
 */
async function shouldRotateLog() {
  try {
    const stats = await fs.stat(LOG_FILE);
    const sizeMB = stats.size / (1024 * 1024);
    return sizeMB >= MAX_LOG_SIZE_MB;
  } catch (err) {
    // File doesn't exist yet
    return false;
  }
}

/**
 * Rotate log file
 */
async function rotateLog() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const rotatedFile = `${LOG_FILE}.${timestamp}`;

    await fs.rename(LOG_FILE, rotatedFile);
    console.log(`[agent-logger] Rotated log to ${path.basename(rotatedFile)}`);

    // Clean up old logs
    await cleanOldLogs();
  } catch (err) {
    console.error("[agent-logger] Failed to rotate log:", err.message);
  }
}

/**
 * Delete logs older than MAX_LOG_AGE_DAYS
 */
async function cleanOldLogs() {
  try {
    const logDir = path.dirname(LOG_FILE);
    const files = await fs.readdir(logDir);
    const logFiles = files.filter(f => f.startsWith('agent.log.') && f !== 'agent.log');

    const cutoffTime = Date.now() - (MAX_LOG_AGE_DAYS * 24 * 60 * 60 * 1000);

    for (const file of logFiles) {
      const filePath = path.join(logDir, file);
      const stats = await fs.stat(filePath);

      if (stats.mtimeMs < cutoffTime) {
        await fs.unlink(filePath);
        console.log(`[agent-logger] Deleted old log: ${file}`);
      }
    }
  } catch (err) {
    console.error("[agent-logger] Failed to clean old logs:", err.message);
  }
}

/**
 * Write a structured log entry
 */
async function writeLog(entry) {
  try {
    const logDir = path.dirname(LOG_FILE);
    await fs.mkdir(logDir, { recursive: true });

    // Check if rotation is needed
    if (await shouldRotateLog()) {
      await rotateLog();
    }

    // Remove null/undefined values from context
    if (entry.context) {
      entry.context = Object.fromEntries(
        Object.entries(entry.context).filter(([_, v]) => v != null)
      );
      if (Object.keys(entry.context).length === 0) {
        delete entry.context;
      }
    }

    const line = JSON.stringify(entry) + "\n";
    await fs.appendFile(LOG_FILE, line, "utf-8");
  } catch (err) {
    console.error("[agent-logger] Failed to write log:", err instanceof Error ? err.message : String(err));
  }
}

/**
 * Main event handler
 */
const logAgentEvent = async (event) => {
  const timestamp = event.timestamp?.toISOString() ?? new Date().toISOString();
  const correlationId = getCorrelationId(event.sessionKey);

  // Base log entry
  const baseEntry = {
    timestamp,
    level: "INFO",
    component: event.type,
    message: "",
    action: event.action,
    context: {
      correlation_id: correlationId,
      session_key: event.sessionKey,
    }
  };

  // Handle different event types
  switch (event.type) {
    case "command":
      await writeLog({
        ...baseEntry,
        message: `Command: ${event.action}`,
        context: {
          ...baseEntry.context,
          sender_id: event.context?.senderId,
          source: event.context?.commandSource,
        }
      });

      // Reset correlation ID on new session
      if (event.action === "new" || event.action === "reset") {
        correlationMap.set(event.sessionKey, generateCorrelationId());
      }
      break;

    case "agent":
      if (event.action === "bootstrap") {
        await writeLog({
          ...baseEntry,
          message: "Agent bootstrap started",
          phase: "start",
          context: {
            ...baseEntry.context,
            workspace_dir: event.context?.workspaceDir,
          }
        });
      } else if (event.action === "ready") {
        await writeLog({
          ...baseEntry,
          message: "Agent ready",
          phase: "complete",
        });
      } else if (event.action === "error") {
        await writeLog({
          ...baseEntry,
          level: "ERROR",
          message: `Agent error: ${event.context?.error || "unknown"}`,
          phase: "failed",
          context: {
            ...baseEntry.context,
            error: event.context?.error,
            error_code: event.context?.errorCode,
          }
        });
      } else {
        await writeLog({
          ...baseEntry,
          message: `Agent ${event.action}`,
        });
      }
      break;

    case "llm":
      await writeLog({
        ...baseEntry,
        component: "llm_caller",
        message: `LLM ${event.action}: ${event.context?.model || "unknown"}`,
        phase: event.action === "start" ? "start" : event.action === "complete" ? "complete" : "progress",
        context: {
          ...baseEntry.context,
          model: event.context?.model,
          prompt_tokens: event.context?.promptTokens,
          completion_tokens: event.context?.completionTokens,
          total_tokens: event.context?.totalTokens,
          duration_ms: event.context?.durationMs,
          cost_estimate: event.context?.costEstimate,
        }
      });
      break;

    case "subagent":
      await writeLog({
        ...baseEntry,
        component: "subagent_manager",
        message: `Subagent ${event.action}`,
        phase: event.action === "spawn" ? "start" : event.action === "complete" ? "complete" : event.action === "error" ? "failed" : "progress",
        context: {
          ...baseEntry.context,
          subagent_id: event.context?.subagentId,
          parent_agent_id: event.context?.parentAgentId,
          task: event.context?.task,
        }
      });
      break;

    case "telegram":
      await writeLog({
        ...baseEntry,
        component: "telegram_handler",
        message: `Telegram ${event.action}`,
        context: {
          ...baseEntry.context,
          sender_id: event.context?.senderId,
          message_type: event.context?.messageType,
          chat_id: event.context?.chatId,
        }
      });
      break;

    case "cron":
      await writeLog({
        ...baseEntry,
        component: "cron_scheduler",
        message: `Cron ${event.action}: ${event.context?.taskId || "unknown"}`,
        phase: event.action === "trigger" ? "start" : event.action === "complete" ? "complete" : event.action === "error" ? "failed" : "progress",
        context: {
          ...baseEntry.context,
          task_id: event.context?.taskId,
          schedule: event.context?.schedule,
          next_run: event.context?.nextRun,
        }
      });
      break;

    default:
      // Log any other events generically
      await writeLog({
        ...baseEntry,
        message: `${event.type}:${event.action}`,
        context: {
          ...baseEntry.context,
          ...event.context,
        }
      });
  }
};

export default logAgentEvent;
