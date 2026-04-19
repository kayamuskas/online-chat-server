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

  const bottomRef = useRef<HTMLDivElement>(null);

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
    void loadHistory();
  }, [roomId, loadHistory]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleSend(content: string, replyToId: string | null) {
    const result = await sendRoomMessage(roomId, {
      content,
      ...(replyToId ? { replyToId } : {}),
    });
    setMessages((prev) => [...prev, result.message]);
    setRange((prev) =>
      prev
        ? { ...prev, lastWatermark: result.message.conversationWatermark }
        : null,
    );
    setReplyTo(null);
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
        />
        <div ref={bottomRef} />
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
