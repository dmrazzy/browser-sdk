import type { RelativeTime, Observable } from '@datadog/browser-core'
import { SESSION_TIME_OUT_DELAY, relativeNow, createValueHistory, HookNames, DISCARDED } from '@datadog/browser-core'
import type { LocationChange } from '../../browser/locationChangeObservable'
import type { LifeCycle } from '../lifeCycle'
import { LifeCycleEventType } from '../lifeCycle'
import type { DefaultRumEventAttributes, Hooks } from '../hooks'

/**
 * We want to attach to an event:
 * - the url corresponding to its start
 * - the referrer corresponding to the previous view url (or document referrer for initial view)
 */

export const URL_CONTEXT_TIME_OUT_DELAY = SESSION_TIME_OUT_DELAY

export interface UrlContext {
  url: string
  referrer: string
}

export interface UrlContexts {
  findUrl: (startTime?: RelativeTime) => UrlContext | undefined
  stop: () => void
}

export function startUrlContexts(
  lifeCycle: LifeCycle,
  hooks: Hooks,
  locationChangeObservable: Observable<LocationChange>,
  location: Location
) {
  const urlContextHistory = createValueHistory<UrlContext>({ expireDelay: URL_CONTEXT_TIME_OUT_DELAY })

  let previousViewUrl: string | undefined

  lifeCycle.subscribe(LifeCycleEventType.BEFORE_VIEW_CREATED, ({ startClocks }) => {
    const viewUrl = location.href
    urlContextHistory.add(
      buildUrlContext({
        url: viewUrl,
        referrer: !previousViewUrl ? document.referrer : previousViewUrl,
      }),
      startClocks.relative
    )
    previousViewUrl = viewUrl
  })

  lifeCycle.subscribe(LifeCycleEventType.AFTER_VIEW_ENDED, ({ endClocks }) => {
    urlContextHistory.closeActive(endClocks.relative)
  })

  const locationChangeSubscription = locationChangeObservable.subscribe(({ newLocation }) => {
    const current = urlContextHistory.find()
    if (current) {
      const changeTime = relativeNow()
      urlContextHistory.closeActive(changeTime)
      urlContextHistory.add(
        buildUrlContext({
          url: newLocation.href,
          referrer: current.referrer,
        }),
        changeTime
      )
    }
  })

  function buildUrlContext({ url, referrer }: { url: string; referrer: string }) {
    return {
      url,
      referrer,
    }
  }

  hooks.register(HookNames.Assemble, ({ startTime, eventType }): DefaultRumEventAttributes | DISCARDED => {
    const urlContext = urlContextHistory.find(startTime)

    if (!urlContext) {
      return DISCARDED
    }

    return {
      type: eventType,
      view: {
        url: urlContext.url,
        referrer: urlContext.referrer,
      },
    }
  })

  return {
    findUrl: (startTime?: RelativeTime) => urlContextHistory.find(startTime),
    stop: () => {
      locationChangeSubscription.unsubscribe()
      urlContextHistory.stop()
    },
  }
}
