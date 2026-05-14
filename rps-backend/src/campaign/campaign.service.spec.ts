import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Company } from '../company/company.entity';
import {
  CampaignParticipant,
  CampaignParticipantStatus,
} from '../campaign-participant/campaign-participant.entity';
import { SurveyResponse } from '../response/response.entity';
import { Campaign } from './campaign.entity';
import { CampaignService } from './campaign.service';

describe('CampaignService', () => {
  let service: CampaignService;
  let responseRepository: { find: jest.Mock };
  let campaignParticipantRepository: { find: jest.Mock };
  const originalN8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
  const originalFetch = global.fetch;

  beforeEach(async () => {
    process.env.N8N_WEBHOOK_URL = 'http://n8n.test/webhook/rps';
    responseRepository = {
      find: jest.fn(),
    };
    campaignParticipantRepository = {
      find: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampaignService,
        {
          provide: getRepositoryToken(Campaign),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Company),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(SurveyResponse),
          useValue: responseRepository,
        },
        {
          provide: getRepositoryToken(CampaignParticipant),
          useValue: campaignParticipantRepository,
        },
      ],
    }).compile();

    service = module.get<CampaignService>(CampaignService);
  });

  afterEach(() => {
    if (originalN8nWebhookUrl === undefined) {
      delete process.env.N8N_WEBHOOK_URL;
    } else {
      process.env.N8N_WEBHOOK_URL = originalN8nWebhookUrl;
    }
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('formats only responses from the requested campaign', async () => {
    responseRepository.find.mockResolvedValue([
      {
        answer: '4',
        employee: {
          id: 7,
          company_name: null,
          email: 'test@example.com',
          first_name: 'Ada',
          last_name: 'Lovelace',
          department: 'R&D',
        },
        question: {
          order_index: 1,
        },
      },
    ]);

    const rows = await (service as any).getCampaignResponsesFormatted(
      12,
      'Entreprise Test',
    );

    expect(responseRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          employee: {
            campaign_participations: {
              campaign: { id: 12 },
            },
          },
          question: {
            campaign: { id: 12 },
          },
          deleted_at: expect.any(Object),
        }),
      }),
    );
    expect(rows).toEqual([
      {
        Employeur: 'Entreprise Test',
        Email: 'test@example.com',
        'Nom et Prenom': 'Ada Lovelace',
        Fonction: 'R&D',
        Statut: 'OK',
        Q1: '4',
      },
    ]);
  });

  it('formats all participant response statuses for n8n', async () => {
    const completedAt = new Date('2026-05-12T10:00:00.000Z');
    const invitedAt = new Date('2026-05-10T08:00:00.000Z');
    campaignParticipantRepository.find.mockResolvedValue([
      {
        id: 41,
        status: CampaignParticipantStatus.COMPLETED,
        invitation_sent_at: invitedAt,
        reminder_sent_at: null,
        completed_at: completedAt,
        employee: {
          id: 7,
          company_name: null,
          email: 'ada@example.com',
          first_name: 'Ada',
          last_name: 'Lovelace',
          department: 'R&D',
        },
      },
      {
        id: 42,
        status: CampaignParticipantStatus.PENDING,
        invitation_sent_at: invitedAt,
        reminder_sent_at: null,
        completed_at: null,
        employee: {
          id: 8,
          company_name: 'Filiale',
          email: 'grace@example.com',
          first_name: 'Grace',
          last_name: 'Hopper',
          department: 'IT',
        },
      },
    ]);
    responseRepository.find.mockResolvedValue([
      {
        employee: { id: 7 },
      },
      {
        employee: { id: 7 },
      },
    ]);

    const rows = await (service as any).getCampaignParticipantStatuses(
      12,
      'Entreprise Test',
    );

    expect(campaignParticipantRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          campaign: { id: 12 },
          employee: { deleted_at: expect.any(Object) },
        },
      }),
    );
    expect(rows).toEqual([
      {
        participant_id: 41,
        employee_id: 7,
        email: 'ada@example.com',
        name: 'Ada Lovelace',
        first_name: 'Ada',
        last_name: 'Lovelace',
        employer: 'Entreprise Test',
        function: 'R&D',
        participation_status: 'completed',
        response_status: 'responded',
        responded: true,
        response_count: 2,
        invitation_sent_at: invitedAt,
        reminder_sent_at: null,
        completed_at: completedAt,
      },
      {
        participant_id: 42,
        employee_id: 8,
        email: 'grace@example.com',
        name: 'Grace Hopper',
        first_name: 'Grace',
        last_name: 'Hopper',
        employer: 'Filiale',
        function: 'IT',
        participation_status: 'pending',
        response_status: 'not_responded',
        responded: false,
        response_count: 0,
        invitation_sent_at: invitedAt,
        reminder_sent_at: null,
        completed_at: null,
      },
    ]);
  });

  it('rejects analysis before calling n8n when a campaign has no usable responses', async () => {
    jest
      .spyOn(service as any, 'getCampaignResponsesFormatted')
      .mockResolvedValue([]);
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      (service as any).triggerAnalysis(
        4,
        'Campagne vide',
        10,
        'Entreprise Test',
        'client@example.com',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts the expected local analysis payload to n8n', async () => {
    jest
      .spyOn(service as any, 'getCampaignResponsesFormatted')
      .mockResolvedValue([
        {
          Employeur: 'Entreprise Test',
          Email: 'employee@example.com',
          'Nom et Prenom': 'Ada Lovelace',
          Fonction: 'R&D',
          Statut: 'OK',
          Q1: '4',
        },
      ]);
    jest
      .spyOn(service as any, 'getCampaignParticipantStatuses')
      .mockResolvedValue([
        {
          participant_id: 41,
          employee_id: 7,
          email: 'employee@example.com',
          name: 'Ada Lovelace',
          first_name: 'Ada',
          last_name: 'Lovelace',
          employer: 'Entreprise Test',
          function: 'R&D',
          participation_status: 'completed',
          response_status: 'responded',
          responded: true,
          response_count: 1,
          invitation_sent_at: null,
          reminder_sent_at: null,
          completed_at: null,
        },
        {
          participant_id: 42,
          employee_id: 8,
          email: 'pending@example.com',
          name: 'Grace Hopper',
          first_name: 'Grace',
          last_name: 'Hopper',
          employer: 'Entreprise Test',
          function: 'IT',
          participation_status: 'pending',
          response_status: 'not_responded',
          responded: false,
          response_count: 0,
          invitation_sent_at: null,
          reminder_sent_at: null,
          completed_at: null,
        },
      ]);
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await (service as any).triggerAnalysis(
      1,
      'Campagne active',
      10,
      'Entreprise Test',
      'client@example.com',
    );

    expect(result).toEqual({
      success: true,
      message:
        'Analyse lancee. Vous recevrez le rapport par email dans 1 a 2 minutes.',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://n8n.test/webhook/rps',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const [, request] = fetchMock.mock.calls[0];
    const participants = [
      {
        participant_id: 41,
        employee_id: 7,
        email: 'employee@example.com',
        name: 'Ada Lovelace',
        first_name: 'Ada',
        last_name: 'Lovelace',
        employer: 'Entreprise Test',
        function: 'R&D',
        participation_status: 'completed',
        response_status: 'responded',
        responded: true,
        response_count: 1,
        invitation_sent_at: null,
        reminder_sent_at: null,
        completed_at: null,
      },
      {
        participant_id: 42,
        employee_id: 8,
        email: 'pending@example.com',
        name: 'Grace Hopper',
        first_name: 'Grace',
        last_name: 'Hopper',
        employer: 'Entreprise Test',
        function: 'IT',
        participation_status: 'pending',
        response_status: 'not_responded',
        responded: false,
        response_count: 0,
        invitation_sent_at: null,
        reminder_sent_at: null,
        completed_at: null,
      },
    ];
    const participationSummary = {
      total_participants: 2,
      responded_participants: 1,
      not_responded_participants: 1,
      pending_participants: 1,
      participation_rate: 50,
    };

    expect(JSON.parse(request.body)).toEqual({
      body: {
        body: [
          {
            Employeur: 'Entreprise Test',
            Email: 'employee@example.com',
            'Nom et Prenom': 'Ada Lovelace',
            Fonction: 'R&D',
            Statut: 'OK',
            Q1: '4',
          },
        ],
        participants,
        participation_summary: participationSummary,
        campaign_id: 1,
        company_id: 10,
        client_email: 'client@example.com',
      },
      campaign_name: 'Campagne active',
      company_id: 10,
      company_name: 'Entreprise Test',
      participants,
      participation_summary: participationSummary,
      user_email: 'client@example.com',
    });
  });

  it('wraps n8n failures in a delivery error', async () => {
    jest
      .spyOn(service as any, 'getCampaignResponsesFormatted')
      .mockResolvedValue([{ Employeur: 'Entreprise Test', Q1: '4' }]);
    jest.spyOn((service as any).logger, 'error').mockImplementation();
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 500, statusText: 'Error' }) as
      unknown as typeof fetch;

    await expect(
      (service as any).triggerAnalysis(
        1,
        'Campagne active',
        10,
        'Entreprise Test',
        'client@example.com',
      ),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });
});
