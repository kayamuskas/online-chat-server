/**
 * DmScreenStub — Phase 5 empty-state DM screen (D-12, D-08, FRND-05).
 *
 * Phase 6 will replace this with the real message engine.
 * Shows read-only state when frozen=true (DM history frozen due to ban — FRND-05).
 * Shows appropriate message based on ineligibleReason.
 */

interface DmScreenStubProps {
  partnerUsername: string;
  frozen?: boolean;
  ineligibleReason?: 'not_friends' | 'ban_exists';
}

export function DmScreenStub({
  partnerUsername,
  frozen = false,
  ineligibleReason,
}: DmScreenStubProps) {
  return (
    <div className="rooms-view">
      <div className="rooms-view__header">
        <h2>{partnerUsername}</h2>
      </div>
      <div className="rooms-view__body">
        {frozen && (
          <p className="error-msg">This conversation is read-only.</p>
        )}
        {!frozen && ineligibleReason === 'ban_exists' && (
          <p className="rooms-empty">This user has restricted contact with you.</p>
        )}
        {!frozen && ineligibleReason === 'not_friends' && (
          <p className="rooms-empty">Add as friend to start messaging.</p>
        )}
        {!frozen && !ineligibleReason && (
          <p className="rooms-empty">No messages yet. (Chat coming in Phase 6)</p>
        )}
      </div>
    </div>
  );
}
