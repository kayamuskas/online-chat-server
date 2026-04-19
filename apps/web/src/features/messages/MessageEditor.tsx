/**
 * MessageEditor — Phase 6 inline edit mode for a single message (MSG-04, D-24, D-25).
 *
 * Rendered in place of the message bubble when the current user activates "Edit"
 * on their own message. Shows a pre-filled textarea with Save/Cancel controls so
 * the action is always reversible before submit (D-24).
 *
 * The parent conversation view is responsible for calling the API and dismissing
 * this component after a successful edit.
 */

import { useState } from "react";

interface MessageEditorProps {
  /** Current content of the message being edited (pre-fill). */
  initialContent: string;
  /** Indicates the parent is submitting — disables controls. */
  saving?: boolean;
  /** Called with the new content when the user confirms the edit. */
  onSave: (newContent: string) => void;
  /** Called when the user cancels without saving. */
  onCancel: () => void;
}

export function MessageEditor({
  initialContent,
  saving = false,
  onSave,
  onCancel,
}: MessageEditorProps) {
  const [content, setContent] = useState(initialContent);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") {
      onCancel();
    }
    // Ctrl/Cmd+Enter saves
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      const trimmed = content.trim();
      if (trimmed && trimmed !== initialContent) {
        onSave(trimmed);
      }
    }
  }

  function handleSave() {
    const trimmed = content.trim();
    if (!trimmed || trimmed === initialContent) {
      onCancel();
      return;
    }
    onSave(trimmed);
  }

  return (
    <div className="msg-editor">
      <textarea
        className="msg-editor__textarea field__input"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={saving}
        aria-label="Edit message"
        rows={3}
        autoFocus
      />
      <div className="msg-editor__actions">
        <button
          type="button"
          className="btn btn--soft btn--xs"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn btn--xs"
          onClick={handleSave}
          disabled={saving || !content.trim() || content.trim() === initialContent}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      <p className="msg-editor__hint">Esc to cancel · Ctrl+Enter to save</p>
    </div>
  );
}
