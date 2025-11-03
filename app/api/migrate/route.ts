import { NextRequest, NextResponse } from 'next/server'
import { simulateMigration, MigrationLogger, calculateStats } from '@/lib/migration-utils'
import type { MailboxRow, MigrationConfig, MigrationResult, MigrationSession } from '@/types/migration'

// Store active migration sessions in memory (in production, use Redis or database)
const activeSessions = new Map<string, MigrationSession>()
const sessionLoggers = new Map<string, MigrationLogger>()

export async function POST(request: NextRequest) {
  try {
    const { sessionId, mailboxList, config }: {
      sessionId: string,
      mailboxList: MailboxRow[],
      config: MigrationConfig
    } = await request.json()

    if (!sessionId || !mailboxList || !Array.isArray(mailboxList)) {
      return NextResponse.json({ error: 'Invalid request parameters' }, { status: 400 })
    }

    const logger = new MigrationLogger()
    sessionLoggers.set(sessionId, logger)

    // Initialize session
    const session: MigrationSession = {
      id: sessionId,
      config,
      mailboxList,
      migrationResults: [],
      stats: {
        Total: mailboxList.length,
        Successful: 0,
        Failed: 0,
        Skipped: 0,
        InProgress: 0
      },
      logs: [],
      status: 'migrating',
      startTime: new Date().toISOString()
    }

    activeSessions.set(sessionId, session)

    logger.log(`Starting migration of ${mailboxList.length} mailboxes in batches of ${config.BatchSize}...`, 'Progress')

    // Start the migration process asynchronously
    processMigration(sessionId, mailboxList, config, logger).catch(console.error)

    return NextResponse.json({ success: true, sessionId })
  } catch (error) {
    console.error('Migration start error:', error)
    return NextResponse.json(
      { error: 'Failed to start migration' },
      { status: 500 }
    )
  }
}

async function processMigration(
  sessionId: string,
  mailboxList: MailboxRow[],
  config: MigrationConfig,
  logger: MigrationLogger
) {
  const session = activeSessions.get(sessionId)
  if (!session) return

  const batchSize = config.BatchSize
  const totalMailboxes = mailboxList.length
  let processedCount = 0

  // Process in batches
  for (let i = 0; i < totalMailboxes; i += batchSize) {
    const batch = mailboxList.slice(i, i + batchSize)
    const batchNumber = Math.floor(i / batchSize) + 1

    logger.log(`Processing Batch ${batchNumber} (${batch.length} mailboxes)`, 'Progress')

    // Process batch in parallel
    const batchPromises = batch.map(async (mailbox) => {
      logger.log(`Starting migration: ${mailbox.SourceEmail} → ${mailbox.TargetEmail}`, 'Progress', mailbox.SourceEmail)

      try {
        const result = await simulateMigration(mailbox)

        if (result.Status === 'Completed') {
          logger.log(`Migration completed successfully - Items: ${result.ItemsMigrated}, Data: ${result.DataMigrated}, Duration: ${result.Duration}`, 'Success', mailbox.SourceEmail)
          session.stats.Successful++
        } else {
          logger.log(`Migration failed: ${result.ErrorMessage}`, 'Error', mailbox.SourceEmail)
          session.stats.Failed++
        }

        session.migrationResults.push(result)
        processedCount++

        // Update session progress
        session.stats = calculateStats(session.migrationResults)
        activeSessions.set(sessionId, session)

        return result
      } catch (error) {
        logger.log(`Migration error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'Error', mailbox.SourceEmail)
        session.stats.Failed++

        const failedResult: MigrationResult = {
          SourceEmail: mailbox.SourceEmail,
          TargetEmail: mailbox.TargetEmail,
          DisplayName: mailbox.DisplayName,
          StartTime: new Date().toISOString(),
          EndTime: new Date().toISOString(),
          Duration: '00:00',
          Status: 'Failed',
          ItemsMigrated: 0,
          DataMigrated: '0 MB',
          ErrorMessage: error instanceof Error ? error.message : 'Unknown error'
        }

        session.migrationResults.push(failedResult)
        return failedResult
      }
    })

    await Promise.all(batchPromises)

    logger.log(`Batch ${batchNumber} complete`, 'Progress')

    // Brief pause between batches (except for last batch)
    if (i + batchSize < totalMailboxes) {
      logger.log('Pausing 5 seconds before next batch...', 'Info')
      await new Promise(resolve => setTimeout(resolve, 5000))
    }
  }

  // Migration complete
  session.status = 'completed'
  session.endTime = new Date().toISOString()
  session.logs = logger.getLogs()

  const successRate = Math.round((session.stats.Successful / session.stats.Total) * 100)
  logger.log(`Migration Complete! Total: ${session.stats.Total}, Successful: ${session.stats.Successful}, Failed: ${session.stats.Failed}, Success Rate: ${successRate}%`, 'Success')

  activeSessions.set(sessionId, session)
}

// Get session data (for progress endpoint)
export function getSession(sessionId: string): MigrationSession | undefined {
  return activeSessions.get(sessionId)
}

// Get session logger (for progress endpoint)
export function getSessionLogger(sessionId: string): MigrationLogger | undefined {
  return sessionLoggers.get(sessionId)
}