'use client'

import { useState, useRef } from 'react'
import { Upload, Settings, Play, FileText, Download, CheckCircle, AlertCircle, XCircle, Loader2, Info } from 'lucide-react'
import Papa from 'papaparse'
import type { MailboxRow, MigrationConfig, ValidationResult, MigrationResult, LogEntry, MigrationSession } from '@/types/migration'

export default function MigrationDashboard() {
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [mailboxData, setMailboxData] = useState<MailboxRow[]>([])
  const [config, setConfig] = useState<MigrationConfig>({
    BatchSize: 10,
    ValidateOnly: false,
    SkipValidation: false,
    ReportPath: '.'
  })
  const [session, setSession] = useState<MigrationSession | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isValidating, setIsValidating] = useState(false)
  const [isMigrating, setIsMigrating] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setCsvFile(file)

    Papa.parse(file, {
      header: true,
      complete: (results) => {
        const data = results.data as MailboxRow[]
        const validData = data.filter(row =>
          row.SourceEmail && row.TargetEmail && row.DisplayName
        )
        setMailboxData(validData)
        setLogs(prev => [...prev, {
          timestamp: new Date().toISOString(),
          level: 'Success',
          message: `Loaded ${validData.length} mailboxes from CSV`
        }])
      },
      error: (error) => {
        setLogs(prev => [...prev, {
          timestamp: new Date().toISOString(),
          level: 'Error',
          message: `CSV parsing error: ${error.message}`
        }])
      }
    })
  }

  const startValidation = async () => {
    if (!mailboxData.length) return

    setIsValidating(true)
    setLogs([])

    try {
      const response = await fetch('/api/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mailboxList: mailboxData, config })
      })

      if (!response.ok) throw new Error('Validation failed')

      const validationResults: ValidationResult[] = await response.json()

      const newSession: MigrationSession = {
        id: Date.now().toString(),
        config,
        mailboxList: mailboxData,
        validationResults,
        migrationResults: [],
        stats: {
          Total: mailboxData.length,
          Successful: 0,
          Failed: 0,
          Skipped: 0,
          InProgress: 0
        },
        logs: [],
        status: 'ready'
      }

      setSession(newSession)

      const passed = validationResults.filter(r => r.ValidationStatus === 'Passed').length
      const warnings = validationResults.filter(r => r.ValidationStatus === 'Warning').length
      const failed = validationResults.filter(r => r.ValidationStatus === 'Failed').length

      setLogs(prev => [...prev,
        {
          timestamp: new Date().toISOString(),
          level: 'Success',
          message: `Validation complete: ${passed} passed, ${warnings} warnings, ${failed} failed`
        }
      ])
    } catch (error) {
      setLogs(prev => [...prev, {
        timestamp: new Date().toISOString(),
        level: 'Error',
        message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }])
    } finally {
      setIsValidating(false)
    }
  }

  const startMigration = async () => {
    if (!session) return

    setIsMigrating(true)

    try {
      const response = await fetch('/api/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mailboxList: mailboxData,
          config,
          sessionId: session.id
        })
      })

      if (!response.ok) throw new Error('Migration start failed')

      const { sessionId } = await response.json()

      // Start listening to progress
      const eventSource = new EventSource(`/api/progress?sessionId=${sessionId}`)

      eventSource.addEventListener('log', (e) => {
        const logEntry: LogEntry = JSON.parse(e.data)
        setLogs(prev => [...prev, logEntry])
      })

      eventSource.addEventListener('progress', (e) => {
        const data = JSON.parse(e.data)
        setSession(prev => prev ? {
          ...prev,
          stats: data.stats,
          migrationResults: data.results
        } : null)
      })

      eventSource.addEventListener('complete', (e) => {
        const data = JSON.parse(e.data)
        setSession(prev => prev ? {
          ...prev,
          status: 'completed',
          stats: data.stats,
          migrationResults: data.results
        } : null)
        eventSource.close()
        setIsMigrating(false)
      })

      eventSource.onerror = () => {
        eventSource.close()
        setIsMigrating(false)
      }
    } catch (error) {
      setLogs(prev => [...prev, {
        timestamp: new Date().toISOString(),
        level: 'Error',
        message: `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }])
      setIsMigrating(false)
    }
  }

  const downloadReport = async (format: 'csv' | 'html') => {
    if (!session) return

    try {
      const response = await fetch(`/api/reports?sessionId=${session.id}&format=${format}`)
      if (!response.ok) throw new Error('Report generation failed')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `migration-report-${session.id}.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      setLogs(prev => [...prev, {
        timestamp: new Date().toISOString(),
        level: 'Error',
        message: `Report download failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }])
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Passed': return <CheckCircle className="h-5 w-5 text-success" />
      case 'Warning': return <AlertCircle className="h-5 w-5 text-warning" />
      case 'Failed': return <XCircle className="h-5 w-5 text-error" />
      default: return null
    }
  }

  const getLogClassName = (level: string) => {
    const baseClass = 'log-entry'
    switch (level) {
      case 'Success': return `${baseClass} log-success`
      case 'Warning': return `${baseClass} log-warning`
      case 'Error': return `${baseClass} log-error`
      case 'Progress': return `${baseClass} log-progress`
      default: return `${baseClass} log-info`
    }
  }

  return (
    <div className="space-y-6">
      {/* Introduction/Help Card */}
      <div className="card bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-ms-blue">
        <div className="flex items-start space-x-4">
          <Info className="h-8 w-8 text-ms-blue flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Exchange Mailbox Migration Process</h2>
            <p className="text-gray-700 mb-4">
              Migrate Exchange mailboxes safely with automated validation, batch processing, and comprehensive reporting.
              This tool simulates the migration process with realistic timing and success rates.
            </p>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="bg-ms-blue text-white rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">1</div>
                  <h3 className="font-semibold text-gray-900">Upload CSV</h3>
                </div>
                <p className="text-sm text-gray-600">
                  Prepare a CSV file with three columns: <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">SourceEmail</code>,
                  <code className="bg-gray-100 px-1 py-0.5 rounded text-xs mx-1">TargetEmail</code>,
                  <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">DisplayName</code>
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="bg-ms-blue text-white rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">2</div>
                  <h3 className="font-semibold text-gray-900">Validate</h3>
                </div>
                <p className="text-sm text-gray-600">
                  Check for valid email formats, duplicate addresses, and potential migration issues before starting
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="bg-ms-blue text-white rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">3</div>
                  <h3 className="font-semibold text-gray-900">Migrate & Monitor</h3>
                </div>
                <p className="text-sm text-gray-600">
                  Track real-time progress with live logs and download detailed CSV/HTML reports when complete
                </p>
              </div>
            </div>
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> This is a simulation tool. No actual mailbox migrations are performed.
                For production use, integrate with PowerShell Exchange cmdlets.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Step 1: CSV Upload */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Upload className="h-6 w-6 text-ms-blue mr-2" />
            <h2 className="text-xl font-semibold">Step 1: Upload CSV File</h2>
          </div>
          {mailboxData.length > 0 && (
            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
              ✓ {mailboxData.length} mailboxes loaded
            </span>
          )}
        </div>

        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-ms-blue transition-colors">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="hidden"
          />

          {csvFile ? (
            <div className="space-y-3">
              <CheckCircle className="h-16 w-16 text-success mx-auto" />
              <p className="text-xl font-semibold text-gray-900">{csvFile.name}</p>
              <p className="text-gray-600">{mailboxData.length} mailboxes ready to migrate</p>
              <div className="pt-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-secondary"
                >
                  Choose Different File
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <FileText className="h-16 w-16 text-gray-400 mx-auto" />
              <div>
                <p className="text-xl font-semibold text-gray-900 mb-2">
                  Upload Your Mailbox CSV File
                </p>
                <p className="text-gray-600 max-w-2xl mx-auto mb-1">
                  Your CSV must contain three columns: <code className="font-mono bg-gray-100 px-2 py-1 rounded text-sm">SourceEmail</code>,
                  <code className="font-mono bg-gray-100 px-2 py-1 rounded text-sm mx-1">TargetEmail</code>, and
                  <code className="font-mono bg-gray-100 px-2 py-1 rounded text-sm">DisplayName</code>
                </p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn-primary text-lg px-8 py-3"
              >
                <Upload className="h-5 w-5 inline mr-2" />
                Choose CSV File
              </button>
              <p className="text-sm text-gray-500">
                Sample file available: <code className="font-mono bg-gray-100 px-2 py-0.5 rounded">sample-mailboxes.csv</code> in project root
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Step 2: Configuration */}
      {mailboxData.length > 0 && (
        <div className="card">
          <div className="flex items-center mb-4">
            <Settings className="h-6 w-6 text-ms-blue mr-2" />
            <h2 className="text-xl font-semibold">Step 2: Configure Migration Settings</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Batch Size (1-50)
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={config.BatchSize}
                onChange={(e) => setConfig({ ...config, BatchSize: parseInt(e.target.value) || 10 })}
                className="input-field"
              />
              <p className="text-xs text-gray-500 mt-1">Number of mailboxes to process simultaneously</p>
            </div>

            <div className="flex items-start space-x-2">
              <input
                type="checkbox"
                id="validateOnly"
                checked={config.ValidateOnly}
                onChange={(e) => setConfig({ ...config, ValidateOnly: e.target.checked })}
                className="mt-1 h-4 w-4 text-ms-blue focus:ring-ms-blue border-gray-300 rounded"
              />
              <div>
                <label htmlFor="validateOnly" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Validate Only (No Migration)
                </label>
                <p className="text-xs text-gray-500">Perform validation checks without migrating</p>
              </div>
            </div>

            <div className="flex items-start space-x-2">
              <input
                type="checkbox"
                id="skipValidation"
                checked={config.SkipValidation}
                onChange={(e) => setConfig({ ...config, SkipValidation: e.target.checked })}
                className="mt-1 h-4 w-4 text-ms-blue focus:ring-ms-blue border-gray-300 rounded"
              />
              <div>
                <label htmlFor="skipValidation" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Skip Validation (Not Recommended)
                </label>
                <p className="text-xs text-gray-500">Start migration without validation checks</p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex gap-4">
            <button
              onClick={startValidation}
              disabled={isValidating || isMigrating}
              className="btn-primary"
            >
              {isValidating ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                  Validating...
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5 inline mr-2" />
                  Validate Mailboxes
                </>
              )}
            </button>

            {session && session.validationResults && session.validationResults.length > 0 && (
              <button
                onClick={startMigration}
                disabled={isMigrating || (session.validationResults.some(r => r.ValidationStatus === 'Failed') || false)}
                className="btn-primary bg-green-600 hover:bg-green-700"
              >
                {isMigrating ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                    Migration in Progress...
                  </>
                ) : (
                  <>
                    <Play className="h-5 w-5 inline mr-2" />
                    Start Migration
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Validation Results */}
      {session && session.validationResults && session.validationResults.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Validation Results</h2>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-2xl font-bold text-success">
                {session.validationResults.filter(r => r.ValidationStatus === 'Passed').length}
              </p>
              <p className="text-sm text-gray-600">Passed</p>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <p className="text-2xl font-bold text-warning">
                {session.validationResults.filter(r => r.ValidationStatus === 'Warning').length}
              </p>
              <p className="text-sm text-gray-600">Warnings</p>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <p className="text-2xl font-bold text-error">
                {session.validationResults.filter(r => r.ValidationStatus === 'Failed').length}
              </p>
              <p className="text-sm text-gray-600">Failed</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Display Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Target</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Issues</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {session.validationResults.map((result, index) => (
                  <tr key={index}>
                    <td className="px-4 py-3">
                      <div className="flex items-center">
                        {getStatusIcon(result.ValidationStatus)}
                        <span className="ml-2 text-sm">{result.ValidationStatus}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{result.DisplayName}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{result.SourceEmail}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{result.TargetEmail}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {result.ValidationIssues.length > 0 ? result.ValidationIssues.join(', ') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Migration Progress */}
      {isMigrating && session && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Migration Progress</h2>

          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-2xl font-bold text-ms-blue">{session.stats.Total}</p>
              <p className="text-sm text-gray-600">Total</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-2xl font-bold text-success">{session.stats.Successful}</p>
              <p className="text-sm text-gray-600">Successful</p>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <p className="text-2xl font-bold text-error">{session.stats.Failed}</p>
              <p className="text-sm text-gray-600">Failed</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="text-2xl font-bold text-purple-600">{session.stats.InProgress}</p>
              <p className="text-sm text-gray-600">In Progress</p>
            </div>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-ms-blue h-3 rounded-full transition-all duration-300"
              style={{
                width: `${((session.stats.Successful + session.stats.Failed) / session.stats.Total) * 100}%`
              }}
            />
          </div>
        </div>
      )}

      {/* Live Logs */}
      {logs.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Live Activity Log</h2>
            <button
              onClick={() => setLogs([])}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Clear Logs
            </button>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto space-y-1">
            {logs.map((log, index) => (
              <div key={index} className={getLogClassName(log.level)}>
                <span className="text-gray-500 text-xs">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                {' - '}
                <span>{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reports */}
      {session && session.status === 'completed' && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Download Reports</h2>

          <div className="flex gap-4">
            <button
              onClick={() => downloadReport('csv')}
              className="btn-primary"
            >
              <Download className="h-5 w-5 inline mr-2" />
              Download CSV Report
            </button>

            <button
              onClick={() => downloadReport('html')}
              className="btn-secondary"
            >
              <Download className="h-5 w-5 inline mr-2" />
              Download HTML Report
            </button>
          </div>
        </div>
      )}
    </div>
  )
}