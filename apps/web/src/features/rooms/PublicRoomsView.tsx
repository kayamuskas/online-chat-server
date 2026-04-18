/**
 * PublicRoomsView — Phase 4 public room catalog and search surface.
 *
 * Shows the public room catalog with name, description, and member count.
 * Supports live search over both name and description (D-04, D-05).
 * Users can join a room directly from the catalog list.
 *
 * Stays within the classic chat-shell direction: no detached dashboard.
 */

import { useEffect, useState, useCallback } from "react";
import {
  listPublicRooms,
  joinRoom,
  type RoomCatalogRow,
} from "../../lib/api";

interface PublicRoomsViewProps {
  /** Called when the user successfully joins a room. */
  onJoined?: (room: RoomCatalogRow) => void;
  /** Called when the user wants to navigate to create-room view. */
  onCreateRoom?: () => void;
}

export function PublicRoomsView({ onJoined, onCreateRoom }: PublicRoomsViewProps) {
  const [rooms, setRooms] = useState<RoomCatalogRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  const fetchRooms = useCallback(async (query: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await listPublicRooms(query || undefined);
      setRooms(result.rooms);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load rooms");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount and whenever search changes (debounced via useEffect)
  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchRooms(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, fetchRooms]);

  async function handleJoin(room: RoomCatalogRow) {
    setJoiningId(room.id);
    setJoinError(null);
    try {
      await joinRoom(room.id);
      onJoined?.(room);
    } catch (e) {
      setJoinError(e instanceof Error ? e.message : "Failed to join room");
    } finally {
      setJoiningId(null);
    }
  }

  return (
    <div className="rooms-view">
      <div className="rooms-view__header">
        <div>
          <h2>Public rooms</h2>
          <p className="sub">Discover and join open rooms. Search by name or description.</p>
        </div>
        {onCreateRoom && (
          <button type="button" className="btn" onClick={onCreateRoom}>
            Create room
          </button>
        )}
      </div>

      <div className="rooms-search">
        <input
          className="field__input"
          type="text"
          placeholder="Search rooms…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search public rooms"
        />
      </div>

      {joinError && <p className="error-msg">{joinError}</p>}

      {loading && <p className="rooms-loading">Loading rooms…</p>}

      {!loading && !error && rooms.length === 0 && (
        <p className="rooms-empty">
          {search ? "No rooms match your search." : "No public rooms yet. Be the first to create one!"}
        </p>
      )}

      {!loading && error && <p className="error-msg">{error}</p>}

      {!loading && !error && rooms.length > 0 && (
        <ul className="rooms-list" aria-label="Public rooms">
          {rooms.map((room) => (
            <li key={room.id} className="rooms-list__item">
              <div className="rooms-list__info">
                <span className="rooms-list__name">{room.name}</span>
                {room.description && (
                  <span className="rooms-list__desc">{room.description}</span>
                )}
                <span className="rooms-list__meta">
                  {room.member_count} {room.member_count === 1 ? "member" : "members"}
                </span>
              </div>
              <button
                type="button"
                className="btn btn--soft btn--xs"
                onClick={() => void handleJoin(room)}
                disabled={joiningId === room.id}
              >
                {joiningId === room.id ? "Joining…" : "Join"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
