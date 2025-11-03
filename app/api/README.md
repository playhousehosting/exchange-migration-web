# Exchange Migration Web App - API Routes

This directory contains the Next.js API routes for the migration application.

## Required API Routes

The following API routes need to be implemented:

### 1. `/api/validate/route.ts`
- **Purpose**: Validate mailbox list before migration
- **Method**: POST
- **Input**: `{ mailboxList: MailboxRow[], config: MigrationConfig }`
- **Output**: `ValidationResult[]`
- **Logic**: Calls `validateMailbox()` from `lib/migration-utils.ts` for each mailbox

### 2. `/api/migrate/route.ts`
- **Purpose**: Start migration process
- **Method**: POST  
- **Input**: `{ mailboxList: MailboxRow[], config: MigrationConfig, sessionId: string }`
- **Output**: `{ sessionId: string }`
- **Logic**: 
  - Creates migration session
  - Processes mailboxes in batches
  - Calls `simulateMigration()` from `lib/migration-utils.ts`
  - Stores results in session

### 3. `/api/progress/route.ts`
- **Purpose**: Stream real-time progress via Server-Sent Events (SSE)
- **Method**: GET
- **Query**: `?sessionId=string`
- **Output**: SSE stream with events:
  - `log`: Individual log entries
  - `progress`: Updated stats and results
  - `complete`: Final results

### 4. `/api/reports/route.ts`
- **Purpose**: Generate and download CSV/HTML reports
- **Method**: GET
- **Query**: `?sessionId=string&format=csv|html`
- **Output**: File download (CSV or HTML)
- **Logic**: 
  - Retrieves session results
  - Generates report using `generateReportHTML()` from `lib/migration-utils.ts`
  - Returns as downloadable file

## Implementation Notes

- All routes use Next.js 15 App Router format (`route.ts`)
- Sessions stored in-memory (use Redis for production)
- SSE implementation uses `ReadableStream` for progress updates
- CSV generation uses `csv-stringify` package
- HTML reports use inline CSS for email-safe rendering

## Example Implementation

See the existing codebase implementation or refer to the project documentation for complete API route examples.

## Development

Create these files in `app/api/` with the structure:
```
app/
  api/
    validate/
      route.ts
    migrate/
      route.ts
    progress/
      route.ts
    reports/
      route.ts
```

Each file exports `POST` or `GET` functions as Next.js API route handlers.