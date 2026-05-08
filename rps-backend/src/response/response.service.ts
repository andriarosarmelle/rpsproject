import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { throwPersistenceError } from '../common/database-error.util';
import { Employee } from '../employee/employee.entity';
import { Question } from '../question/question.entity';
import { CreateResponseDto, UpdateResponseDto } from './dto/response.dto';
import { SurveyResponse } from './response.entity';

@Injectable()
export class ResponseService {
  constructor(
    @InjectRepository(SurveyResponse)
    private readonly responseRepository: Repository<SurveyResponse>,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(Question)
    private readonly questionRepository: Repository<Question>,
  ) {}

  async create(createResponseDto: CreateResponseDto) {
    const employee = await this.findEmployeeOrThrow(
      createResponseDto.employee_id,
    );
    const question = await this.findQuestionOrThrow(
      createResponseDto.question_id,
    );

    await this.assertNoActiveDuplicateResponse(employee.id, question.id);

    const response = this.responseRepository.create({
      answer: createResponseDto.answer,
      employee,
      question,
    });

    try {
      const savedResponse = await this.responseRepository.save(response);
      await this.markEmployeeAsResponded(employee);
      return savedResponse;
    } catch (error) {
      throwPersistenceError(error, {
        defaultMessage: 'Failed to create response',
        foreignKeyMessage: 'Employee or question not found',
        duplicateMessage: 'This employee has already answered this question',
        constraintMessages: {
          IDX_responses_employee_question_active:
            'This employee has already answered this question',
          UQ_responses_employee_question:
            'This employee has already answered this question',
        },
      });
    }
  }

  findAll() {
    return this.responseRepository.find({
      where: {
        deleted_at: IsNull(),
        employee: { deleted_at: IsNull() },
      },
      order: { id: 'ASC' },
      relations: { employee: true, question: true },
    });
  }

  async findOne(id: number) {
    const response = await this.responseRepository.findOne({
      where: {
        id,
        deleted_at: IsNull(),
        employee: { deleted_at: IsNull() },
      },
      relations: { employee: true, question: true },
    });

    if (!response) {
      throw new NotFoundException(`Response ${id} not found`);
    }

    return response;
  }

  async update(id: number, updateResponseDto: UpdateResponseDto) {
    const response = await this.findOne(id);
    let employee = response.employee;
    let question = response.question;

    if (updateResponseDto.answer !== undefined) {
      response.answer = updateResponseDto.answer;
    }

    if (updateResponseDto.employee_id !== undefined) {
      employee = await this.findEmployeeOrThrow(updateResponseDto.employee_id);
    }

    if (updateResponseDto.question_id !== undefined) {
      question = await this.findQuestionOrThrow(updateResponseDto.question_id);
    }

    await this.assertNoActiveDuplicateResponse(
      employee.id,
      question.id,
      response.id,
    );
    response.employee = employee;
    response.question = question;

    try {
      return await this.responseRepository.save(response);
    } catch (error) {
      throwPersistenceError(error, {
        defaultMessage: 'Failed to update response',
        foreignKeyMessage: 'Employee or question not found',
        duplicateMessage: 'This employee has already answered this question',
        constraintMessages: {
          IDX_responses_employee_question_active:
            'This employee has already answered this question',
          UQ_responses_employee_question:
            'This employee has already answered this question',
        },
      });
    }
  }

  async remove(id: number) {
    const response = await this.findOne(id);
    response.deleted_at = new Date();

    try {
      await this.responseRepository.save(response);
      await this.syncEmployeeResponseStatus(response.employee);
      return { deleted: true, id, deleted_at: response.deleted_at };
    } catch (error) {
      throwPersistenceError(error, {
        defaultMessage: 'Failed to delete response',
      });
    }
  }

  private async findEmployeeOrThrow(employeeId: number) {
    const employee = await this.employeeRepository.findOne({
      where: { id: employeeId, deleted_at: IsNull() },
    });

    if (!employee) {
      throw new NotFoundException(`Employee ${employeeId} not found`);
    }

    return employee;
  }

  private async findQuestionOrThrow(questionId: number) {
    const question = await this.questionRepository.findOne({
      where: { id: questionId },
    });

    if (!question) {
      throw new NotFoundException(`Question ${questionId} not found`);
    }

    return question;
  }

  private async assertNoActiveDuplicateResponse(
    employeeId: number,
    questionId: number,
    currentResponseId?: number,
  ) {
    const existing = await this.responseRepository.findOne({
      where: {
        employee: { id: employeeId },
        question: { id: questionId },
        deleted_at: IsNull(),
      },
    });

    if (existing && existing.id !== currentResponseId) {
      throw new BadRequestException(
        'This employee has already answered this question',
      );
    }
  }

  private async markEmployeeAsResponded(employee: Employee) {
    if (employee.status === 'OK') {
      return;
    }

    employee.status = 'OK';
    await this.employeeRepository.save(employee);
  }

  private async syncEmployeeResponseStatus(employee: Employee) {
    const activeResponseCount = await this.responseRepository.count({
      where: {
        employee: { id: employee.id },
        deleted_at: IsNull(),
      },
    });
    const nextStatus = activeResponseCount > 0 ? 'OK' : '';

    if (employee.status === nextStatus) {
      return;
    }

    employee.status = nextStatus;
    await this.employeeRepository.save(employee);
  }
}
