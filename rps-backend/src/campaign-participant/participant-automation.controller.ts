import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { MarkParticipantReminderDto } from './dto/campaign-participant.dto';
import { CampaignParticipantService } from './campaign-participant.service';

@Controller()
@UseGuards(AuthGuard)
export class ParticipantAutomationController {
  constructor(
    private readonly campaignParticipantService: CampaignParticipantService,
  ) {}

  @Get('campaigns/:campaignId/pending-reminders')
  @ApiResponse({
    status: 200,
    description: 'Participants de campagne disponibles pour relance n8n',
  })
  getPendingReminders(@Param('campaignId', ParseIntPipe) campaignId: number) {
    return this.campaignParticipantService.getPendingReminders(campaignId);
  }

  @Patch('participants/:id/reminder')
  @ApiBody({ type: MarkParticipantReminderDto })
  @ApiResponse({
    status: 200,
    description: 'Participant marque comme relance par n8n',
  })
  markReminderSent(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: MarkParticipantReminderDto,
  ) {
    return this.campaignParticipantService.markReminderSent(id, payload);
  }
}
