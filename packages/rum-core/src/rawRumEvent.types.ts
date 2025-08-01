import type {
  Duration,
  ErrorSource,
  ErrorHandling,
  ResourceType,
  ServerDuration,
  TimeStamp,
  RawErrorCause,
  DefaultPrivacyLevel,
  Csp,
  Context,
} from '@datadog/browser-core'
import type { PageState } from './domain/contexts/pageStateHistory'

export const RumEventType = {
  ACTION: 'action',
  ERROR: 'error',
  LONG_TASK: 'long_task',
  VIEW: 'view',
  RESOURCE: 'resource',
  VITAL: 'vital',
} as const

export type RumEventType = (typeof RumEventType)[keyof typeof RumEventType]

export const RumLongTaskEntryType = {
  LONG_TASK: 'long-task',
  LONG_ANIMATION_FRAME: 'long-animation-frame',
} as const

export type RumLongTaskEntryType = (typeof RumLongTaskEntryType)[keyof typeof RumLongTaskEntryType]

export interface RawRumResourceEvent {
  date: TimeStamp
  type: typeof RumEventType.RESOURCE
  resource: {
    type: ResourceType
    id: string
    duration?: ServerDuration
    url: string
    method?: string
    status_code?: number
    size?: number
    encoded_body_size?: number
    decoded_body_size?: number
    transfer_size?: number
    render_blocking_status?: string
    redirect?: ResourceEntryDetailsElement
    dns?: ResourceEntryDetailsElement
    connect?: ResourceEntryDetailsElement
    ssl?: ResourceEntryDetailsElement
    worker?: ResourceEntryDetailsElement
    first_byte?: ResourceEntryDetailsElement
    download?: ResourceEntryDetailsElement
    protocol?: string
    delivery_type?: DeliveryType
  }
  _dd: {
    trace_id?: string
    span_id?: string // not available for initial document tracing
    rule_psr?: number
    discarded: boolean
    page_states?: PageStateServerEntry[]
  }
}

export interface ResourceEntryDetailsElement {
  duration: ServerDuration
  start: ServerDuration
}

export interface RawRumErrorEvent {
  date: TimeStamp
  type: typeof RumEventType.ERROR
  error: {
    id: string
    type?: string
    stack?: string
    handling_stack?: string
    component_stack?: string
    fingerprint?: string
    source: ErrorSource
    message: string
    handling?: ErrorHandling
    causes?: RawErrorCause[]
    source_type: 'browser'
    csp?: Csp
  }
  view?: {
    in_foreground: boolean
  }
  context?: Context
}

export interface RawRumViewEvent {
  date: TimeStamp
  type: typeof RumEventType.VIEW
  view: {
    loading_type: ViewLoadingType
    first_byte?: ServerDuration
    first_contentful_paint?: ServerDuration
    first_input_delay?: ServerDuration
    first_input_time?: ServerDuration
    first_input_target_selector?: string
    interaction_to_next_paint?: ServerDuration
    interaction_to_next_paint_time?: ServerDuration
    interaction_to_next_paint_target_selector?: string
    cumulative_layout_shift?: number
    cumulative_layout_shift_time?: ServerDuration
    cumulative_layout_shift_target_selector?: string
    custom_timings?: {
      [key: string]: ServerDuration
    }
    largest_contentful_paint?: ServerDuration
    largest_contentful_paint_target_selector?: string
    dom_interactive?: ServerDuration
    dom_content_loaded?: ServerDuration
    dom_complete?: ServerDuration
    load_event?: ServerDuration
    loading_time?: ServerDuration
    time_spent: ServerDuration
    is_active: boolean
    name?: string
    error: Count
    action: Count
    long_task: Count
    resource: Count
    frustration: Count
    performance?: ViewPerformanceData
  }
  display?: ViewDisplay
  privacy?: {
    replay_level: DefaultPrivacyLevel
  }
  _dd: {
    document_version: number
    replay_stats?: ReplayStats
    page_states?: PageStateServerEntry[]
    cls?: {
      device_pixel_ratio: number
    }
    configuration: {
      start_session_replay_recording_manually: boolean
    }
  }
  device?: {
    locale?: string
    locales?: readonly string[]
    time_zone?: string
  }
}

interface ViewDisplay {
  scroll: {
    max_depth?: number
    max_depth_scroll_top?: number
    max_scroll_height?: number
    max_scroll_height_time?: ServerDuration
  }
}

