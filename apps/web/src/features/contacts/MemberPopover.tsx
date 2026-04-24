import { useEffect, useRef } from "react";
import { PresenceDot, type PresenceStatus } from "../presence/PresenceDot";

interface MemberPopoverProps {
  username: string;
  userId: string;
  presenceStatus: PresenceStatus;
  roomName: string;
  isFriend: boolean;
  isCurrentUser: boolean;
  anchorRect: DOMRect;
  onClose: () => void;
  onSendFriendRequest?: (userId: string, username: string) => void;
  onBanUser?: (userId: string) => void;
}

export function MemberPopover({
  username,
  userId,
  presenceStatus,
  roomName,
  isFriend,
  isCurrentUser,
  anchorRect,
  onClose,
  onSendFriendRequest,
  onBanUser,
}: MemberPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Outside click dismiss
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [onClose]);

  // Position: below the anchor, flip up if near viewport bottom
  const top = anchorRect.bottom + 4;
  const left = anchorRect.left;
  const flipUp = top + 200 > window.innerHeight;
  const style: React.CSSProperties = {
    position: "fixed",
    left: Math.min(left, window.innerWidth - 270),
    top: flipUp ? anchorRect.top - 200 : top,
    zIndex: 1000,
  };

  const initial = username.charAt(0).toUpperCase();
  const contextParts: string[] = [];
  contextParts.push(`Member of #${roomName}`);
  if (isFriend) {
    contextParts.push("In your contacts");
  } else {
    contextParts.push("Not in your contacts");
  }

  return (
    <div ref={popoverRef} className="member-popover" style={style}>
      <div className="member-popover__header">
        <div className="member-popover__avatar">{initial}</div>
        <div className="member-popover__identity">
          <div className="member-popover__name">{username}</div>
          <div className="member-popover__handle">
            <PresenceDot status={presenceStatus} />
            <span>@{username}</span>
          </div>
        </div>
      </div>
      <div className="member-popover__context">
        {contextParts.join(". ")}.
      </div>
      {!isCurrentUser && (
        <div className="member-popover__actions">
          {!isFriend && onSendFriendRequest && (
            <button
              type="button"
              className="member-popover__action"
              onClick={() => { onSendFriendRequest(userId, username); onClose(); }}
            >
              Send friend request
            </button>
          )}
          <button type="button" className="member-popover__action" disabled>
            View profile
          </button>
          {onBanUser && (
            <button
              type="button"
              className="member-popover__action member-popover__action--danger"
              onClick={() => { onBanUser(userId); onClose(); }}
            >
              Ban user
            </button>
          )}
        </div>
      )}
    </div>
  );
}
