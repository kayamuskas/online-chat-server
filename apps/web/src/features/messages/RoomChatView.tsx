/**
 * RoomChatView — Phase 6 real room conversation surface (MSG-01..04, MSG-08, D-30, D-33, D-35).
 *
 * Conversation-agnostic primitives (MessageTimeline + MessageComposer) are shared
 * with DmChatView so room chat and DM chat feel like the same engine (D-21, D-35).
 *
 * Access control:
 *   - Sending requires current membership and no active room ban (D-30).
 *   - Membership is not validated client-side; the server rejects unauthorised sends.
 *
 * Transport:
 *   - REST owns initial history load, send/edit mutations, and load-older pagination (D-33).
 *   - WebSocket realtime fanout is handled server-side; the client in Phase 6 uses the
 *     REST history endpoint for the initial load; full WS subscription comes in Phase 7.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getRoomHistory,
  sendRoomMessage,
  editRoomMessage,
  type MessageView,
  type MessageHistoryRange,
  type ReplyPreview,
} from "../../lib/api";
import { MessageTimeline } from "./MessageTimeline";
import { MessageComposer } from "./MessageComposer";
import { useSocket } from "../socket/SocketProvider";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapWsMessage(raw: any): MessageView {
  const msg = raw.message ?? raw;
  const rp = msg.reply_preview ?? msg.replyPreview;

  return {
    id: msg.id,
    conversationType: raw.conversation_type ?? msg.conversation_type ?? msg.conversationType,
    conversationId: raw.conversation_id ?? msg.conversation_id ?? msg.conversationId,
    authorId: msg.author_id ?? msg.authorId,
    authorUsername: msg.author_username ?? msg.authorUsername ?? "",
    content: msg.content,
    replyToId: msg.reply_to_id ?? msg.replyToId ?? null,
    replyPreview: rp
      ? {
          id: rp.id,
          authorUsername: rp.author_username ?? rp.authorUsername,
          contentSnippet: rp.content_preview ?? rp.contentSnippet,
        }
      : null,
    editedAt: msg.edited_at ?? msg.editedAt ?? null,
    createdAt: msg.created_at ?? msg.createdAt,
    conversationWatermark: Number(
      msg.conversation_watermark ?? msg.conversationWatermark,
    ),
  };
}

function mergeMessages(
  current: MessageView[],
  incoming: MessageView[],
): MessageView[] {
  const byId = new Map(current.map((message) => [message.id, message]));

  for (const message of incoming) {
    const existing = byId.get(message.id);
    byId.set(
      message.id,
      existing
        ? {
            ...existing,
            ...message,
            authorUsername: message.authorUsername || existing.authorUsername,
            replyPreview: message.replyPreview ?? existing.replyPreview,
          }
        : message,
    );
  }

  return Array.from(byId.values()).sort(
    (a, b) => a.conversationWatermark - b.conversationWatermark,
  );
}

interface RoomChatViewProps {
  /** Room ID for the conversation. */
  roomId: string;
  /** Display name shown in the header. */
  roomName: string;
  /** Current user's ID (needed for edit-button visibility). */
  currentUserId: string;
  /** Called when user wants to go back to the room list. */
  onBack?: () => void;
}