export interface ViewPerformanceData {
  cls?: {
    score: number
    timestamp?: ServerDuration
    target_selector?: string
    previous_rect?: RumRect
    current_rect?: RumRect
  }
  fcp?: {
    timestamp: number
  }
  fid?: {
    duration: ServerDuration
    timestamp: ServerDuration
    target_selector?: string
  }
  inp?: {
    duration: ServerDuration
    timestamp?: ServerDuration
    target_selector?: string
  }
  lcp?: {
    timestamp: ServerDuration
    target_selector?: string
    resource_url?: string
  }
}

export interface RumRect {
  x: number
  y: number
  width: number
  height: number
}

export interface PageStateServerEntry {
  state: PageState
  start: ServerDuration
  [k: string]: unknown
}

export const ViewLoadingType = {
  INITIAL_LOAD: 'initial_load',
  ROUTE_CHANGE: 'route_change',
  BF_CACHE: 'bf_cache',
} as const

export type ViewLoadingType = (typeof ViewLoadingType)[keyof typeof ViewLoadingType]

export interface ViewCustomTimings {
  [key: string]: Duration
}

export interface ReplayStats {
  records_count: number
  segments_count: number
  segments_total_raw_size: number
}

interface Count {
  count: number
}

export interface RawRumLongTaskEvent {
  date: TimeStamp
  type: typeof RumEventType.LONG_TASK
  long_task: {
    id: string
    entry_type: typeof RumLongTaskEntryType.LONG_TASK
    duration: ServerDuration
  }
  _dd: {
    discarded: boolean
  }
}

export type DeliveryType = 'cache' | 'navigational-prefetch' | 'other'

export type InvokerType =
  | 'user-callback'
  | 'event-listener'
  | 'resolve-promise'
  | 'reject-promise'
  | 'classic-script'
  | 'module-script'

export interface RawRumLongAnimationFrameEvent {
  date: TimeStamp
  type: typeof RumEventType.LONG_TASK // LoAF are ingested as Long Task
  long_task: {
    id: string
    entry_type: typeof RumLongTaskEntryType.LONG_ANIMATION_FRAME
    duration: ServerDuration
    blocking_duration: ServerDuration
    first_ui_event_timestamp: ServerDuration
    render_start: ServerDuration
    style_and_layout_start: ServerDuration
    start_time: ServerDuration
    scripts: Array<{
      duration: ServerDuration
      pause_duration: ServerDuration
      forced_style_and_layout_duration: ServerDuration
      start_time: ServerDuration
      execution_start: ServerDuration
      source_url: string
      source_function_name: string
      source_char_position: number
      invoker: string
      invoker_type: InvokerType
      window_attribution: string
    }>
  }
  _dd: {
    discarded: boolean
  }
}

export interface RawRumActionEvent {
  date: TimeStamp
  type: typeof RumEventType.ACTION
  action: {
    id: string
    type: ActionType
    loading_time?: ServerDuration
    frustration?: {
      type: FrustrationType[]
    }
    error?: Count
    long_task?: Count
    resource?: Count
    target: {
      name: string
    }
  }
  view?: {
    in_foreground: boolean
  }
  _dd?: {
    action?: {
      target?: {
        selector?: string
        width?: number
        height?: number
      }
      name_source?: string
      position?: {
        x: number
        y: number
      }
      pointer_up_delay?: Duration
    }
  }
  context?: Context
}

export const ActionType = {
  CLICK: 'click',
  CUSTOM: 'custom',
} as const

export type ActionType = (typeof ActionType)[keyof typeof ActionType]

export const FrustrationType = {
  RAGE_CLICK: 'rage_click',
  ERROR_CLICK: 'error_click',
  DEAD_CLICK: 'dead_click',
} as const

export type FrustrationType = (typeof FrustrationType)[keyof typeof FrustrationType]

export interface RawRumVitalEvent {
  date: TimeStamp
  type: typeof RumEventType.VITAL
  vital: {
    id: string
    name: string
    type: VitalType
    description?: string
    duration: number
  }
  _dd?: {
    vital: {
      computed_value: true
    }
  }
  context?: Context
}

export const VitalType = {
  DURATION: 'duration',
} as const

export type VitalType = (typeof VitalType)[keyof typeof VitalType]

export type RawRumEvent =
  | RawRumErrorEvent
  | RawRumResourceEvent
  | RawRumViewEvent
  | RawRumLongTaskEvent
  | RawRumLongAnimationFrameEvent
  | RawRumActionEvent
  | RawRumVitalEvent
