import { Log } from "@/util/log"
import * as path from "path"
import { Instance } from "@/project/instance"
import { Global } from "@/global"

const log = Log.create({ service: "plan-mode" })

const DESTRUCTIVE_COMMANDS = new Set([
  "rm",
  "rmdir",
  "mv",
  "cp",
  "sed",
  "awk",
  "tee",
  "truncate",
  "dd",
  "shred",
  "wipe",
  "chmod",
  "chown",
  "ln",
  "install",
])

const DESTRUCTIVE_PATTERNS = [
  /^git\s+(commit|push|reset|rebase|merge|cherry-pick|am|stash\s+pop|stash\s+apply)/i,
  /^npm\s+(install|i|uninstall|remove|ci|publish)/i,
  /^yarn\s+(add|remove|upgrade|publish)/i,
  /^pnpm\s+(add|remove|install|publish)/i,
  /^pip\s+(install|uninstall)/i,
  /^cargo\s+(install|publish)/i,
  /^go\s+(install|get|mod\s+(tidy|download))/i,
  /^brew\s+(install|uninstall|upgrade)/i,
  /^apt\s*(install|remove|purge|upgrade)/i,
  /^apt-get\s*(install|remove|purge|upgrade)/i,
  /^docker\s+(run|build|push|rmi|rm|stop|kill|exec)/i,
  /^kubectl\s+(apply|delete|create|patch|exec)/i,
  /^helm\s+(install|upgrade|uninstall|delete)/i,
  /^gh\s+(issue|pr)\s+(create|close|reopen|edit|comment|merge|review|ready|convert)/i,
  /^gh\s+release\s+(create|delete|upload|download)/i,
  /^gh\s+run\s+(cancel|rerun|watch)/i,
  /^gh\s+workflow\s+run/i,
  /^gh\s+repo\s+(create|delete|edit|fork|sync)/i,
  /^gh\s+(api|graphql).*--method\s+(POST|PUT|PATCH|DELETE)/i,
]

const CONTENT_CREATION_COMMANDS = new Set([
  "mkdir",
  "touch",
])

const READONLY_COMMANDS = new Set([
  "ls",
  "dir",
  "cat",
  "head",
  "tail",
  "less",
  "more",
  "grep",
  "egrep",
  "fgrep",
  "find",
  "locate",
  "which",
  "whereis",
  "type",
  "whoami",
  "id",
  "pwd",
  "echo",
  "printf",
  "wc",
  "sort",
  "uniq",
  "cut",
  "tr",
  "stat",
  "file",
  "du",
  "df",
  "free",
  "uptime",
  "date",
  "cal",
  "env",
  "printenv",
  "uname",
  "hostname",
  "arch",
  "nc",
  "curl",
  "wget",
])

const READONLY_GIT_PATTERNS = [
  /^git\s+(status|diff|log|show|branch|tag|remote|stash\s+list|blame|shortlog|rev-parse|ls-files|ls-tree|describe)/i,
]

const READONLY_GH_PATTERNS = [
  /^gh\s+(issue|pr)\s+(list|view|search|checks|diff)/i,
  /^gh\s+release\s+(list|view|download)/i,
  /^gh\s+run\s+(list|view|download)/i,
  /^gh\s+workflow\s+list/i,
  /^gh\s+repo\s+(view|list|clone)/i,
  /^gh\s+(api|graphql)\s+(?!.*--method\s+(POST|PUT|PATCH|DELETE))/i,
  /^gh\s+(browse|gist\s+list|search|status)/i,
]

const PLAN_PATH_PATTERNS = [
  /(^|\/|\\)\.opencode\/plans(\/|\\|$)/i,
]

export function isPlanPath(targetPath: string): boolean {
  const normalized = targetPath.replace(/\\/g, "/")
  for (const pattern of PLAN_PATH_PATTERNS) {
    if (pattern.test(normalized)) {
      return true
    }
  }
  return false
}

function isPlanPathWithContext(targetPath: string): boolean {
  if (isPlanPath(targetPath)) {
    return true
  }
  try {
    const absolutePath = path.isAbsolute(targetPath) 
      ? targetPath 
      : path.resolve(Instance.directory, targetPath)
    
    const planPaths = [
      path.join(".opencode", "plans"),
      path.join(Instance.worktree, ".opencode", "plans"),
      path.join(Global.Path.data, "plans"),
    ]
    
    for (const planPath of planPaths) {
      const absolutePlanPath = path.isAbsolute(planPath) 
        ? planPath 
        : path.resolve(Instance.directory, planPath)
      if (absolutePath.startsWith(absolutePlanPath + path.sep) || absolutePath === absolutePlanPath) {
        return true
      }
    }
  } catch {
    // If Instance context isn't available, fall back to pattern matching
  }
  return false
}

export type PlanModeAction = "allow" | "deny"

export interface PlanModeValidationResult {
  action: PlanModeAction
  reason?: string
  command?: string
}

export function isPlanMode(agent: string): boolean {
  return agent === "plan"
}

