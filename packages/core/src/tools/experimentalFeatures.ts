/**
 * LIMITATION:
 * For NPM setup, this feature flag singleton is shared between RUM and Logs product.
 * This means that an experimental flag set on the RUM product will be set on the Logs product.
 * So keep in mind that in certain configurations, your experimental feature flag may affect other products.
 *
 * FORMAT:
 * All feature flags should be snake_cased
 */
// We want to use a real enum (i.e. not a const enum) here, to be able to check whether an arbitrary
// string is an expected feature flag

import { objectHasValue } from './utils/objectUtils'

// eslint-disable-next-line no-restricted-syntax
export enum ExperimentalFeature {
  TRACK_INTAKE_REQUESTS = 'track_intake_requests',
  WRITABLE_RESOURCE_GRAPHQL = 'writable_resource_graphql',
  WATCH_COOKIE_WITHOUT_LOCK = 'watch_cookie_without_lock',
}

const enabledExperimentalFeatures: Set<ExperimentalFeature> = new Set()

export function initFeatureFlags(enableExperimentalFeatures: string[] | undefined) {
  if (Array.isArray(enableExperimentalFeatures)) {
    addExperimentalFeatures(
      enableExperimentalFeatures.filter((flag): flag is ExperimentalFeature =>
        objectHasValue(ExperimentalFeature, flag)
      )
    )
  }
}

export function addExperimentalFeatures(enabledFeatures: ExperimentalFeature[]): void {
  enabledFeatures.forEach((flag) => {
    enabledExperimentalFeatures.add(flag)
  })
}

export function isExperimentalFeatureEnabled(featureName: ExperimentalFeature): boolean {
  return enabledExperimentalFeatures.has(featureName)
}

export function resetExperimentalFeatures(): void {
  enabledExperimentalFeatures.clear()
}

export function getExperimentalFeatures(): Set<ExperimentalFeature> {
  return enabledExperimentalFeatures
}
