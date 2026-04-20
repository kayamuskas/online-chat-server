/**
 * Phase 3 + 4 + 5 + 6 API client — auth flows, session management, room surfaces,
 * contacts / DM policy, and messaging contracts.
 *
 * All requests are made to the NestJS API running on SERVICE_PORTS.apiHttp.
 * Credentials (session cookies) are sent with every request via credentials: "include".
 *
 * Phase 3 covers:
 *   POST   /api/v1/auth/register
 *   POST   /api/v1/auth/sign-in
 *   POST   /api/v1/auth/sign-out
 *   GET    /api/v1/auth/me
 *   POST   /api/v1/auth/change-password
 *   POST   /api/v1/auth/password-reset/request
 *   POST   /api/v1/auth/password-reset/confirm
 *   GET    /api/v1/sessions
 *   DELETE /api/v1/sessions/others
 *   DELETE /api/v1/sessions/:id
 *
 * Phase 4 room surfaces:
 *   POST   /api/v1/rooms
 *   GET    /api/v1/rooms
 *   POST   /api/v1/rooms/:id/join
 *   POST   /api/v1/rooms/:id/leave
 *   POST   /api/v1/rooms/:id/manage/invite
 *   POST   /api/v1/rooms/:id/manage/admins/:userId
 *   DELETE /api/v1/rooms/:id/manage/admins/:userId
 *   DELETE /api/v1/rooms/:id/manage/members/:userId
 *   GET    /api/v1/rooms/:id/manage/bans
 *   DELETE /api/v1/rooms/:id/manage/bans/:userId
 *
 * Phase 6 messaging surfaces:
 *   GET    /api/v1/messages/rooms/:roomId/history
 *   POST   /api/v1/messages/rooms/:roomId/messages
 *   PATCH  /api/v1/messages/rooms/:roomId/messages/:messageId
 *   GET    /api/v1/messages/dm/:conversationId/history
 *   POST   /api/v1/messages/dm/:conversationId/messages
 *   PATCH  /api/v1/messages/dm/:conversationId/messages/:messageId
 */

import { SERVICE_PORTS } from "@chat/shared";

const BASE_URL = `http://localhost:${SERVICE_PORTS.apiHttp}/api/v1`;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PublicUser {
  id: string;
  email: string;
  username: string;
  createdAt: string;
}

export interface ApiError {
  message: string;
  statusCode?: number;
}

/**
 * A session inventory item as returned by GET /api/v1/sessions.
 * Mirrors SessionInventoryItem from the API auth.types.ts.
 */
export interface SessionInventoryItem {
  sessionId: string;
  ipAddress: string | null;
  userAgent: string | null;
  lastSeenAt: string;
  createdAt: string;
  isPersistent: boolean;
  isCurrentSession: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return undefined as unknown as T;
  }

  const data = await res.json();

  if (!res.ok) {
    const msg =
      typeof data?.message === "string"
        ? data.message
        : res.statusText || "Request failed";
    const err = new Error(msg) as Error & { statusCode: number };
    err.statusCode = res.status;
    throw err;
  }

  return data as T;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "GET",
    credentials: "include",
  });

  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return undefined as unknown as T;
  }

  const data = await res.json();

  if (!res.ok) {
    const msg =
      typeof data?.message === "string"
        ? data.message
        : res.statusText || "Request failed";
    const err = new Error(msg) as Error & { statusCode: number };
    err.statusCode = res.status;
    throw err;
  }

  return data as T;
}

async function postFormData<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return undefined as unknown as T;
  }
  const data = await res.json();
  if (!res.ok) {
    const msg =
      typeof data?.message === "string"
        ? data.message
        : res.statusText || "Request failed";
    const err = new Error(msg) as Error & { statusCode: number };
    err.statusCode = res.status;
    throw err;
  }
  return data as T;
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return undefined as unknown as T;
  }

  const data = await res.json();

  if (!res.ok) {
    const msg =
      typeof data?.message === "string"
        ? data.message
        : res.statusText || "Request failed";
    const err = new Error(msg) as Error & { statusCode: number };
    err.statusCode = res.status;
    throw err;
  }

  return data as T;
}

