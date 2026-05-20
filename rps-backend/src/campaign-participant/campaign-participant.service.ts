import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { Campaign } from '../campaign/campaign.entity';
import { parseCsvDocument } from '../common/csv.util';
import { throwPersistenceError } from '../common/database-error.util';
import { SendGridMailService } from '../email/sendgrid-mail.service';
import { Employee } from '../employee/employee.entity';
import { Question } from '../question/question.entity';
import { SurveyResponse } from '../response/response.entity';
import {
  CampaignParticipant,
  CampaignParticipantStatus,
} from './campaign-participant.entity';
import {
  CreateCampaignParticipantDto,
  ImportCampaignEmployeeRowDto,
  ImportCampaignEmployeesDto,
  MarkParticipantReminderDto,
  SendCampaignInvitationsDto,
  SendCampaignRemindersDto,
  SubmitCampaignResponsesDto,
  UpdateCampaignParticipantDto,
} from './dto/campaign-participant.dto';

@Injectable()
export class CampaignParticipantService {
  private readonly logger = new Logger(CampaignParticipantService.name);

  constructor(
    @InjectRepository(CampaignParticipant)
    private readonly campaignParticipantRepository: Repository<CampaignParticipant>,
    @InjectRepository(SurveyResponse)
    private readonly responseRepository: Repository<SurveyResponse>,
    @InjectRepository(Question)
    private readonly questionRepository: Repository<Question>,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(Campaign)
    private readonly campaignRepository: Repository<Campaign>,
    private readonly dataSource: DataSource,
    private readonly sendGridMailService: SendGridMailService,
  ) {}

