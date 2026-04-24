/**
 * MessageTimeline — Phase 6 chronological message list (MSG-01, MSG-03, MSG-04, MSG-08, D-25).
 *
 * Conversation-agnostic: works for both room and DM data shapes.
 * Renders messages in watermark order (ascending — oldest at top, newest at bottom).
 *
 * Features:
 *   - Reply chip rendering using replyPreview data from MessageView
 *   - "edited" marker for messages where editedAt is set (D-25)
 *   - Per-message Reply and Edit action buttons; Edit shown only for currentUserId's messages
 *   - Lightweight "load older" affordance when range.hasMoreBefore=true (MSG-08/D-29)
 *   - Watermark gap state is exposed via onLoadOlder callback for parent to wire
 *   - No infinite scroll polish — Phase 9 will build on top of this contract
 */

import { Fragment, forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { MessageView, MessageHistoryRange } from "../../lib/api";
import { attachmentDownloadUrl } from "../../lib/api";
import { MessageEditor } from "./MessageEditor";

interface MessageTimelineProps {
  /** Stable identifier for resetting per-conversation scroll anchoring state. */
  conversationKey: string;
  /** Messages to display in chronological order (ascending watermark). */
  messages: MessageView[];
  /** Watermark range metadata from the last history response. */
  range: MessageHistoryRange | null;
  /** Unread count snapshot captured when the conversation was opened. */
  initialUnreadCount?: number;
  /** Currently authenticated user's ID (used to show Edit button only for own messages). */
  currentUserId: string;
  /** ID of the message currently being edited (controlled from parent). */
  editingMessageId?: string | null;
  /** True while a save-edit request is in flight. */
  editSaving?: boolean;
  /** Called when user clicks the Reply button on a message. */
  onReply?: (message: MessageView) => void;
  /** Called when user clicks the Edit button on their own message. */
  onStartEdit?: (message: MessageView) => void;
  /** Called when user confirms an edit. */
  onSaveEdit?: (messageId: string, newContent: string) => void;
  /** Called when user cancels an in-progress edit. */
  onCancelEdit?: () => void;
  /** Called when user clicks Delete on a message. */
  onDelete?: (message: MessageView) => void;
  /** True if current user can delete any message (admin/owner in room context). */
  canDeleteAny?: boolean;
  /** Called when user wants to load older messages (cursor: range.firstWatermark). */
  onLoadOlder?: () => void;
  /** True while older messages are being fetched. */
  loadingOlder?: boolean;
  /** True when unseen realtime messages arrived while user was scrolled up. */
  hasNewMessages?: boolean;
  /** Clears parent unseen-message state once the user reaches the bottom again. */
  onScrollToBottom?: () => void;
}

/**
 * Maps a file extension to a short type label for display in attachment cards.
 */
function getFileTypeIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    doc: 'DOC', docx: 'DOC', pdf: 'PDF', txt: 'TXT',
    png: 'IMG', jpg: 'IMG', jpeg: 'IMG', gif: 'IMG', webp: 'IMG', svg: 'IMG',
    zip: 'ZIP', tar: 'ZIP', gz: 'ZIP', rar: 'ZIP',
    mp3: 'AUD', wav: 'AUD', mp4: 'VID', mov: 'VID',
    xls: 'XLS', xlsx: 'XLS', csv: 'CSV',
  };
  return map[ext] ?? 'FILE';
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Formats a message timestamp for display.
 * Shows time only for today; falls back to date + time for older messages.
 */
