import { exec } from 'child_process';
import { promisify } from 'util';
import type { MailboxRow, ValidationResult, MigrationResult } from '@/types/migration';

const execAsync = promisify(exec);

export interface ExchangeConfig {
  connectionUri?: string;
  useBasicAuth?: boolean;
  credentialPath?: string;
  useMockData?: boolean; // Toggle between real Exchange and simulation
}

/**
 * Exchange PowerShell Connector
 * Executes PowerShell commands to interact with Exchange Server/Online
 */
export class ExchangeConnector {
  private config: ExchangeConfig;
  private isConnected = false;

  constructor(config: ExchangeConfig = { useMockData: true }) {
    this.config = config;
  }

  /**
   * Test Exchange connection
   */
  async testConnection(): Promise<{ success: boolean; message: string; version?: string }> {
    if (this.config.useMockData) {
      return {
        success: true,
        message: 'Using mock data (simulation mode)',
        version: 'Simulation v1.0'
      };
    }

    try {
      const script = `
        $session = Get-PSSession | Where-Object { $_.ConfigurationName -eq 'Microsoft.Exchange' }
        if ($session) {
          $version = (Get-Command Get-Mailbox).Version
          Write-Output "Connected|$version"
        } else {
          Write-Output "Not connected"
        }
      `;

      const { stdout } = await this.executePowerShell(script);

      if (stdout.includes('Connected')) {
        const version = stdout.split('|')[1]?.trim();
        this.isConnected = true;
        return {
          success: true,
          message: 'Connected to Exchange',
          version
        };
      }

      return {
        success: false,
        message: 'No active Exchange session found. Please run Connect-ExchangeOnline first.'
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Connect to Exchange Online
   */
  async connectExchangeOnline(userPrincipalName?: string): Promise<void> {
    if (this.config.useMockData) {
      this.isConnected = true;
      return;
    }

    const script = userPrincipalName
      ? `Connect-ExchangeOnline -UserPrincipalName ${userPrincipalName} -ShowProgress $false`
      : `Connect-ExchangeOnline -ShowProgress $false`;

    await this.executePowerShell(script);
    this.isConnected = true;
  }

  /**
   * Validate a single mailbox exists and get details
   */
  async validateMailbox(email: string): Promise<{
    exists: boolean;
    size?: number;
    itemCount?: number;
    database?: string;
    error?: string;
  }> {
    if (this.config.useMockData) {
      // Simulation mode
      const hash = email.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
      const exists = hash % 10 !== 0; // 90% exist

      return exists ? {
        exists: true,
        size: Math.random() * 5000 + 100, // MB
        itemCount: Math.floor(Math.random() * 50000) + 1000,
        database: 'SimulatedDB01'
      } : {
        exists: false,
        error: 'Mailbox not found'
      };
    }

    try {
      const script = `
        $mailbox = Get-Mailbox -Identity "${email}" -ErrorAction Stop
        $stats = Get-MailboxStatistics -Identity "${email}" -ErrorAction Stop

        $sizeInMB = 0
        if ($stats.TotalItemSize) {
          $sizeString = $stats.TotalItemSize.ToString()
          if ($sizeString -match '([\\d,]+)\\s*(bytes|KB|MB|GB)') {
            $value = [double]($matches[1] -replace ',','')
            $unit = $matches[2]
            switch ($unit) {
              'bytes' { $sizeInMB = $value / 1MB }
              'KB' { $sizeInMB = $value / 1024 }
              'MB' { $sizeInMB = $value }
              'GB' { $sizeInMB = $value * 1024 }
            }
          }
        }

        $result = @{
          Exists = $true
          Size = [math]::Round($sizeInMB, 2)
          ItemCount = $stats.ItemCount
          Database = $mailbox.Database
        }
        $result | ConvertTo-Json
      `;

      const { stdout } = await this.executePowerShell(script);
      const result = JSON.parse(stdout);

      return {
        exists: result.Exists,
        size: result.Size,
        itemCount: result.ItemCount,
        database: result.Database
      };
    } catch (error) {
      return {
        exists: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Create migration batch
   */
  async createMigrationBatch(
    batchName: string,
    mailboxes: MailboxRow[],
    targetDeliveryDomain: string
  ): Promise<{ success: boolean; batchId?: string; error?: string }> {
    if (this.config.useMockData) {
      return {
        success: true,
        batchId: `Batch-${Date.now()}`
      };
    }

    try {
      // Create CSV for batch
      const csvContent = mailboxes.map(m =>
        `"${m.SourceEmail}","${m.TargetEmail}","${m.DisplayName}"`
      ).join('\n');

      const csvPath = `C:\\Temp\\migration-${batchName}.csv`;

      const script = `
        # Create CSV file
        @"
EmailAddress,TargetAddress,DisplayName
${csvContent}
"@ | Out-File -FilePath "${csvPath}" -Encoding UTF8

        # Create migration batch
        $batch = New-MigrationBatch -Name "${batchName}" \`
          -CSVData ([System.IO.File]::ReadAllBytes("${csvPath}")) \`
          -TargetDeliveryDomain "${targetDeliveryDomain}" \`
          -AutoStart

        @{
          Success = $true
          BatchId = $batch.Identity
        } | ConvertTo-Json
      `;

      const { stdout } = await this.executePowerShell(script);
      const result = JSON.parse(stdout);

      return {
        success: result.Success,
        batchId: result.BatchId
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Start mailbox migration using New-MoveRequest
   */
  async startMigration(
    sourceEmail: string,
    targetEmail: string,
    targetDatabase?: string
  ): Promise<{ success: boolean; moveRequestId?: string; error?: string }> {
    if (this.config.useMockData) {
      // Simulate migration delay and success/failure
      await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 6000));

      const success = Math.random() > 0.05; // 95% success rate

      return success ? {
        success: true,
        moveRequestId: `Move-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      } : {
        success: false,
        error: 'Simulated migration failure - mailbox locked'
      };
    }

    try {
      const script = targetDatabase
        ? `
          $moveRequest = New-MoveRequest -Identity "${sourceEmail}" \`
            -TargetDatabase "${targetDatabase}" \`
            -BadItemLimit 50 \`
            -AcceptLargeDataLoss \`
            -SuspendWhenReadyToComplete

          @{
            Success = $true
            MoveRequestId = $moveRequest.Identity
          } | ConvertTo-Json
        `
        : `
          $moveRequest = New-MoveRequest -Identity "${sourceEmail}" \`
            -Remote \`
            -RemoteHostName "${targetEmail.split('@')[1]}" \`
            -TargetDeliveryDomain "${targetEmail.split('@')[1]}" \`
            -BadItemLimit 50 \`
            -AcceptLargeDataLoss

          @{
            Success = $true
            MoveRequestId = $moveRequest.Identity
          } | ConvertTo-Json
        `;

      const { stdout } = await this.executePowerShell(script);
      const result = JSON.parse(stdout);

      return {
        success: result.Success,
        moveRequestId: result.MoveRequestId
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get migration progress
   */
  async getMigrationStatus(moveRequestId: string): Promise<{
    status: string;
    percentComplete: number;
    bytesTransferred?: number;
    error?: string;
  }> {
    if (this.config.useMockData) {
      return {
        status: 'Completed',
        percentComplete: 100,
        bytesTransferred: Math.random() * 5000 * 1024 * 1024 // bytes
      };
    }

    try {
      const script = `
        $stats = Get-MoveRequestStatistics -Identity "${moveRequestId}"

        @{
          Status = $stats.Status
          PercentComplete = $stats.PercentComplete
          BytesTransferred = $stats.BytesTransferred.ToBytes()
        } | ConvertTo-Json
      `;

      const { stdout } = await this.executePowerShell(script);
      const result = JSON.parse(stdout);

      return {
        status: result.Status,
        percentComplete: result.PercentComplete,
        bytesTransferred: result.BytesTransferred
      };
    } catch (error) {
      return {
        status: 'Failed',
        percentComplete: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Execute PowerShell script
   */
  private async executePowerShell(script: string): Promise<{ stdout: string; stderr: string }> {
    const command = `powershell.exe -NoProfile -NonInteractive -Command "${script.replace(/"/g, '\\"')}"`;

    try {
      const result = await execAsync(command, {
        timeout: 60000, // 60 second timeout
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });

      return result;
    } catch (error: any) {
      throw new Error(`PowerShell execution failed: ${error.message}`);
    }
  }

  /**
   * Disconnect from Exchange
   */
  async disconnect(): Promise<void> {
    if (this.config.useMockData) {
      this.isConnected = false;
      return;
    }

    try {
      await this.executePowerShell('Disconnect-ExchangeOnline -Confirm:$false');
      this.isConnected = false;
    } catch (error) {
      // Ignore disconnect errors
    }
  }
}

// Singleton instance
let exchangeConnectorInstance: ExchangeConnector | null = null;

export function getExchangeConnector(config?: ExchangeConfig): ExchangeConnector {
  if (!exchangeConnectorInstance) {
    exchangeConnectorInstance = new ExchangeConnector(config);
  }
  return exchangeConnectorInstance;
}