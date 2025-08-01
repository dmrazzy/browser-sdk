import type { Payload } from '../../transport'
import { timeStampNow } from '../../tools/utils/timeUtils'
import { normalizeUrl } from '../../tools/utils/urlPolyfill'
import { generateUUID } from '../../tools/utils/stringUtils'
import { INTAKE_SITE_FED_STAGING, INTAKE_SITE_US1, PCI_INTAKE_HOST_US1 } from '../intakeSites'
import type { InitConfiguration } from './configuration'

// replaced at build time
declare const __BUILD_ENV__SDK_VERSION__: string

export type TrackType = 'logs' | 'rum' | 'replay' | 'profile' | 'exposures'
export type ApiType =
  | 'fetch-keepalive'
  | 'fetch'
  | 'beacon'
  // 'manual' reflects that the request have been sent manually, outside of the SDK (ex: via curl or
  // a Node.js script).
  | 'manual'

export type EndpointBuilder = ReturnType<typeof createEndpointBuilder>

export function createEndpointBuilder(initConfiguration: InitConfiguration, trackType: TrackType) {
  const buildUrlWithParameters = createEndpointUrlWithParametersBuilder(initConfiguration, trackType)

  return {
    build(api: ApiType, payload: Payload) {
      const parameters = buildEndpointParameters(initConfiguration, trackType, api, payload)
      return buildUrlWithParameters(parameters)
    },
    trackType,
  }
}

/**
 * Create a function used to build a full endpoint url from provided parameters. The goal of this
 * function is to pre-compute some parts of the URL to avoid re-computing everything on every
 * request, as only parameters are changing.
 */
function createEndpointUrlWithParametersBuilder(
  initConfiguration: InitConfiguration,
  trackType: TrackType
): (parameters: string) => string {
  const path = `/api/v2/${trackType}`
  const proxy = initConfiguration.proxy
  if (typeof proxy === 'string') {
    const normalizedProxyUrl = normalizeUrl(proxy)
    return (parameters) => `${normalizedProxyUrl}?ddforward=${encodeURIComponent(`${path}?${parameters}`)}`
  }
  if (typeof proxy === 'function') {
    return (parameters) => proxy({ path, parameters })
  }
  const host = buildEndpointHost(trackType, initConfiguration)
  return (parameters) => `https://${host}${path}?${parameters}`
}

export function buildEndpointHost(
  trackType: TrackType,
  initConfiguration: InitConfiguration & { usePciIntake?: boolean }
) {
  const { site = INTAKE_SITE_US1, internalAnalyticsSubdomain } = initConfiguration

  if (trackType === 'logs' && initConfiguration.usePciIntake && site === INTAKE_SITE_US1) {
    return PCI_INTAKE_HOST_US1
  }

  if (internalAnalyticsSubdomain && site === INTAKE_SITE_US1) {
    return `${internalAnalyticsSubdomain}.${INTAKE_SITE_US1}`
  }

  if (site === INTAKE_SITE_FED_STAGING) {
    return `http-intake.logs.${site}`
  }

  const domainParts = site.split('.')
  const extension = domainParts.pop()
  return `browser-intake-${domainParts.join('-')}.${extension!}`
}

/**
 * Build parameters to be used for an intake request. Parameters should be re-built for each
 * request, as they change randomly.
 */
function buildEndpointParameters(
  { clientToken, internalAnalyticsSubdomain }: InitConfiguration,
  trackType: TrackType,
  api: ApiType,
  { retry, encoding }: Payload
) {
  const parameters = [
    'ddsource=browser',
    `dd-api-key=${clientToken}`,
    `dd-evp-origin-version=${encodeURIComponent(__BUILD_ENV__SDK_VERSION__)}`,
    'dd-evp-origin=browser',
    `dd-request-id=${generateUUID()}`,
  ]

  if (encoding) {
    parameters.push(`dd-evp-encoding=${encoding}`)
  }

  if (trackType === 'rum') {
    parameters.push(`batch_time=${timeStampNow()}`, `_dd.api=${api}`)

    if (retry) {
      parameters.push(`_dd.retry_count=${retry.count}`, `_dd.retry_after=${retry.lastFailureStatus}`)
    }
  }

  if (internalAnalyticsSubdomain) {
    parameters.reverse()
  }

  return parameters.join('&')
}
