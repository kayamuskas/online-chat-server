/**
 * MessagesService — Phase 6 shared messaging domain service.
 *
 * Owns all invariant enforcement for send, edit, and history flows:
 *   - MSG-02: UTF-8 content size validation (via domain helpers)
 *   - MSG-03: Same-conversation reply reference validation
 *   - MSG-04: Author-only edit; chronological position preserved
 *   - MSG-08: Watermark metadata in history results
 *   - D-30:   Room access — membership required + no active ban
 *   - D-31:   DM access — friendship required + no user-ban
 *   - D-32:   Frozen DM conversation → send/edit rejected (read-only)
 *
 * Access control delegates to RoomsRepository (membership/ban) and
 * ContactsRepository (friendship/ban/frozen) rather than coupling to
 * the higher-level services, which keeps circular imports away.
 *
 * Design decisions:
 * - callerId is always sourced from the authenticated session; never from body.
 * - ForbiddenException covers access-denied cases (not-a-member, banned, frozen).
 * - NotFoundException covers missing resources (message not found, etc.).
 * - BadRequestException covers invariant violations (content too long, wrong reply, etc.).
 * - Service does NOT import controllers; it is a leaf in the dependency graph.
 */

import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { MessagesRepository, type MessageHistoryResult } from './messages.repository.js';
import { RoomsRepository } from '../rooms/rooms.repository.js';
import { ContactsRepository } from '../contacts/contacts.repository.js';
import {
  validateMessageContent,
  validateReplyTarget,
} from './messages.helpers.js';
import type {
  Message,
  MessageView,
  SendMessageInput,
  EditMessageInput,
  MessageHistoryQuery,
} from './messages.types.js';

@Injectable()
export class MessagesService {
  constructor(
    private readonly repo: MessagesRepository,
    private readonly roomsRepo: RoomsRepository,
    private readonly contactsRepo: ContactsRepository,
  ) {}

  // ── Internal access guards ─────────────────────────────────────────────────

  /**
   * D-30: Assert that callerId has active room membership with no active room ban.
   * Throws ForbiddenException otherwise.
   */
  private async assertRoomAccess(roomId: string, callerId: string): Promise<void> {
    const isBanned = await this.roomsRepo.isBanned(roomId, callerId);
    if (isBanned) {
      throw new ForbiddenException('You are banned from this room');
    }
    const membership = await this.roomsRepo.getMembership(roomId, callerId);
    if (!membership) {
      throw new ForbiddenException('You are not a member of this room');
    }
  }

  /**
   * D-31 + D-32: Assert that callerId may interact with a DM conversation.
   *
   * Checks:
   * 1. DM conversation must exist.
   * 2. callerId must be one of the two participants.
   * 3. No mutual user-ban in either direction.
   * 4. Conversation must not be frozen (D-32).
   *
   * For read-only history access, pass allowFrozen=true to skip the frozen check.
   */
  private async assertDmAccess(
    conversationId: string,
    callerId: string,
    allowFrozen = false,
  ): Promise<void> {
    const dm = await this.contactsRepo.findDmConversationById(conversationId);
    if (!dm) {
      throw new NotFoundException('DM conversation not found');
    }
    if (dm.user_a_id !== callerId && dm.user_b_id !== callerId) {
      throw new ForbiddenException('You are not a participant in this DM conversation');
    }
    const otherId = dm.user_a_id === callerId ? dm.user_b_id : dm.user_a_id;
    const ban = await this.contactsRepo.findBanBetween(callerId, otherId);
    if (ban) {
      throw new ForbiddenException('DM access restricted due to an active ban');
    }
    if (!allowFrozen && dm.frozen) {
      throw new ForbiddenException('This DM conversation is frozen and read-only (D-32)');
    }
  }

  // ── Send message ───────────────────────────────────────────────────────────

