import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { SurveyResponse } from '../response/response.entity';
import { throwPersistenceError } from '../common/database-error.util';
import { Company } from '../company/company.entity';
import {
  CampaignParticipant,
  CampaignParticipantStatus,
} from '../campaign-participant/campaign-participant.entity';
import { getN8nWebhookUrl } from '../n8n/n8n.config';
import {
  campaignStatuses,
  CampaignStatus,
  CreateCampaignDto,
  UpdateCampaignDto,
} from './dto/campaign.dto';
import { Campaign } from './campaign.entity';

type N8nParticipantStatusRow = {
  participant_id: number;
  employee_id: number | null;
  email: string;
  name: string;
  first_name: string;
  last_name: string;
  employer: string;
  function: string;
  participation_status: CampaignParticipantStatus;
  response_status: 'responded' | 'not_responded';
  responded: boolean;
  response_count: number;
  invitation_sent_at: Date | null;
  reminder_sent_at: Date | null;
  completed_at: Date | null;
};

@Injectable()
export class CampaignService {
  private readonly logger = new Logger(CampaignService.name);
  private readonly n8nWebhookUrl: string;

  constructor(
    @InjectRepository(Campaign)
    private readonly campaignRepository: Repository<Campaign>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(SurveyResponse)
    private readonly responseRepository: Repository<SurveyResponse>,
    @InjectRepository(CampaignParticipant)
    private readonly campaignParticipantRepository: Repository<CampaignParticipant>,
  ) {
    this.n8nWebhookUrl = getN8nWebhookUrl();
  }

  async create(createCampaignDto: CreateCampaignDto) {
    const status = createCampaignDto.status ?? 'preparation';
    this.ensureValidStatus(status);
    this.ensureValidDateRange(
      createCampaignDto.start_date,
      createCampaignDto.end_date,
    );

    const company = await this.findCompanyOrThrow(createCampaignDto.company_id);

    const campaign = this.campaignRepository.create({
      name: createCampaignDto.name,
      description: createCampaignDto.description ?? null,
      start_date: createCampaignDto.start_date,
      end_date: createCampaignDto.end_date,
      status,
      company,
    });

    try {
      return this.normalizeCampaignForRead(
        await this.campaignRepository.save(campaign),
      );
    } catch (error) {
      throwPersistenceError(error, {
        defaultMessage: 'Failed to create campaign',
        foreignKeyMessage: 'Company not found',
        checkMessage:
          'Campaign end date must be greater than or equal to start date',
        constraintMessages: {
          CHK_campaign_dates:
            'Campaign end date must be greater than or equal to start date',
        },
      });
    }
  }

  async findAll() {
    const campaigns = await this.campaignRepository.find({
      order: { id: 'ASC' },
      relations: { company: true, questions: true, reports: true },
    });

    return campaigns.map((campaign) => this.normalizeCampaignForRead(campaign));
  }

