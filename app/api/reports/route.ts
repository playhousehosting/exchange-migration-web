import { NextRequest, NextResponse } from 'next/server'
import { stringify } from 'csv-stringify/sync'
import { getSession } from '../migrate/route'
import { generateReportHTML, calculateStats } from '@/lib/migration-utils'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')
  const format = searchParams.get('format') || 'csv'

  if (!sessionId) {
    return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
  }

  const session = getSession(sessionId)
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  const stats = calculateStats(session.migrationResults)

  try {
    if (format === 'csv') {
      // Generate CSV report
      const csvData = session.migrationResults.map(result => ({
        'Display Name': result.DisplayName,
        'Source Email': result.SourceEmail,
        'Target Email': result.TargetEmail,
        'Status': result.Status,
        'Start Time': result.StartTime,
        'End Time': result.EndTime || 'N/A',
        'Duration': result.Duration || 'N/A',
        'Items Migrated': result.ItemsMigrated,
        'Data Migrated': result.DataMigrated,
        'Error Message': result.ErrorMessage || ''
      }))

      const csv = stringify(csvData, {
        header: true,
        columns: [
          'Display Name',
          'Source Email',
          'Target Email',
          'Status',
          'Start Time',
          'End Time',
          'Duration',
          'Items Migrated',
          'Data Migrated',
          'Error Message'
        ]
      })

      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="Migration_Report_${new Date().toISOString().split('T')[0]}.csv"`
        }
      })

    } else if (format === 'html') {
      // Generate HTML report
      const html = generateReportHTML(session.migrationResults, stats, session.validationResults)

      return new Response(html, {
        headers: {
          'Content-Type': 'text/html',
          'Content-Disposition': `attachment; filename="Migration_Report_${new Date().toISOString().split('T')[0]}.html"`
        }
      })

    } else {
      return NextResponse.json({ error: 'Invalid format. Use csv or html' }, { status: 400 })
    }

  } catch (error) {
    console.error('Report generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    )
  }
}