// ── Auth API calls ────────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/register
 * Returns the newly created user. Throws on duplicate email/username (409).
 */
export async function register(params: {
  email: string;
  username: string;
  password: string;
}): Promise<{ user: PublicUser }> {
  return post("/auth/register", params);
}

/**
 * POST /api/v1/auth/sign-in
 * Issues a session cookie. Returns the authenticated user.
 */
export async function signIn(params: {
  email: string;
  password: string;
  keepSignedIn: boolean;
}): Promise<{ user: PublicUser }> {
  return post("/auth/sign-in", params);
}

/**
 * POST /api/v1/auth/sign-out
 * Invalidates the current browser session. Returns undefined (204).
 */
export async function signOut(): Promise<void> {
  return post("/auth/sign-out");
}

/**
 * GET /api/v1/auth/me
 * Returns the current authenticated user or throws 401.
 */
export async function me(): Promise<{ user: PublicUser }> {
  return get("/auth/me");
}

/**
 * POST /api/v1/auth/change-password
 * Requires current session + current password verification. Returns undefined (204).
 */
export async function changePassword(params: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  return post("/auth/change-password", params);
}

/**
 * DELETE /api/v1/auth/account
 * Permanently deletes the authenticated account. Requires password confirmation (D-10).
 */
export async function deleteAccount(params: { password: string }): Promise<void> {
  const res = await fetch(`${BASE_URL}/auth/account`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const msg = typeof data?.message === "string" ? data.message : "Deletion failed. Please try again.";
    throw Object.assign(new Error(msg), { statusCode: res.status });
  }
}

/**
 * POST /api/v1/auth/password-reset/request
 * Silently enqueues a reset mail artifact. Always returns 200.
 */
export async function requestPasswordReset(params: {
  email: string;
}): Promise<void> {
  return post("/auth/password-reset/request", params);
}

/**
 * POST /api/v1/auth/password-reset/confirm
 * Validates one-time token and updates the password.
 */
export async function confirmPasswordReset(params: {
  token: string;
  newPassword: string;
}): Promise<void> {
  return post("/auth/password-reset/confirm", params);
}

// ── Room types ────────────────────────────────────────────────────────────────

export type RoomVisibility = "public" | "private";
export type RoomRole = "owner" | "admin" | "member";
export type InviteStatus = "pending" | "accepted" | "declined" | "expired";

/** A public room catalog row as returned by GET /api/v1/rooms. */
export interface RoomCatalogRow {
  id: string;
  name: string;
  description: string | null;
  visibility: RoomVisibility;
  owner_id: string;
  member_count: number;
  created_at: string;
}

