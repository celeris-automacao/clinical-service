import type { Response } from "express";

/**
 * Minimal in-process pub/sub for Server-Sent Events, keyed by user id.
 *
 * This is deliberately single-process (in-memory Map) — the API server runs
 * as one process in this deployment, so there is no need for a cross-process
 * broker (Redis pub/sub etc). If the API server is ever scaled horizontally,
 * this hub only reaches clients connected to the same instance and a shared
 * broker would need to be introduced.
 */
const clientsByUserId = new Map<number, Set<Response>>();

export function subscribe(userId: number, res: Response): void {
  let set = clientsByUserId.get(userId);
  if (!set) {
    set = new Set();
    clientsByUserId.set(userId, set);
  }
  set.add(res);
}

export function unsubscribe(userId: number, res: Response): void {
  const set = clientsByUserId.get(userId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) clientsByUserId.delete(userId);
}

export type ChatEvent =
  | { type: "message"; conversationId: number }
  | { type: "read"; conversationId: number };

export function publishToUser(userId: number, event: ChatEvent): void {
  const set = clientsByUserId.get(userId);
  if (!set || set.size === 0) return;
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of set) {
    res.write(payload);
  }
}

/**
 * Separate hub for the community feed, keyed by clinic id instead of user id
 * — every clinic member sees the same broadcast feed, so there is no
 * per-recipient fanout list to resolve (unlike chat, which is 1:1).
 */
const communityClientsByClinicId = new Map<number, Set<Response>>();

export function subscribeToClinic(clinicId: number, res: Response): void {
  let set = communityClientsByClinicId.get(clinicId);
  if (!set) {
    set = new Set();
    communityClientsByClinicId.set(clinicId, set);
  }
  set.add(res);
}

export function unsubscribeFromClinic(clinicId: number, res: Response): void {
  const set = communityClientsByClinicId.get(clinicId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) communityClientsByClinicId.delete(clinicId);
}

export type CommunityEvent =
  | { type: "post" }
  | { type: "post-deleted"; postId: number }
  | { type: "comment"; postId: number }
  | { type: "comment-deleted"; postId: number }
  | { type: "like"; postId: number };

export function publishToClinic(clinicId: number, event: CommunityEvent): void {
  const set = communityClientsByClinicId.get(clinicId);
  if (!set || set.size === 0) return;
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of set) {
    res.write(payload);
  }
}
