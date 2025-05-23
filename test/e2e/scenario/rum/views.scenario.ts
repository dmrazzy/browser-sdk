import { test, expect } from '@playwright/test'
import { createTest, html } from '../../lib/framework'

test.describe('rum views', () => {
  createTest('send performance timings along the view events')
    .withRum()
    .run(async ({ flushEvents, intakeRegistry }) => {
      await flushEvents()
      const viewEvent = intakeRegistry.rumViewEvents[0]
      expect(viewEvent).toBeDefined()
      expect(viewEvent.view.first_byte).toBeGreaterThan(0)
      expect(viewEvent.view.dom_complete).toBeGreaterThan(0)
      expect(viewEvent.view.dom_content_loaded).toBeGreaterThan(0)
      expect(viewEvent.view.dom_interactive).toBeGreaterThan(0)
      expect(viewEvent.view.load_event).toBeGreaterThan(0)
    })

  test.describe('loading time', () => {
    // Simple spinner to test dom mutations.
    const SPINNER = html`
      <script type="module">
        const spinner = document.createElement('div')
        document.body.append(spinner)

        const spinnerChars = ['|', '/', '-', '\\\\']
        let i = 0
        setInterval(() => {
          spinner.innerText = spinnerChars[i]
          i = (i + 1) % spinnerChars.length
        }, 10)
      </script>
    `

    createTest('has a loading time')
      .withRum()
      .run(async ({ flushEvents, intakeRegistry }) => {
        await flushEvents()
        const viewEvent = intakeRegistry.rumViewEvents[0]
        expect(viewEvent).toBeDefined()
        expect(viewEvent.view.loading_time).toBeGreaterThan(0)
      })

    createTest('does not have a loading time when DOM mutations are notified continuously')
      .withRum()
      .withBody(SPINNER)
      .run(async ({ flushEvents, intakeRegistry }) => {
        await flushEvents()
        const viewEvent = intakeRegistry.rumViewEvents.at(-1)
        expect(viewEvent).toBeDefined()
        expect(viewEvent!.view.loading_time).toBeUndefined()
      })

    createTest('excludes some dom mutation when computing the loading time')
      .withRum({
        enableExperimentalFeatures: ['dom_mutation_ignoring'],
      })
      .withBody(html`
        <script type="module">
          document.body.setAttribute('data-dd-excluded-activity-mutations', 'true')
        </script>
        ${SPINNER}
      `)
      .run(async ({ flushEvents, intakeRegistry }) => {
        await flushEvents()
        const viewEvent = intakeRegistry.rumViewEvents[0]
        expect(viewEvent).toBeDefined()
        expect(viewEvent.view.loading_time).toBeGreaterThan(0)
      })
  })

  createTest('send performance first input delay')
    .withRum()
    .withBody(html` <button>Hop</button> `)
    .run(async ({ browserName, flushEvents, intakeRegistry, page }) => {
      test.skip(
        browserName === 'webkit',
        "Safari have an issue with 'event.timeStamp', so the 'first-input' polyfill is ignoring it and doesn't send a performance entry. See https://bugs.webkit.org/show_bug.cgi?id=211101"
      )
      const button = page.locator('button')
      await button.click()
      await flushEvents()
      const viewEvent = intakeRegistry.rumViewEvents[0]
      expect(viewEvent).toBeDefined()
      expect(viewEvent.view.first_input_delay).toBeGreaterThanOrEqual(0)
    })

  test.describe('anchor navigation', () => {
    createTest("don't create a new view when it is an Anchor navigation")
      .withRum()
      .withBody(html`
        <a href="#test-anchor">anchor link</a>
        <div id="test-anchor"></div>
      `)
      .run(async ({ flushEvents, intakeRegistry, page }) => {
        const anchor = page.locator('a')
        await anchor.click()

        await flushEvents()
        const viewEvents = intakeRegistry.rumViewEvents

        expect(viewEvents).toHaveLength(1)
        expect(viewEvents[0].view.loading_type).toBe('initial_load')
      })

    createTest('create a new view on hash change')
      .withRum()
      .run(async ({ flushEvents, intakeRegistry, page }) => {
        await page.evaluate(() => {
          window.location.hash = '#bar'
        })

        await flushEvents()
        const viewEvents = intakeRegistry.rumViewEvents

        expect(viewEvents).toHaveLength(2)
        expect(viewEvents[0].view.loading_type).toBe('initial_load')
        expect(viewEvents[1].view.loading_type).toBe('route_change')
      })
  })
})
