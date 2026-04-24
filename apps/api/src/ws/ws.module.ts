import { Module } from '@nestjs/common';
import { RealtimeEventsService } from './realtime-events.service.js';

@Module({
  providers: [RealtimeEventsService],
  exports: [RealtimeEventsService],
})
export class WsModule {}
