import { sendToExtension } from '@datadog/browser-core'
import type { LifeCycle, RumConfiguration, ViewHistory } from '@datadog/browser-rum-core'
import type { BrowserRecord } from '../../types'
import * as replayStats from '../replayStats'
import type { Tracker } from './trackers'
import {
  trackFocus,
  trackFrustration,
  trackInput,
  trackMediaInteraction,
  trackMouseInteraction,
  trackMove,
  trackMutation,
  trackScroll,
  trackStyleSheet,
  trackViewEnd,
  trackViewportResize,
  trackVisualViewportResize,
} from './trackers'
import { createElementsScrollPositions } from './elementsScrollPositions'
import type { ShadowRootsController } from './shadowRootsController'
import { initShadowRootsController } from './shadowRootsController'
import { startFullSnapshots } from './startFullSnapshots'
import { initRecordIds } from './recordIds'
import type { SerializationStats } from './serialization'

export interface RecordOptions {
  emit?: (record: BrowserRecord, stats?: SerializationStats) => void
  configuration: RumConfiguration
  lifeCycle: LifeCycle
  viewHistory: ViewHistory
}

export interface RecordAPI {
  stop: () => void
  flushMutations: () => void
  shadowRootsController: ShadowRootsController
}

export function record(options: RecordOptions): RecordAPI {
  const { emit, configuration, lifeCycle } = options
  // runtime checks for user options
  if (!emit) {
    throw new Error('emit function is required')
  }

  const emitAndComputeStats = (record: BrowserRecord, stats?: SerializationStats) => {
    emit(record, stats)
    sendToExtension('record', { record })
    const view = options.viewHistory.findView()!
    replayStats.addRecord(view.id)
  }

  const elementsScrollPositions = createElementsScrollPositions()

  const shadowRootsController = initShadowRootsController(configuration, emitAndComputeStats, elementsScrollPositions)

  const { stop: stopFullSnapshots } = startFullSnapshots(
    elementsScrollPositions,
    shadowRootsController,
    lifeCycle,
    configuration,
    flushMutations,
    emitAndComputeStats
  )

  function flushMutations() {
    shadowRootsController.flush()
    mutationTracker.flush()
  }

  const recordIds = initRecordIds()
  const mutationTracker = trackMutation(emitAndComputeStats, configuration, shadowRootsController, document)
  const trackers: Tracker[] = [
    mutationTracker,
    trackMove(configuration, emitAndComputeStats),
    trackMouseInteraction(configuration, emitAndComputeStats, recordIds),
    trackScroll(configuration, emitAndComputeStats, elementsScrollPositions, document),
    trackViewportResize(configuration, emitAndComputeStats),
    trackInput(configuration, emitAndComputeStats),
    trackMediaInteraction(configuration, emitAndComputeStats),
    trackStyleSheet(emitAndComputeStats),
    trackFocus(configuration, emitAndComputeStats),
    trackVisualViewportResize(configuration, emitAndComputeStats),
    trackFrustration(lifeCycle, emitAndComputeStats, recordIds),
    trackViewEnd(lifeCycle, (viewEndRecord) => {
      flushMutations()
      emitAndComputeStats(viewEndRecord)
    }),
  ]

  return {
    stop: () => {
      shadowRootsController.stop()
      trackers.forEach((tracker) => tracker.stop())
      stopFullSnapshots()
    },
    flushMutations,
    shadowRootsController,
  }
}
