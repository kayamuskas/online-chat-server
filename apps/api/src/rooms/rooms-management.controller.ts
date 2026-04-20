/**
 * RoomsManagementController — Phase 4-03 authenticated management surface.
 *
 * Endpoints (all under /api/v1/rooms/:id/manage):
 *   POST /:id/manage/invite           — invite a registered user by username
 *   POST /:id/manage/admins/:userId   — promote a member to admin
 *   DELETE /:id/manage/admins/:userId — demote an admin (owner protected)
 *   DELETE /:id/manage/members/:userId — remove a member (modeled as ban)
 *   GET  /:id/manage/bans             — list banned users with metadata
 *   DELETE /:id/manage/bans/:userId   — unban a user
 *
 * Authorization policy (enforced here):
 * - All endpoints require authentication (CurrentUserGuard at class level).
 * - Invite: caller must be room owner or admin.
 * - makeAdmin / removeAdmin: caller must be room owner.
 * - removeMember: caller must be room owner or admin.
 * - listBanned / unban: caller must be room owner or admin.
 *
 * All domain invariants (owner protection, registered-user-only invites,
 * ban semantics) live in RoomsService — this controller stays thin.
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
  ForbiddenException,
} from '@nestjs/common';
import { RoomsService } from './rooms.service.js';
import { CurrentUserGuard } from '../auth/current-user.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthContext } from '../auth/current-user.guard.js';

// ── Input DTOs ─────────────────────────────────────────────────────────────────

interface InviteBody {
  username?: unknown;
  reason?: unknown;
}

interface RemoveMemberBody {
  reason?: unknown;
}

// ── Authorization helpers ──────────────────────────────────────────────────────

/** Require caller to be owner or admin; throws ForbiddenException otherwise. */
async function requireAdminOrOwner(
  roomsService: RoomsService,
  roomId: string,
  userId: string,
): Promise<void> {
  const isAdmin = await roomsService.isAdmin(roomId, userId);
  if (!isAdmin) {
    throw new ForbiddenException('You must be a room admin or owner to perform this action');
  }
}

/** Require caller to be the room owner; throws ForbiddenException otherwise. */
async function requireOwner(
  roomsService: RoomsService,
  roomId: string,
  userId: string,
): Promise<void> {
  const isOwner = await roomsService.isOwner(roomId, userId);
  if (!isOwner) {
    throw new ForbiddenException('Only the room owner can perform this action');
  }
}

// ── Controller ─────────────────────────────────────────────────────────────────

@Controller('api/v1/rooms')
@UseGuards(CurrentUserGuard)
export class RoomsManagementController {
  constructor(private readonly roomsService: RoomsService) {}

  /**
   * POST /api/v1/rooms/:id/manage/invite
   *
   * Invite a registered user to the room by username.
   * - Caller must be room owner or admin.
   * - Target username must map to an already registered user.
   * - Duplicate pending invites are rejected with 409.
   * 201 on success.
   */
  @Post(':id/manage/invite')
  @HttpCode(HttpStatus.CREATED)
  async invite(
    @Param('id') roomId: string,
    @Body() body: unknown,
    @CurrentUser() ctx: AuthContext,
  ) {
    const b = (body ?? {}) as InviteBody;

    if (typeof b.username !== 'string' || b.username.trim().length === 0) {
      throw new BadRequestException('username is required and must be a non-empty string');
    }

    await requireAdminOrOwner(this.roomsService, roomId, ctx.user.id);

    const invite = await this.roomsService.inviteToRoom(roomId, ctx.user.id, b.username.trim());
    return { invite };
  }

  /**
   * POST /api/v1/rooms/:id/manage/admins/:userId
   *
   * Promote a member to admin.
   * - Caller must be the room owner.
   * 201 on success.
   */
  @Post(':id/manage/admins/:userId')
  @HttpCode(HttpStatus.CREATED)
  async makeAdmin(
    @Param('id') roomId: string,
    @Param('userId') targetUserId: string,
    @CurrentUser() ctx: AuthContext,
  ) {
    await requireOwner(this.roomsService, roomId, ctx.user.id);

    const admin = await this.roomsService.makeAdmin(roomId, targetUserId, ctx.user.id);
    return { admin };
  }

  /**
   * DELETE /api/v1/rooms/:id/manage/admins/:userId
   *
   * Demote an admin (remove admin privileges).
   * - Caller must be the room owner.
   * - Owner's own admin status is protected (service throws ForbiddenException).
   * 204 on success.
   */
  @Delete(':id/manage/admins/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeAdmin(
    @Param('id') roomId: string,
    @Param('userId') targetUserId: string,
    @CurrentUser() ctx: AuthContext,
  ): Promise<void> {
    await requireOwner(this.roomsService, roomId, ctx.user.id);
    await this.roomsService.removeAdmin(roomId, targetUserId);
  }

  /**
   * DELETE /api/v1/rooms/:id/manage/members/:userId
   *
   * Remove a member from the room using ban semantics.
   * - Caller must be room owner or admin.
   * - Removal is modeled as a ban: the user cannot rejoin until explicitly unbanned.
   * - Owner cannot be removed this way (service throws ForbiddenException).
   * 204 on success.
   */
  @Delete(':id/manage/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @Param('id') roomId: string,
    @Param('userId') targetUserId: string,
    @Body() body: unknown,
    @CurrentUser() ctx: AuthContext,
  ): Promise<void> {
    const b = (body ?? {}) as RemoveMemberBody;
    const reason = typeof b.reason === 'string' ? b.reason.trim() || undefined : undefined;

    await requireAdminOrOwner(this.roomsService, roomId, ctx.user.id);
    await this.roomsService.removeMemberAsBan(roomId, targetUserId, ctx.user.id, reason);
  }

  /**
   * GET /api/v1/rooms/:id/manage/bans
   *
   * List all banned users in the room with who-banned metadata.
   * - Caller must be room owner or admin.
   * 200 on success.
   */
  @Get(':id/manage/bans')
  async listBanned(
    @Param('id') roomId: string,
    @CurrentUser() ctx: AuthContext,
  ) {
    await requireAdminOrOwner(this.roomsService, roomId, ctx.user.id);

    const bans = await this.roomsService.listBanned(roomId);
    return { bans };
  }

  /**
   * DELETE /api/v1/rooms/:id/manage/bans/:userId
   *
   * Unban a user — allows them to rejoin.
   * - Caller must be room owner or admin.
   * 204 on success.
   */
  @Delete(':id/manage/bans/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unban(
    @Param('id') roomId: string,
    @Param('userId') targetUserId: string,
    @CurrentUser() ctx: AuthContext,
  ): Promise<void> {
    await requireAdminOrOwner(this.roomsService, roomId, ctx.user.id);
    await this.roomsService.unbanMember(roomId, targetUserId);
  }

  /**
   * DELETE /api/v1/rooms/:id
   *
   * Permanently deletes the room and all its messages/attachments (D-05).
   * Caller must be the room owner.
   * 204 on success.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRoom(
    @Param('id') roomId: string,
    @CurrentUser() ctx: AuthContext,
  ): Promise<void> {
    await requireOwner(this.roomsService, roomId, ctx.user.id);
    await this.roomsService.deleteRoom(roomId, ctx.user.id);
  }
}