/** A full room record (e.g. after creation). */
export interface Room {
  id: string;
  name: string;
  description: string | null;
  visibility: RoomVisibility;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

/** A membership record. */
export interface RoomMembership {
  id: string;
  room_id: string;
  user_id: string;
  role: RoomRole;
  joined_at: string;
}

/** A room invite record. */
export interface RoomInvite {
  id: string;
  room_id: string;
  invited_by_user_id: string;
  invited_user_id: string;
  status: InviteStatus;
  created_at: string;
  expires_at: string | null;
}

/** A room ban record. */
export interface RoomBan {
  id: string;
  room_id: string;
  banned_user_id: string;
  banned_by_user_id: string;
  reason: string | null;
  banned_at: string;
}

export interface PrivateRoomEntry {
  room: RoomCatalogRow;
  membership: RoomMembership;
}

export interface PendingRoomInviteEntry {
  invite: RoomInvite;
  room: RoomCatalogRow;
  inviter_username: string | null;
}

// ── Room API calls ─────────────────────────────────────────────────────────────

/**
 * POST /api/v1/rooms
 * Create a new room. `name` is required; `visibility` defaults to 'public'; `description` is optional.
 * Returns the created room. Throws 409 if name is already taken.
 */
export async function createRoom(params: {
  name: string;
  description?: string | null;
  visibility?: RoomVisibility;
}): Promise<{ room: Room }> {
  return post("/rooms", params);
}

/**
 * GET /api/v1/rooms
 * List public rooms. Optional `search` matches room name and description.
 */
export async function listPublicRooms(search?: string): Promise<{ rooms: RoomCatalogRow[] }> {
  const qs = search ? `?search=${encodeURIComponent(search)}` : "";
  return get(`/rooms${qs}`);
}

/**
 * POST /api/v1/rooms/:id/join
 * Join a public room as an ordinary member. Returns the membership.
 * Throws 400 if the room is private, the user is banned, or already a member.
 */
export async function joinRoom(roomId: string): Promise<{ membership: RoomMembership }> {
  return post(`/rooms/${encodeURIComponent(roomId)}/join`);
}

/**
 * POST /api/v1/rooms/:id/leave
 * Leave a room. Throws 400 when the owner attempts to leave.
 * Returns undefined (204).
 */
export async function leaveRoom(roomId: string): Promise<void> {
  return post(`/rooms/${encodeURIComponent(roomId)}/leave`);
}

/**
 * GET /api/v1/rooms/mine/private
 * List authenticated user's private-room memberships.
 */
export async function getMyRooms(): Promise<{ rooms: PrivateRoomEntry[] }> {
  return get("/rooms/mine");
}

export async function getMyPrivateRooms(): Promise<{ rooms: PrivateRoomEntry[] }> {
  return get("/rooms/mine/private");
}

/**
 * GET /api/v1/rooms/invites/pending
 * List pending private-room invites addressed to the current user.
 */
export async function getPendingPrivateInvites(): Promise<{ invites: PendingRoomInviteEntry[] }> {
  return get("/rooms/invites/pending");
}

/**
 * POST /api/v1/rooms/:id/invites/:inviteId/accept
 * Accept a private-room invite owned by the authenticated user.
 */
export async function acceptRoomInvite(
  roomId: string,
  inviteId: string,
): Promise<{ membership: RoomMembership }> {
  return post(`/rooms/${encodeURIComponent(roomId)}/invites/${encodeURIComponent(inviteId)}/accept`);
}

/**
 * POST /api/v1/rooms/:id/invites/:inviteId/decline
 * Decline a private-room invite owned by the authenticated user.
 */
export async function declineRoomInvite(roomId: string, inviteId: string): Promise<void> {
  return post(`/rooms/${encodeURIComponent(roomId)}/invites/${encodeURIComponent(inviteId)}/decline`);
}

/**
 * POST /api/v1/rooms/:id/manage/invite
 * Invite a registered user by username. Caller must be owner or admin.
 * Returns the created invite. Throws 404 if username not found.
 */
export async function inviteToRoom(
  roomId: string,
  username: string,
): Promise<{ invite: RoomInvite }> {
  return post(`/rooms/${encodeURIComponent(roomId)}/manage/invite`, { username });
}

/**
 * POST /api/v1/rooms/:id/manage/admins/:userId
 * Promote a member to admin. Caller must be the room owner.
 */
export async function makeRoomAdmin(
  roomId: string,
  userId: string,
): Promise<{ admin: unknown }> {
  return post(`/rooms/${encodeURIComponent(roomId)}/manage/admins/${encodeURIComponent(userId)}`);
}

/**
 * DELETE /api/v1/rooms/:id/manage/admins/:userId
 * Demote an admin. Caller must be the room owner.
 * Returns undefined (204).
 */
export async function removeRoomAdmin(roomId: string, userId: string): Promise<void> {
  const res = await fetch(
    `${BASE_URL}/rooms/${encodeURIComponent(roomId)}/manage/admins/${encodeURIComponent(userId)}`,
    { method: "DELETE", credentials: "include" },
  );
  if (!res.ok && res.status !== 204) {
    const data = await res.json().catch(() => ({}));
    const msg = typeof data?.message === "string" ? data.message : res.statusText || "Request failed";
    const err = new Error(msg) as Error & { statusCode: number };
    err.statusCode = res.status;
    throw err;
  }
}

/**
 * DELETE /api/v1/rooms/:id/manage/members/:userId
 * Remove a member (modeled as ban). Caller must be owner or admin.
 * Returns undefined (204).
 */
export async function removeRoomMember(
  roomId: string,
  userId: string,
  reason?: string,
): Promise<void> {
  const res = await fetch(
    `${BASE_URL}/rooms/${encodeURIComponent(roomId)}/manage/members/${encodeURIComponent(userId)}`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: reason ? JSON.stringify({ reason }) : undefined,
    },
  );
  if (!res.ok && res.status !== 204) {
    const data = await res.json().catch(() => ({}));
    const msg = typeof data?.message === "string" ? data.message : res.statusText || "Request failed";
    const err = new Error(msg) as Error & { statusCode: number };
    err.statusCode = res.status;
    throw err;
  }
}