export function validateCommandForPlanMode(command: string, agent: string): PlanModeValidationResult {
  if (!isPlanMode(agent)) {
    return { action: "allow" }
  }

  const trimmed = command.trim()
  if (!trimmed) {
    return { action: "allow" }
  }

  const firstToken = extractFirstToken(trimmed)
  if (!firstToken) {
    return { action: "allow" }
  }

  if (DESTRUCTIVE_COMMANDS.has(firstToken)) {
    log.info("plan mode: blocking destructive command", { command: firstToken })
    return {
      action: "deny",
      reason: `Command '${firstToken}' is not allowed in plan mode. Plan mode is read-only. Switch to 'build' mode to make changes.`,
      command: firstToken,
    }
  }

  for (const pattern of DESTRUCTIVE_PATTERNS) {
    if (pattern.test(trimmed)) {
      const matched = pattern.source.match(/\w+\s+\w+/)?.[0] || firstToken
      log.info("plan mode: blocking destructive pattern", { pattern: pattern.source })
      return {
        action: "deny",
        reason: `Command '${matched}' is not allowed in plan mode. Plan mode is read-only. Switch to 'build' mode to make changes.`,
        command: matched,
      }
    }
  }

  if (CONTENT_CREATION_COMMANDS.has(firstToken)) {
    const args = extractPathArgs(trimmed)
    const hasPlanPath = args.some(arg => isPlanPathWithContext(arg))
    if (hasPlanPath) {
      log.info("plan mode: allowing content creation for plan path", { command: firstToken, args })
      return { action: "allow" }
    }
    log.info("plan mode: blocking content creation outside plan paths", { command: firstToken, args })
    return {
      action: "deny",
      reason: `Command '${firstToken}' is only allowed for plan files (.opencode/plans/). Switch to 'build' mode to create files elsewhere.`,
      command: firstToken,
    }
  }

  const dangerousChars = detectDangerousChars(trimmed)
  if (dangerousChars) {
    log.info("plan mode: blocking dangerous characters", { chars: dangerousChars })
    return {
      action: "deny",
      reason: `Potentially unsafe command detected (${dangerousChars}). Plan mode restricts commands that could modify files. Switch to 'build' mode to execute this command.`,
      command: dangerousChars,
    }
  }

  if (READONLY_COMMANDS.has(firstToken)) {
    return { action: "allow" }
  }

  for (const pattern of READONLY_GIT_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { action: "allow" }
    }
  }

  for (const pattern of READONLY_GH_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { action: "allow" }
    }
  }

  return { action: "allow" }
}

function extractFirstToken(command: string): string {
  let i = 0
  while (i < command.length && /\s/.test(command[i])) {
    i++
  }

  let token = ""
  let inQuote = false
  let quoteChar = ""

  while (i < command.length) {
    const char = command[i]

    if (inQuote) {
      if (char === quoteChar && command[i - 1] !== "\\") {
        inQuote = false
      } else {
        token += char
      }
    } else if (char === '"' || char === "'") {
      inQuote = true
      quoteChar = char
    } else if (/\s/.test(char)) {
      break
    } else if (char === "|" || char === "&" || char === ";" || char === "<" || char === ">") {
      break
    } else {
      token += char
    }
    i++
  }

  const parts = token.split(/\s+/)
  return parts[0]?.toLowerCase() || ""
}

function extractPathArgs(command: string): string[] {
  const tokens: string[] = []
  let current = ""
  let inQuote = false
  let quoteChar = ""

  for (let i = 0; i < command.length; i++) {
    const char = command[i]

    if (inQuote) {
      if (char === quoteChar && command[i - 1] !== "\\") {
        tokens.push(current)
        current = ""
        inQuote = false
      } else {
        current += char
      }
    } else if (char === '"' || char === "'") {
      if (current) tokens.push(current)
      current = ""
      inQuote = true
      quoteChar = char
    } else if (/\s/.test(char)) {
      if (current) {
        tokens.push(current)
        current = ""
      }
    } else {
      current += char
    }
  }
  if (current) tokens.push(current)

  return tokens.filter(t => !t.startsWith("-"))
}

function detectDangerousChars(command: string): string | null {
  let inSingleQuote = false
  let inDoubleQuote = false
  let isEscaped = false

  for (let i = 0; i < command.length; i++) {
    const char = command[i]

    if (isEscaped) {
      isEscaped = false
      continue
    }

    if (char === "\\" && !inSingleQuote) {
      isEscaped = true
      continue
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote
      continue
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote
      continue
    }

    const inAnyQuote = inSingleQuote || inDoubleQuote

    if (!inAnyQuote) {
      if (/[\n\r\u2028\u2029\u0085]/.test(char)) {
        return "newline injection"
      }
    }

    if (char === "`" && !inSingleQuote) {
      return "command substitution (backtick)"
    }

    if (!inAnyQuote && char === ">" && i > 0 && command[i - 1] !== ">") {
      if (i === 0 || command[i - 1] !== "2") {
        return "file redirect"
      }
    }
  }

  return null
}

export const PlanMode = {
  isPlanMode,
  validateCommandForPlanMode,
  isPlanPath,
  DESTRUCTIVE_COMMANDS,
  CONTENT_CREATION_COMMANDS,
  READONLY_COMMANDS,
}
