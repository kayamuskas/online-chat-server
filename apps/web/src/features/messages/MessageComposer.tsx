/**
 * MessageComposer — Phase 6 multiline send composer (MSG-02, D-22, D-23, D-35).
 *
 * Conversation-agnostic: works for both room and DM targets. The parent passes
 * `onSend` and, optionally, the current `replyTo` state plus `onCancelReply`.
 *
 * Features:
 *   - Multiline textarea (Enter submits, Shift+Enter adds newline)
 *   - ReplyPreview chip rendered above the input when replying
 *   - Disabled when `readOnly=true` (frozen DM — D-32)
 *   - Character limit feedback at 3072 bytes (MSG-02)
 */

import { useState, useRef } from "react";
import { ReplyPreview } from "./ReplyPreview";
import type { ReplyPreview as ReplyPreviewData } from "../../lib/api";

const MAX_BYTES = 3072;

function utf8ByteLength(str: string): number {
  return new TextEncoder().encode(str).length;
}

interface MessageComposerProps {
  /** When true the textarea and send button are disabled (frozen DM). */
  readOnly?: boolean;
  /** Placeholder text shown in the textarea. */
  placeholder?: string;
  /** Pending reply target; renders a ReplyPreview chip when set. */
  replyTo?: ReplyPreviewData | null;
  /** Called when the user dismisses the reply chip. */
  onCancelReply?: () => void;
  /**
   * Called when the user submits a message.
   * `replyToId` is the ID of the message being replied to, or null.
   */
  onSend: (content: string, replyToId: string | null) => Promise<void> | void;
}

export function MessageComposer({
  readOnly = false,
  placeholder = "Write a message…",
  replyTo,
  onCancelReply,
  onSend,
}: MessageComposerProps) {
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const byteLen = utf8ByteLength(content);
  const overLimit = byteLen > MAX_BYTES;
  const canSend = !readOnly && !sending && content.trim().length > 0 && !overLimit;

  async function handleSend() {
    if (!canSend) return;
    setError(null);
    setSending(true);
    try {
      await onSend(content.trim(), replyTo?.id ?? null);
      setContent("");
      textareaRef.current?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  return (
    <div className="msg-composer">
      {replyTo && onCancelReply && (
        <ReplyPreview preview={replyTo} onCancel={onCancelReply} />
      )}

      {readOnly && (
        <p className="msg-composer__frozen">
          This conversation is read-only.
        </p>
      )}

      {error && <p className="error-msg msg-composer__error">{error}</p>}

      <div className="msg-composer__row">
        <textarea
          ref={textareaRef}
          className={`msg-composer__input field__input${overLimit ? " msg-composer__input--over" : ""}`}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={readOnly ? "Read-only" : placeholder}
          disabled={readOnly || sending}
          rows={2}
          aria-label="Message input"
          aria-invalid={overLimit}
        />
        <button
          type="button"
          className="btn msg-composer__send"
          onClick={() => void handleSend()}
          disabled={!canSend}
          aria-label="Send message"
        >
          {sending ? "…" : "Send"}
        </button>
      </div>

      {overLimit && (
        <p className="msg-composer__limit-warn" role="alert">
          Message too long ({byteLen} / {MAX_BYTES} bytes)
        </p>
      )}
    </div>
  );
}
