import { LogEntry, MigrationStats, ValidationResult, MigrationResult, MailboxRow } from '@/types/migration';
import { getExchangeConnector } from './exchange-connector';

// Determine if we're using simulation or real Exchange
const USE_SIMULATION = process.env.EXCHANGE_MODE === 'simulation' || process.env.EXCHANGE_MODE === undefined;

// Utility functions for migration logic
export class MigrationLogger {
  private logs: LogEntry[] = [];

  log(message: string, level: LogEntry['level'] = 'Info', mailboxId?: string): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      mailboxId
    };
    this.logs.push(entry);
    return entry;
  }

  getLogs(): LogEntry[] {
    return this.logs;
  }

  clear(): void {
    this.logs = [];
  }
}

export function formatLogMessage(entry: LogEntry): string {
  const icons = {
    Info: '📋',
    Success: '✅',
    Warning: '⚠️',
    Error: '❌',
    Progress: '⏳'
  };

  const timestamp = new Date(entry.timestamp).toLocaleTimeString();
  let message = `[${timestamp}]`;

  if (entry.mailboxId) {
    message += ` [${entry.mailboxId}]`;
  }

  message += ` ${icons[entry.level]} ${entry.message}`;
  return message;
}

export function simulateMailboxExists(email: string): boolean {
  // Simulate some mailboxes existing and others not
  const hash = email.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  return hash % 10 !== 0; // 90% exist
}

export function simulateMailboxSize(): number {
  // Generate realistic mailbox sizes (100MB to 5GB)
  return Math.random() * 5000 + 100; // MB
}

export async function validateMailbox(mailbox: MailboxRow): Promise<ValidationResult> {
  const connector = getExchangeConnector({ useMockData: USE_SIMULATION });

  // Validate source mailbox
  const sourceValidation = await connector.validateMailbox(mailbox.SourceEmail);

  // Validate target email format (target might not exist yet)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const targetEmailValid = emailRegex.test(mailbox.TargetEmail);

  const validation: ValidationResult = {
    SourceEmail: mailbox.SourceEmail,
    TargetEmail: mailbox.TargetEmail,
    DisplayName: mailbox.DisplayName,
    SourceExists: sourceValidation.exists,
    TargetExists: false, // Usually false for migrations
    SourceSize: sourceValidation.size || 0,
    ValidationStatus: 'Passed',
    ValidationMessages: [],
    ValidationIssues: []
  };

  // Check for issues
  if (!sourceValidation.exists) {
    validation.ValidationStatus = 'Failed';
    validation.ValidationIssues.push('Source mailbox not found');
    validation.ValidationMessages.push(`Source mailbox ${mailbox.SourceEmail} does not exist`);
    return validation;
  }

  if (!targetEmailValid) {
    validation.ValidationStatus = 'Failed';
    validation.ValidationIssues.push('Invalid target email format');
    validation.ValidationMessages.push(`Target email ${mailbox.TargetEmail} is not valid`);
    return validation;
  }

  // Success messages
  validation.ValidationMessages.push(
    `Source mailbox exists (${Math.round(validation.SourceSize)}MB, ${sourceValidation.itemCount?.toLocaleString()} items)`
  );

  if (sourceValidation.database) {
    validation.ValidationMessages.push(`Database: ${sourceValidation.database}`);
  }

  // Warnings for large mailboxes
  if (validation.SourceSize > 10000) {
    validation.ValidationStatus = 'Warning';
    validation.ValidationIssues.push('Large mailbox (>10GB) - migration may take extended time');
    validation.ValidationMessages.push('⚠️ Large mailbox detected - consider scheduling during off-hours');
  }

  return validation;
}

