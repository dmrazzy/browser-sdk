import type { RelativeTime } from '@datadog/browser-core'
import { clocksNow, DISCARDED, HookNames } from '@datadog/browser-core'
import type { RumSessionManagerMock } from '../../../test'
import { createRumSessionManagerMock, noopRecorderApi } from '../../../test'
import { SessionType } from '../rumSessionManager'
import type { DefaultRumEventAttributes, DefaultTelemetryEventAttributes, Hooks } from '../hooks'
import { createHooks } from '../hooks'
import { startSessionContext } from './sessionContext'
import type { ViewHistory } from './viewHistory'

describe('session context', () => {
  let hooks: Hooks
  let viewHistory: ViewHistory
  let sessionManager: RumSessionManagerMock
  const fakeView = {
    id: '1',
    startClocks: clocksNow(),
    sessionIsActive: false,
  }
  let isRecordingSpy: jasmine.Spy
  let getReplayStatsSpy: jasmine.Spy
  let findViewSpy: jasmine.Spy
  const fakeStats = {
    segments_count: 4,
    records_count: 10,
    segments_total_raw_size: 1000,
  }

  beforeEach(() => {
    viewHistory = { findView: () => undefined } as ViewHistory
    hooks = createHooks()
    sessionManager = createRumSessionManagerMock()
    sessionManager.setId('123')
    const recorderApi = noopRecorderApi

    isRecordingSpy = spyOn(recorderApi, 'isRecording')
    getReplayStatsSpy = spyOn(recorderApi, 'getReplayStats')
    findViewSpy = spyOn(viewHistory, 'findView').and.returnValue(fakeView)

    startSessionContext(hooks, sessionManager, recorderApi, viewHistory)
  })

  it('should set id and type', () => {
    isRecordingSpy.and.returnValue(true)

    const defaultRumEventAttributes = hooks.triggerHook(HookNames.Assemble, {
      eventType: 'action',
      startTime: 0 as RelativeTime,
    })

    expect(defaultRumEventAttributes).toEqual({
      type: 'action',
      session: jasmine.objectContaining({
        id: jasmine.any(String),
        type: SessionType.USER,
      }),
    })
  })

  it('should set hasReplay when recording has started (isRecording) on events', () => {
    isRecordingSpy.and.returnValue(true)
    const eventWithHasReplay = hooks.triggerHook(HookNames.Assemble, {
      eventType: 'action',
      startTime: 0 as RelativeTime,
    }) as DefaultRumEventAttributes

    isRecordingSpy.and.returnValue(false)
    const eventWithoutHasReplay = hooks.triggerHook(HookNames.Assemble, {
      eventType: 'action',
      startTime: 0 as RelativeTime,
    }) as DefaultRumEventAttributes

    expect(getReplayStatsSpy).not.toHaveBeenCalled()
    expect(isRecordingSpy).toHaveBeenCalled()
    expect(eventWithHasReplay.session!.has_replay).toEqual(true)
    expect(eventWithoutHasReplay.session!.has_replay).toBeUndefined()
  })

  it('should set hasReplay when there are Replay stats on view events', () => {
    getReplayStatsSpy.and.returnValue(fakeStats)
    const eventWithHasReplay = hooks.triggerHook(HookNames.Assemble, {
      eventType: 'view',
      startTime: 0 as RelativeTime,
    }) as DefaultRumEventAttributes

    getReplayStatsSpy.and.returnValue(undefined)
    const eventWithoutHasReplay = hooks.triggerHook(HookNames.Assemble, {
      eventType: 'view',
      startTime: 0 as RelativeTime,
    }) as DefaultRumEventAttributes

    expect(getReplayStatsSpy).toHaveBeenCalled()
    expect(isRecordingSpy).not.toHaveBeenCalled()
    expect(eventWithHasReplay.session!.has_replay).toEqual(true)
    expect(eventWithoutHasReplay.session!.has_replay).toBeUndefined()
  })

  it('should set session.is_active when the session is active', () => {
    findViewSpy.and.returnValue({ ...fakeView, sessionIsActive: true })
    const eventWithActiveSession = hooks.triggerHook(HookNames.Assemble, {
      eventType: 'view',
      startTime: 0 as RelativeTime,
    }) as DefaultRumEventAttributes
    findViewSpy.and.returnValue({ ...fakeView, sessionIsActive: false })
    const eventWithoutActiveSession = hooks.triggerHook(HookNames.Assemble, {
      eventType: 'view',
      startTime: 0 as RelativeTime,
    }) as DefaultRumEventAttributes

    expect(eventWithActiveSession.session!.is_active).toBe(undefined)
    expect(eventWithoutActiveSession.session!.is_active).toBe(false)
  })

  it('should set sampled_for_replay', () => {
    sessionManager.setTrackedWithSessionReplay()
    const eventSampleForReplay = hooks.triggerHook(HookNames.Assemble, {
      eventType: 'view',
      startTime: 0 as RelativeTime,
    }) as DefaultRumEventAttributes

    sessionManager.setTrackedWithoutSessionReplay()
    const eventSampledOutForReplay = hooks.triggerHook(HookNames.Assemble, {
      eventType: 'view',
      startTime: 0 as RelativeTime,
    }) as DefaultRumEventAttributes

    expect(eventSampleForReplay.session!.sampled_for_replay).toBe(true)
    expect(eventSampledOutForReplay.session!.sampled_for_replay).toBe(false)
  })

  it('should discard the event if no session', () => {
    sessionManager.setNotTracked()
    const defaultRumEventAttributes = hooks.triggerHook(HookNames.Assemble, {
      eventType: 'view',
      startTime: 0 as RelativeTime,
    })

    expect(defaultRumEventAttributes).toBe(DISCARDED)
  })

  it('should discard the event if no view', () => {
    findViewSpy.and.returnValue(undefined)
    const defaultRumEventAttributes = hooks.triggerHook(HookNames.Assemble, {
      eventType: 'view',
      startTime: 0 as RelativeTime,
    })

    expect(defaultRumEventAttributes).toBe(DISCARDED)
  })

  describe('assemble telemetry hook', () => {
    it('should add session.id', () => {
      const telemetryEventAttributes = hooks.triggerHook(HookNames.AssembleTelemetry, {
        startTime: 0 as RelativeTime,
      }) as DefaultTelemetryEventAttributes

      expect(telemetryEventAttributes.session?.id).toEqual('123')
    })

    it('should not add session.id if no session', () => {
      sessionManager.setNotTracked()
      const telemetryEventAttributes = hooks.triggerHook(HookNames.AssembleTelemetry, {
        startTime: 0 as RelativeTime,
      })

      expect(telemetryEventAttributes).toBeUndefined()
    })
  })
})