  /**
   * Send a new message to a room or DM conversation.
   *
   * Policy checks applied in order:
   *   1. Conversation access (D-30 / D-31 / D-32)
   *   2. Content validation (MSG-02)
   *   3. Reply target validation (MSG-03)
   *
   * Returns the persisted Message row with server-assigned watermark (D-28).
   */
  async sendMessage(input: SendMessageInput): Promise<MessageView> {
    // 1. Access control
    if (input.conversation_type === 'room') {
      await this.assertRoomAccess(input.conversation_id, input.author_id);
    } else {
      await this.assertDmAccess(input.conversation_id, input.author_id);
    }

    // 2. Content validation (MSG-02)
    const contentCheck = validateMessageContent(input.content);
    if (!contentCheck.valid) {
      throw new BadRequestException(contentCheck.error);
    }

    // 3. Reply validation (MSG-03)
    if (input.reply_to_id) {
      const replyMessage = await this.repo.resolveReplyMessage(input.reply_to_id);
      const replyCheck = validateReplyTarget({
        reply_to_id: input.reply_to_id,
        conversation_type: input.conversation_type,
        conversation_id: input.conversation_id,
        reply_message: replyMessage,
      });
      if (!replyCheck.valid) {
        throw new BadRequestException(replyCheck.error);
      }
    }

    const created = await this.repo.createMessage(input);
    const view = await this.repo.findMessageViewById(created.id);
    if (!view) throw new NotFoundException(`Message '${created.id}' disappeared after insert`);
    return view;
  }

  // ── List history ───────────────────────────────────────────────────────────

  /**
   * Return a paginated history page for a room or DM conversation.
   *
   * For rooms: active membership required; bans block read access (D-30).
   * For DMs: participant required; bans block access; frozen conversations
   *          are allowed for history reads (D-32: frozen = read-only, not gone).
   *
   * Returns enriched MessageViews + MessageHistoryRange metadata (MSG-08, D-27).
   */
  async listHistory(
    callerId: string,
    query: MessageHistoryQuery,
  ): Promise<MessageHistoryResult> {
    if (query.conversation_type === 'room') {
      await this.assertRoomAccess(query.conversation_id, callerId);
    } else {
      // D-32: frozen DM is visible (read-only) — pass allowFrozen=true
      await this.assertDmAccess(query.conversation_id, callerId, true);
    }

    return this.repo.listHistory(query);
  }

  // ── Edit message ───────────────────────────────────────────────────────────

  /**
   * Edit an existing message authored by the caller.
   *
   * Policy checks applied in order:
   *   1. Message must exist (NotFoundException).
   *   2. Caller must have active conversation access (D-30 / D-31 / D-32).
   *   3. Author-only check (MSG-04) — delegated to applyMessageEdit helper.
   *   4. New content validation (MSG-02).
   *
   * Returns the updated MessageView (via a follow-up history fetch for full enrichment).
   * Editing preserves chronological position (watermark, created_at unchanged — D-25, D-28).
   */
  async editMessage(input: EditMessageInput): Promise<Message> {
    // 1. Fetch the existing message
    const message = await this.repo.findMessageById(input.message_id);
    if (!message) {
      throw new NotFoundException(`Message '${input.message_id}' not found`);
    }

    // 2. Conversation access — frozen DM blocks edit (D-32: only reads allowed)
    if (message.conversation_type === 'room') {
      await this.assertRoomAccess(message.conversation_id, input.caller_id);
    } else {
      // allowFrozen=false: frozen DM is read-only, edits rejected (D-32)
      await this.assertDmAccess(message.conversation_id, input.caller_id);
    }

    // 3. Author-only rule (MSG-04) — applyMessageEdit throws if caller ≠ author
    // We do this validation in-memory first so we get a clear Forbidden error.
    if (input.caller_id !== message.author_id) {
      throw new ForbiddenException(
        `Forbidden: only the author may edit this message`,
      );
    }

    // 4. New content validation (MSG-02)
    const contentCheck = validateMessageContent(input.new_content);
    if (!contentCheck.valid) {
      throw new BadRequestException(contentCheck.error);
    }

    // 5. Persist the edit — watermark and created_at are NOT changed (D-25)
    const updated = await this.repo.editMessage(input.message_id, input.new_content, new Date());
    if (!updated) {
      throw new NotFoundException(`Message '${input.message_id}' disappeared during edit`);
    }
    return updated;
  }
}
