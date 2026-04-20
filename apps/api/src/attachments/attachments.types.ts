/**
 * attachments.types.ts -- Phase 7 attachment domain type contracts.
 *
 * D-40..D-43: Attachment is a separate entity with FK to messages (1:N).
 * D-41: Stores original_filename, mime_type, file_size, storage_path, comment, uploader_id.
 */

export interface Attachment {
  id: string;
  message_id: string | null;
  uploader_id: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  storage_path: string;
  comment: string | null;
  created_at: Date;
}

/** Projection returned to clients -- no storage_path exposed (D-49). */
export interface AttachmentView {
  id: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  comment: string | null;
}

export interface InsertAttachmentInput {
  uploader_id: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  storage_path: string;
  comment: string | null;
}
