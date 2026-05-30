import fs from 'fs'
import path from 'path'

const USAGE_FILE = path.join(process.cwd(), 'data', 'usage.json')
const COST_PER_SEARCH = 0.032

interface UsageRecord {
  month: string  // "YYYY-MM"
  searches: number
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

function loadUsage(): UsageRecord {
  try {
    if (!fs.existsSync(USAGE_FILE)) return { month: currentMonth(), searches: 0 }
    const record = JSON.parse(fs.readFileSync(USAGE_FILE, 'utf-8')) as UsageRecord
    if (record.month !== currentMonth()) return { month: currentMonth(), searches: 0 }
    return record
  } catch {
    return { month: currentMonth(), searches: 0 }
  }
}

function saveUsage(record: UsageRecord): void {
  fs.mkdirSync(path.dirname(USAGE_FILE), { recursive: true })
  fs.writeFileSync(USAGE_FILE, JSON.stringify(record, null, 2))
}

export function monthlyBudgetUsd(): number {
  const val = parseFloat(process.env.GOOGLE_MONTHLY_BUDGET_USD ?? '50')
  return isNaN(val) ? 50 : val
}

/** Returns current spend this calendar month in USD. */
export function currentSpendUsd(): number {
  return loadUsage().searches * COST_PER_SEARCH
}

/** Returns remaining budget in USD. */
export function remainingBudgetUsd(): number {
  return monthlyBudgetUsd() - currentSpendUsd()
}

/**
 * Check whether adding `count` more searches would exceed the monthly budget.
 * Throws if it would. Call before each batch of searches.
 */
export function assertBudget(count: number): void {
  const budget = monthlyBudgetUsd()
  const current = loadUsage()
  const projectedCost = (current.searches + count) * COST_PER_SEARCH

  if (projectedCost > budget) {
    const spent = (current.searches * COST_PER_SEARCH).toFixed(2)
    const limit = budget.toFixed(2)
    throw new Error(
      `Google API monthly budget of $${limit} would be exceeded ` +
      `(spent so far this month: $${spent}). ` +
      `Raise GOOGLE_MONTHLY_BUDGET_USD in .env.local or wait until next month.`
    )
  }
}

/** Record that `count` searches were made. Call after successful API calls. */
export function recordSearches(count: number): void {
  const record = loadUsage()
  record.searches += count
  saveUsage(record)
}
