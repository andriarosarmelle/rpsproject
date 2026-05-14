import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Company } from './company.entity';
import { CompanyService } from './company.service';

describe('CompanyService', () => {
  let service: CompanyService;
  let companyRepository: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    merge: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(async () => {
    companyRepository = {
      create: jest.fn((payload) => ({ id: 1, ...payload })),
      save: jest.fn((company) => Promise.resolve(company)),
      find: jest.fn(),
      findOne: jest.fn(),
      merge: jest.fn((company, payload) => Object.assign(company, payload)),
      remove: jest.fn(() => Promise.resolve()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompanyService,
        {
          provide: getRepositoryToken(Company),
          useValue: companyRepository,
        },
      ],
    }).compile();

    service = module.get<CompanyService>(CompanyService);
  });

  it('creates and saves a company', async () => {
    await expect(service.create({ name: 'LaRoche' })).resolves.toEqual({
      id: 1,
      name: 'LaRoche',
    });
    expect(companyRepository.create).toHaveBeenCalledWith({ name: 'LaRoche' });
    expect(companyRepository.save).toHaveBeenCalledWith({
      id: 1,
      name: 'LaRoche',
    });
  });

  it('returns companies without soft-deleted employees', async () => {
    const activeEmployee = { id: 10, deleted_at: null };
    const deletedEmployee = { id: 11, deleted_at: new Date() };
    companyRepository.find.mockResolvedValue([
      {
        id: 1,
        name: 'LaRoche',
        employees: [activeEmployee, deletedEmployee],
      },
    ]);

    await expect(service.findAll()).resolves.toEqual([
      {
        id: 1,
        name: 'LaRoche',
        employees: [activeEmployee],
      },
    ]);
    expect(companyRepository.find).toHaveBeenCalledWith({
      order: { id: 'ASC' },
      relations: { campaigns: true, employees: true },
    });
  });

  it('throws when a company cannot be found', async () => {
    companyRepository.findOne.mockResolvedValue(null);

    await expect(service.findOne(404)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates an existing company', async () => {
    const existingCompany = { id: 1, name: 'Old', employees: [] };
    companyRepository.findOne.mockResolvedValue(existingCompany);

    await expect(service.update(1, { name: 'New' })).resolves.toEqual({
      id: 1,
      name: 'New',
      employees: [],
    });
    expect(companyRepository.merge).toHaveBeenCalledWith(existingCompany, {
      name: 'New',
    });
    expect(companyRepository.save).toHaveBeenCalledWith(existingCompany);
  });

  it('removes an existing company', async () => {
    const existingCompany = { id: 1, name: 'LaRoche', employees: [] };
    companyRepository.findOne.mockResolvedValue(existingCompany);

    await expect(service.remove(1)).resolves.toEqual({ deleted: true, id: 1 });
    expect(companyRepository.remove).toHaveBeenCalledWith(existingCompany);
  });
});
