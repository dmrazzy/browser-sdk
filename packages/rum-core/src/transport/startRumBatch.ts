import type { Context, Observable, RawError, PageMayExitEvent, Encoder } from '@datadog/browser-core'
import { DeflateEncoderStreamId, combine, startBatchWithReplica } from '@datadog/browser-core'
import type { RumConfiguration } from '../domain/configuration'
import type { LifeCycle } from '../domain/lifeCycle'
import { LifeCycleEventType } from '../domain/lifeCycle'
import { RumEventType } from '../rawRumEvent.types'
import type { RumEvent } from '../rumEvent.types'

export function startRumBatch(
  configuration: RumConfiguration,
  lifeCycle: LifeCycle,
  reportError: (error: RawError) => void,
  pageMayExitObservable: Observable<PageMayExitEvent>,
  sessionExpireObservable: Observable<void>,
  createEncoder: (streamId: DeflateEncoderStreamId) => Encoder
) {
  const replica = configuration.replica

  const batch = startBatchWithReplica(
    configuration,
    {
      endpoint: configuration.rumEndpointBuilder,
      encoder: createEncoder(DeflateEncoderStreamId.RUM),
    },
    replica && {
      endpoint: replica.rumEndpointBuilder,
      transformMessage: (message) => combine(message, { application: { id: replica.applicationId } }),
      encoder: createEncoder(DeflateEncoderStreamId.RUM_REPLICA),
    },
    reportError,
    pageMayExitObservable,
    sessionExpireObservable
  )

  lifeCycle.subscribe(LifeCycleEventType.RUM_EVENT_COLLECTED, (serverRumEvent: RumEvent & Context) => {
    if (serverRumEvent.type === RumEventType.VIEW) {
      batch.upsert(serverRumEvent, serverRumEvent.view.id)
    } else {
      batch.add(serverRumEvent)
    }
  })

  return batch
}