/**
 * GET /api/v1/rooms/:id/manage/bans
 * List banned users with metadata. Caller must be owner or admin.
 */
export async function listRoomBans(roomId: string): Promise<{ bans: RoomBan[] }> {
  return get(`/rooms/${encodeURIComponent(roomId)}/manage/bans`);
}

/**
 * DELETE /api/v1/rooms/:id
 * Permanently delete a room (owner only).
 * Returns undefined (204).
 */
export async function deleteRoom(roomId: string): Promise<void> {
  return del(`/rooms/${encodeURIComponent(roomId)}`);
}

/**
 * DELETE /api/v1/rooms/:id/manage/bans/:userId
 * Unban a user. Caller must be owner or admin.
 * Returns undefined (204).
 */
export async function unbanRoomUser(roomId: string, userId: string): Promise<void> {
  const res = await fetch(
    `${BASE_URL}/rooms/${encodeURIComponent(roomId)}/manage/bans/${encodeURIComponent(userId)}`,
    { method: "DELETE", credentials: "include" },
  );
  if (!res.ok && res.status !== 204) {
    const data = await res.json().catch(() => ({}));
    const msg = typeof data?.message === "string" ? data.message : res.statusText || "Request failed";
    const err = new Error(msg) as Error & { statusCode: number };
    err.statusCode = res.status;
    throw err;
  }
}

// ── Phase 5: Contacts domain types (inline — no shared package for these yet) ──

