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

import { useEffect, useRef, useState } from "react";
import type { MessageView, MessageHistoryRange } from "../../lib/api";
import { attachmentDownloadUrl } from "../../lib/api";
import { MessageEditor } from "./MessageEditor";

interface MessageTimelineProps {
  /** Messages to display in chronological order (ascending watermark). */
  messages: MessageView[];
  /** Watermark range metadata from the last history response. */
  range: MessageHistoryRange | null;
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

export function MessageTimeline({
  messages,
  range,
  currentUserId,
  editingMessageId = null,
  editSaving = false,
  onReply,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onLoadOlder,
  loadingOlder = false,
  hasNewMessages = false,
  onScrollToBottom,
}: MessageTimelineProps) {
  const hasMoreBefore = range?.hasMoreBefore ?? false;
  const scrollRef = useRef<HTMLDivElement>(null);
  const previousMessageCountRef = useRef(messages.length);
  const [isScrolledUp, setIsScrolledUp] = useState(false);

  useEffect(() => {
    const nextCount = messages.length;
    const previousCount = previousMessageCountRef.current;

    if (nextCount > previousCount) {
      if (!isScrolledUp) {
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: "smooth",
        });
        onScrollToBottom?.();
      }
    }

    previousMessageCountRef.current = nextCount;
  }, [isScrolledUp, messages.length, onScrollToBottom]);

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

  return (
    <div
      ref={scrollRef}
      className="msg-timeline"
      role="log"
      aria-live="polite"
      aria-label="Message history"
      onScroll={handleScroll}
      style={{ position: "relative", overflowY: "auto", height: "100%" }}
    >
      {/* Load older messages affordance (MSG-08, D-29) */}
      {hasMoreBefore && (
        <div className="msg-timeline__load-older">
          <button
            type="button"
            className="btn btn--soft btn--xs"
            onClick={onLoadOlder}
            disabled={loadingOlder}
          >
            {loadingOlder ? "Loading…" : "Load older messages"}
          </button>
        </div>
      )}

      {messages.length === 0 && !loadingOlder && (
        <p className="msg-timeline__empty">No messages yet. Say hello!</p>
      )}

      <ul className="msg-timeline__list">
        {messages.map((msg) => {
          const isOwn = msg.authorId === currentUserId;
          const isEditing = editingMessageId === msg.id;

          return (
            <li
              key={msg.id}
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

              {/* Attachment download links */}
              {msg.attachments && msg.attachments.length > 0 && (
                <div className="msg-attachments">
                  {msg.attachments.map((att) => (
                    <a
                      key={att.id}
                      href={attachmentDownloadUrl(att.id)}
                      className="msg-attachment-link"
                      target="_blank"
                      rel="noopener"
                      download={att.originalFilename}
                    >
                      {att.originalFilename} ({(att.fileSize / 1024).toFixed(0)} KB)
                    </a>
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
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {isScrolledUp && hasNewMessages && (
        <div
          style={{
            position: "sticky",
            bottom: "1rem",
            display: "flex",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <button
            type="button"
            className="msg-timeline__new-messages-btn"
            onClick={handleScrollToBottom}
            style={{
              pointerEvents: "auto",
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: "999px",
              padding: "0.55rem 0.9rem",
              background: "rgba(17,24,39,0.92)",
              color: "#f9fafb",
              boxShadow: "0 10px 30px rgba(15,23,42,0.28)",
            }}
          >
            &#8595; новые сообщения
          </button>
        </div>
      )}
    </div>
  );
}
