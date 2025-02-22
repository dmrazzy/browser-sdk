import type { Context, ContextManager, User } from '@datadog/browser-core'
import type { RecorderApi } from '../../boot/rumPublicApi'

export interface CommonContext {
  user: User
  account: Context
  context: Context
  hasReplay: true | undefined
}

export function buildCommonContext(
  globalContextManager: ContextManager,
  userContextManager: ContextManager,
  accountContextManager: ContextManager,
  recorderApi: RecorderApi
): CommonContext {
  return {
    context: globalContextManager.getContext(),
    user: userContextManager.getContext(),
    account: accountContextManager.getContext(),
    hasReplay: recorderApi.isRecording() ? true : undefined,
  }
}