  private static normalizeCompanyName(value?: string | null) {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private static getCompanyNameFromCsvRow(
    row: Record<string, string>,
  ): string | undefined {
    const companyName = row.company_name ?? row.entreprise ?? row.company ?? '';
    return companyName.trim() || undefined;
  }

  async create(createCampaignParticipantDto: CreateCampaignParticipantDto) {
    const campaign = await this.findCampaignOrThrow(
      createCampaignParticipantDto.campaign_id,
    );
    const employee = await this.findEmployeeOrThrow(
      createCampaignParticipantDto.employee_id,
    );

    this.ensureSameCompany(employee, campaign);

    const existingParticipant =
      await this.campaignParticipantRepository.findOne({
        where: {
          campaign: { id: campaign.id },
          employee: { id: employee.id },
        },
      });

    if (existingParticipant) {
      throw new BadRequestException(
        'This employee is already assigned to this campaign',
      );
    }

    const participant = this.campaignParticipantRepository.create({
      campaign,
      employee,
      participation_token: randomUUID(),
      invitation_sent_at:
        createCampaignParticipantDto.invitation_sent_at ?? null,
      reminder_sent_at: null,
      completed_at: null,
      status: CampaignParticipantStatus.PENDING,
    });

    try {
      return await this.campaignParticipantRepository.save(participant);
    } catch (error) {
      throwPersistenceError(error, {
        defaultMessage: 'Failed to create campaign participant',
        foreignKeyMessage: 'Campaign or employee not found',
        duplicateMessage: 'This employee is already assigned to this campaign',
        constraintMessages: {
          UQ_campaign_participants_campaign_employee:
            'This employee is already assigned to this campaign',
          UQ_campaign_participants_token:
            'Generated participation token already exists',
        },
      });
    }
  }

  findAll() {
    return this.campaignParticipantRepository.find({
      where: {
        employee: { deleted_at: IsNull() },
      },
      order: { id: 'ASC' },
      relations: {
        campaign: true,
        employee: true,
      },
    });
  }

  async findOne(id: number) {
    const participant = await this.campaignParticipantRepository.findOne({
      where: { id, employee: { deleted_at: IsNull() } },
      relations: {
        campaign: true,
        employee: true,
      },
    });

    if (!participant) {
      throw new NotFoundException(`Campaign participant ${id} not found`);
    }

    return participant;
  }

  async findByToken(token: string) {
    const participant = await this.campaignParticipantRepository.findOne({
      where: {
        participation_token: token,
        employee: { deleted_at: IsNull() },
      },
      relations: {
        campaign: true,
        employee: true,
      },
    });

    if (!participant) {
      throw new NotFoundException('Participation link not found');
    }

    return participant;
  }

  async getQuestionnaireByToken(token: string) {
    const participant = await this.campaignParticipantRepository.findOne({
      where: {
        participation_token: token,
        employee: { deleted_at: IsNull() },
      },
      relations: {
        campaign: {
          company: true,
          questions: true,
        },
        employee: true,
      },
    });

    if (!participant) {
      throw new NotFoundException('Participation link not found');
    }

    return {
      token: participant.participation_token,
      status: participant.status,
      completed_at: participant.completed_at,
      employee: {
        id: participant.employee.id,
        first_name: participant.employee.first_name,
        last_name: participant.employee.last_name,
        email: participant.employee.email,
        department: participant.employee.department,
      },
      campaign: {
        id: participant.campaign.id,
        name: participant.campaign.name,
        status: participant.campaign.status,
        start_date: participant.campaign.start_date,
        end_date: participant.campaign.end_date,
        company: participant.campaign.company,
      },
      questions: [...participant.campaign.questions].sort((a, b) => {
        if (a.order_index === b.order_index) {
          return a.id - b.id;
        }

        return a.order_index - b.order_index;
      }),
    };
  }

  async update(
    id: number,
    updateCampaignParticipantDto: UpdateCampaignParticipantDto,
  ) {
    const participant = await this.findOne(id);

    if (updateCampaignParticipantDto.invitation_sent_at !== undefined) {
      participant.invitation_sent_at =
        updateCampaignParticipantDto.invitation_sent_at;
    }

    if (updateCampaignParticipantDto.reminder_sent_at !== undefined) {
      participant.reminder_sent_at =
        updateCampaignParticipantDto.reminder_sent_at;
      if (
        participant.reminder_sent_at &&
        participant.status !== CampaignParticipantStatus.COMPLETED
      ) {
        participant.status = CampaignParticipantStatus.REMINDED;
      }
    }

    if (updateCampaignParticipantDto.completed_at !== undefined) {
      participant.completed_at = updateCampaignParticipantDto.completed_at;
      if (participant.completed_at) {
        participant.status = CampaignParticipantStatus.COMPLETED;
      }
    }

    try {
      return await this.campaignParticipantRepository.save(participant);
    } catch (error) {
      throwPersistenceError(error, {
        defaultMessage: 'Failed to update campaign participant',
      });
    }
  }

  async submitByToken(token: string, payload: SubmitCampaignResponsesDto) {
    if (!payload.responses?.length) {
      throw new BadRequestException('At least one response is required');
    }

    const questionIds = payload.responses.map((item) => item.question_id);
    const uniqueQuestionIds = new Set(questionIds);

    if (uniqueQuestionIds.size !== questionIds.length) {
      throw new BadRequestException('Each question can only be answered once');
    }

    return this.dataSource.transaction(async (manager) => {
      const participantRepository = manager.getRepository(CampaignParticipant);
      const questionRepository = manager.getRepository(Question);
      const responseRepository = manager.getRepository(SurveyResponse);
      const participant = await participantRepository.findOne({
        where: {
          participation_token: token,
          employee: { deleted_at: IsNull() },
        },
        relations: {
          campaign: true,
          employee: true,
        },
      });

      if (!participant) {
        throw new NotFoundException('Participation link not found');
      }

      if (participant.completed_at) {
        throw new BadRequestException(
          'This participation link has already been used',
        );
      }

      const questions = await questionRepository.find({
        where: { id: In(questionIds) },
        relations: { campaign: true },
      });

      if (questions.length !== questionIds.length) {
        throw new BadRequestException('One or more questions do not exist');
      }

      const invalidQuestion = questions.find(
        (question) => question.campaign.id !== participant.campaign.id,
      );

      if (invalidQuestion) {
        throw new BadRequestException(
          'Submitted questions must belong to the participant campaign',
        );
      }

      const existingResponses = await responseRepository.find({
        where: {
          employee: { id: participant.employee.id },
          question: { id: In(questionIds) },
          deleted_at: IsNull(),
        },
      });

      if (existingResponses.length > 0) {
        throw new BadRequestException(
          'One or more questions have already been answered by this employee',
        );
      }

      const questionById = new Map(
        questions.map((question) => [question.id, question]),
      );
      const responses = payload.responses.map((item) =>
        responseRepository.create({
          employee: participant.employee,
          question: questionById.get(item.question_id),
          answer: item.answer,
        }),
      );

      try {
        await responseRepository.save(responses);
      } catch (error) {
        throwPersistenceError(error, {
          defaultMessage: 'Failed to save responses',
          duplicateMessage:
            'One or more questions have already been answered by this employee',
          constraintMessages: {
            IDX_responses_employee_question_active:
              'One or more questions have already been answered by this employee',
            UQ_responses_employee_question:
              'One or more questions have already been answered by this employee',
          },
        });
      }

      participant.completed_at = new Date();
      participant.status = CampaignParticipantStatus.COMPLETED;
      participant.employee.status = 'OK';

      try {
        await manager.getRepository(Employee).save(participant.employee);
        await participantRepository.save(participant);
      } catch (error) {
        throwPersistenceError(error, {
          defaultMessage: 'Failed to finalize campaign participant submission',
        });
      }

      return {
        submitted: true,
        participant_id: participant.id,
        completed_at: participant.completed_at,
        response_count: responses.length,
      };
    });
  }

  async getCampaignProgress(campaignId: number) {
    try {
      const participants = await this.campaignParticipantRepository.find({
        where: {
          campaign: { id: campaignId },
          employee: { deleted_at: IsNull() },
        },
        relations: { employee: true },
        order: { id: 'ASC' },
      });
      await this.ensureParticipationTokens(participants);

      const total = participants.length;
      const completed = participants.filter(
        (participant) =>
          participant.status === CampaignParticipantStatus.COMPLETED,
      ).length;
      const reminded = participants.filter(
        (participant) =>
          participant.status === CampaignParticipantStatus.REMINDED,
      ).length;
      const pending = participants.filter(
        (participant) =>
          participant.status === CampaignParticipantStatus.PENDING,
      ).length;

      return {
        campaign_id: campaignId,
        total_participants: total,
        completed_participants: completed,
        pending_participants: pending,
        reminded_participants: reminded,
        participation_rate:
          total === 0 ? 0 : Number(((completed / total) * 100).toFixed(2)),
        participants,
      };
    } catch (error) {
      throwPersistenceError(error, {
        defaultMessage: 'Failed to get campaign progress',
        foreignKeyMessage: 'Campaign not found',
      });
    }
  }

  private async ensureParticipationTokens(participants: CampaignParticipant[]) {
    const missingTokens = participants.filter(
      (participant) => !participant.participation_token,
    );

    if (!missingTokens.length) {
      return;
    }

    for (const participant of missingTokens) {
      participant.participation_token = randomUUID();
    }

    await this.campaignParticipantRepository.save(missingTokens);
  }

  async importEmployeesForCampaign(
    campaignId: number,
    payload: ImportCampaignEmployeesDto,
  ) {
    try {
      this.logger.log(
        `[Import] Starting import for campaign ${campaignId}, company ${payload.company_id}`,
      );
      this.logger.log(
        `[Import] CSV length: ${payload.csv?.length || 0}, Rows provided: ${payload.rows?.length || 0}`,
      );

      const campaign = await this.findCampaignOrThrow(campaignId);

      if (campaign.company.id !== payload.company_id) {
        throw new BadRequestException(
          `Company mismatch: campaign has company ${campaign.company.id}, but payload has ${payload.company_id}`,
        );
      }

      const rows = payload.rows?.length
        ? payload.rows
        : this.parseCsv(payload.csv ?? '');

      this.logger.log(`[Import] Parsed ${rows.length} rows from CSV`);

      const normalizedRows = Array.from(
        new Map(
          rows
            .filter((row) => row.email?.trim())
            .map((row) => [row.email.trim().toLowerCase(), row]),
        ).values(),
      );
      const companyNameByEmail = new Map(
        normalizedRows.map((row) => [
          row.email.trim().toLowerCase(),
          CampaignParticipantService.normalizeCompanyName(row.company_name),
        ]),
      );
      const uniqueCompanyNames = [
        ...new Set(
          Array.from(companyNameByEmail.values()).filter(
            (name): name is string => Boolean(name),
          ),
        ),
      ];

      this.logger.log(
        `[Import] Starting import of ${normalizedRows.length} employees for campaign ${campaignId}`,
      );

      if (normalizedRows.length === 0) {
        throw new BadRequestException(
          'No valid employee rows found in CSV. Ensure you have email addresses.',
        );
      }

      const employeesByEmail = new Map<string, Employee>();
      const BATCH_SIZE = 50;

      for (let i = 0; i < normalizedRows.length; i += BATCH_SIZE) {
        const batch = normalizedRows.slice(i, i + BATCH_SIZE);
        this.logger.log(
          `[Import] Processing batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} rows)`,
        );

        const batchEmails = batch.map((row) => row.email.trim().toLowerCase());

        try {
          const existingEmployees = await this.employeeRepository
            .createQueryBuilder('employee')
            .leftJoinAndSelect('employee.company', 'company')
            .where('LOWER(employee.email) IN (:...emails)', {
              emails: batchEmails,
            })
            .getMany();

          const existingMap = new Map(
            existingEmployees.map((employee) => [
              employee.email?.toLowerCase(),
              employee,
            ]),
          );
          const employeesToSave: Employee[] = [];

          for (const row of batch) {
            const email = row.email.trim().toLowerCase();
            const existingEmployee = existingMap.get(email);

            if (employeesByEmail.has(email)) {
              continue;
            }

            if (
              existingEmployee &&
              existingEmployee.company.id !== payload.company_id
            ) {
              this.logger.warn(
                `[Import] Employee ${email} already exists for different company. Skipping.`,
              );
              continue;
            }

            const employee =
              existingEmployee ??
              this.employeeRepository.create({
                email,
                survey_token: randomUUID(),
                company: campaign.company,
              });

            employee.first_name = row.first_name?.trim() || 'N/A';
            employee.last_name = row.last_name?.trim() || 'N/A';
            employee.phone = row.phone?.trim() || null;
            employee.status = row.status?.trim() || null;
            employee.department = row.department?.trim() || null;
            employee.company_name = row.company_name?.trim() || null;
            employee.company = campaign.company;
            employee.deleted_at = null;
            employee.survey_token = employee.survey_token ?? randomUUID();

            employeesToSave.push(employee);
          }

          if (employeesToSave.length > 0) {
            // Save batch within a transaction
            await this.employeeRepository.manager.transaction(
              async (transactionalEntityManager) => {
                const savedBatch =
                  await transactionalEntityManager.save(employeesToSave);
                for (const employee of savedBatch) {
                  if (employee.email) {
                    employeesByEmail.set(
                      employee.email.toLowerCase(),
                      employee,
                    );
                  }
                }
                this.logger.log(
                  `[Import] Saved ${savedBatch.length} employees in batch`,
                );
              },
            );
          }
        } catch (error) {
          this.logger.error(
            `[Import] Error processing batch starting at index ${i}:`,
            error instanceof Error ? error.stack : undefined,
          );
          throwPersistenceError(error, {
            defaultMessage: `Failed to import employees for batch ${Math.floor(i / BATCH_SIZE) + 1}`,
            foreignKeyMessage: 'Company not found',
            duplicateMessage:
              'One or more employees already exist with the same email or survey token',
            constraintMessages: {
              UQ_employees_email:
                'One or more employees already exist with the same email',
              UQ_employees_survey_token:
                'One or more employees already exist with the same survey token',
            },
          });
        }
      }

      const employees = Array.from(employeesByEmail.values());

      this.logger.log(
        `[Import] Successfully imported ${employees.length} unique employees`,
      );

      const participantsToCreate: CampaignParticipant[] = [];
      const employeeIds = employees.map((employee) => employee.id);

      if (employeeIds.length > 0) {
        const existingParticipants =
          await this.campaignParticipantRepository.find({
            where: {
              campaign: { id: campaignId },
              employee: { id: In(employeeIds) },
            },
            relations: { employee: true },
          });

        const existingSet = new Set(
          existingParticipants.map((participant) => participant.employee.id),
        );

        for (const employee of employees) {
          if (!existingSet.has(employee.id)) {
            participantsToCreate.push(
              this.campaignParticipantRepository.create({
                campaign,
                employee,
                participation_token: randomUUID(),
                invitation_sent_at: payload.invitation_sent_at ?? null,
                reminder_sent_at: null,
                completed_at: null,
                status: CampaignParticipantStatus.PENDING,
              }),
            );
          }
        }
      }

      let participants: CampaignParticipant[] = [];
      if (participantsToCreate.length > 0) {
        try {
          participants =
            await this.campaignParticipantRepository.save(participantsToCreate);
          this.logger.log(
            `[Import] Created ${participants.length} new participants`,
          );

          try {
            if (participants.length > 0) {
              const participantIds = participants
                .map((participant) => participant.id)
                .filter((id): id is number => id !== undefined && id !== null);

              this.logger.log(
                `[Import] Reloading ${participantIds.length} participants with employee relations`,
              );

              if (participantIds.length > 0) {
                participants = await this.campaignParticipantRepository.find({
                  where: { id: In(participantIds) },
                  relations: { employee: true },
                });
                this.logger.log(
                  `[Import] Reloaded ${participants.length} participants with employee relations`,
                );
              }
            }
          } catch (reloadError) {
            this.logger.warn(
              '[Import] Could not reload participants with relations, continuing with direct mapping:',
              reloadError instanceof Error
                ? reloadError.message
                : String(reloadError),
            );
          }
        } catch (error) {
          this.logger.error(
            '[Import] Error saving participants',
            error instanceof Error ? error.stack : undefined,
          );
          throwPersistenceError(error, {
            defaultMessage: 'Failed to create campaign participants',
            duplicateMessage:
              'One or more employees are already assigned to this campaign',
            constraintMessages: {
              UQ_campaign_participants_campaign_employee:
                'One or more employees are already assigned to this campaign',
              UQ_campaign_participants_token:
                'A generated participation token already exists',
            },
          });
        }
      }

      const participantRecords =
        employeeIds.length > 0
          ? await this.campaignParticipantRepository.find({
              where: {
                campaign: { id: campaignId },
                employee: { id: In(employeeIds) },
              },
              relations: { employee: true },
              order: { id: 'ASC' },
            })
          : [];

      this.logger.log(
        `[Import] Company names extracted: ${uniqueCompanyNames.join(', ') || 'none'}`,
      );

      const result = {
        imported_employees: employees.length,
        participants: participantRecords.map((p) => {
          let emp: Employee | undefined;

          if (p.employee) {
            emp = p.employee;
          }

          if (!emp) {
            console.warn(
              `[Import] No employee data found for participant ${p.participation_token}`,
            );
            return {
              participation_token: p.participation_token,
              employee: {
                first_name: 'N/A',
                last_name: 'N/A',
                email: '',
                company_name: '',
              },
            };
          }

          return {
            participation_token: p.participation_token,
            employee: {
              first_name: emp.first_name || 'N/A',
              last_name: emp.last_name || 'N/A',
              email: emp.email || '',
              company_name:
                (emp.email &&
                  companyNameByEmail.get(emp.email.toLowerCase())) ||
                '',
            },
          };
        }),
        company_names: uniqueCompanyNames,
        analysis_status: 'manual_trigger_required',
      };

      return result;
    } catch (error) {
      this.logger.error(
        '[Import] Fatal error during import',
        error instanceof Error ? error.stack : undefined,
      );
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throwPersistenceError(error, {
        defaultMessage: 'Employee import failed',
        duplicateMessage: 'One or more employees or participants already exist',
        constraintMessages: {
          UQ_employees_email:
            'One or more employees already exist with the same email',
          UQ_employees_survey_token:
            'One or more employees already exist with the same survey token',
          UQ_campaign_participants_campaign_employee:
            'One or more employees are already assigned to this campaign',
          UQ_campaign_participants_token:
            'A generated participation token already exists',
        },
      });
    }
  }

  async sendInvitations(
    campaignId: number,
    options: SendCampaignInvitationsDto = {},
  ) {
    const campaign = await this.findCampaignOrThrow(campaignId);

    if (campaign.status !== 'active') {
      throw new BadRequestException('Le sondage doit etre active avant envoi.');
    }

    const participants = await this.campaignParticipantRepository.find({
      where: {
        campaign: { id: campaignId },
        employee: { deleted_at: IsNull() },
      },
      relations: { employee: true },
      order: { id: 'ASC' },
    });

    await this.ensureParticipationTokens(participants);

    if (!participants.length) {
      throw new BadRequestException(
        "Importez des employes avant d'envoyer les invitations.",
      );
    }

    const eligibleParticipants = participants.filter((participant) => {
      if (participant.status === CampaignParticipantStatus.COMPLETED) {
        return false;
      }

      if (!participant.employee?.email?.trim()) {
        return false;
      }

      return options.force || !participant.invitation_sent_at;
    });

    const skippedCount = participants.length - eligibleParticipants.length;

    if (!eligibleParticipants.length) {
      return {
        success: true,
        campaign_id: campaignId,
        sent_count: 0,
        skipped_count: skippedCount,
        participants: [],
        message: 'Aucune nouvelle invitation a envoyer.',
      };
    }

    const appUrl = this.resolvePublicAppUrl(options.app_url);
    const campaignName = campaign.name?.trim() || `Campagne ${campaign.id}`;
    const companyName =
      campaign.company.name?.trim() || `Entreprise ${campaign.company.id}`;
    const recipients = eligibleParticipants.map((participant) => {
      const email = (participant.employee.email ?? '').trim().toLowerCase();
      const firstName = participant.employee.first_name?.trim() || '';
      const lastName = participant.employee.last_name?.trim() || '';
      const name = `${firstName} ${lastName}`.trim() || email;

      return {
        participant_id: participant.id,
        employee_id: participant.employee.id,
        email,
        name,
        survey_url: `${appUrl}/survey-response/${participant.participation_token}`,
        campaign_name: campaignName,
        company_name: companyName,
      };
    });

    const sendGridResult =
      await this.sendGridMailService.sendSurveyInvitations(recipients);

    if (!sendGridResult.sent.length) {
      throw new InternalServerErrorException(
        "Aucune invitation n'a pu etre envoyee via SendGrid.",
      );
    }

    const sentParticipantIds = new Set(
      sendGridResult.sent.map((recipient) => recipient.participant_id),
    );
    const sentParticipants = eligibleParticipants.filter((participant) =>
      sentParticipantIds.has(participant.id),
    );

    const invitationDate = new Date();
    for (const participant of sentParticipants) {
      participant.invitation_sent_at = invitationDate;
    }

    try {
      await this.campaignParticipantRepository.save(sentParticipants);
    } catch (error) {
      throwPersistenceError(error, {
        defaultMessage: 'Failed to update invitation send timestamps',
      });
    }

    return {
      success: sendGridResult.failed.length === 0,
      campaign_id: campaignId,
      sent_count: sendGridResult.sent.length,
      failed_count: sendGridResult.failed.length,
      skipped_count: skippedCount,
      invitations_sent_at: invitationDate,
      sendgrid_result: {
        failed: sendGridResult.failed.map((item) => ({
          participant_id: item.recipient.participant_id,
          email: item.recipient.email,
          error: item.error,
        })),
      },
      participants: sendGridResult.sent.map((recipient) => ({
        participant_id: recipient.participant_id,
        email: recipient.email,
        survey_url: recipient.survey_url,
      })),
    };
  }

  async sendReminders(
    campaignId: number,
    options: SendCampaignRemindersDto = {},
  ) {
    const participants = await this.campaignParticipantRepository.find({
      where: {
        campaign: { id: campaignId },
        employee: { deleted_at: IsNull() },
      },
      relations: { employee: true },
    });

    const thresholdDays = options.minimum_days_since_invitation ?? 6;
    const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;
    const now = Date.now();

    const pendingParticipants = participants.filter((participant) => {
      if (participant.status === CampaignParticipantStatus.COMPLETED) {
        return false;
      }

      if (options.force) {
        return true;
      }

      if (!participant.invitation_sent_at) {
        return false;
      }

      return now - participant.invitation_sent_at.getTime() >= thresholdMs;
    });

    const reminderDate = new Date();

    for (const participant of pendingParticipants) {
      participant.reminder_sent_at = reminderDate;
      participant.reminder_count = (participant.reminder_count ?? 0) + 1;
      participant.status = CampaignParticipantStatus.REMINDED;
    }

    await this.campaignParticipantRepository.save(pendingParticipants);

    return {
      campaign_id: campaignId,
      minimum_days_since_invitation: thresholdDays,
      reminded_count: pendingParticipants.length,
      reminded_participants: pendingParticipants,
    };
  }

  async getPendingReminders(campaignId: number) {
    const campaign = await this.findCampaignOrThrow(campaignId);
    const participants = await this.campaignParticipantRepository.find({
      where: {
        campaign: { id: campaignId },
        employee: { deleted_at: IsNull() },
      },
      relations: { employee: true },
      order: { id: 'ASC' },
    });

    await this.ensureParticipationTokens(participants);

    const appUrl = this.resolvePublicAppUrl();
    const pendingParticipants = participants.filter(
      (participant) =>
        participant.status !== CampaignParticipantStatus.COMPLETED,
    );

    return {
      campaign_id: campaignId,
      campaign_name: campaign.name,
      company_name: campaign.company?.name ?? 'Entreprise',
      participants: pendingParticipants.map((participant) => {
        const firstName = participant.employee.first_name?.trim() || '';
        const lastName = participant.employee.last_name?.trim() || '';
        const name =
          `${firstName} ${lastName}`.trim() ||
          participant.employee.email ||
          `Participant ${participant.id}`;

        return {
          participant_id: participant.id,
          nom: name,
          email: participant.employee.email,
          survey_url: `${appUrl}/survey-response/${participant.participation_token}`,
          invitation_sent_at: participant.invitation_sent_at,
          reminder_sent_at: participant.reminder_sent_at,
          reminder_count: participant.reminder_count ?? 0,
          status: participant.status,
        };
      }),
    };
  }

  async markReminderSent(
    participantId: number,
    payload: MarkParticipantReminderDto = {},
  ) {
    const participant = await this.findOne(participantId);

    if (participant.status === CampaignParticipantStatus.COMPLETED) {
      return {
        updated: false,
        participant_id: participant.id,
        status: participant.status,
        message: 'Participant already completed',
      };
    }

    participant.reminder_sent_at = payload.reminder_sent_at
      ? new Date(payload.reminder_sent_at)
      : new Date();
    participant.reminder_count =
      payload.reminder_count ?? (participant.reminder_count ?? 0) + 1;
    participant.status = CampaignParticipantStatus.REMINDED;

    const saved = await this.campaignParticipantRepository.save(participant);

    return {
      updated: true,
      participant_id: saved.id,
      reminder_sent_at: saved.reminder_sent_at,
      reminder_count: saved.reminder_count,
      status: saved.status,
    };
  }

  private async findCampaignOrThrow(campaignId: number) {
    const campaign = await this.campaignRepository.findOne({
      where: { id: campaignId },
      relations: { company: true },
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign ${campaignId} not found`);
    }

    return campaign;
  }

  private async findEmployeeOrThrow(employeeId: number) {
    const employee = await this.employeeRepository.findOne({
      where: { id: employeeId, deleted_at: IsNull() },
      relations: { company: true },
    });

    if (!employee) {
      throw new NotFoundException(`Employee ${employeeId} not found`);
    }

    return employee;
  }

  private ensureSameCompany(employee: Employee, campaign: Campaign) {
    if (employee.company.id !== campaign.company.id) {
      throw new BadRequestException(
        'Employee must belong to the same company as the campaign',
      );
    }
  }

  private resolvePublicAppUrl(value?: string | null) {
    const configuredUrl =
      value?.trim() ||
      process.env.APP_URL?.trim() ||
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      'http://127.0.0.1:3001';
    const normalizedUrl = configuredUrl.replace(/\/+$/, '');

    if (!/^https?:\/\/[^/]+/i.test(normalizedUrl)) {
      throw new BadRequestException(
        "L'URL publique de l'application doit commencer par http:// ou https://",
      );
    }

    return normalizedUrl;
  }

  private parseCsv(csv: string): ImportCampaignEmployeeRowDto[] {
    const { headers, rows: parsedRows, dataLineCount } = parseCsvDocument(csv);

    if (!headers.length) {
      return [];
    }

    this.logger.log(`[CSV] Headers detected: ${headers.join(', ')}`);

    const rows: ImportCampaignEmployeeRowDto[] = [];

    for (let i = 0; i < parsedRows.length; i++) {
      try {
        const row = parsedRows[i];
        const email = (
          row.email ??
          row.adresse_courriel ??
          row.courriel ??
          ''
        ).trim();

        if (!email || !email.includes('@')) {
          this.logger.warn(
            `[CSV] Row ${i + 2}: Missing or invalid email '${email}', skipping`,
          );
          continue;
        }

        rows.push({
          email,
          first_name: (row.first_name ?? row.prenom ?? '').trim() || undefined,
          last_name: (row.last_name ?? row.nom ?? '').trim() || undefined,
          phone: (row.phone ?? '').trim() || undefined,
          status: (row.status ?? row.statut ?? '').trim() || undefined,
          department:
            (
              row.department ??
              row.fonction ??
              row.titre_professionnel ??
              ''
            ).trim() || undefined,
          company_name:
            CampaignParticipantService.getCompanyNameFromCsvRow(row),
        });
      } catch (error) {
        this.logger.error(
          `[CSV] Error parsing row ${i + 2}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    this.logger.log(
      `[CSV] Successfully parsed ${rows.length} valid rows from ${dataLineCount} total rows`,
    );
    return rows;
  }
}
