/**
 * Delete Timers - In-Memory Scheduler for Empty Voice Channels
 * When a voice room becomes empty, we schedule it for deletion after a delay.
 * Timers are lost on bot restart; startup recovery re-schedules empty channels.
 */
const deleteTimers = new Map<string, NodeJS.Timeout>();

/** Schedule a channel for deletion; cancels any existing timer for that channel. */
export function scheduleDelete(
  voiceChannelId: string,
  delayMs: number,
  callback: () => void | Promise<void>
): void {
  cancelDelete(voiceChannelId);
  const timer = setTimeout(async () => {
    deleteTimers.delete(voiceChannelId);
    await callback();
  }, delayMs);
  deleteTimers.set(voiceChannelId, timer);
}

/** Cancel a scheduled deletion (e.g. when someone joins). */
export function cancelDelete(voiceChannelId: string): void {
  const existing = deleteTimers.get(voiceChannelId);
  if (existing) {
    clearTimeout(existing);
    deleteTimers.delete(voiceChannelId);
  }
}

/** Check if a channel has a delete timer pending. */
export function hasDeleteTimer(voiceChannelId: string): boolean {
  return deleteTimers.has(voiceChannelId);
}
