const fs = require("node:fs")
const path = require("node:path")
const { spawnSync } = require("node:child_process")

function stripMatchingQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }
  return value
}

function loadEnvFile(envFile) {
  const envPath = path.resolve(process.cwd(), envFile)
  const raw = fs.readFileSync(envPath, "utf8")

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue

    const separatorIndex = trimmed.indexOf("=")
    if (separatorIndex <= 0) continue

    const key = trimmed.slice(0, separatorIndex).trim()
    const value = stripMatchingQuotes(trimmed.slice(separatorIndex + 1).trim())
    process.env[key] = value
  }
}

function moveIfPresent(filePath, tempPath) {
  if (!fs.existsSync(filePath)) return false
  fs.renameSync(filePath, tempPath)
  return true
}

function restoreBackup(filePath, tempPath) {
  if (!fs.existsSync(tempPath)) return
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }
  fs.renameSync(tempPath, filePath)
}

const envFile = process.argv[2]

if (!envFile) {
  console.error("Usage: node scripts/build-with-env.cjs <env-file>")
  process.exit(1)
}

loadEnvFile(envFile)
process.env.NODE_ENV = "production"

const nextBin = require.resolve("next/dist/bin/next")
const localEnvPath = path.resolve(process.cwd(), ".env.local")
const localEnvBackupPath = path.resolve(process.cwd(), ".env.local.build-backup")

if (!fs.existsSync(localEnvPath) && fs.existsSync(localEnvBackupPath)) {
  restoreBackup(localEnvPath, localEnvBackupPath)
}

const movedLocalEnv = moveIfPresent(localEnvPath, localEnvBackupPath)
let exitCode = 1

try {
  const result = spawnSync(process.execPath, [nextBin, "build"], {
    stdio: "inherit",
    env: process.env,
  })

  if (result.error) {
    throw result.error
  }

  exitCode = result.status ?? 1
} finally {
  if (movedLocalEnv || (!fs.existsSync(localEnvPath) && fs.existsSync(localEnvBackupPath))) {
    restoreBackup(localEnvPath, localEnvBackupPath)
  }
}

process.exit(exitCode)