export interface FriendRequest {
  id: string;
  requester_id: string;
  target_id: string;
  message: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Friendship {
  id: string;
  user_a_id: string;
  user_b_id: string;
  created_at: string;
}

export interface UserBan {
  id: string;
  banner_user_id: string;
  banned_user_id: string;
  banned_username: string;
  created_at: string;
}

export interface DmConversation {
  id: string;
  user_a_id: string;
  user_b_id: string;
  frozen: boolean;
  created_at: string;
}

export interface FriendWithPresence {
  userId: string;
  username: string;
  conversationId?: string | null;
  presenceStatus?: 'online' | 'afk' | 'offline';
}

export interface IncomingFriendRequestView {
  id: string;
  requester_id: string;
  requester_username: string;
  message: string | null;
  created_at: string;
}

// ── Phase 5: Contacts and DM Policy ─────────────────────────────────────────

export async function sendFriendRequest(body: { targetUsername: string; message?: string }) {
  return post<{ request: FriendRequest }>('/contacts/requests', body);
}

export async function getIncomingRequests() {
  return get<{ requests: IncomingFriendRequestView[] }>('/contacts/requests');
}

export async function getOutgoingRequests() {
  return get<{ requests: FriendRequest[] }>('/contacts/requests/outgoing');
}

export async function acceptFriendRequest(requestId: string) {
  return post<{ friendship: Friendship }>(`/contacts/requests/${requestId}/accept`);
}

export async function declineFriendRequest(requestId: string) {
  return post<void>(`/contacts/requests/${requestId}/decline`);
}

export async function cancelFriendRequest(requestId: string) {
  return del<void>(`/contacts/requests/${requestId}`);
}

export async function getMyFriends() {
  return get<{ friends: FriendWithPresence[] }>('/contacts/friends');
}

export async function removeFriend(userId: string) {
  return del<void>(`/contacts/friends/${userId}`);
}

export async function banUser(targetUserId: string) {
  return post<void>('/contacts/bans', { targetUserId });
}

export async function getMyBans() {
  return get<{ bans: UserBan[] }>('/contacts/bans');
}

export async function unbanUser(userId: string) {
  return del<void>(`/contacts/bans/${userId}`);
}

export async function initiateDm(userId: string) {
  return post<{ conversation: DmConversation; eligible: boolean }>(`/contacts/dm/${userId}`);
}

export async function getPendingRequestCount() {
  const result = await getIncomingRequests();
  return result.requests.length;
}

// ── Phase 6: Messaging types ──────────────────────────────────────────────────

/** Reply preview embedded in a MessageView. */
export interface ReplyPreview {
  id: string;
  authorUsername: string;
  contentSnippet: string;
}

/**
 * Transform raw API MessageView (snake_case) to the frontend camelCase contract.
 * The backend serialises postgres rows directly without a camelCase transform layer.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapMessageView(raw: any): MessageView {
  const rp = raw.reply_preview ?? raw.replyPreview;
  return {
    id: raw.id,
    conversationType: raw.conversation_type ?? raw.conversationType,
    conversationId: raw.conversation_id ?? raw.conversationId,
    authorId: raw.author_id ?? raw.authorId,
    authorUsername: raw.author_username ?? raw.authorUsername,
    content: raw.content,
    replyToId: raw.reply_to_id ?? raw.replyToId ?? null,
    replyPreview: rp
      ? {
          id: rp.id,
          authorUsername: rp.author_username ?? rp.authorUsername,
          contentSnippet: rp.content_preview ?? rp.contentSnippet,
        }
      : null,
    editedAt: raw.edited_at ?? raw.editedAt ?? null,
    createdAt: raw.created_at ?? raw.createdAt,
    conversationWatermark: Number(raw.conversation_watermark ?? raw.conversationWatermark),
    attachments: Array.isArray(raw.attachments)
      ? raw.attachments.map((a: any) => ({
          id: a.id,
          originalFilename: a.original_filename ?? a.originalFilename,
          mimeType: a.mime_type ?? a.mimeType,
          fileSize: Number(a.file_size ?? a.fileSize),
          comment: a.comment ?? null,
        }))
      : [],
  };
}

/**
 * A fully-enriched message row as returned by history endpoints.
 * Mirrors MessageView from the API messages.types.ts.
 */
export interface MessageView {
  id: string;
  conversationType: 'room' | 'dm';
  conversationId: string;
  authorId: string;
  authorUsername: string;
  content: string;
  replyToId: string | null;
  replyPreview: ReplyPreview | null;
  editedAt: string | null;
  createdAt: string;
  conversationWatermark: number;
  attachments: AttachmentView[];
}

/**
 * Attachment metadata as returned by the upload endpoint and embedded in MessageView.
 */
export interface AttachmentView {
  id: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  comment: string | null;
}

/**
 * Watermark range metadata returned alongside every history page.
 * Mirrors MessageHistoryRange from the API messages.types.ts.
 */
export interface MessageHistoryRange {
  firstWatermark: number;
  lastWatermark: number;
  hasMoreBefore: boolean;
  totalCount: number;
}

/** Response shape for all history endpoints. */
export interface MessageHistoryResponse {
  messages: MessageView[];
  range: MessageHistoryRange;
}

// ── Phase 6: Messaging API calls ──────────────────────────────────────────────

/**
 * GET /api/v1/messages/rooms/:roomId/history
 * Returns paginated room message history in chronological order.
 * Optionally pass `beforeWatermark` for older-page cursor and `limit` for page size.
 */
export async function getRoomHistory(
  roomId: string,
  opts?: { beforeWatermark?: number; afterWatermark?: number; limit?: number },
): Promise<MessageHistoryResponse> {
  const params = new URLSearchParams();
  if (opts?.beforeWatermark !== undefined) {
    params.set("before_watermark", String(opts.beforeWatermark));
  }
  if (opts?.afterWatermark !== undefined) {
    params.set("after_watermark", String(opts.afterWatermark));
  }
  if (opts?.limit !== undefined) {
    params.set("limit", String(opts.limit));
  }
  const qs = params.size > 0 ? `?${params.toString()}` : "";
  const raw = await get<{ messages: unknown[]; range: MessageHistoryRange }>(
    `/messages/rooms/${encodeURIComponent(roomId)}/history${qs}`,
  );
  return { messages: raw.messages.map(mapMessageView), range: raw.range };
}

/**
 * POST /api/v1/messages/rooms/:roomId/messages
 * Send a message in a room. Returns the created MessageView.
 * `replyToId` is optional — supply to create a threaded reply.
 */
export async function sendRoomMessage(
  roomId: string,
  body: { content: string; replyToId?: string; attachmentIds?: string[] },
): Promise<{ message: MessageView }> {
  const raw = await post<{ message: unknown }>(
    `/messages/rooms/${encodeURIComponent(roomId)}/messages`,
    {
      content: body.content,
      ...(body.replyToId ? { reply_to_id: body.replyToId } : {}),
      ...(body.attachmentIds?.length ? { attachment_ids: body.attachmentIds } : {}),
    },
  );
  return { message: mapMessageView(raw.message) };
}

/**
 * PATCH /api/v1/messages/rooms/:roomId/messages/:messageId
 * Edit a room message. Only the original author may edit. Returns updated MessageView.
 */
export async function editRoomMessage(
  roomId: string,
  messageId: string,
  body: { content: string },
): Promise<{ message: MessageView }> {
  const res = await fetch(
    `${BASE_URL}/messages/rooms/${encodeURIComponent(roomId)}/messages/${encodeURIComponent(messageId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ new_content: body.content }),
    },
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const msg = typeof data?.message === "string" ? data.message : res.statusText || "Request failed";
    const err = new Error(msg) as Error & { statusCode: number };
    err.statusCode = res.status;
    throw err;
  }
  const raw = (await res.json()) as { message: unknown };
  return { message: mapMessageView(raw.message) };
}

/**
 * GET /api/v1/messages/dm/:conversationId/history
 * Returns paginated DM message history in chronological order.
 * Frozen conversations are read-only but still readable.
 */
export async function getDmHistory(
  conversationId: string,
  opts?: { beforeWatermark?: number; afterWatermark?: number; limit?: number },
): Promise<MessageHistoryResponse> {
  const params = new URLSearchParams();
  if (opts?.beforeWatermark !== undefined) {
    params.set("before_watermark", String(opts.beforeWatermark));
  }
  if (opts?.afterWatermark !== undefined) {
    params.set("after_watermark", String(opts.afterWatermark));
  }
  if (opts?.limit !== undefined) {
    params.set("limit", String(opts.limit));
  }
  const qs = params.size > 0 ? `?${params.toString()}` : "";
  const raw = await get<{ messages: unknown[]; range: MessageHistoryRange }>(
    `/messages/dm/${encodeURIComponent(conversationId)}/history${qs}`,
  );
  return { messages: raw.messages.map(mapMessageView), range: raw.range };
}

/**
 * POST /api/v1/messages/dm/:conversationId/messages
 * Send a DM message. Rejected server-side if the conversation is frozen (D-32).
 */
export async function sendDmMessage(
  conversationId: string,
  body: { content: string; replyToId?: string; attachmentIds?: string[] },
): Promise<{ message: MessageView }> {
  const raw = await post<{ message: unknown }>(
    `/messages/dm/${encodeURIComponent(conversationId)}/messages`,
    {
      content: body.content,
      ...(body.replyToId ? { reply_to_id: body.replyToId } : {}),
      ...(body.attachmentIds?.length ? { attachment_ids: body.attachmentIds } : {}),
    },
  );
  return { message: mapMessageView(raw.message) };
}

/**
 * PATCH /api/v1/messages/dm/:conversationId/messages/:messageId
 * Edit a DM message. Only the original author may edit.
 */
export async function editDmMessage(
  conversationId: string,
  messageId: string,
  body: { content: string },
): Promise<{ message: MessageView }> {
  const res = await fetch(
    `${BASE_URL}/messages/dm/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ new_content: body.content }),
    },
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const msg = typeof data?.message === "string" ? data.message : res.statusText || "Request failed";
    const err = new Error(msg) as Error & { statusCode: number };
    err.statusCode = res.status;
    throw err;
  }
  const raw = (await res.json()) as { message: unknown };
  return { message: mapMessageView(raw.message) };
}

