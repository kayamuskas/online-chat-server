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

import { useState, useRef, useEffect } from "react";
import { ReplyPreview } from "./ReplyPreview";
import type { ReplyPreview as ReplyPreviewData } from "../../lib/api";
import { uploadAttachment, type AttachmentView } from "../../lib/api";

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
  onSend: (content: string, replyToId: string | null, attachmentIds: string[]) => Promise<void> | void;
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
  const [pendingAttachments, setPendingAttachments] = useState<AttachmentView[]>([]);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function restoreComposerFocus() {
    // Defer focus until parent state updates and scroll adjustments settle.
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }

  useEffect(() => {
    if (replyTo) {
      textareaRef.current?.focus();
    }
  }, [replyTo]);

  const byteLen = utf8ByteLength(content);
  const overLimit = byteLen > MAX_BYTES;
  const canSend = !readOnly && !sending && !uploading
    && (content.trim().length > 0 || pendingAttachments.length > 0)
    && !overLimit;

  async function handleFileSelect(files: File[]) {
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded = await Promise.all(files.map((f) => uploadAttachment(f)));
      setPendingAttachments((prev) => [...prev, ...uploaded]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(e.clipboardData.files);
    if (files.length > 0) {
      e.preventDefault();
      void handleFileSelect(files);
    }
  }

  async function handleSend() {
    if (!canSend) return;
    setError(null);
    setSending(true);
    try {
      await onSend(
        content.trim(),
        replyTo?.id ?? null,
        pendingAttachments.map((a) => a.id),
      );
      setContent("");
      setPendingAttachments([]);
      restoreComposerFocus();
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

      {pendingAttachments.length > 0 && (
        <div className="msg-composer__attachments">
          {pendingAttachments.map((a) => (
            <span key={a.id} className="msg-composer__attachment-chip">
              {a.originalFilename}
              <button
                type="button"
                onClick={() => setPendingAttachments((prev) => prev.filter((p) => p.id !== a.id))}
                aria-label={`Remove ${a.originalFilename}`}
              >
                x
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="msg-composer__row">
        <textarea
          ref={textareaRef}
          className={`msg-composer__input field__input${overLimit ? " msg-composer__input--over" : ""}`}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
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
        <button
          type="button"
          className="btn msg-composer__attach"
          onClick={() => fileInputRef.current?.click()}
          disabled={readOnly || uploading}
          aria-label="Attach file"
        >
          {uploading ? "..." : "+"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            void handleFileSelect(files);
            e.target.value = "";
          }}
        />
      </div>

      {overLimit && (
        <p className="msg-composer__limit-warn" role="alert">
          Message too long ({byteLen} / {MAX_BYTES} bytes)
        </p>
      )}
    </div>
  );
}
