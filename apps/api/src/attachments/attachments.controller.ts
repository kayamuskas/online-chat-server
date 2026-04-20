/**
 * AttachmentsController -- Phase 7 file upload and download endpoints.
 *
 * Endpoints:
 *   POST /api/v1/attachments/upload     -- upload a file (multipart/form-data)
 *   GET  /api/v1/attachments/:id/download -- download a file (proxied, ACL-checked)
 *
 * All endpoints require authentication via CurrentUserGuard.
 * callerId is ALWAYS sourced from @CurrentUser() ctx.user.id.
 *
 * Security:
 *   - T-07-06: @UseGuards(CurrentUserGuard) at class level protects all routes.
 *   - T-07-02: UUID filenames on disk prevent path traversal (D-48).
 *   - T-07-07: No filesystem URLs exposed; all downloads proxied (D-49).
 *   - T-07-08: ACL checked at request time, not cached (D-50).
 */

import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  BadRequestException,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { createReadStream } from 'node:fs';
import type { Response } from 'express';
import { AttachmentsService } from './attachments.service.js';
import { CurrentUserGuard } from '../auth/current-user.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthContext } from '../auth/current-user.guard.js';

const UPLOADS_DIR = process.env['UPLOADS_DIR'] ?? './uploads';
const FILE_MAX_BYTES = 20 * 1024 * 1024; // 20 MB hard cap (D-47)

/**
 * D-48: Multer DiskStorage with UUID filenames.
 * Original filenames never touch disk -- they are stored in the DB only.
 */
const multerOptions = {
  storage: diskStorage({
    destination: (_req: any, _file: any, cb: any) => {
      cb(null, UPLOADS_DIR);
    },
    filename: (_req: any, file: any, cb: any) => {
      const ext = extname(file.originalname);
      cb(null, `${randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: FILE_MAX_BYTES },
};

@Controller('api/v1/attachments')
@UseGuards(CurrentUserGuard)
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  /**
   * POST /api/v1/attachments/upload
   *
   * Accept a multipart file upload (field name: "file").
   * Optional "comment" field in the form data body.
   * D-44: Returns the created AttachmentView with id.
   * D-47: 20 MB hard cap enforced by Multer; 3 MB image cap enforced by service layer.
   */
  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file', multerOptions))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('comment') comment: string | undefined,
    @CurrentUser() ctx: AuthContext,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    const attachment = await this.attachmentsService.createAttachment(
      file,
      ctx.user.id,
      comment,
    );
    return attachment;
  }

  /**
   * GET /api/v1/attachments/:id/download
   *
   * Proxy-stream the attachment file after checking ACL.
   * D-49: No direct filesystem URLs exposed.
   * D-50: ACL check happens at request time, not cached.
   * Content-Disposition uses RFC 5987 UTF-8 encoding for non-ASCII filenames.
   */
  @Get(':id/download')
  async download(
    @Param('id') id: string,
    @CurrentUser() ctx: AuthContext,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { attachment, storagePath } =
      await this.attachmentsService.resolveDownload(id, ctx.user.id);
    res.set({
      'Content-Type': attachment.mime_type,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(attachment.original_filename)}`,
    });
    return new StreamableFile(createReadStream(storagePath));
  }
}