// ── Phase 8: Message deletion ──────────────────────────────────────────────────

/**
 * DELETE /api/v1/messages/rooms/:roomId/messages/:messageId
 * Author or room admin/owner can delete (D-02).
 */
export async function deleteRoomMessage(roomId: string, messageId: string): Promise<void> {
  return del(`/messages/rooms/${encodeURIComponent(roomId)}/messages/${encodeURIComponent(messageId)}`);
}

/**
 * DELETE /api/v1/messages/dm/:conversationId/messages/:messageId
 * Only the author can delete their DM message (D-02: no admin concept in DMs).
 */
export async function deleteDmMessage(conversationId: string, messageId: string): Promise<void> {
  return del(`/messages/dm/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`);
}

// ── Phase 7: Attachments ───────────────────────────────────────────────────────

/**
 * POST /api/v1/attachments/upload
 * Upload a file as multipart/form-data. Returns the created AttachmentView.
 * D-44: Client uploads first, gets ID, then binds via sendMessage.
 */
export async function uploadAttachment(
  file: File,
  comment?: string,
): Promise<AttachmentView> {
  const fd = new FormData();
  fd.append("file", file);
  if (comment) fd.append("comment", comment);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = await postFormData<any>("/attachments/upload", fd);
  return {
    id: raw.id,
    originalFilename: raw.original_filename ?? raw.originalFilename,
    mimeType: raw.mime_type ?? raw.mimeType,
    fileSize: Number(raw.file_size ?? raw.fileSize),
    comment: raw.comment ?? null,
  };
}

