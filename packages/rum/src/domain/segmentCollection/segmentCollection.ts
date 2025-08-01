import type { DeflateEncoder, HttpRequest, TimeoutId } from '@datadog/browser-core'
import { isPageExitReason, ONE_SECOND, clearTimeout, setTimeout } from '@datadog/browser-core'
import type { LifeCycle, ViewHistory, RumSessionManager, RumConfiguration } from '@datadog/browser-rum-core'
import { LifeCycleEventType } from '@datadog/browser-rum-core'
import type { BrowserRecord, CreationReason, SegmentContext } from '../../types'
import type { SerializationStats } from '../record'
import type { ReplayPayload } from './buildReplayPayload'
import { buildReplayPayload } from './buildReplayPayload'
import type { FlushReason, Segment } from './segment'
import { createSegment } from './segment'

export const SEGMENT_DURATION_LIMIT = 5 * ONE_SECOND
/**
 * beacon payload max queue size implementation is 64kb
 * ensure that we leave room for logs, rum and potential other users
 */
export let SEGMENT_BYTES_LIMIT = 60_000

// Segments are the main data structure for session replays. They contain context information used
// for indexing or UI needs, and a list of records (RRWeb 'events', renamed to avoid confusing
// namings). They are stored without any processing from the intake, and fetched one after the
// other while a session is being replayed. Their encoding (deflate) are carefully crafted to allow
// concatenating multiple segments together. Segments have a size overhead (metadata), so our goal is to
// build segments containing as many records as possible while complying with the various flush
// strategies to guarantee a good replay quality.
//
// When the recording starts, a segment is initially created.  The segment is flushed (finalized and
// sent) based on various events (non-exhaustive list):
//
// * the page visibility change or becomes to unload
// * the segment duration reaches a limit
// * the encoded segment bytes count reaches a limit
// * ...
//
// A segment cannot be created without its context.  If the RUM session ends and no session id is
// available when creating a new segment, records will be ignored, until the session is renewed and
// a new session id is available.
//
// Empty segments (segments with no record) aren't useful and should be ignored.
//
// To help investigate session replays issues, each segment is created with a "creation reason",
// indicating why the session has been created.

interface SegmentCollector {
  addRecord(this: void, record: BrowserRecord, stats?: SerializationStats): void
  stop(this: void): void
}

export function startSegmentCollection(
  lifeCycle: LifeCycle,
  configuration: RumConfiguration,
  sessionManager: RumSessionManager,
  viewHistory: ViewHistory,
  httpRequest: HttpRequest<ReplayPayload>,
  encoder: DeflateEncoder
): SegmentCollector {
  return doStartSegmentCollection(
    lifeCycle,
    () => computeSegmentContext(configuration.applicationId, sessionManager, viewHistory),
    httpRequest,
    encoder
  )
}

const enum SegmentCollectionStatus {
  WaitingForInitialRecord,
  SegmentPending,
  Stopped,
}
type SegmentCollectionState =
  | {
      status: SegmentCollectionStatus.WaitingForInitialRecord
      nextSegmentCreationReason: CreationReason
    }
  | {
      status: SegmentCollectionStatus.SegmentPending
      segment: Segment
      expirationTimeoutId: TimeoutId
    }
  | {
      status: SegmentCollectionStatus.Stopped
    }

export function doStartSegmentCollection(
  lifeCycle: LifeCycle,
  getSegmentContext: () => SegmentContext | undefined,
  httpRequest: HttpRequest<ReplayPayload>,
  encoder: DeflateEncoder
): SegmentCollector {
  let state: SegmentCollectionState = {
    status: SegmentCollectionStatus.WaitingForInitialRecord,
    nextSegmentCreationReason: 'init',
  }

  const { unsubscribe: unsubscribeViewCreated } = lifeCycle.subscribe(LifeCycleEventType.VIEW_CREATED, () => {
    flushSegment('view_change')
  })

  const { unsubscribe: unsubscribePageMayExit } = lifeCycle.subscribe(
    LifeCycleEventType.PAGE_MAY_EXIT,
    (pageMayExitEvent) => {
      flushSegment(pageMayExitEvent.reason as FlushReason)
    }
  )

  function flushSegment(flushReason: FlushReason) {
    if (state.status === SegmentCollectionStatus.SegmentPending) {
      state.segment.flush((metadata, stats, encoderResult) => {
        const payload = buildReplayPayload(encoderResult.output, metadata, stats, encoderResult.rawBytesCount)

        if (isPageExitReason(flushReason)) {
          httpRequest.sendOnExit(payload)
        } else {
          httpRequest.send(payload)
        }
      })
      clearTimeout(state.expirationTimeoutId)
    }

    if (flushReason !== 'stop') {
      state = {
        status: SegmentCollectionStatus.WaitingForInitialRecord,
        nextSegmentCreationReason: flushReason,
      }
    } else {
      state = {
        status: SegmentCollectionStatus.Stopped,
      }
    }
  }

  return {
    addRecord: (record: BrowserRecord, stats?: SerializationStats) => {
      if (state.status === SegmentCollectionStatus.Stopped) {
        return
      }

      if (state.status === SegmentCollectionStatus.WaitingForInitialRecord) {
        const context = getSegmentContext()
        if (!context) {
          return
        }

        state = {
          status: SegmentCollectionStatus.SegmentPending,
          segment: createSegment({ encoder, context, creationReason: state.nextSegmentCreationReason }),
          expirationTimeoutId: setTimeout(() => {
            flushSegment('segment_duration_limit')
          }, SEGMENT_DURATION_LIMIT),
        }
      }

      state.segment.addRecord(record, stats, (encodedBytesCount) => {
        if (encodedBytesCount > SEGMENT_BYTES_LIMIT) {
          flushSegment('segment_bytes_limit')
        }
      })
    },

    stop: () => {
      flushSegment('stop')
      unsubscribeViewCreated()
      unsubscribePageMayExit()
    },
  }
}

export function computeSegmentContext(
  applicationId: string,
  sessionManager: RumSessionManager,
  viewHistory: ViewHistory
) {
  const session = sessionManager.findTrackedSession()
  const viewContext = viewHistory.findView()
  if (!session || !viewContext) {
    return undefined
  }
  return {
    application: {
      id: applicationId,
    },
    session: {
      id: session.id,
    },
    view: {
      id: viewContext.id,
    },
  }
}

export function setSegmentBytesLimit(newSegmentBytesLimit = 60_000) {
  SEGMENT_BYTES_LIMIT = newSegmentBytesLimit
}
