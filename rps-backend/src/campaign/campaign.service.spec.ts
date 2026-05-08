import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Company } from '../company/company.entity';
import { SurveyResponse } from '../response/response.entity';
import { Campaign } from './campaign.entity';
import { CampaignService } from './campaign.service';

describe('CampaignService', () => {
  let service: CampaignService;
  let responseRepository: { find: jest.Mock };
  const originalN8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
  const originalFetch = global.fetch;

  beforeEach(async () => {
    process.env.N8N_WEBHOOK_URL = 'http://n8n.test/webhook/rps';
    responseRepository = {
      find: jest.fn(),
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
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await (service as any).triggerAnalysis(
      1,
      'Campagne active',
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
        campaign_id: 1,
        client_email: 'client@example.com',
      },
      campaign_name: 'Campagne active',
      company_name: 'Entreprise Test',
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
        'Entreprise Test',
        'client@example.com',
      ),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });
});
