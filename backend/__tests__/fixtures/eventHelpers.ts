import { MessageBus } from '../../src/services/MessageBus';

/**
 * Subscribe to a single domain event emitted via MessageBus.broadcast().
 *
 * Services publish domain events with `messageBus.broadcast({ event, ... })`,
 * which delivers ONE envelope on the 'broadcast' channel with the original
 * payload nested under `envelope.content` and the event name at
 * `envelope.content.event`. There is no per-event channel, so a test cannot
 * subscribe with `messageBus.on('<event>', ...)` — nothing emits on that
 * channel. This helper mirrors how the services themselves consume events:
 * listen on 'broadcast', match the event name, and hand the raw payload to the
 * caller.
 *
 * @param messageBus the bus to subscribe on
 * @param event the event name to match (e.g. 'agent:registered')
 * @param handler invoked with the event payload when a matching event arrives
 * @returns an unsubscribe function
 */
export function onBroadcastEvent(
  messageBus: MessageBus,
  event: string,
  handler: (payload: any) => void
): () => void {
  const listener = (envelope: any) => {
    const payload = envelope?.content ?? envelope;
    if (payload?.event === event) {
      handler(payload);
    }
  };

  messageBus.on('broadcast', listener);
  return () => messageBus.off('broadcast', listener);
}
