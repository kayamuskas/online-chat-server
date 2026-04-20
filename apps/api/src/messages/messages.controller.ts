/**
 * MessagesController — Phase 6 HTTP surface for the shared messaging engine.
 *
 * Endpoints (all under /api/v1/messages):
 *
 *   Room history and messaging:
 *   GET    rooms/:roomId/history          — paginated message history for a room
 *   POST   rooms/:roomId/messages         — send a message to a room
 *   PATCH  rooms/:roomId/messages/:id     — edit a message in a room
 *
 *   DM history and messaging:
 *   GET    dm/:conversationId/history     — paginated message history for a DM conversation
 *   POST   dm/:conversationId/messages    — send a message to a DM conversation
 *   PATCH  dm/:conversationId/messages/:id — edit a message in a DM conversation
 *
 * All endpoints require authentication via CurrentUserGuard.
 * callerId is ALWAYS sourced from @CurrentUser() ctx.user.id — never from request body.
 *
 * Parallel route shapes (D-33):
 * - Room and DM history/send/edit routes follow the same shape; only the
 *   conversation target differs.
 *
 * Security notes:
 * - T-06-01: @UseGuards(CurrentUserGuard) at class level protects all routes.
 * - T-06-02: conversation_id and message_id are validated as UUIDs at runtime
 *            by the service layer (repository queries fail gracefully on bad UUIDs).
 * - T-06-03: Access control (D-30/D-31/D-32) is enforced by MessagesService.
 * - T-06-04: author_id always sourced from session; never from body.
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { MessagesService } from './messages.service.js';
import { MessagesGateway } from './messages.gateway.js';
import { CurrentUserGuard } from '../auth/current-user.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthContext } from '../auth/current-user.guard.js';
import type { ConversationType } from './messages.types.js';

// ── Validation helpers ────────────────────────────────────────────────────────

function parseSendMessageBody(body: unknown): { content: string; reply_to_id?: string | null } {
  const b = (body ?? {}) as { content?: unknown; reply_to_id?: unknown };
  if (typeof b.content !== 'string' || b.content.trim().length === 0) {
    throw new BadRequestException('content is required');
  }
  return {
    content: b.content,
    reply_to_id:
      typeof b.reply_to_id === 'string' && b.reply_to_id.trim().length > 0
        ? b.reply_to_id.trim()
        : null,
  };
}

function parseEditMessageBody(body: unknown): { new_content: string } {
  const b = (body ?? {}) as { new_content?: unknown };
  if (typeof b.new_content !== 'string' || b.new_content.trim().length === 0) {
    throw new BadRequestException('new_content is required');
  }
  return { new_content: b.new_content };
}

function parseHistoryQuery(
  query: Record<string, string | undefined>,
): { before_watermark?: number; after_watermark?: number; limit?: number } {
  const result: { before_watermark?: number; after_watermark?: number; limit?: number } = {};
  if (query['before_watermark'] !== undefined) {
    const bw = parseInt(query['before_watermark'], 10);
    if (!isNaN(bw) && bw > 0) {
      result.before_watermark = bw;
    }
  }
  if (query['after_watermark'] !== undefined) {
    const aw = parseInt(query['after_watermark'], 10);
    if (!isNaN(aw) && aw >= 0) {
      result.after_watermark = aw;
    }
  }
  // D-52: after_watermark takes precedence over before_watermark
  if (result.after_watermark !== undefined && result.before_watermark !== undefined) {
    delete result.before_watermark;
  }
  if (query['limit'] !== undefined) {
    const lim = parseInt(query['limit'], 10);
    if (!isNaN(lim) && lim > 0) {
      result.limit = Math.min(lim, 200);
    }
  }
  return result;
}

// ── Controller ────────────────────────────────────────────────────────────────

@Controller('api/v1/messages')
@UseGuards(CurrentUserGuard)
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly messagesGateway: MessagesGateway,
  ) {}

  // ── Room history ─────────────────────────────────────────────────────────

  /**
   * GET /api/v1/messages/rooms/:roomId/history
   *
   * Return a paginated chronological history page for a room conversation.
   * Query params: before_watermark (cursor), limit (max 200).
   * D-30: Access requires active membership and no active room ban.
   * D-27: Response includes range metadata (firstWatermark, lastWatermark, hasMoreBefore).
   */
  @Get('rooms/:roomId/history')
  async getRoomHistory(
    @Param('roomId') roomId: string,
    @Query() query: Record<string, string | undefined>,
    @CurrentUser() ctx: AuthContext,
  ) {
    const { before_watermark, after_watermark, limit } = parseHistoryQuery(query);
    const result = await this.messagesService.listHistory(ctx.user.id, {
      conversation_type: 'room' as ConversationType,
      conversation_id: roomId,
      before_watermark,
      after_watermark,
      limit,
    });
    return result;
  }

  // ── Room send ────────────────────────────────────────────────────────────

  /**
   * POST /api/v1/messages/rooms/:roomId/messages
   *
   * Send a new message to a room.
   * Body: { content: string, reply_to_id?: string }
   * D-30: Access requires active membership and no active room ban.
   * MSG-02: Content validated (non-empty, ≤ 3 KB).
   * MSG-03: reply_to_id validated to be in the same room conversation.
   * After persisting, fans out 'message-created' event via WebSocket to room members.
   */
  @Post('rooms/:roomId/messages')
  @HttpCode(HttpStatus.CREATED)
  async sendRoomMessage(
    @Param('roomId') roomId: string,
    @Body() body: unknown,
    @CurrentUser() ctx: AuthContext,
  ) {
    const { content, reply_to_id } = parseSendMessageBody(body);
    const message = await this.messagesService.sendMessage({
      conversation_type: 'room',
      conversation_id: roomId,
      author_id: ctx.user.id,
      content,
      reply_to_id,
    });
    // Fanout via WebSocket (D-34)
    await this.messagesGateway.broadcastMessageCreated(message);
    return { message };
  }

  // ── Room edit ────────────────────────────────────────────────────────────

  /**
   * PATCH /api/v1/messages/rooms/:roomId/messages/:messageId
   *
   * Edit an existing room message authored by the caller.
   * Body: { new_content: string }
   * MSG-04: Only the author may edit; watermark and created_at are preserved.
   * D-25: Edited messages carry edited_at; chronological position unchanged.
   * After persisting, fans out 'message-edited' event via WebSocket to room members.
   */
  @Patch('rooms/:roomId/messages/:messageId')
  async editRoomMessage(
    @Param('messageId') messageId: string,
    @Body() body: unknown,
    @CurrentUser() ctx: AuthContext,
  ) {
    const { new_content } = parseEditMessageBody(body);
    const message = await this.messagesService.editMessage({
      message_id: messageId,
      caller_id: ctx.user.id,
      new_content,
    });
    // Fanout via WebSocket (D-34)
    await this.messagesGateway.broadcastMessageEdited(message);
    return { message };
  }

  // ── DM history ───────────────────────────────────────────────────────────

  /**
   * GET /api/v1/messages/dm/:conversationId/history
   *
   * Return a paginated chronological history page for a DM conversation.
   * Query params: before_watermark (cursor), limit (max 200).
   * D-31: Access requires DM eligibility (friendship + no ban).
   * D-32: Frozen DM conversations are read-only but remain visible (allowFrozen=true for history).
   */
  @Get('dm/:conversationId/history')
  async getDmHistory(
    @Param('conversationId') conversationId: string,
    @Query() query: Record<string, string | undefined>,
    @CurrentUser() ctx: AuthContext,
  ) {
    const { before_watermark, after_watermark, limit } = parseHistoryQuery(query);
    const result = await this.messagesService.listHistory(ctx.user.id, {
      conversation_type: 'dm' as ConversationType,
      conversation_id: conversationId,
      before_watermark,
      after_watermark,
      limit,
    });
    return result;
  }

  // ── DM send ──────────────────────────────────────────────────────────────

  /**
   * POST /api/v1/messages/dm/:conversationId/messages
   *
   * Send a new message to a DM conversation.
   * Body: { content: string, reply_to_id?: string }
   * D-31: Access requires DM eligibility (friendship + no ban).
   * D-32: Frozen DM conversation → rejected (read-only).
   * MSG-02: Content validated (non-empty, ≤ 3 KB).
   * MSG-03: reply_to_id validated to be in the same DM conversation.
   * After persisting, fans out 'message-created' event via WebSocket to participants.
   */
  @Post('dm/:conversationId/messages')
  @HttpCode(HttpStatus.CREATED)
  async sendDmMessage(
    @Param('conversationId') conversationId: string,
    @Body() body: unknown,
    @CurrentUser() ctx: AuthContext,
  ) {
    const { content, reply_to_id } = parseSendMessageBody(body);
    const message = await this.messagesService.sendMessage({
      conversation_type: 'dm',
      conversation_id: conversationId,
      author_id: ctx.user.id,
      content,
      reply_to_id,
    });
    // Fanout via WebSocket (D-34)
    await this.messagesGateway.broadcastMessageCreated(message);
    return { message };
  }

  // ── DM edit ──────────────────────────────────────────────────────────────

  /**
   * PATCH /api/v1/messages/dm/:conversationId/messages/:messageId
   *
   * Edit an existing DM message authored by the caller.
   * Body: { new_content: string }
   * MSG-04: Only the author may edit; watermark and created_at are preserved.
   * D-25: Edited messages carry edited_at; chronological position unchanged.
   * D-32: Frozen DM conversation → rejected.
   * After persisting, fans out 'message-edited' event via WebSocket to participants.
   */
  @Patch('dm/:conversationId/messages/:messageId')
  async editDmMessage(
    @Param('messageId') messageId: string,
    @Body() body: unknown,
    @CurrentUser() ctx: AuthContext,
  ) {
    const { new_content } = parseEditMessageBody(body);
    const message = await this.messagesService.editMessage({
      message_id: messageId,
      caller_id: ctx.user.id,
      new_content,
    });
    // Fanout via WebSocket (D-34)
    await this.messagesGateway.broadcastMessageEdited(message);
    return { message };
  }
}