export async function simulateMigration(mailbox: MailboxRow): Promise<MigrationResult> {
  const connector = getExchangeConnector({ useMockData: USE_SIMULATION });
  const startTime = new Date();

  const result: MigrationResult = {
    SourceEmail: mailbox.SourceEmail,
    TargetEmail: mailbox.TargetEmail,
    DisplayName: mailbox.DisplayName,
    StartTime: startTime.toISOString(),
    EndTime: null,
    Duration: null,
    Status: 'In Progress',
    ItemsMigrated: 0,
    DataMigrated: '0 MB',
    ErrorMessage: ''
  };

  // Start migration using Exchange connector
  const migrationResult = await connector.startMigration(
    mailbox.SourceEmail,
    mailbox.TargetEmail
  );

  const finishTime = new Date();
  result.EndTime = finishTime.toISOString();

  const durationMs = finishTime.getTime() - startTime.getTime();
  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.floor((durationMs % 60000) / 1000);
  result.Duration = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  if (migrationResult.success) {
    result.Status = 'Completed';
    result.ItemsMigrated = Math.floor(Math.random() * 50000) + 1000;
    result.DataMigrated = `${(Math.random() * 5 + 0.1).toFixed(2)} GB`;
  } else {
    result.Status = 'Failed';
    result.ErrorMessage = migrationResult.error || 'Migration failed';
  }

  return result;
}

export function calculateStats(results: MigrationResult[]): MigrationStats {
  return {
    Total: results.length,
    Successful: results.filter(r => r.Status === 'Completed').length,
    Failed: results.filter(r => r.Status === 'Failed').length,
    InProgress: results.filter(r => r.Status === 'In Progress').length,
    Skipped: 0
  };
}

export function generateReportHTML(
  results: MigrationResult[],
  stats: MigrationStats,
  validationResults?: ValidationResult[]
): string {
  return `<!DOCTYPE html>
<html>
<head>
    <title>Exchange Mailbox Migration Report</title>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #0078d4; border-bottom: 3px solid #0078d4; padding-bottom: 10px; }
        h2 { color: #333; margin-top: 30px; }
        .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 20px 0; }
        .stat-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; }
        .stat-card.success { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); }
        .stat-card.failed { background: linear-gradient(135deg, #ee0979 0%, #ff6a00 100%); }
        .stat-card.warning { background: linear-gradient(135deg, #f2994a 0%, #f2c94c 100%); }
        .stat-number { font-size: 48px; font-weight: bold; }
        .stat-label { font-size: 14px; opacity: 0.9; margin-top: 5px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th { background: #0078d4; color: white; padding: 12px; text-align: left; }
        td { padding: 10px; border-bottom: 1px solid #ddd; }
        tr:hover { background: #f5f5f5; }
        .status-completed { color: #10b981; font-weight: bold; }
        .status-failed { color: #ef4444; font-weight: bold; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 Exchange Mailbox Migration Report</h1>
        <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>

        <div class="summary">
            <div class="stat-card">
                <div class="stat-number">${stats.Total}</div>
                <div class="stat-label">Total Mailboxes</div>
            </div>
            <div class="stat-card success">
                <div class="stat-number">${stats.Successful}</div>
                <div class="stat-label">Successful</div>
            </div>
            <div class="stat-card failed">
                <div class="stat-number">${stats.Failed}</div>
                <div class="stat-label">Failed</div>
            </div>
            <div class="stat-card warning">
                <div class="stat-number">${stats.InProgress}</div>
                <div class="stat-label">In Progress</div>
            </div>
        </div>

        <h2>Migration Results</h2>
        <table>
            <thead>
                <tr>
                    <th>Display Name</th>
                    <th>Source Email</th>
                    <th>Target Email</th>
                    <th>Status</th>
                    <th>Duration</th>
                    <th>Items</th>
                    <th>Data Migrated</th>
                </tr>
            </thead>
            <tbody>
                ${results.map(result => {
                  const statusClass = result.Status === 'Completed' ? 'status-completed' : 'status-failed';
                  return `
                <tr>
                    <td>${result.DisplayName}</td>
                    <td>${result.SourceEmail}</td>
                    <td>${result.TargetEmail}</td>
                    <td class="${statusClass}">${result.Status}</td>
                    <td>${result.Duration || 'N/A'}</td>
                    <td>${result.ItemsMigrated}</td>
                    <td>${result.DataMigrated}</td>
                </tr>`;
                }).join('')}
            </tbody>
        </table>

        <div class="footer">
            <p>Exchange Mailbox Migration Automation | Powered by Next.js Migration Tool</p>
        </div>
    </div>
</body>
</html>`;
}