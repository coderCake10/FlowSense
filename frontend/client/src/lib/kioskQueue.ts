/* Kiosk destination queue: an ordered, duplicate-free list of stops. Pure
 * functions so the kiosk's queue rules are unit-testable without React. */
import type { Destination } from "@/data/navigation";

export function isQueued(queue: readonly Destination[], id: string) {
  return queue.some(item => item.id === id);
}

/** Appends `destination` unless it is already queued (order is preserved). */
export function addToQueue(
  queue: readonly Destination[],
  destination: Destination
) {
  return isQueued(queue, destination.id) ? [...queue] : [...queue, destination];
}

export function removeFromQueue(queue: readonly Destination[], id: string) {
  return queue.filter(item => item.id !== id);
}

/** The stop to offer after finishing `currentId`: the first other queued stop. */
export function nextStop(
  queue: readonly Destination[],
  currentId: string | null
) {
  return queue.find(item => item.id !== currentId) ?? null;
}

/**
 * Queue to run when Navigate is pressed (architecture notes, Kiosk →
 * Interactive 3D Map): an empty queue becomes just the selected destination;
 * a selected destination not yet queued is appended so it isn't dropped.
 */
export function activateQueue(
  queue: readonly Destination[],
  selected: Destination | null
) {
  return selected ? addToQueue(queue, selected) : [...queue];
}