  async findOne(id: number) {
    const campaign = await this.campaignRepository.findOne({
      where: { id },
      relations: { company: true, questions: true, reports: true },
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign ${id} not found`);
    }

    return this.normalizeCampaignForRead(campaign);
  }

  async update(id: number, updateCampaignDto: UpdateCampaignDto) {
    const campaign = await this.findOne(id);
    let company = campaign.company;

    if (updateCampaignDto.company_id !== undefined) {
      company = await this.findCompanyOrThrow(updateCampaignDto.company_id);
    }

    if (updateCampaignDto.name !== undefined) {
      campaign.name = updateCampaignDto.name;
    }

    if (updateCampaignDto.description !== undefined) {
      campaign.description = updateCampaignDto.description;
    }

    if (updateCampaignDto.start_date !== undefined) {
      campaign.start_date = updateCampaignDto.start_date;
    }

    if (updateCampaignDto.end_date !== undefined) {
      campaign.end_date = updateCampaignDto.end_date;
    }

    if (updateCampaignDto.status !== undefined) {
      this.ensureValidStatus(updateCampaignDto.status);
      campaign.status = updateCampaignDto.status;
    }

    this.ensureValidDateRange(campaign.start_date, campaign.end_date);
    campaign.company = company;

    try {
      return await this.campaignRepository.save(campaign);
    } catch (error) {
      throwPersistenceError(error, {
        defaultMessage: 'Failed to update campaign',
        foreignKeyMessage: 'Company not found',
        checkMessage:
          'Campaign end date must be greater than or equal to start date',
        constraintMessages: {
          CHK_campaign_dates:
            'Campaign end date must be greater than or equal to start date',
        },
      });
    }
  }

  async remove(id: number) {
    const campaign = await this.findOne(id);
    await this.campaignRepository.remove(campaign);
    return { deleted: true, id };
  }

  async activate(id: number) {
    const campaign = await this.findOne(id);

    if (!campaign.questions.length) {
      throw new BadRequestException(
        'A campaign needs at least one question before activation',
      );
    }

    campaign.status = 'active';
    return this.campaignRepository.save(campaign);
  }

  async terminate(id: number) {
    const campaign = await this.findOne(id);
    campaign.status = 'terminated';
    return this.campaignRepository.save(campaign);
  }

  async archive(id: number) {
    const campaign = await this.findOne(id);
    campaign.status = 'archived';
    return this.campaignRepository.save(campaign);
  }

  async analyze(campaignId: number, userEmail: string) {
    const campaign = await this.findOne(campaignId);
    const companyName = campaign.company?.name || 'Entreprise';

    return this.triggerAnalysis(
      campaignId,
      campaign.name,
      campaign.company?.id ?? null,
      companyName,
      userEmail,
    );
  }

  async analyzeWithCompanyName(
    campaignId: number,
    userEmail: string,
    companyName?: string,
  ) {
    const campaign = await this.findOne(campaignId);
    const finalCompanyName =
      companyName || campaign.company?.name || 'Entreprise';

    return this.triggerAnalysis(
      campaignId,
      campaign.name,
      campaign.company?.id ?? null,
      finalCompanyName,
      userEmail,
    );
  }

  private ensureValidStatus(status: CampaignStatus) {
    if (!campaignStatuses.includes(status)) {
      throw new BadRequestException(`Invalid campaign status: ${status}`);
    }
  }

  private async findCompanyOrThrow(companyId: number) {
    const company = await this.companyRepository.findOne({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException(`Company ${companyId} not found`);
    }

    return company;
  }

  /**
   * Récupère et formate toutes les réponses d'une campagne pour l'envoi à n8n.
   * Retourne un tableau d'employés avec leurs réponses Q1..Q28.
   */
  private async getCampaignResponsesFormatted(
    campaignId: number,
    defaultCompanyName: string,
  ): Promise<Array<Record<string, string>>> {
    // Récupérer toutes les réponses de la campagne avec relations employé et question
    const responses = await this.responseRepository.find({
      where: {
        employee: {
          campaign_participations: {
            campaign: { id: campaignId },
          },
        },
        question: {
          campaign: { id: campaignId },
        },
        deleted_at: IsNull(),
      },
      relations: ['employee', 'question'],
      order: { employee: { id: 'ASC' }, question: { order_index: 'ASC' } },
    });

    const employeeMap = new Map<number, Record<string, string>>();

    for (const response of responses) {
      const employee = response.employee;
      if (!employee) continue;

      let row = employeeMap.get(employee.id);
      if (!row) {
        row = {
          Employeur: employee.company_name || defaultCompanyName,
          Email: employee.email || '',
          'Nom et Prenom':
            `${employee.first_name || ''} ${employee.last_name || ''}`.trim(),
          Fonction: employee.department || '',
          Statut: 'OK',
        };
        employeeMap.set(employee.id, row);
      }

      // Ajouter la réponse pour cette question (ex: Q1, Q2, ...)
      if (response.question && response.question.order_index != null) {
        const qKey = `Q${response.question.order_index}`;
        row[qKey] = response.answer ?? '';
      }
    }

    return Array.from(employeeMap.values());
  }

  /**
   * Retourne tous les participants d'une campagne, y compris ceux qui n'ont pas
   * encore repondu, pour que n8n puisse distinguer clairement les statuts.
   */
  private async getCampaignParticipantStatuses(
    campaignId: number,
    defaultCompanyName: string,
  ): Promise<N8nParticipantStatusRow[]> {
    const participants = await this.campaignParticipantRepository.find({
      where: {
        campaign: { id: campaignId },
        employee: { deleted_at: IsNull() },
      },
      relations: { employee: true },
      order: { id: 'ASC' },
    });

    if (participants.length === 0) {
      return [];
    }

    const responses = await this.responseRepository.find({
      where: {
        employee: {
          campaign_participations: {
            campaign: { id: campaignId },
          },
        },
        question: {
          campaign: { id: campaignId },
        },
        deleted_at: IsNull(),
      },
      relations: ['employee', 'question'],
    });
    const responseCountByEmployeeId = new Map<number, number>();

    for (const response of responses) {
      const employeeId = response.employee?.id;
      if (!employeeId) {
        continue;
      }

      responseCountByEmployeeId.set(
        employeeId,
        (responseCountByEmployeeId.get(employeeId) ?? 0) + 1,
      );
    }

    return participants.map((participant) => {
      const employee = participant.employee;
      const responseCount = employee
        ? (responseCountByEmployeeId.get(employee.id) ?? 0)
        : 0;
      const responded =
        participant.status === CampaignParticipantStatus.COMPLETED ||
        Boolean(participant.completed_at) ||
        responseCount > 0;
      const firstName = employee?.first_name || '';
      const lastName = employee?.last_name || '';

      return {
        participant_id: participant.id,
        employee_id: employee?.id ?? null,
        email: employee?.email || '',
        name: `${firstName} ${lastName}`.trim(),
        first_name: firstName,
        last_name: lastName,
        employer: employee?.company_name || defaultCompanyName,
        function: employee?.department || '',
        participation_status: participant.status,
        response_status: responded ? 'responded' : 'not_responded',
        responded,
        response_count: responseCount,
        invitation_sent_at: participant.invitation_sent_at,
        reminder_sent_at: participant.reminder_sent_at,
        completed_at: participant.completed_at,
      };
    });
  }

  private async triggerAnalysis(
    campaignId: number,
    campaignName: string | null,
    companyId: number | null,
    companyName: string,
    userEmail: string,
  ) {
    // Récupérer les données des employés avec leurs réponses
    const employeesData = await this.getCampaignResponsesFormatted(
      campaignId,
      companyName,
    );
    const participants = await this.getCampaignParticipantStatuses(
      campaignId,
      companyName,
    );

    if (employeesData.length === 0) {
      throw new BadRequestException(
        'Aucune reponse exploitable n’est disponible pour cette campagne.',
      );
    }

    const respondedParticipants = participants.filter(
      (participant) => participant.responded,
    ).length;
    const pendingParticipants = participants.length - respondedParticipants;
    const participationSummary = {
      total_participants: participants.length,
      responded_participants: respondedParticipants,
      not_responded_participants: pendingParticipants,
      pending_participants: pendingParticipants,
      participation_rate:
        participants.length === 0
          ? 0
          : Number(
              ((respondedParticipants / participants.length) * 100).toFixed(2),
            ),
    };

    // Construire le payload au format attendu par n8n (identique au frontend)
    const payload = {
      body: {
        body: employeesData,
        participants,
        participation_summary: participationSummary,
        campaign_id: campaignId,
        company_id: companyId,
        client_email: userEmail,
      },
      campaign_name: campaignName,
      company_id: companyId,
      company_name: companyName,
      participants,
      participation_summary: participationSummary,
      user_email: userEmail,
    };

    try {
      const response = await fetch(this.n8nWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        this.logger.error(
          `n8n webhook failed: ${response.status} ${response.statusText}`,
        );
        throw new InternalServerErrorException(
          "Erreur lors de l'envoi de l'analyse a n8n",
        );
      }

      this.logger.log(
        `Analysis triggered for campaign ${campaignId} (${companyName}) by ${userEmail} with ${employeesData.length} employee responses`,
      );
      return {
        success: true,
        message:
          'Analyse lancee. Vous recevrez le rapport par email dans 1 a 2 minutes.',
      };
    } catch (error) {
      this.logger.error('Failed to call n8n webhook', error);
      throw new InternalServerErrorException(
        "Erreur lors du lancement de l'analyse. Verifiez que n8n est demarre.",
      );
    }
  }

  private ensureValidDateRange(startDate?: Date | null, endDate?: Date | null) {
    if (startDate && endDate && endDate < startDate) {
      throw new BadRequestException(
        'Campaign end date must be greater than or equal to start date',
      );
    }
  }

  private normalizeCampaignForRead(campaign: Campaign) {
    campaign.name = campaign.name?.trim() || `Campagne ${campaign.id}`;

    if (campaign.company) {
      campaign.company.name =
        campaign.company.name?.trim() || `Entreprise ${campaign.company.id}`;
    }

    return campaign;
  }
}
