/**
 * CreateRoomView — Phase 4 lightweight room creation form.
 *
 * Contract (D-01, D-02, D-03):
 *   - `name` is required.
 *   - `visibility` defaults to 'public' if not explicitly changed.
 *   - `description` is optional.
 *
 * Stays within the classic chat-shell direction: rendered as a card/panel,
 * not a detached dashboard page.
 */

import { useState } from "react";
import { createRoom, type Room, type RoomVisibility } from "../../lib/api";

interface CreateRoomViewProps {
  /** Called with the new room when creation succeeds. */
  onCreated?: (room: Room) => void;
  /** Called when user dismisses / cancels. */
  onCancel?: () => void;
}

export function CreateRoomView({ onCreated, onCancel }: CreateRoomViewProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<RoomVisibility>("public");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Room name is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await createRoom({
        name: name.trim(),
        description: description.trim() || null,
        visibility,
      });
      onCreated?.(result.room);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create room");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rooms-view">
      <div className="rooms-view__header">
        <div>
          <h2>Create room</h2>
          <p className="sub">Give your room a unique name to get started.</p>
        </div>
      </div>

      <form className="create-room-form" onSubmit={(e) => void handleSubmit(e)} noValidate>
        {error && <p className="error-msg">{error}</p>}

        <div className="field">
          <label className="field__label" htmlFor="room-name">
            Room name <span aria-hidden="true">*</span>
          </label>
          <input
            id="room-name"
            className="field__input"
            type="text"
            placeholder="e.g. general"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
            autoComplete="off"
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="room-desc">
            Description <span className="field__optional">(optional)</span>
          </label>
          <input
            id="room-desc"
            className="field__input"
            type="text"
            placeholder="What is this room about?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            autoComplete="off"
          />
        </div>

        <div className="field">
          <span className="field__label">Visibility</span>
          <div className="radio-group">
            <label className="radio-option">
              <input
                type="radio"
                name="visibility"
                value="public"
                checked={visibility === "public"}
                onChange={() => setVisibility("public")}
              />
              <span className="radio-option__text">
                <strong>Public</strong> — anyone can discover and join
              </span>
            </label>
            <label className="radio-option">
              <input
                type="radio"
                name="visibility"
                value="private"
                checked={visibility === "private"}
                onChange={() => setVisibility("private")}
              />
              <span className="radio-option__text">
                <strong>Private</strong> — invite only
              </span>
            </label>
          </div>
        </div>

        <div className="form-actions">
          {onCancel && (
            <button
              type="button"
              className="btn btn--soft"
              onClick={onCancel}
              disabled={submitting}
            >
              Cancel
            </button>
          )}
          <button type="submit" className="btn" disabled={submitting || !name.trim()}>
            {submitting ? "Creating…" : "Create room"}
          </button>
        </div>
      </form>
    </div>
  );
}
