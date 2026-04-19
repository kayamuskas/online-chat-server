/**
 * ReplyPreview — Phase 6 reply chip shown inside the message composer (D-23).
 *
 * Rendered when the user has tapped "Reply" on a message and has not yet sent
 * or cancelled. Shows a truncated snippet of the original message and a cancel
 * button so the reply mode is always reversible before submit.
 */

import type { ReplyPreview as ReplyPreviewData } from "../../lib/api";

interface ReplyPreviewProps {
  /** The resolved preview for the message being replied to. */
  preview: ReplyPreviewData;
  /** Called when the user dismisses the reply. */
  onCancel: () => void;
}

export function ReplyPreview({ preview, onCancel }: ReplyPreviewProps) {
  return (
    <div className="reply-preview" role="note" aria-label="Replying to message">
      <div className="reply-preview__bar" aria-hidden="true" />
      <div className="reply-preview__content">
        <span className="reply-preview__author">{preview.authorUsername}</span>
        <span className="reply-preview__snippet">{preview.contentSnippet}</span>
      </div>
      <button
        type="button"
        className="reply-preview__cancel"
        aria-label="Cancel reply"
        onClick={onCancel}
      >
        &times;
      </button>
    </div>
  );
}
