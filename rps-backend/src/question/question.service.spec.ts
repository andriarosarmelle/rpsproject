import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Campaign } from '../campaign/campaign.entity';
import { Question } from './question.entity';
import { QuestionService } from './question.service';

describe('QuestionService', () => {
  let service: QuestionService;
  let questionRepository: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    remove: jest.Mock;
  };
  let campaignRepository: { findOne: jest.Mock };

  beforeEach(async () => {
    questionRepository = {
      create: jest.fn((payload) => ({ id: 10, ...payload })),
      save: jest.fn((question) => Promise.resolve(question)),
      find: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(() => Promise.resolve()),
    };
    campaignRepository = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuestionService,
        {
          provide: getRepositoryToken(Question),
          useValue: questionRepository,
        },
        {
          provide: getRepositoryToken(Campaign),
          useValue: campaignRepository,
        },
      ],
    }).compile();

    service = module.get<QuestionService>(QuestionService);
  });

  it('creates a choice question and removes empty options', async () => {
    const campaign = { id: 3, status: 'preparation' };
    campaignRepository.findOne.mockResolvedValue(campaign);

    await expect(
      service.create({
        campaign_id: 3,
        question_text: 'Charge de travail',
        question_type: 'choice',
        rps_dimension: 'charge',
        order_index: 2,
        choice_options: ['Faible', '', 'Elevée'],
      }),
    ).resolves.toEqual({
      id: 10,
      campaign,
      question_text: 'Charge de travail',
      question_type: 'choice',
      rps_dimension: 'charge',
      order_index: 2,
      choice_options: ['Faible', 'Elevée'],
    });
  });

  it('does not persist options for non-choice questions', async () => {
    const campaign = { id: 3, status: 'preparation' };
    campaignRepository.findOne.mockResolvedValue(campaign);

    await service.create({
      campaign_id: 3,
      question_text: 'Commentaire libre',
      question_type: 'text',
      rps_dimension: 'qualitative',
      choice_options: ['Oui', 'Non'],
    });

    expect(questionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        choice_options: null,
        order_index: 0,
      }),
    );
  });

  it('rejects modifications when the campaign is active', async () => {
    campaignRepository.findOne.mockResolvedValue({ id: 3, status: 'active' });

    await expect(
      service.create({
        campaign_id: 3,
        question_text: 'Question',
        question_type: 'scale',
        rps_dimension: 'stress',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updates a question and clears options when type becomes text', async () => {
    const campaign = { id: 3, status: 'preparation' };
    const existingQuestion = {
      id: 10,
      campaign,
      question_text: 'Ancienne question',
      question_type: 'choice',
      rps_dimension: 'charge',
      order_index: 1,
      choice_options: ['Oui', 'Non'],
      responses: [],
    };
    questionRepository.findOne.mockResolvedValue(existingQuestion);
    campaignRepository.findOne.mockResolvedValue(campaign);

    await expect(
      service.update(10, {
        question_text: 'Nouvelle question',
        question_type: 'text',
        choice_options: ['A', 'B'],
      }),
    ).resolves.toEqual({
      ...existingQuestion,
      question_text: 'Nouvelle question',
      question_type: 'text',
      choice_options: null,
    });
  });

  it('reorders all questions in a campaign', async () => {
    const campaign = { id: 3, status: 'preparation' };
    const firstQuestion = { id: 10, order_index: 0, campaign };
    const secondQuestion = { id: 11, order_index: 1, campaign };
    campaignRepository.findOne.mockResolvedValue(campaign);
    questionRepository.find.mockResolvedValue([firstQuestion, secondQuestion]);

    await expect(
      service.reorder(3, [
        { question_id: 10, order_index: 2 },
        { question_id: 11, order_index: 1 },
      ]),
    ).resolves.toEqual([firstQuestion, secondQuestion]);
    expect(firstQuestion.order_index).toBe(2);
    expect(secondQuestion.order_index).toBe(1);
    expect(questionRepository.save).toHaveBeenCalledWith([
      firstQuestion,
      secondQuestion,
    ]);
  });

  it('rejects reorder items outside the requested campaign', async () => {
    campaignRepository.findOne.mockResolvedValue({
      id: 3,
      status: 'preparation',
    });
    questionRepository.find.mockResolvedValue([{ id: 10, order_index: 0 }]);

    await expect(
      service.reorder(3, [{ question_id: 99, order_index: 1 }]),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
