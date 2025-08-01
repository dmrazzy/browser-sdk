import type { RumErrorEvent } from '@datadog/browser-rum-core'
import { test, expect } from '@playwright/test'
import { createTest, html } from '../../lib/framework'

// Note: using `browser.execute` to throw exceptions may result in "Script error." being reported,
// because WDIO is evaluating the script in a different context than the page.
function createBody(errorGenerator: string) {
  return html`
    <button>click me</button>
    <script>
      const button = document.querySelector('button')
      button.addEventListener('click', function handler() {
        ${errorGenerator}
      })
      function foo() {
        return new Error('oh snap')
      }
      function customError() {
        class CustomTestError extends Error {}
        return new CustomTestError('oh snap')
      }
      function customErrorWithInheritance() {
        class CustomTestError extends Error {}
        class CustomTestError2 extends CustomTestError {}

        // this is an anonymous class, which has no name
        // we're checking if the stacktrace is correctly reported for this specific case (with the class name missing)
        return new (class extends CustomTestError2 {
          constructor(e) {
            super(e)
            this.name = 'CustomTestError3'
          }
        })('oh snap')
      }
    </script>
  `
}

test.describe('rum errors', () => {
  createTest('send console.error errors')
    .withRum()
    .withBody(createBody('console.error("oh snap")'))
    .run(async ({ page, intakeRegistry, baseUrl, flushEvents, withBrowserLogs }) => {
      const button = page.locator('button')
      await button.click()

      await flushEvents()
      expect(intakeRegistry.rumErrorEvents).toHaveLength(1)
      expectError(intakeRegistry.rumErrorEvents[0].error, {
        message: 'oh snap',
        source: 'console',
        handlingStack: ['HandlingStack: console error', `handler @ ${baseUrl}/:`],
        handling: 'handled',
      })
      withBrowserLogs((browserLogs) => {
        expect(browserLogs).toHaveLength(1)
      })
    })

  createTest('pass Error instance to console.error')
    .withRum()
    .withBody(createBody('console.error("Foo:", foo())'))
    .run(async ({ page, flushEvents, intakeRegistry, baseUrl, withBrowserLogs }) => {
      const button = page.locator('button')
      await button.click()

      await flushEvents()
      expect(intakeRegistry.rumErrorEvents).toHaveLength(1)
      expectError(intakeRegistry.rumErrorEvents[0].error, {
        message: 'Foo: Error: oh snap',
        source: 'console',
        stack: ['Error: oh snap', `at foo @ ${baseUrl}/:`, `handler @ ${baseUrl}/:`],
        handlingStack: ['HandlingStack: console error', `handler @ ${baseUrl}/:`],
        handling: 'handled',
      })
      withBrowserLogs((browserLogs) => {
        expect(browserLogs).toHaveLength(1)
      })
    })

  createTest('send uncaught exceptions')
    .withRum()
    .withBody(createBody('throw foo()'))
    .run(async ({ page, flushEvents, intakeRegistry, baseUrl, withBrowserLogs }) => {
      const button = page.locator('button')
      await button.click()

      await flushEvents()
      expect(intakeRegistry.rumErrorEvents).toHaveLength(1)
      expectError(intakeRegistry.rumErrorEvents[0].error, {
        message: 'oh snap',
        source: 'source',
        stack: ['Error: oh snap', `at foo @ ${baseUrl}/:`, `handler @ ${baseUrl}/:`],
        handling: 'unhandled',
      })
      withBrowserLogs((browserLogs) => {
        expect(browserLogs).toHaveLength(1)
      })
    })

  createTest('send runtime errors happening before initialization')
    .withRum()
    .withRumInit((configuration) => {
      // Use a setTimeout to:
      // * have a constant stack trace regardless of the setup used
      // * avoid the exception to be swallowed by the `onReady` logic
      setTimeout(() => {
        throw new Error('oh snap')
      })
      // Simulate a late initialization of the RUM SDK
      setTimeout(() => window.DD_RUM!.init(configuration))
    })
    .run(async ({ intakeRegistry, flushEvents, withBrowserLogs, baseUrl }) => {
      await flushEvents()
      expect(intakeRegistry.rumErrorEvents).toHaveLength(1)
      expectError(intakeRegistry.rumErrorEvents[0].error, {
        message: 'oh snap',
        source: 'source',
        handling: 'unhandled',
        stack: ['Error: oh snap', `at <anonymous> @ ${baseUrl}/:`],
      })
      withBrowserLogs((browserLogs) => {
        expect(browserLogs).toHaveLength(1)
      })
    })

  createTest('send unhandled rejections')
    .withRum()
    .withBody(createBody('Promise.reject(foo())'))
    .run(async ({ flushEvents, page, intakeRegistry, baseUrl, withBrowserLogs }) => {
      const button = page.locator('button')
      await button.click()

      await flushEvents()
      expect(intakeRegistry.rumErrorEvents).toHaveLength(1)
      expectError(intakeRegistry.rumErrorEvents[0].error, {
        message: 'oh snap',
        source: 'source',
        stack: ['Error: oh snap', `at foo @ ${baseUrl}/:`, `handler @ ${baseUrl}/:`],
        handling: 'unhandled',
      })
      withBrowserLogs((browserLogs) => {
        expect(browserLogs).toHaveLength(1)
      })
    })

  createTest('send custom errors')
    .withRum()
    .withBody(createBody('DD_RUM.addError(foo())'))
    .run(async ({ flushEvents, page, intakeRegistry, baseUrl, withBrowserLogs }) => {
      const button = page.locator('button')
      await button.click()

      await flushEvents()
      expect(intakeRegistry.rumErrorEvents).toHaveLength(1)
      expectError(intakeRegistry.rumErrorEvents[0].error, {
        message: 'oh snap',
        source: 'custom',
        stack: ['Error: oh snap', `at foo @ ${baseUrl}/:`, `handler @ ${baseUrl}/:`],
        handlingStack: ['HandlingStack: error', `handler @ ${baseUrl}/:`],
        handling: 'handled',
      })
      withBrowserLogs((browserLogs) => {
        expect(browserLogs).toHaveLength(0)
      })
    })

  // non-native errors should have the same stack trace as regular errors on ALL BROWSERS
  createTest('send non-native errors')
    .withRum()
    .withBody(createBody('DD_RUM.addError(customError())'))
    .run(async ({ flushEvents, page, intakeRegistry, baseUrl, withBrowserLogs }) => {
      const button = page.locator('button')
      await button.click()

      await flushEvents()
      expect(intakeRegistry.rumErrorEvents).toHaveLength(1)
      expectError(intakeRegistry.rumErrorEvents[0].error, {
        message: 'oh snap',
        source: 'custom',
        stack: ['Error: oh snap', `at customError @ ${baseUrl}/:`, `handler @ ${baseUrl}/:`],
        handlingStack: ['HandlingStack: error', `handler @ ${baseUrl}/:`],
        handling: 'handled',
      })
      withBrowserLogs((browserLogs) => {
        expect(browserLogs).toHaveLength(0)
      })
    })

  // non-native should have the same stack trace as regular errors on ALL BROWSERS
  // this should also work for custom error classes that inherit from other custom error classes
  createTest('send non-native errors with inheritance')
    .withRum()
    .withBody(createBody('DD_RUM.addError(customErrorWithInheritance())'))
    .run(async ({ flushEvents, page, intakeRegistry, baseUrl, withBrowserLogs }) => {
      const button = page.locator('button')
      await button.click()

      await flushEvents()
      expect(intakeRegistry.rumErrorEvents).toHaveLength(1)

      expectError(intakeRegistry.rumErrorEvents[0].error, {
        message: 'oh snap',
        source: 'custom',
        stack: ['CustomTestError3: oh snap', `at customErrorWithInheritance @ ${baseUrl}/:`, `handler @ ${baseUrl}/:`],
        handlingStack: ['HandlingStack: error', `handler @ ${baseUrl}/:`],
        handling: 'handled',
      })
      withBrowserLogs((browserLogs) => {
        expect(browserLogs).toHaveLength(0)
      })
    })

  createTest('send CSP violation errors')
    .withRum()
    .withBody(
      createBody(`
      const script = document.createElement('script');
      script.src = "https://example.com/foo.js"
      document.body.appendChild(script)
      `)
    )
    .run(async ({ page, browserName, intakeRegistry, baseUrl, flushEvents, withBrowserLogs }) => {
      const button = page.locator('button')
      await button.click()

      await flushEvents()

      expect(intakeRegistry.rumErrorEvents).toHaveLength(1)
      expectError(intakeRegistry.rumErrorEvents[0].error, {
        message: /^csp_violation: 'https:\/\/example\.com\/foo\.js' blocked by 'script-src(-elem)?' directive$/,
        source: 'report',
        stack: [
          /^script-src(-elem)?: 'https:\/\/example\.com\/foo\.js' blocked by 'script-src(-elem)?' directive of the policy/,
          `  at <anonymous> @ ${baseUrl}/:`,
        ],
        handling: 'unhandled',
        csp: {
          disposition: 'enforce',
        },
      })
      withBrowserLogs((browserLogs) => {
        if (browserName === 'firefox') {
          // Firefox has an additional Warning log: "Loading failed for the <script> with source 'https://example.com/foo.js'"
          expect(browserLogs).toHaveLength(2)
        } else {
          expect(browserLogs).toHaveLength(1)
        }
      })
    })
})

