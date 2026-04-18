import { Controller, Get } from '@nestjs/common';
import { QUEUE_NAMES } from '@chat/shared';

interface MetaResponse {
  service: string;
  transports: string[];
  queues: string[];
}

@Controller('api/v1')
export class MetaController {
  /**
   * GET /api/v1/meta
   *
   * Returns stable metadata about this service's capabilities. Phase 1 scope
   * is limited to transport boundary declaration and queue name advertisement.
   * Later phases may extend this with version info and feature flags.
   */
  @Get('meta')
  getMeta(): MetaResponse {
    return {
      service: 'api',
      transports: ['rest', 'websocket'],
      queues: [QUEUE_NAMES.system],
    };
  }
}
