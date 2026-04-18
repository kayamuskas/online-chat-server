/**
 * ContactsController — Phase 5 HTTP surface for the contacts domain.
 *
 * Endpoints (all under /api/v1/contacts):
 *   GET    requests/outgoing           — list outgoing pending requests (sent by caller)
 *   POST   requests                    — send a friend request
 *   GET    requests                    — list incoming pending requests
 *   POST   requests/:id/accept         — accept an incoming request
 *   POST   requests/:id/decline        — decline an incoming request
 *   DELETE requests/:id                — cancel an outgoing request
 *   GET    friends                     — list caller's friends with presence
 *   DELETE friends/:userId             — remove a friend
 *   POST   bans                        — ban a user
 *   GET    bans                        — list caller's bans
 *   DELETE bans/:userId                — unban a user
 *   POST   dm/:userId                  — initiate a DM conversation
 *
 * All endpoints require authentication via CurrentUserGuard.
 * callerId is ALWAYS sourced from @CurrentUser() ctx.user.id — never from request body.
 *
 * Security notes:
 * - T-05-10: @UseGuards(CurrentUserGuard) at class level protects all 12 routes.
 * - T-05-11: parseSendRequestBody validates targetUsername before any service call.
 * - T-05-12: initiateDm delegates DM eligibility enforcement to ContactsService.
 */

import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ContactsService } from './contacts.service.js';
import { CurrentUserGuard } from '../auth/current-user.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthContext } from '../auth/current-user.guard.js';

// ── Validation helpers ──────────────────────────────────────────────────────

function parseSendRequestBody(body: unknown): { targetUsername: string; message?: string } {
  const b = (body ?? {}) as { targetUsername?: unknown; message?: unknown };
  if (typeof b.targetUsername !== 'string' || b.targetUsername.trim().length === 0) {
    throw new BadRequestException('targetUsername is required');
  }
  return {
    targetUsername: b.targetUsername.trim(),
    message: typeof b.message === 'string' ? b.message.trim() || undefined : undefined,
  };
}

function parseBanBody(body: unknown): { targetUserId: string } {
  const b = (body ?? {}) as { targetUserId?: unknown };
  if (typeof b.targetUserId !== 'string' || b.targetUserId.trim().length === 0) {
    throw new BadRequestException('targetUserId is required');
  }
  return { targetUserId: b.targetUserId.trim() };
}

// ── Controller ──────────────────────────────────────────────────────────────