export function RoomChatView({
  roomId,
  roomName,
  currentUserId,
  onBack,
}: RoomChatViewProps) {
  const [messages, setMessages] = useState<MessageView[]>([]);
  const [range, setRange] = useState<MessageHistoryRange | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const [replyTo, setReplyTo] = useState<ReplyPreview | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const socket = useSocket();

  const loadHistory = useCallback(
    async (opts?: { beforeWatermark?: number }) => {
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const result = await getRoomHistory(roomId, opts);
        setMessages((prev) =>
          opts?.beforeWatermark
            ? [...result.messages, ...prev]
            : result.messages,
        );
        setRange(result.range);
      } catch (e) {
        setHistoryError(e instanceof Error ? e.message : "Failed to load messages");
      } finally {
        setHistoryLoading(false);
      }
    },
    [roomId],
  );

  useEffect(() => {
    setMessages([]);
    setRange(null);
    setReplyTo(null);
    setEditingMessageId(null);
    setHasNewMessages(false);
    void loadHistory();
  }, [roomId, loadHistory]);

  const scheduleReconnectRefetch = useCallback(() => {
    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current);
    }

    reconnectTimerRef.current = window.setTimeout(async () => {
      try {
        const result = await getRoomHistory(roomId);
        setRange(result.range);
        setMessages((prev) => {
          const merged = mergeMessages(prev, result.messages);
          if (merged.length > prev.length) {
            setHasNewMessages(true);
          }
          return merged;
        });
      } catch {
        // silent reconnect recovery per phase plan
      }
    }, 500);
  }, [roomId]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    function onMessageCreated(payload: unknown) {
      const nextMessage = mapWsMessage(payload);
      if (
        nextMessage.conversationType !== "room" ||
        nextMessage.conversationId !== roomId
      ) {
        return;
      }

      setMessages((prev) => {
        const merged = mergeMessages(prev, [nextMessage]);
        if (merged.length > prev.length) {
          setHasNewMessages(true);
        }
        return merged;
      });
      setRange((prev) =>
        prev
          ? {
              ...prev,
              lastWatermark: Math.max(
                prev.lastWatermark,
                nextMessage.conversationWatermark,
              ),
              totalCount: prev.totalCount + 1,
            }
          : prev,
      );
    }

    function onMessageEdited(payload: unknown) {
      const nextMessage = mapWsMessage(payload);
      if (
        nextMessage.conversationType !== "room" ||
        nextMessage.conversationId !== roomId
      ) {
        return;
      }

      setMessages((prev) =>
        prev.map((message) =>
          message.id === nextMessage.id
            ? {
                ...message,
                content: nextMessage.content,
                replyToId: nextMessage.replyToId,
                editedAt: nextMessage.editedAt,
                createdAt: nextMessage.createdAt,
                conversationWatermark: nextMessage.conversationWatermark,
              }
            : message,
        ),
      );
    }

    function onReconnect() {
      socket.emit("joinRoom", { roomId });
      scheduleReconnectRefetch();
    }

    socket.emit("joinRoom", { roomId });
    socket.on("message-created", onMessageCreated);
    socket.on("message-edited", onMessageEdited);
    socket.io.on("reconnect", onReconnect);

    return () => {
      socket.emit("leaveRoom", { roomId });
      socket.off("message-created", onMessageCreated);
      socket.off("message-edited", onMessageEdited);
      socket.io.off("reconnect", onReconnect);
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [roomId, scheduleReconnectRefetch, socket]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleSend(content: string, replyToId: string | null) {
    const result = await sendRoomMessage(roomId, {
      content,
      ...(replyToId ? { replyToId } : {}),
    });
    setMessages((prev) => mergeMessages(prev, [result.message]));
    setRange((prev) =>
      prev
        ? { ...prev, lastWatermark: result.message.conversationWatermark }
        : null,
    );
    setReplyTo(null);
    setHasNewMessages(false);
  }

  function handleReply(msg: MessageView) {
    setReplyTo({
      id: msg.id,
      authorUsername: msg.authorUsername,
      contentSnippet:
        msg.content.length > 80 ? msg.content.slice(0, 80) + "…" : msg.content,
    });
    setEditingMessageId(null);
  }

  function handleStartEdit(msg: MessageView) {
    setEditingMessageId(msg.id);
    setReplyTo(null);
  }

  async function handleSaveEdit(messageId: string, newContent: string) {
    setEditSaving(true);
    try {
      const result = await editRoomMessage(roomId, messageId, {
        content: newContent,
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? result.message : m)),
      );
      setEditingMessageId(null);
    } finally {
      setEditSaving(false);
    }
  }

  async function handleLoadOlder() {
    if (!range?.hasMoreBefore) return;
    setLoadingOlder(true);
    try {
      await loadHistory({ beforeWatermark: range.firstWatermark });
    } finally {
      setLoadingOlder(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="rooms-view rooms-view--chat">
      <div className="rooms-view__header">
        {onBack && (
          <button
            type="button"
            className="btn btn--soft btn--xs"
            onClick={onBack}
            aria-label="Back to rooms"
          >
            &#8592; Back
          </button>
        )}
        <h2>{roomName}</h2>
      </div>

      <div className="rooms-view__body rooms-view__body--scroll">
        {historyError && <p className="error-msg">{historyError}</p>}
        {historyLoading && messages.length === 0 && (
          <p className="rooms-loading">Loading messages…</p>
        )}

        <MessageTimeline
          messages={messages}
          range={range}
          currentUserId={currentUserId}
          editingMessageId={editingMessageId}
          editSaving={editSaving}
          onReply={handleReply}
          onStartEdit={handleStartEdit}
          onSaveEdit={handleSaveEdit}
          onCancelEdit={() => setEditingMessageId(null)}
          onLoadOlder={handleLoadOlder}
          loadingOlder={loadingOlder}
          hasNewMessages={hasNewMessages}
          onScrollToBottom={() => setHasNewMessages(false)}
        />
      </div>

      <div className="rooms-view__composer">
        <MessageComposer
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          onSend={handleSend}
        />
      </div>
    </div>
  );
}
