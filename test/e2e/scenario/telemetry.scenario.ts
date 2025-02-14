import { bundleSetup, createTest, flushEvents } from '../lib/framework'

describe('telemetry', () => {
  createTest('send errors for logs')
    .withSetup(bundleSetup)
    .withLogs()
    .run(async ({ intakeRegistry }) => {
      await browser.execute(() => {
        const context = {
          get foo() {
            throw new window.Error('expected error')
          },
        }
        window.DD_LOGS!.logger.log('hop', context as any)
      })
      await flushEvents()
      expect(intakeRegistry.telemetryErrorEvents.length).toBe(1)
      const event = intakeRegistry.telemetryErrorEvents[0]
      expect(event.service).toEqual('browser-logs-sdk')
      expect(event.telemetry.message).toBe('expected error')
      expect(event.telemetry.error!.kind).toBe('Error')
      expect(event.telemetry.status).toBe('error')
      intakeRegistry.empty()
    })

  createTest('send errors for RUM')
    .withSetup(bundleSetup)
    .withRum()
    .run(async ({ intakeRegistry }) => {
      await browser.execute(() => {
        const context = {
          get foo() {
            throw new window.Error('expected error')
          },
        }
        window.DD_RUM!.addAction('hop', context as any)
      })
      await flushEvents()
      expect(intakeRegistry.telemetryErrorEvents.length).toBe(1)
      const event = intakeRegistry.telemetryErrorEvents[0]
      expect(event.service).toEqual('browser-rum-sdk')
      expect(event.telemetry.message).toBe('expected error')
      expect(event.telemetry.error!.kind).toBe('Error')
      expect(event.telemetry.status).toBe('error')
      intakeRegistry.empty()
    })

  createTest('send init configuration for logs')
    .withSetup(bundleSetup)
    .withLogs({
      forwardErrorsToLogs: true,
    })
    .run(async ({ intakeRegistry }) => {
      await flushEvents()
      expect(intakeRegistry.telemetryConfigurationEvents.length).toBe(1)
      const event = intakeRegistry.telemetryConfigurationEvents[0]
      expect(event.service).toEqual('browser-logs-sdk')
      expect(event.telemetry.configuration.forward_errors_to_logs).toEqual(true)
    })

  createTest('send init configuration for RUM')
    .withSetup(bundleSetup)
    .withRum({
      trackUserInteractions: true,
    })
    .run(async ({ intakeRegistry }) => {
      await flushEvents()
      expect(intakeRegistry.telemetryConfigurationEvents.length).toBe(1)
      const event = intakeRegistry.telemetryConfigurationEvents[0]
      expect(event.service).toEqual('browser-rum-sdk')
      expect(event.telemetry.configuration.track_user_interactions).toEqual(true)
    })

  createTest('send usage telemetry for RUM')
    .withSetup(bundleSetup)
    .withRum()
    .run(async ({ intakeRegistry }) => {
      await browser.execute(() => {
        window.DD_RUM!.addAction('foo')
      })

      await flushEvents()
      expect(intakeRegistry.telemetryUsageEvents.length).toBe(2)
      const event = intakeRegistry.telemetryUsageEvents[1] // first event is 'set-global-context' done in pageSetup.ts
      expect(event.service).toEqual('browser-rum-sdk')
      expect(event.telemetry.usage.feature).toEqual('add-action')
    })

  createTest('send usage telemetry for logs')
    .withSetup(bundleSetup)
    .withLogs()
    .run(async ({ intakeRegistry }) => {
      await browser.execute(() => {
        window.DD_LOGS!.setTrackingConsent('granted')
      })

      await flushEvents()
      expect(intakeRegistry.telemetryUsageEvents.length).toBe(1)
      const event = intakeRegistry.telemetryUsageEvents[0]
      expect(event.service).toEqual('browser-logs-sdk')
      expect(event.telemetry.usage.feature).toEqual('set-tracking-consent')
    })
})
