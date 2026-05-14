import { Repository } from 'typeorm';
import {
  CampaignParticipant,
  CampaignParticipantStatus,
} from './campaign-participant.entity';
import { CampaignParticipantService } from './campaign-participant.service';
import { Employee } from '../employee/employee.entity';

type CampaignParticipantRepositoryMock = {
  find: jest.Mock;
  save: jest.Mock;
};

type EmployeeRepositoryMock = {
  createQueryBuilder: jest.Mock;
  save: jest.Mock;
};

const originalEnv = {
  APP_URL: process.env.APP_URL,
  N8N_INVITATION_WEBHOOK_PATH: process.env.N8N_INVITATION_WEBHOOK_PATH,
  N8N_INVITATION_WEBHOOK_URL: process.env.N8N_INVITATION_WEBHOOK_URL,
};
const originalFetch = global.fetch;

afterEach(() => {
  restoreEnvValue('APP_URL', originalEnv.APP_URL);
  restoreEnvValue(
    'N8N_INVITATION_WEBHOOK_PATH',
    originalEnv.N8N_INVITATION_WEBHOOK_PATH,
  );
  restoreEnvValue(
    'N8N_INVITATION_WEBHOOK_URL',
    originalEnv.N8N_INVITATION_WEBHOOK_URL,
  );
  global.fetch = originalFetch;
});

function createService(employeeRepository: EmployeeRepositoryMock) {
  return new CampaignParticipantService(
    {} as never,
    {} as never,
    {} as never,
    employeeRepository as unknown as Repository<Employee>,
    {} as never,
    {} as never,
  );
}

function createInvitationService(
  campaignParticipantRepository: CampaignParticipantRepositoryMock,
) {
  return new CampaignParticipantService(
    campaignParticipantRepository as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
}

function getSaveImportedEmployee(service: CampaignParticipantService) {
  return service['saveImportedEmployee'].bind(service) as (
    employee: Employee,
    companyId: number,
  ) => Promise<Employee | null>;
}

function createQueryBuilderMock(existingEmployee: Employee | null) {
  return {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(existingEmployee),
  };
}

describe('CampaignParticipantService', () => {
  describe('sendInvitations', () => {
    it('posts survey links to n8n and marks invitations as sent', async () => {
      process.env.N8N_INVITATION_WEBHOOK_URL =
        'http://n8n.test/webhook/send-survey-invitations';
      delete process.env.N8N_INVITATION_WEBHOOK_PATH;

      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: jest.fn().mockResolvedValue(''),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const participant = {
        id: 7,
        participation_token: 'token-7',
        invitation_sent_at: null,
        status: CampaignParticipantStatus.PENDING,
        employee: {
          id: 12,
          email: 'person@example.com',
          first_name: 'Ada',
          last_name: 'Lovelace',
          department: 'Tech',
        },
        campaign: {
          id: 47,
          name: 'Sondage RPS',
          company: { name: 'Entreprise Test' },
        },
      } as CampaignParticipant;
      const campaignParticipantRepository = {
        find: jest.fn().mockResolvedValue([participant]),
        save: jest.fn().mockResolvedValue([participant]),
      };
      const service = createInvitationService(campaignParticipantRepository);

      await expect(
        service.sendInvitations(47, {
          app_url: 'http://localhost:3001',
        }),
      ).resolves.toMatchObject({
        campaign_id: 47,
        sent_count: 1,
        skipped_count: 0,
        recipients: [
          {
            email: 'person@example.com',
            name: 'Ada Lovelace',
            survey_url: 'http://localhost:3001/survey-response/token-7',
          },
        ],
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [, request] = fetchMock.mock.calls[0];
      const body = JSON.parse((request as RequestInit).body as string) as {
        event: string;
        campaign: { id: number; company: string };
        recipients: Array<{ email: string; survey_url: string }>;
      };

      expect(body).toMatchObject({
        event: 'survey_invitations',
        campaign: { id: 47, company: 'Entreprise Test' },
        recipients: [
          {
            email: 'person@example.com',
            survey_url: 'http://localhost:3001/survey-response/token-7',
          },
        ],
      });
      expect(participant.invitation_sent_at).toBeInstanceOf(Date);
      expect(campaignParticipantRepository.save).toHaveBeenCalledWith([
        participant,
      ]);
    });
  });

  describe('saveImportedEmployee', () => {
    it('reuses an existing same-company employee when TypeORM wraps duplicate email errors', async () => {
      const existingEmployee = {
        id: 12,
        email: 'person@example.com',
        company: { id: 4 },
        survey_token: 'existing-token',
      } as Employee;
      const importedEmployee = {
        email: 'person@example.com',
        first_name: 'New',
        last_name: 'Name',
        phone: null,
        status: null,
        department: 'RH',
        company_name: 'LaRoche',
        deleted_at: null,
        survey_token: 'new-token',
        company: { id: 4 },
      } as Employee;
      const queryBuilder = createQueryBuilderMock(existingEmployee);
      const employeeRepository = {
        createQueryBuilder: jest.fn(() => queryBuilder),
        save: jest
          .fn()
          .mockRejectedValueOnce({
            driverError: {
              code: '23505',
              constraint: 'UQ_employees_email',
              detail:
                'Key (email)=(person@example.com) already exists.',
            },
          })
          .mockResolvedValueOnce(existingEmployee),
      };
      const service = createService(employeeRepository);

      await expect(
        getSaveImportedEmployee(service)(importedEmployee, 4),
      ).resolves.toBe(existingEmployee);

      expect(queryBuilder.where).toHaveBeenCalledWith(
        'LOWER(employee.email) = :email',
        { email: 'person@example.com' },
      );
      expect(existingEmployee).toMatchObject({
        first_name: 'New',
        last_name: 'Name',
        department: 'RH',
        company_name: 'LaRoche',
        deleted_at: null,
      });
      expect(employeeRepository.save).toHaveBeenCalledTimes(2);
      expect(employeeRepository.save).toHaveBeenLastCalledWith(
        existingEmployee,
      );
    });

    it('regenerates the survey token when TypeORM wraps duplicate token errors', async () => {
      const importedEmployee = {
        email: 'person@example.com',
        survey_token: 'duplicate-token',
        company: { id: 4 },
      } as Employee;
      const employeeRepository = {
        createQueryBuilder: jest.fn(),
        save: jest
          .fn()
          .mockRejectedValueOnce({
            driverError: {
              code: '23505',
              constraint: 'UQ_employees_survey_token',
              detail:
                'Key (survey_token)=(duplicate-token) already exists.',
            },
          })
          .mockResolvedValueOnce(importedEmployee),
      };
      const service = createService(employeeRepository);

      await expect(
        getSaveImportedEmployee(service)(importedEmployee, 4),
      ).resolves.toBe(importedEmployee);

      expect(importedEmployee.survey_token).not.toBe('duplicate-token');
      expect(employeeRepository.save).toHaveBeenCalledTimes(2);
      expect(employeeRepository.createQueryBuilder).not.toHaveBeenCalled();
    });
  });
});

function restoreEnvValue(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
