import { NextRequest, NextResponse } from 'next/server'
import { validateMailbox } from '@/lib/migration-utils'
import type { MailboxRow, ValidationResult, MigrationConfig } from '@/types/migration'

export async function POST(request: NextRequest) {
  try {
    const { mailboxList, config }: { mailboxList: MailboxRow[], config: MigrationConfig } = await request.json()

    if (!mailboxList || !Array.isArray(mailboxList)) {
      return NextResponse.json({ error: 'Invalid mailbox list' }, { status: 400 })
    }

    const validationResults: ValidationResult[] = []

    // Validate each mailbox (with simulated delay for realism)
    for (const mailbox of mailboxList) {
      const result = await validateMailbox(mailbox)
      validationResults.push(result)
    }

    return NextResponse.json(validationResults)
  } catch (error) {
    console.error('Validation error:', error)
    return NextResponse.json(
      { error: 'Validation failed' },
      { status: 500 }
    )
  }
}