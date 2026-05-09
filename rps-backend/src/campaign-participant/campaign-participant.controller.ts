import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiResponse } from '@nestjs/swagger';
import { CampaignParticipantService } from './campaign-participant.service';
import {
  CreateCampaignParticipantDto,
  ImportCampaignEmployeesDto,
  SendCampaignRemindersDto,
  SubmitCampaignResponsesDto,
  UpdateCampaignParticipantDto,
} from './dto/campaign-participant.dto';
import { AuthGuard } from '../auth/auth.guard';

@Controller('campaign-participants')
export class CampaignParticipantController {
  constructor(
    private readonly campaignParticipantService: CampaignParticipantService,
  ) {}

  // Public routes (token-based access for survey respondents)
  @Get('token/:token')
  findByToken(@Param('token') token: string) {
    return this.campaignParticipantService.findByToken(token);
  }

  @Get('token/:token/questionnaire')
  getQuestionnaireByToken(@Param('token') token: string) {
    return this.campaignParticipantService.getQuestionnaireByToken(token);
  }

  @Post('token/:token/submit')
  @ApiBody({ type: SubmitCampaignResponsesDto })
  @ApiResponse({
    status: 201,
    description: 'Réponses enregistrées avec succès',
  })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  submitByToken(
    @Param('token') token: string,
    @Body() payload: SubmitCampaignResponsesDto,
  ) {
    return this.campaignParticipantService.submitByToken(token, payload);
  }

  // Protected routes (admin only)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Post()
  @ApiBody({ type: CreateCampaignParticipantDto })
  @ApiResponse({ status: 201, description: 'Participant ajouté avec succès' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  create(@Body() createCampaignParticipantDto: CreateCampaignParticipantDto) {
    return this.campaignParticipantService.create(createCampaignParticipantDto);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Get()
  findAll() {
    return this.campaignParticipantService.findAll();
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Get('campaign/:campaignId/progress')
  getCampaignProgress(@Param('campaignId', ParseIntPipe) campaignId: number) {
    return this.campaignParticipantService.getCampaignProgress(campaignId);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Post('campaign/:campaignId/import-employees')
  @ApiBody({ type: ImportCampaignEmployeesDto })
  @ApiResponse({ status: 201, description: 'Employés importés avec succès' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  importEmployeesForCampaign(
    @Param('campaignId', ParseIntPipe) campaignId: number,
    @Body() payload: ImportCampaignEmployeesDto,
  ) {
    return this.campaignParticipantService.importEmployeesForCampaign(
      campaignId,
      payload,
    );
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Post('campaign/:campaignId/remind')
  @ApiBody({ type: SendCampaignRemindersDto })
  @ApiResponse({ status: 200, description: 'Rappels envoyés avec succès' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  sendReminders(
    @Param('campaignId', ParseIntPipe) campaignId: number,
    @Body() payload: SendCampaignRemindersDto,
  ) {
    return this.campaignParticipantService.sendReminders(campaignId, payload);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.campaignParticipantService.findOne(id);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Patch(':id')
  @ApiBody({ type: UpdateCampaignParticipantDto })
  @ApiResponse({
    status: 200,
    description: 'Participant mis à jour avec succès',
  })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCampaignParticipantDto: UpdateCampaignParticipantDto,
  ) {
    return this.campaignParticipantService.update(
      id,
      updateCampaignParticipantDto,
    );
  }
}
