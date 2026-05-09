import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
  Logger,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiResponse } from '@nestjs/swagger';
import { CreateCampaignDto, UpdateCampaignDto } from './dto/campaign.dto';
import { CampaignService } from './campaign.service';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.guard';

@Controller('campaigns')
@ApiBearerAuth()
export class CampaignController {
  private readonly logger = new Logger(CampaignController.name);

  constructor(private readonly campaignService: CampaignService) {}

  @Post()
  @UseGuards(AuthGuard)
  @ApiBody({ type: CreateCampaignDto })
  @ApiResponse({ status: 201, description: 'Campagne créée avec succès' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  create(@Body() createCampaignDto: CreateCampaignDto) {
    return this.campaignService.create(createCampaignDto);
  }

  @Get()
  @UseGuards(AuthGuard)
  findAll() {
    return this.campaignService.findAll();
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.campaignService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  @ApiBody({ type: UpdateCampaignDto })
  @ApiResponse({ status: 200, description: 'Campagne mise à jour avec succès' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCampaignDto: UpdateCampaignDto,
  ) {
    return this.campaignService.update(id, updateCampaignDto);
  }

  @Post(':id/activate')
  @UseGuards(AuthGuard)
  @ApiResponse({ status: 200, description: 'Campagne activée avec succès' })
  activate(@Param('id', ParseIntPipe) id: number) {
    return this.campaignService.activate(id);
  }

  @Post(':id/terminate')
  @UseGuards(AuthGuard)
  @ApiResponse({ status: 200, description: 'Campagne terminée avec succès' })
  terminate(@Param('id', ParseIntPipe) id: number) {
    return this.campaignService.terminate(id);
  }

  @Post(':id/archive')
  @UseGuards(AuthGuard)
  @ApiResponse({ status: 200, description: 'Campagne archivée avec succès' })
  archive(@Param('id', ParseIntPipe) id: number) {
    return this.campaignService.archive(id);
  }

  @Post(':id/analyze')
  @UseGuards(AuthGuard)
  @ApiResponse({ status: 200, description: 'Analyse générée avec succès' })
  async analyze(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.campaignService.analyze(id, req.user.email);
  }

  @Post(':id/analyze-with-company')
  @UseGuards(AuthGuard)
  @ApiBody({
    schema: {
      type: 'object',
      properties: { company_name: { type: 'string' } },
    },
  })
  @ApiResponse({ status: 200, description: 'Analyse générée avec succès' })
  async analyzeWithCompany(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { company_name?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.campaignService.analyzeWithCompanyName(
      id,
      req.user.email,
      body.company_name,
    );
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.campaignService.remove(id);
  }
}
