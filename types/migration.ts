// Type definitions for the migration system
export interface MailboxRow {
  SourceEmail: string;
  TargetEmail: string;
  DisplayName: string;
}

export interface ValidationResult {
  SourceEmail: string;
  TargetEmail: string;
  DisplayName: string;
  SourceExists: boolean;
  TargetExists: boolean;
  SourceSize: number;
  ValidationStatus: 'Passed' | 'Warning' | 'Failed';
  ValidationMessages: string[];
  ValidationIssues: string[]; // Added for tracking specific issues
}

export interface MigrationResult {
  SourceEmail: string;
  TargetEmail: string;
  DisplayName: string;
  StartTime: string;
  EndTime: string | null;
  Duration: string | null;
  Status: 'In Progress' | 'Completed' | 'Failed';
  ItemsMigrated: number;
  DataMigrated: string;
  ErrorMessage: string;
}

export interface MigrationStats {
  Total: number;
  Successful: number;
  Failed: number;
  Skipped: number;
  InProgress: number;
}

export interface MigrationConfig {
  BatchSize: number;
  ValidateOnly: boolean;
  SkipValidation: boolean;
  ReportPath: string;
}

export interface LogEntry {
  timestamp: string;
  level: 'Info' | 'Success' | 'Warning' | 'Error' | 'Progress';
  message: string;
  mailboxId?: string;
}

export interface MigrationSession {
  id: string;
  config: MigrationConfig;
  mailboxList: MailboxRow[];
  validationResults?: ValidationResult[];
  migrationResults: MigrationResult[];
  stats: MigrationStats;
  logs: LogEntry[];
  status: 'idle' | 'validating' | 'ready' | 'migrating' | 'completed' | 'error';
  startTime?: string;
  endTime?: string;
}