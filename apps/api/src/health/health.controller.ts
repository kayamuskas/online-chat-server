import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  /**
   * GET /healthz
   *
   * Public health check. Returns a minimal status payload so Compose
   * healthchecks and later QA smoke scripts can verify the API is up without
   * auth.
   */
  @Get('healthz')
  check(): { status: string; service: string } {
    return { status: 'ok', service: 'api' };
  }
}
