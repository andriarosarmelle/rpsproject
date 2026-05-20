import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Campaign } from '../campaign/campaign.entity';
import { Employee } from '../employee/employee.entity';
import { Question } from '../question/question.entity';
import { SurveyResponse } from '../response/response.entity';
import { CampaignParticipantController } from './campaign-participant.controller';
import { CampaignParticipant } from './campaign-participant.entity';
import { CampaignParticipantService } from './campaign-participant.service';
import { ParticipantAutomationController } from './participant-automation.controller';
import { AuthModule } from '../auth/auth.module';
import { CampaignModule } from '../campaign/campaign.module';
import { SendGridMailService } from '../email/sendgrid-mail.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CampaignParticipant,
      SurveyResponse,
      Question,
      Employee,
      Campaign,
    ]),
    AuthModule,
    CampaignModule,
  ],
  controllers: [CampaignParticipantController, ParticipantAutomationController],
  providers: [CampaignParticipantService, SendGridMailService],
  exports: [TypeOrmModule, CampaignParticipantService],
})
export class CampaignParticipantModule {}