function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (isToday) {
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export interface MessageTimelineHandle {
  scrollToBottom: () => void;
}

export const MessageTimeline = forwardRef<MessageTimelineHandle, MessageTimelineProps>(function MessageTimeline({
  conversationKey,
  messages,
  range,
  initialUnreadCount = 0,
  currentUserId,
  editingMessageId = null,
  editSaving = false,
  onReply,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  canDeleteAny = false,
  onLoadOlder,
  loadingOlder = false,
  hasNewMessages = false,
  onScrollToBottom,
}: MessageTimelineProps, ref) {
  const hasMoreBefore = range?.hasMoreBefore ?? false;
  const scrollRef = useRef<HTMLDivElement>(null);
  const previousMessageCountRef = useRef(messages.length);
  const jumpToTopAfterOlderRef = useRef(false);
  const initialAnchorAppliedRef = useRef(false);
  const unreadDividerRef = useRef<HTMLLIElement>(null);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [initialUnreadMessageId, setInitialUnreadMessageId] = useState<string | null>(null);
  const handleScrollRef = useRef<() => void>(null!);

  useEffect(() => {
    previousMessageCountRef.current = 0;
    jumpToTopAfterOlderRef.current = false;
    initialAnchorAppliedRef.current = false;
    setIsScrolledUp(false);
    setInitialUnreadMessageId(null);
  }, [conversationKey]);

  useEffect(() => {
    if (initialUnreadMessageId || initialUnreadCount <= 0 || messages.length === 0) {
      return;
    }

    const clampedUnreadCount = Math.min(initialUnreadCount, messages.length);
    const firstUnreadIndex = Math.max(0, messages.length - clampedUnreadCount);
    setInitialUnreadMessageId(messages[firstUnreadIndex]?.id ?? null);
  }, [initialUnreadCount, initialUnreadMessageId, messages]);

  // Attach a native scroll listener once on mount so wheel events reliably
  // update isScrolledUp regardless of React's synthetic event batching.
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const handler = () => handleScrollRef.current?.();
    node.addEventListener("scroll", handler, { passive: true });
    return () => node.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    const node = scrollRef.current;
    const nextCount = messages.length;
    const previousCount = previousMessageCountRef.current;

    if (!node || nextCount === 0) {
      previousMessageCountRef.current = nextCount;
      return;
    }

    if (!initialAnchorAppliedRef.current) {
      // Wait until unread anchor id is resolved so we don't jump to bottom first.
      if (initialUnreadCount > 0 && !initialUnreadMessageId) {
        previousMessageCountRef.current = nextCount;
        return;
      }

      if (initialUnreadMessageId) {
        unreadDividerRef.current?.scrollIntoView({
          block: "start",
          behavior: "instant",
        });
        setIsScrolledUp(true);
      } else {
        node.scrollTo({
          top: node.scrollHeight,
          behavior: "instant",
        });
        onScrollToBottom?.();
      }
      initialAnchorAppliedRef.current = true;
      previousMessageCountRef.current = nextCount;
      return;
    }

    if (jumpToTopAfterOlderRef.current && nextCount > previousCount) {
      node.scrollTop = 0;
      // A second write on the next frame avoids browser scroll anchoring
      // snapping us back near the old viewport after prepend.
      window.requestAnimationFrame(() => {
        const nextNode = scrollRef.current;
        if (nextNode) {
          nextNode.scrollTop = 0;
        }
      });
      jumpToTopAfterOlderRef.current = false;
    } else if (nextCount > previousCount) {
      if (!isScrolledUp) {
        node?.scrollTo({
          top: node.scrollHeight,
          behavior: "instant",
        });
        onScrollToBottom?.();
      }
    }

    previousMessageCountRef.current = nextCount;
  }, [initialUnreadMessageId, isScrolledUp, messages.length, onScrollToBottom]);

  useEffect(() => {
    if (!loadingOlder) {
      jumpToTopAfterOlderRef.current = false;
    }
  }, [loadingOlder, messages.length]);

  // Keep ref in sync every render so the native listener always calls the latest closure.
  handleScrollRef.current = handleScroll;

  function handleScroll() {
    const node = scrollRef.current;
    if (!node) {
      return;
    }

    const nextIsScrolledUp =
      node.scrollHeight - node.scrollTop - node.clientHeight > 100;

    setIsScrolledUp(nextIsScrolledUp);

    if (!nextIsScrolledUp && hasNewMessages) {
      onScrollToBottom?.();
    }
  }

  function handleScrollToBottom() {
    const node = scrollRef.current;
    if (!node) {
      return;
    }

    node.scrollTo({
      top: node.scrollHeight,
      behavior: "smooth",
    });
    setIsScrolledUp(false);
    onScrollToBottom?.();
  }

  useImperativeHandle(ref, () => ({ scrollToBottom: handleScrollToBottom }));

  return (
    <div
      ref={scrollRef}
      className="msg-timeline"
      role="log"
      aria-live="polite"
      aria-label="Message history"
      onScroll={handleScroll}
      style={{ position: "relative", overflowY: "auto", flex: 1, minHeight: 0 }}
    >
      {(hasMoreBefore || loadingOlder) && (
        <div className="msg-timeline__history-status" aria-live="polite">
          {loadingOlder ? (
            <span>Loading earlier messages…</span>
          ) : (
            <button
              type="button"
              className="msg-timeline__history-status__btn"
              onClick={() => {
                const node = scrollRef.current;
                if (!node || !hasMoreBefore || loadingOlder) return;
                jumpToTopAfterOlderRef.current = true;
                onLoadOlder?.();
              }}
            >
              Scroll up for earlier messages
            </button>
          )}
        </div>
      )}

      {messages.length === 0 && !loadingOlder && (
        <p className="msg-timeline__empty">No messages yet. Say hello!</p>
      )}

      <ul className="msg-timeline__list">
        {messages.map((msg) => {
          const isOwn = msg.authorId === currentUserId;
          const isEditing = editingMessageId === msg.id;
          const showUnreadDivider = initialUnreadMessageId === msg.id;

          return (
            <Fragment key={msg.id}>
              {showUnreadDivider && (
                <li
                  ref={unreadDividerRef}
                  className="msg-timeline__divider"
                  aria-label="Start of new messages"
                >
                  <span>new &#8595;</span>
                </li>
              )}
              <li
                className={`msg-bubble${isOwn ? " msg-bubble--own" : ""}`}
                data-watermark={msg.conversationWatermark}
              >
              {/* Reply chip */}
              {msg.replyPreview && (
                <div className="msg-bubble__reply-chip" aria-label="Replying to">
                  <span className="msg-bubble__reply-author">
                    {msg.replyPreview.authorUsername}
                  </span>
                  <span className="msg-bubble__reply-snippet">
                    {msg.replyPreview.contentSnippet}
                  </span>
                </div>
              )}

              {/* Message header */}
              <div className="msg-bubble__header">
                <span className="msg-bubble__author">{msg.authorUsername}</span>
                <span className="msg-bubble__time">{formatTimestamp(msg.createdAt)}</span>
                {msg.editedAt && (
                  <span className="msg-bubble__edited" title={`Edited ${formatTimestamp(msg.editedAt)}`}>
                    edited
                  </span>
                )}
              </div>

              {/* Message body or inline editor */}
              {isEditing ? (
                <MessageEditor
                  initialContent={msg.content}
                  saving={editSaving}
                  onSave={(newContent) => onSaveEdit?.(msg.id, newContent)}
                  onCancel={() => onCancelEdit?.()}
                />
              ) : (
                <div className="msg-bubble__content">
                  {msg.content.split("\n").map((line, i) => (
                    // Each line rendered as a separate paragraph for multiline support
                    // Key is stable because lines in a single message don't reorder
                    <span key={i}>
                      {line}
                      {i < msg.content.split("\n").length - 1 && <br />}
                    </span>
                  ))}
                </div>
              )}

              {/* Attachment cards */}
              {msg.attachments && msg.attachments.length > 0 && (
                <div className="msg-attachments">
                  {msg.attachments.map((att) => (
                    <div key={att.id} className="attachment">
                      <div className="attachment__icon">{getFileTypeIcon(att.originalFilename)}</div>
                      <div className="attachment__info">
                        <div className="attachment__name">{att.originalFilename}</div>
                        <div className="attachment__meta">
                          {formatFileSize(att.fileSize)}
                          {att.comment && ` · ${att.comment}`}
                        </div>
                      </div>
                      <a
                        href={attachmentDownloadUrl(att.id)}
                        className="btn btn--soft btn--xs"
                        download={att.originalFilename}
                        target="_blank"
                        rel="noopener"
                      >
                        Download
                      </a>
                    </div>
                  ))}
                </div>
              )}

              {/* Per-message actions */}
              {!isEditing && (
                <div className="msg-bubble__actions">
                  {onReply && (
                    <button
                      type="button"
                      className="msg-bubble__action"
                      onClick={() => onReply(msg)}
                      aria-label="Reply to this message"
                    >
                      Reply
                    </button>
                  )}
                  {isOwn && onStartEdit && (
                    <button
                      type="button"
                      className="msg-bubble__action"
                      onClick={() => onStartEdit(msg)}
                      aria-label="Edit your message"
                    >
                      Edit
                    </button>
                  )}
                  {(isOwn || canDeleteAny) && onDelete && (
                    <button
                      type="button"
                      className="msg-bubble__action msg-bubble__action--delete"
                      onClick={() => onDelete(msg)}
                      aria-label="Delete this message"
                    >
                      Delete
                    </button>
                  )}
                </div>
              )}
              </li>
            </Fragment>
          );
        })}
      </ul>

      {isScrolledUp && hasNewMessages && (
        <div className="msg-timeline__new-messages">
          <button
            type="button"
            className="msg-timeline__new-messages-btn"
            onClick={handleScrollToBottom}
          >
            &#8595; New messages
          </button>
        </div>
      )}
    </div>
  );
});
