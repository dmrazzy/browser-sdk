import type { Duration, RelativeTime } from '@datadog/browser-core'
import { clocksOrigin } from '@datadog/browser-core'
import type { Clock } from '@datadog/browser-core/test'
import { mockClock, registerCleanupTask } from '@datadog/browser-core/test'
import type { RumPerformanceEntry } from '../../../browser/performanceObservable'
import { RumPerformanceEntryType } from '../../../browser/performanceObservable'
import { createPerformanceEntry, mockPerformanceObserver, mockRumConfiguration } from '../../../../test'
import { trackInitialViewMetrics } from './trackInitialViewMetrics'

describe('trackInitialViewMetrics', () => {
  let clock: Clock
  let scheduleViewUpdateSpy: jasmine.Spy<() => void>
  let trackInitialViewMetricsResult: ReturnType<typeof trackInitialViewMetrics>
  let setLoadEventSpy: jasmine.Spy<(loadEvent: Duration) => void>
  let notifyPerformanceEntries: (entries: RumPerformanceEntry[]) => void

  beforeEach(() => {
    ;({ notifyPerformanceEntries } = mockPerformanceObserver())

    const configuration = mockRumConfiguration()
    scheduleViewUpdateSpy = jasmine.createSpy()
    setLoadEventSpy = jasmine.createSpy()
    clock = mockClock()

    trackInitialViewMetricsResult = trackInitialViewMetrics(
      configuration,
      clocksOrigin(),
      setLoadEventSpy,
      scheduleViewUpdateSpy
    )

    registerCleanupTask(trackInitialViewMetricsResult.stop)
  })

  it('should merge metrics from various sources', () => {
    notifyPerformanceEntries([
      createPerformanceEntry(RumPerformanceEntryType.NAVIGATION),
      createPerformanceEntry(RumPerformanceEntryType.PAINT),
      createPerformanceEntry(RumPerformanceEntryType.FIRST_INPUT),
    ])

    clock.tick(0)

    expect(scheduleViewUpdateSpy).toHaveBeenCalledTimes(3)
    expect(trackInitialViewMetricsResult.initialViewMetrics).toEqual({
      navigationTimings: jasmine.any(Object),
      firstContentfulPaint: 123 as Duration,
      firstInput: {
        delay: 100 as Duration,
        time: 1000 as RelativeTime,
        targetSelector: undefined,
      },
    })
  })

  it('calls the `setLoadEvent` callback when the loadEvent timing is known', () => {
    notifyPerformanceEntries([
      createPerformanceEntry(RumPerformanceEntryType.PAINT),
      createPerformanceEntry(RumPerformanceEntryType.FIRST_INPUT),
    ])

    clock.tick(0)

    expect(setLoadEventSpy).toHaveBeenCalledOnceWith(jasmine.any(Number))
  })
})
