import React, { act } from 'react'

import type { RouteObject } from 'react-router-dom'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { initializeReactPlugin } from '../../../test/initializeReactPlugin'
import { appendComponent } from '../../../test/appendComponent'
import { useRoutes } from './useRoutes'

describe('useRoutes', () => {
  let startViewSpy: jasmine.Spy<(name?: string | object) => void>

  beforeEach(() => {
    startViewSpy = jasmine.createSpy()
    initializeReactPlugin({
      configuration: {
        router: true,
      },
      publicApi: {
        startView: startViewSpy,
      },
    })
  })

  it('starts a new view as soon as it is rendered', () => {
    appendComponent(
      <MemoryRouter initialEntries={['/foo']}>
        <RoutesRenderer
          routes={[
            {
              path: '/foo',
              element: null,
            },
          ]}
        />
      </MemoryRouter>
    )

    expect(startViewSpy).toHaveBeenCalledOnceWith('/foo')
  })

  it('renders the matching route', () => {
    const container = appendComponent(
      <MemoryRouter initialEntries={['/foo']}>
        <RoutesRenderer
          routes={[
            {
              path: '/foo',
              element: 'foo',
            },
          ]}
        />
      </MemoryRouter>
    )

    expect(container.innerHTML).toBe('foo')
  })

  it('does not start a new view on re-render', () => {
    let forceUpdate: () => void

    function App() {
      const [, setState] = React.useState(0)
      forceUpdate = () => setState((s) => s + 1)
      return (
        <MemoryRouter initialEntries={['/foo']}>
          <RoutesRenderer
            routes={[
              {
                path: '/foo',
                element: null,
              },
            ]}
          />
        </MemoryRouter>
      )
    }

    appendComponent(<App />)

    expect(startViewSpy).toHaveBeenCalledTimes(1)

    act(() => {
      forceUpdate!()
    })

    expect(startViewSpy).toHaveBeenCalledTimes(1)
  })

  it('starts a new view on navigation', () => {
    let navigate: (path: string) => void

    function NavBar() {
      navigate = useNavigate()

      return null
    }

    appendComponent(
      <MemoryRouter initialEntries={['/foo']}>
        <NavBar />
        <RoutesRenderer
          routes={[
            {
              path: '/foo',
              element: null,
            },
            {
              path: '/bar',
              element: null,
            },
          ]}
        />
      </MemoryRouter>
    )

    startViewSpy.calls.reset()
    act(() => {
      navigate!('/bar')
    })

    expect(startViewSpy).toHaveBeenCalledOnceWith('/bar')
  })

  it('does not start a new view if the URL is the same', () => {
    let navigate: (path: string) => void

    function NavBar() {
      navigate = useNavigate()

      return null
    }

    appendComponent(
      <MemoryRouter initialEntries={['/foo']}>
        <NavBar />
        <RoutesRenderer
          routes={[
            {
              path: '/foo',
              element: null,
            },
          ]}
        />
      </MemoryRouter>
    )

    startViewSpy.calls.reset()
    act(() => {
      navigate!('/foo')
    })

    expect(startViewSpy).not.toHaveBeenCalled()
  })

  it('does not start a new view if the path is the same but with different parameters', () => {
    let navigate: (path: string) => void

    function NavBar() {
      navigate = useNavigate()

      return null
    }

    appendComponent(
      <MemoryRouter initialEntries={['/foo']}>
        <NavBar />
        <RoutesRenderer
          routes={[
            {
              path: '/foo',
              element: null,
            },
          ]}
        />
      </MemoryRouter>
    )

    startViewSpy.calls.reset()
    act(() => {
      navigate!('/foo?bar=baz')
    })

    expect(startViewSpy).not.toHaveBeenCalled()
  })

  it('does not start a new view if it does not match any route', () => {
    // Prevent react router from showing a warning in the console when a route does not match
    spyOn(console, 'warn')

    appendComponent(
      <MemoryRouter>
        <RoutesRenderer routes={[{ path: '/bar', element: null }]} />
      </MemoryRouter>
    )

    expect(startViewSpy).not.toHaveBeenCalled()
  })

  it('allows passing a location object', () => {
    appendComponent(
      <MemoryRouter>
        <RoutesRenderer
          routes={[
            {
              path: '/foo',
              element: null,
            },
          ]}
          location={{ pathname: '/foo' }}
        />
      </MemoryRouter>
    )

    expect(startViewSpy).toHaveBeenCalledOnceWith('/foo')
  })

  it('allows passing a location string', () => {
    appendComponent(
      <MemoryRouter>
        <RoutesRenderer
          routes={[
            {
              path: '/foo',
              element: null,
            },
          ]}
          location="/foo"
        />
      </MemoryRouter>
    )

    expect(startViewSpy).toHaveBeenCalledOnceWith('/foo')
  })
})

function RoutesRenderer({ routes, location }: { routes: RouteObject[]; location?: { pathname: string } | string }) {
  return useRoutes(routes, location)
}
