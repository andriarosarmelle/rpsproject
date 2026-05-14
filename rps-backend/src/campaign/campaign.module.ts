import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Company } from '../company/company.entity';
import { CampaignParticipant } from '../campaign-participant/campaign-participant.entity';
import { CampaignController } from './campaign.controller';
import { Campaign } from './campaign.entity';
import { CampaignService } from './campaign.service';
import { SurveyResponse } from '../response/response.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Campaign,
      Company,
      SurveyResponse,
      CampaignParticipant,
    ]),
    AuthModule,
  ],
  controllers: [CampaignController],
  providers: [CampaignService],
  exports: [TypeOrmModule, CampaignService],
})
export class CampaignModule {}
