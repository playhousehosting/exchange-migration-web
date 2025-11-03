import { NextRequest } from 'next/server'
import { getSession, getSessionLogger } from '../migrate/route'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')

  if (!sessionId) {
    return new Response('Missing sessionId', { status: 400 })
  }

  // Set up Server-Sent Events
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()

      // Function to send SSE data
      const sendEvent = (data: any, event?: string) => {
        const eventData = event ? `event: ${event}\n` : ''
        const message = `${eventData}data: ${JSON.stringify(data)}\n\n`
        controller.enqueue(encoder.encode(message))
      }

      // Send initial connection message
      sendEvent({ type: 'connected', message: 'Progress stream connected' })

      // Set up interval to check progress
      const interval = setInterval(() => {
        const session = getSession(sessionId)
        const logger = getSessionLogger(sessionId)

        if (!session || !logger) {
          sendEvent({ type: 'error', message: 'Session not found' })
          clearInterval(interval)
          controller.close()
          return
        }

        // Send latest logs
        const logs = logger.getLogs()
        if (logs.length > 0) {
          const latestLog = logs[logs.length - 1]
          sendEvent({ type: 'log', log: latestLog })
        }

        // Send progress update
        sendEvent({
          type: 'progress',
          session: {
            stats: session.stats,
            status: session.status,
            migrationResults: session.migrationResults
          }
        })

        // Check if migration is complete
        if (session.status === 'completed' || session.status === 'error') {
          sendEvent({
            type: 'complete',
            session: {
              ...session,
              logs: logs
            }
          })
          clearInterval(interval)
          controller.close()
        }
      }, 1000) // Update every second

      // Clean up on client disconnect
      request.signal?.addEventListener('abort', () => {
        clearInterval(interval)
        controller.close()
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Cache-Control'
    }
  })
}