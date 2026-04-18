/**
 * RoomsController — Phase 4-02 authenticated HTTP surface for room flows.
 *
 * Endpoints (all under /api/v1/rooms):
 *   POST /                  — create a new room
 *   GET  /                  — public room catalog (with optional ?search= query)
 *   POST /:id/join          — join a public room (authenticated, non-banned users only)
 *   POST /:id/leave         — leave a room (owners cannot leave — must delete instead)
 *
 * All endpoints require authentication via CurrentUserGuard.
 * Policy enforcement (owner cannot leave, private join blocked, ban check) lives in RoomsService.
 */

import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { RoomsService } from './rooms.service.js';
import { CurrentUserGuard } from '../auth/current-user.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthContext } from '../auth/current-user.guard.js';
import type { RoomVisibility } from './rooms.types.js';

// ── Input DTOs ─────────────────────────────────────────────────────────────────

interface CreateRoomBody {
  name?: unknown;
  description?: unknown;
  visibility?: unknown;
}

// ── Validation helpers ─────────────────────────────────────────────────────────

function parseCreateRoomBody(body: unknown): {
  name: string;
  description?: string | null;
  visibility?: RoomVisibility;
} {
  const b = (body ?? {}) as CreateRoomBody;

  if (typeof b.name !== 'string' || b.name.trim().length === 0) {
    throw new BadRequestException('Room name is required and must be a non-empty string');
  }

  let visibility: RoomVisibility | undefined;
  if (b.visibility === undefined) {
    visibility = undefined;
  } else if (b.visibility === 'public' || b.visibility === 'private') {
    visibility = b.visibility as RoomVisibility;
  } else {
    throw new BadRequestException('visibility must be "public" or "private"');
  }

  return {
    name: (b.name as string).trim(),
    description: typeof b.description === 'string' ? b.description.trim() || null : null,
    visibility,
  };
}

// ── Controller ─────────────────────────────────────────────────────────────────

@Controller('api/v1/rooms')
@UseGuards(CurrentUserGuard)
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  /**
   * POST /api/v1/rooms
   *
   * Create a new room.
   * Body: { name: string, description?: string, visibility?: 'public'|'private' }
   * - `name` is required (globally unique).
   * - `visibility` defaults to 'public'.
   * - `description` is optional.
   * 201 on success. 409 if name already taken.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createRoom(
    @Body() body: unknown,
    @CurrentUser() ctx: AuthContext,
  ) {
    const input = parseCreateRoomBody(body);
    const room = await this.roomsService.createRoom({
      name: input.name,
      description: input.description,
      visibility: input.visibility,
      creatorUserId: ctx.user.id,
    });
    return { room };
  }

  /**
   * GET /api/v1/rooms
   *
   * Public room catalog.
   * Optional query: ?search=<text> — matches both room name and description.
   * Private rooms are excluded from all responses.
   * Response shape: { rooms: RoomCatalogRow[] }
   */
  @Get()
  async catalog(@Query('search') search?: string) {
    const rooms = await this.roomsService.listPublicRooms(search || undefined);
    return { rooms };
  }

  /**
   * GET /api/v1/rooms/mine/private
   *
   * List private rooms where the authenticated user currently has membership.
   */
  @Get('mine/private')
  async myPrivateRooms(@CurrentUser() ctx: AuthContext) {
    const rooms = await this.roomsService.getMyPrivateRooms(ctx.user.id);
    return { rooms };
  }

  /**
   * GET /api/v1/rooms/invites/pending
   *
   * List pending private-room invites addressed to the authenticated user.
   */
  @Get('invites/pending')
  async pendingInvites(@CurrentUser() ctx: AuthContext) {
    const invites = await this.roomsService.getPendingPrivateInvites(ctx.user.id);
    return { invites };
  }

  /**
   * POST /api/v1/rooms/:id/join
   *
   * Join a public room as an ordinary member.
   * - Fails with 400 if the room is private (invite required).
   * - Fails with 400 if the user is banned.
   * - Fails with 409 if the user is already a member.
   * 200 on success.
   */
  @Post(':id/join')
  @HttpCode(HttpStatus.OK)
  async join(
    @Param('id') roomId: string,
    @CurrentUser() ctx: AuthContext,
  ) {
    const membership = await this.roomsService.joinRoom(roomId, ctx.user.id);
    return { membership };
  }

  /**
   * POST /api/v1/rooms/:id/leave
   *
   * Leave a room as an ordinary member.
   * - Fails with 400 when the owner attempts to leave (must delete the room instead).
   * - Fails with 404 when the user is not a member.
   * 204 on success.
   */
  @Post(':id/leave')
  @HttpCode(HttpStatus.NO_CONTENT)
  async leave(
    @Param('id') roomId: string,
    @CurrentUser() ctx: AuthContext,
  ): Promise<void> {
    await this.roomsService.leaveRoom(roomId, ctx.user.id);
  }

  /**
   * POST /api/v1/rooms/:id/invites/:inviteId/accept
   *
   * Accept a pending private-room invite addressed to the authenticated user.
   */
  @Post(':id/invites/:inviteId/accept')
  @HttpCode(HttpStatus.OK)
  async acceptInvite(
    @Param('id') roomId: string,
    @Param('inviteId') inviteId: string,
    @CurrentUser() ctx: AuthContext,
  ) {
    const membership = await this.roomsService.acceptInvite(roomId, inviteId, ctx.user.id);
    return { membership };
  }

  /**
   * POST /api/v1/rooms/:id/invites/:inviteId/decline
   *
   * Decline a pending private-room invite addressed to the authenticated user.
   */
  @Post(':id/invites/:inviteId/decline')
  @HttpCode(HttpStatus.NO_CONTENT)
  async declineInvite(
    @Param('id') roomId: string,
    @Param('inviteId') inviteId: string,
    @CurrentUser() ctx: AuthContext,
  ): Promise<void> {
    await this.roomsService.declineInvite(roomId, inviteId, ctx.user.id);
  }
}
