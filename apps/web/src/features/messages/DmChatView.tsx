/**
 * DmChatView — Phase 6 real DM conversation surface (MSG-01, MSG-02, MSG-03, MSG-04, D-31, D-32).
 *
 * Replaces DmScreenStub from Phase 5. Uses the shared Phase 6 primitives:
 *   - MessageTimeline for chronological history
 *   - MessageComposer for send / reply actions
 *
 * Access-denied semantics preserved (D-31):
 *   - If `conversationId` is null the conversation has not been opened yet; initiateDm is called
 *     automatically to create/retrieve the dm_conversations row and check eligibility.
 *   - If `frozen=true` the conversation is read-only (D-32); history still loads but composer
 *     shows the frozen warning.
 *   - If `ineligibleReason` is set the conversation cannot be started at all; show the appropriate
 *     error state from Phase 5 UX.
 *
 * WebSocket realtime: Phase 6 does not implement WS subscription here; the server pushes
 * new messages via AppGateway but the client in Phase 6 uses polling-on-focus as a lightweight
 * placeholder until Phase 7 adds proper subscriptions. (D-34: WS owns fanout; this view is the
 * REST consumer for now.)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getDmHistory,
  sendDmMessage,
  editDmMessage,
  initiateDm,
  type MessageView,
  type MessageHistoryRange,
  type ReplyPreview,
} from "../../lib/api";
import { MessageTimeline } from "./MessageTimeline";
import { MessageComposer } from "./MessageComposer";

interface DmChatViewProps {
  /** ID of the other participant. */
  partnerId: string;
  /** Display name for the other participant. */
  partnerUsername: string;
  /** Current user's ID (needed for edit visibility). */
  currentUserId: string;
  /**
   * If already known from Phase 5 DmConversation record, pass it here to avoid
   * an extra POST to initiateDm. DmChatView will call initiateDm itself if null.
   */
  conversationId?: string | null;
}

export function DmChatView({
  partnerId,
  partnerUsername,
  currentUserId,
  conversationId: initialConversationId = null,
}: DmChatViewProps) {
  const [conversationId, setConversationId] = useState<string | null>(
    initialConversationId,
  );
  const [frozen, setFrozen] = useState(false);
  const [ineligibleReason, setIneligibleReason] = useState<
    "not_friends" | "ban_exists" | null
  >(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [initLoading, setInitLoading] = useState(!initialConversationId);

  const [messages, setMessages] = useState<MessageView[]>([]);
  const [range, setRange] = useState<MessageHistoryRange | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const [replyTo, setReplyTo] = useState<ReplyPreview | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  // Scroll-to-bottom ref
  const bottomRef = useRef<HTMLDivElement>(null);

  // ── Step 1: open / retrieve the dm_conversations row ──────────────────────
  useEffect(() => {
    if (initialConversationId) {
      setConversationId(initialConversationId);
      setInitLoading(false);
      return;
    }

    let cancelled = false;

    async function openConversation() {
      setInitLoading(true);
      setInitError(null);
      try {
        const result = await initiateDm(partnerId);
        if (!cancelled) {
          if (!result.eligible) {
            // Server says not eligible but still returns the conversation row
            setConversationId(result.conversation.id);
            setFrozen(result.conversation.frozen);
            // If frozen due to ban, derive reason from frozen flag
            if (result.conversation.frozen) {
              setIneligibleReason("ban_exists");
            } else {
              setIneligibleReason("not_friends");
            }
          } else {
            setConversationId(result.conversation.id);
            setFrozen(result.conversation.frozen);
          }
        }
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Could not open conversation";
          // Translate known server reason codes to clean UI states.
          if (msg.includes("not_friends")) {
            setIneligibleReason("not_friends");
          } else {
            // Unknown error — show the raw message as a fallback.
            setInitError(msg);
          }
        }
      } finally {
        if (!cancelled) setInitLoading(false);
      }
    }

    void openConversation();
    return () => {
      cancelled = true;
    };
  }, [partnerId, initialConversationId]);

  // ── Step 2: load history once conversation is known ───────────────────────
  const loadHistory = useCallback(
    async (opts?: { beforeWatermark?: number }) => {
      if (!conversationId) return;
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const result = await getDmHistory(conversationId, opts);
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
    [conversationId],
  );

  useEffect(() => {
    if (!conversationId) return;
    setMessages([]);
    setRange(null);
    void loadHistory();
  }, [conversationId, loadHistory]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleSend(content: string, replyToId: string | null) {
    if (!conversationId) return;
    const result = await sendDmMessage(conversationId, {
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
    if (!conversationId) return;
    setEditSaving(true);
    try {
      const result = await editDmMessage(conversationId, messageId, {
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

  if (initLoading) {
    return (
      <div className="rooms-view">
        <div className="rooms-view__header">
          <h2>{partnerUsername}</h2>
        </div>
        <div className="rooms-view__body">
          <p className="rooms-loading">Opening conversation…</p>
        </div>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="rooms-view">
        <div className="rooms-view__header">
          <h2>{partnerUsername}</h2>
        </div>
        <div className="rooms-view__body">
          <p className="error-msg">{initError}</p>
        </div>
      </div>
    );
  }

  if (ineligibleReason === "not_friends") {
    return (
      <div className="rooms-view">
        <div className="rooms-view__header">
          <h2>{partnerUsername}</h2>
        </div>
        <div className="rooms-view__body">
          <p className="rooms-empty">Add as friend to start messaging.</p>
        </div>
      </div>
    );
  }

  if (ineligibleReason === "ban_exists" && !frozen) {
    return (
      <div className="rooms-view">
        <div className="rooms-view__header">
          <h2>{partnerUsername}</h2>
        </div>
        <div className="rooms-view__body">
          <p className="rooms-empty">This user has restricted contact with you.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rooms-view rooms-view--chat">
      <div className="rooms-view__header">
        <h2>{partnerUsername}</h2>
        {frozen && (
          <span className="rooms-badge rooms-badge--private">read-only</span>
        )}
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
          onReply={frozen ? undefined : handleReply}
          onStartEdit={frozen ? undefined : handleStartEdit}
          onSaveEdit={handleSaveEdit}
          onCancelEdit={() => setEditingMessageId(null)}
          onLoadOlder={handleLoadOlder}
          loadingOlder={loadingOlder}
        />
        <div ref={bottomRef} />
      </div>

      <div className="rooms-view__composer">
        <MessageComposer
          readOnly={frozen}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          onSend={handleSend}
        />
      </div>
    </div>
  );
}
