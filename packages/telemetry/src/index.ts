/** Structured telemetry event for ConnectIO-RAD V2. */
export interface TelemetryEvent {
  readonly name: string
  readonly workspaceId?: string
  readonly domainId?: string
  readonly panelId?: string
  readonly userId?: string
  readonly properties?: Record<string, string | number | boolean | null>
  readonly timestamp: string
}

type TelemetryHandler = (event: TelemetryEvent) => void

let handler: TelemetryHandler = () => {
  // noop by default — replace in apps/web before mounting
}

/** Register a global telemetry handler (called once on app init). */
export function registerTelemetryHandler(h: TelemetryHandler): void {
  handler = h
}

/** Track a named event with optional properties. */
export function trackEvent(
  name: string,
  properties?: Omit<TelemetryEvent, 'name' | 'timestamp'>,
): void {
  handler({ name, ...properties, timestamp: new Date().toISOString() })
}