@Controller('api/v1/contacts')
@UseGuards(CurrentUserGuard)
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  /**
   * GET /api/v1/contacts/requests/outgoing
   *
   * List all pending friend requests sent by the authenticated user.
   * Response: { requests: FriendRequest[] }
   *
   * IMPORTANT: declared BEFORE @Get('requests') and @Post('requests/:id/accept')
   * so NestJS does not treat "outgoing" as a :id parameter.
   */
  @Get('requests/outgoing')
  async getOutgoingRequests(@CurrentUser() ctx: AuthContext) {
    const requests = await this.contactsService.getOutgoingRequests(ctx.user.id);
    return { requests };
  }

  /**
   * POST /api/v1/contacts/requests
   *
   * Send a friend request to a user by username.
   * Body: { targetUsername: string, message?: string }
   * 201 on success.
   */
  @Post('requests')
  @HttpCode(HttpStatus.CREATED)
  async sendFriendRequest(
    @Body() body: unknown,
    @CurrentUser() ctx: AuthContext,
  ) {
    const input = parseSendRequestBody(body);
    const request = await this.contactsService.sendFriendRequest(ctx.user.id, input);
    return { request };
  }

  /**
   * GET /api/v1/contacts/requests
   *
   * List all incoming pending friend requests addressed to the authenticated user.
   * Response: { requests: IncomingFriendRequestView[] }
   */
  @Get('requests')
  async getIncomingRequests(@CurrentUser() ctx: AuthContext) {
    const requests = await this.contactsService.getIncomingRequests(ctx.user.id);
    return { requests };
  }

  /**
   * POST /api/v1/contacts/requests/:id/accept
   *
   * Accept a pending friend request. Only the recipient may accept.
   * 200 on success. Response: { friendship: Friendship }
   */
  @Post('requests/:id/accept')
  @HttpCode(HttpStatus.OK)
  async acceptRequest(
    @Param('id') requestId: string,
    @CurrentUser() ctx: AuthContext,
  ) {
    const friendship = await this.contactsService.acceptRequest(requestId, ctx.user.id);
    return { friendship };
  }

  /**
   * POST /api/v1/contacts/requests/:id/decline
   *
   * Decline a pending friend request. Only the recipient may decline.
   * 204 No Content on success.
   */
  @Post('requests/:id/decline')
  @HttpCode(HttpStatus.NO_CONTENT)
  async declineRequest(
    @Param('id') requestId: string,
    @CurrentUser() ctx: AuthContext,
  ): Promise<void> {
    await this.contactsService.declineRequest(requestId, ctx.user.id);
  }

  /**
   * DELETE /api/v1/contacts/requests/:id
   *
   * Cancel a pending friend request. Only the sender may cancel.
   * 204 No Content on success.
   */
  @Delete('requests/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancelRequest(
    @Param('id') requestId: string,
    @CurrentUser() ctx: AuthContext,
  ): Promise<void> {
    await this.contactsService.cancelRequest(requestId, ctx.user.id);
  }

  /**
   * GET /api/v1/contacts/friends
   *
   * List all friends of the authenticated user with presence status.
   * Response: { friends: FriendWithPresence[] }
   */
  @Get('friends')
  async getFriends(@CurrentUser() ctx: AuthContext) {
    const friends = await this.contactsService.getFriends(ctx.user.id);
    return { friends };
  }

  /**
   * DELETE /api/v1/contacts/friends/:userId
   *
   * Remove a friend. Does NOT freeze DM history (D-19).
   * 204 No Content on success.
   */
  @Delete('friends/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeFriend(
    @Param('userId') targetUserId: string,
    @CurrentUser() ctx: AuthContext,
  ): Promise<void> {
    await this.contactsService.removeFriend(ctx.user.id, targetUserId);
  }

  /**
   * POST /api/v1/contacts/bans
   *
   * Ban a user. Atomically removes friendship and freezes DM conversation (T-05-07).
   * Body: { targetUserId: string }
   * 204 No Content on success.
   */
  @Post('bans')
  @HttpCode(HttpStatus.NO_CONTENT)
  async banUser(
    @Body() body: unknown,
    @CurrentUser() ctx: AuthContext,
  ): Promise<void> {
    const { targetUserId } = parseBanBody(body);
    await this.contactsService.banUser(ctx.user.id, targetUserId);
  }

  /**
   * GET /api/v1/contacts/bans
   *
   * List all users banned by the authenticated user.
   * Response: { bans: UserBan[] }
   */
  @Get('bans')
  async getMyBans(@CurrentUser() ctx: AuthContext) {
    const bans = await this.contactsService.getMyBans(ctx.user.id);
    return { bans };
  }

  /**
   * DELETE /api/v1/contacts/bans/:userId
   *
   * Remove a ban previously created by the caller (unban a user).
   * 204 No Content on success.
   */
  @Delete('bans/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unbanUser(
    @Param('userId') targetUserId: string,
    @CurrentUser() ctx: AuthContext,
  ): Promise<void> {
    await this.contactsService.unbanUser(ctx.user.id, targetUserId);
  }

  /**
   * POST /api/v1/contacts/dm/:userId
   *
   * Initiate or retrieve a DM conversation with another user.
   * DM eligibility is enforced server-side (T-05-12): returns 403 if not eligible.
   * Response: { conversation: DmConversation, eligible: boolean }
   */
  @Post('dm/:userId')
  @HttpCode(HttpStatus.OK)
  async initiateDm(
    @Param('userId') targetUserId: string,
    @CurrentUser() ctx: AuthContext,
  ) {
    const result = await this.contactsService.initiateDm(ctx.user.id, targetUserId);
    return result;
  }
}
