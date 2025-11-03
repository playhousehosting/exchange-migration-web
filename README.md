# Exchange Migration Web App

An interactive Next.js 15 web application that converts the PowerShell Exchange mailbox migration automation script into a modern web interface. This app provides all the functionality of the original script with real-time progress monitoring, interactive validation, and comprehensive reporting.

## 🚀 Features

### Core Migration Capabilities
- **CSV Upload**: Drag-and-drop or file picker for mailbox lists
- **Pre-Migration Validation**: Test mailbox existence, sizes, and prerequisites
- **Batch Processing**: Configurable batch sizes (1-50 mailboxes)
- **Real-Time Progress**: Live SSE updates during migration
- **Error Handling**: Automatic retry logic and detailed error reporting
- **Comprehensive Reports**: Export CSV and HTML reports with same styling as PowerShell script

### Web Interface Benefits
- **Modern UI**: Tailwind CSS with Microsoft design language
- **Live Monitoring**: Real-time log streaming and progress bars
- **Interactive Validation**: Visual validation results with status indicators
- **Responsive Design**: Works on desktop, tablet, and mobile
- **No PowerShell Required**: Runs entirely in the browser (simulation mode)

## 📋 CSV Format Requirements

Your CSV file must contain these columns:
```csv
SourceEmail,TargetEmail,DisplayName
john.doe@oldcompany.com,john.doe@newcompany.com,John Doe
jane.smith@oldcompany.com,jane.smith@newcompany.com,Jane Smith
```

## 🛠️ Setup Instructions (Windows)

### Prerequisites
- **Node.js 18+**: [Download from nodejs.org](https://nodejs.org/)
- **PowerShell 7+**: For development commands (already included in Windows 11)

### Quick Start

```powershell
# Navigate to project directory
cd exchange-migration-web

# Install dependencies
npm install

# Start development server
npm run dev
```

Then open your browser to: **http://localhost:3000**

### Production Build

```powershell
# Build for production
npm run build

# Start production server
npm start
```

## 📖 Usage Guide

### Step 1: Upload CSV File
1. Click "Choose File" or drag-and-drop your CSV file
2. Preview shows first 5 rows to verify format
3. Total mailbox count displayed
4. Use `sample-mailboxes.csv` for testing

### Step 2: Configure Settings
- **Batch Size**: Number of mailboxes to process simultaneously (1-50)
- **Validate Only**: Run validation without starting migration
- **Skip Validation**: Bypass pre-migration checks (not recommended)

### Step 3: Validation (Recommended)
1. Click "Validate" to check mailbox prerequisites
2. Review validation results:
   - ✅ **Passed**: Ready for migration
   - ⚠️ **Warning**: Can proceed with caution (e.g., large mailboxes)
   - ❌ **Failed**: Must resolve before migration (e.g., source not found)

### Step 4: Start Migration
1. Click "Start Migration" (disabled if validation failures exist)
2. Monitor real-time progress and logs
3. View live statistics: Total, Successful, Failed, In Progress

### Step 5: Download Reports
After completion, download comprehensive reports:
- **CSV Report**: Detailed migration results for analysis
- **HTML Report**: Formatted report with statistics and styling

## 🔧 Development

### Project Structure
```
exchange-migration-web/
├── app/
│   ├── api/
│   │   ├── validate/route.ts     # Mailbox validation endpoint
│   │   ├── migrate/route.ts      # Migration orchestration
│   │   ├── progress/route.ts     # SSE progress streaming
│   │   └── reports/route.ts      # Report generation & download
│   ├── layout.tsx                # Root layout with header
│   ├── page.tsx                  # Main migration dashboard
│   └── globals.css               # Tailwind styles
├── lib/
│   ├── migration-utils.ts        # Core migration logic & simulation
│   └── exchange-connector.ts     # PowerShell/Exchange integration
├── types/
│   └── migration.ts              # TypeScript type definitions
├── package.json                  # Dependencies & scripts
├── README.md                     # This file
├── EXCHANGE-SETUP.md             # Complete Exchange setup guide
├── QUICKSTART-EXCHANGE.md        # Quick start for Exchange
└── sample-mailboxes.csv          # Test data
```

### Key Technologies
- **Next.js 15**: App Router with React Server Components
- **TypeScript**: Full type safety
- **Tailwind CSS**: Utility-first styling
- **Server-Sent Events**: Real-time progress updates
- **PapaParse**: CSV parsing
- **Lucide React**: Modern icon library

### Development Commands
```powershell
npm run dev          # Start development server (http://localhost:3000)
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # TypeScript validation
```

## 🔄 Exchange Integration

The application supports two modes:

### Simulation Mode (Default)
Safe testing without Exchange:
- No Exchange connection required
- Realistic validation (90% success rate)
- Simulated migration timing (2-8 seconds per mailbox)
- Perfect for demos and training

### Production Mode
Real Exchange PowerShell integration:
- Connects to Exchange Online or On-Premises
- Real mailbox validation via Get-Mailbox
- Actual migrations via New-MoveRequest
- Progress tracking via Get-MoveRequestStatistics

**See [EXCHANGE-SETUP.md](./EXCHANGE-SETUP.md) for complete setup instructions**

## 🚀 Quick Exchange Setup

```powershell
# Install Exchange PowerShell module
Install-Module ExchangeOnlineManagement -Force

# Connect to Exchange Online
Connect-ExchangeOnline -UserPrincipalName admin@yourdomain.com

# Update .env.local
EXCHANGE_MODE=production

# Restart app
npm run dev
```

## 📊 Monitoring & Logs

### Real-Time Features
- **Live Progress Bar**: Updates every second
- **Log Streaming**: Server-Sent Events for instant log delivery
- **Status Indicators**: Color-coded status updates
- **Batch Progress**: Visual indication of current batch
- **Statistics Dashboard**: Live counters for success/failure rates

### Log Levels
- 📋 **Info**: General information
- ✅ **Success**: Successful operations
- ⚠️ **Warning**: Warnings and cautions
- ❌ **Error**: Errors and failures
- ⏳ **Progress**: Migration progress updates

## 🐛 Troubleshooting

### Common Issues

**"Module not found" errors during development:**
```powershell
# Clean install dependencies
rm -rf node_modules package-lock.json
npm install
```

**Port 3000 already in use:**
```powershell
# Use different port
$env:PORT=3001
npm run dev
```

**CSV not uploading:**
- Verify CSV format matches required columns
- Check file size (limit: 10MB)
- Ensure proper encoding (UTF-8)

**Exchange connection issues:**
- See [EXCHANGE-SETUP.md](./EXCHANGE-SETUP.md) troubleshooting section
- Verify PowerShell session with `Get-PSSession`
- Check permissions with `Get-ManagementRoleAssignment`

## 📝 License

MIT License

## 📞 Support

For issues and questions:
- Check the troubleshooting section above
- Review [EXCHANGE-SETUP.md](./EXCHANGE-SETUP.md) for Exchange setup
- See [QUICKSTART-EXCHANGE.md](./QUICKSTART-EXCHANGE.md) for quick reference
- Test with `sample-mailboxes.csv` in simulation mode first

---

**Note**: This web application provides a complete one-stop-shop for Exchange migrations with real PowerShell integration. Start in simulation mode for testing, then switch to production mode when ready.

**Project Repository**: https://github.com/playhousehosting/exchange-migration-web