/**
 * Build the download URL for an attachment. Uses the proxied download endpoint (D-49).
 */
export function attachmentDownloadUrl(attachmentId: string): string {
  return `${BASE_URL}/attachments/${encodeURIComponent(attachmentId)}/download`;
}

// ── Session management API calls ──────────────────────────────────────────────

/**
 * GET /api/v1/sessions
 * Returns the active session inventory for the current user.
 * Current session is first; isCurrentSession marks "This browser".
 */
export async function listSessions(): Promise<{ sessions: SessionInventoryItem[] }> {
  return get("/sessions");
}

/**
 * DELETE /api/v1/sessions/others
 * Signs out all other sessions. Current session is preserved. Returns undefined (204).
 */
export async function revokeOtherSessions(): Promise<void> {
  const res = await fetch(`${BASE_URL}/sessions/others`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok && res.status !== 204) {
    const data = await res.json().catch(() => ({}));
    const msg =
      typeof data?.message === "string"
        ? data.message
        : res.statusText || "Request failed";
    const err = new Error(msg) as Error & { statusCode: number };
    err.statusCode = res.status;
    throw err;
  }
}

/**
 * DELETE /api/v1/sessions/:id
 * Revokes a specific session by ID.
 * If the revoked session is the current one, the server clears the cookie.
 * Returns undefined (204).
 */
export async function revokeSession(sessionId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/sessions/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok && res.status !== 204) {
    const data = await res.json().catch(() => ({}));
    const msg =
      typeof data?.message === "string"
        ? data.message
        : res.statusText || "Request failed";
    const err = new Error(msg) as Error & { statusCode: number };
    err.statusCode = res.status;
    throw err;
  }
}