function expectError(
  error: RumErrorEvent['error'],
  expected: {
    message: string | RegExp
    source: string
    stack?: Array<string | RegExp>
    handlingStack?: Array<string | RegExp>
    handling: 'handled' | 'unhandled'
    csp?: {
      disposition?: 'enforce' | 'report'
    }
  }
) {
  expect(error.message).toMatch(expected.message)
  expect(error.source).toBe(expected.source)
  expectStack(error.stack, expected.stack)
  expectStack(error.handling_stack, expected.handlingStack)
  expect(error.handling).toBe(expected.handling)
  expect(error.csp?.disposition).toBe(expected.csp?.disposition)
}

function expectStack(stack: string | undefined, expectedLines?: Array<string | RegExp>) {
  if (expectedLines === undefined) {
    expect(stack).toBeUndefined()
  } else {
    expect(stack).toBeDefined()
    const actualLines = stack!.split('\n')
    expect.soft(actualLines.length).toBeGreaterThanOrEqual(expectedLines.length)
    expect.soft(actualLines.length).toBeLessThanOrEqual(expectedLines.length + 2) // FF may have more lines of stack

    expectedLines.forEach((line, i) => {
      if (typeof line !== 'string') {
        return expect(actualLines[i]).toMatch(line)
      }

      if (i === 0) {
        expect(actualLines[i]).toMatch(line)
      } else {
        expect(actualLines[i]).toContain(line)
      }
    })
  }
}
