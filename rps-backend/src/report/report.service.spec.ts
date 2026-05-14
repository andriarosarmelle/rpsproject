import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Campaign } from '../campaign/campaign.entity';
import { Report } from './report.entity';
import { ReportService } from './report.service';

describe('ReportService', () => {
  let service: ReportService;
  let reportRepository: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    remove: jest.Mock;
  };
  let campaignRepository: { findOne: jest.Mock };

  beforeEach(async () => {
    reportRepository = {
      create: jest.fn((payload) => ({ id: 20, ...payload })),
      save: jest.fn((report) => Promise.resolve(report)),
      find: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(() => Promise.resolve()),
    };
    campaignRepository = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportService,
        {
          provide: getRepositoryToken(Report),
          useValue: reportRepository,
        },
        {
          provide: getRepositoryToken(Campaign),
          useValue: campaignRepository,
        },
      ],
    }).compile();

    service = module.get<ReportService>(ReportService);
  });

  it('creates a report for an existing campaign', async () => {
    const campaign = { id: 4, name: 'Campagne active' };
    campaignRepository.findOne.mockResolvedValue(campaign);

    await expect(
      service.create({ campaign_id: 4, report_path: '/reports/rps.docx' }),
    ).resolves.toEqual({
      id: 20,
      report_path: '/reports/rps.docx',
      campaign,
    });
    expect(reportRepository.create).toHaveBeenCalledWith({
      report_path: '/reports/rps.docx',
      campaign,
    });
  });

  it('rejects report creation when the campaign is missing', async () => {
    campaignRepository.findOne.mockResolvedValue(null);

    await expect(
      service.create({ campaign_id: 404, report_path: '/reports/rps.docx' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('finds reports with their campaign relation', async () => {
    const reports = [{ id: 20, report_path: '/reports/rps.docx' }];
    reportRepository.find.mockResolvedValue(reports);

    await expect(service.findAll()).resolves.toBe(reports);
    expect(reportRepository.find).toHaveBeenCalledWith({
      order: { id: 'ASC' },
      relations: { campaign: true },
    });
  });

  it('updates report path and campaign', async () => {
    const oldCampaign = { id: 4 };
    const newCampaign = { id: 5 };
    const report = {
      id: 20,
      report_path: '/reports/old.docx',
      campaign: oldCampaign,
    };
    reportRepository.findOne.mockResolvedValue(report);
    campaignRepository.findOne.mockResolvedValue(newCampaign);

    await expect(
      service.update(20, {
        campaign_id: 5,
        report_path: '/reports/new.docx',
      }),
    ).resolves.toEqual({
      id: 20,
      report_path: '/reports/new.docx',
      campaign: newCampaign,
    });
    expect(reportRepository.save).toHaveBeenCalledWith(report);
  });

  it('removes an existing report', async () => {
    const report = { id: 20, report_path: '/reports/rps.docx' };
    reportRepository.findOne.mockResolvedValue(report);

    await expect(service.remove(20)).resolves.toEqual({
      deleted: true,
      id: 20,
    });
    expect(reportRepository.remove).toHaveBeenCalledWith(report);
  });
});
