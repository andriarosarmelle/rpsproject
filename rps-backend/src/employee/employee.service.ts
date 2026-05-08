import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { IsNull, Repository } from 'typeorm';
import { parseCsvDocument } from '../common/csv.util';
import { throwPersistenceError } from '../common/database-error.util';
import { Company } from '../company/company.entity';
import {
  CreateEmployeeDto,
  ImportEmployeeRowDto,
  ImportEmployeesDto,
  UpdateEmployeeDto,
} from './dto/employee.dto';
import { Employee } from './employee.entity';

@Injectable()
export class EmployeeService {
  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
  ) {}

  private static getCompanyNameFromCsvRow(
    row: Record<string, string>,
  ): string | undefined {
    const companyName = row.company_name ?? row.entreprise ?? row.company ?? '';
    return companyName.trim() || undefined;
  }

  async create(createEmployeeDto: CreateEmployeeDto) {
    const company = await this.findCompanyOrThrow(createEmployeeDto.company_id);
    const email = createEmployeeDto.email.trim().toLowerCase();
    const existingEmployee = await this.findEmployeeByEmail(email);

    if (existingEmployee && !existingEmployee.deleted_at) {
      throw new ConflictException(
        `Employee with email ${email} already exists`,
      );
    }

    if (
      existingEmployee?.deleted_at &&
      existingEmployee.company.id !== company.id
    ) {
      throw new ConflictException(
        `Employee with email ${email} already exists in another company`,
      );
    }

    const employee =
      existingEmployee?.deleted_at && existingEmployee.company.id === company.id
        ? existingEmployee
        : this.employeeRepository.create();

    employee.first_name = createEmployeeDto.first_name;
    employee.last_name = createEmployeeDto.last_name;
    employee.email = email;
    employee.company_name = createEmployeeDto.company_name?.trim() || null;
    employee.phone = createEmployeeDto.phone ?? null;
    employee.status = createEmployeeDto.status?.trim() || null;
    employee.department = createEmployeeDto.department ?? null;
    employee.survey_token =
      createEmployeeDto.survey_token ??
      existingEmployee?.survey_token ??
      randomUUID();
    employee.company = company;
    employee.deleted_at = null;

    try {
      return await this.employeeRepository.save(employee);
    } catch (error) {
      throwPersistenceError(error, {
        defaultMessage: 'Failed to create employee',
        foreignKeyMessage: 'Company not found',
        duplicateMessage:
          'An employee with the same email or survey token already exists',
        constraintMessages: {
          UQ_employees_email: `Employee with email ${email} already exists`,
          UQ_employees_survey_token:
            'An employee with this survey token already exists',
        },
      });
    }
  }

  async findAll(page: number = 1, limit: number = 50) {
    try {
      const skip = (page - 1) * limit;
      const employees = await this.employeeRepository.find({
        where: { deleted_at: IsNull() },
        order: { id: 'ASC' },
        relations: { company: true, responses: true },
        skip,
        take: limit,
      });

      return employees
        .filter((employee) => this.isReadableEmployee(employee))
        .map((employee) => this.normalizeEmployeeForRead(employee));
    } catch (error) {
      throwPersistenceError(error, {
        defaultMessage: 'Failed to fetch employees',
      });
    }
  }

  async findOne(id: number) {
    try {
      const employee = await this.employeeRepository.findOne({
        where: { id, deleted_at: IsNull() },
        relations: { company: true, responses: true },
      });

      if (!employee) {
        throw new NotFoundException(`Employee ${id} not found`);
      }

      if (!this.isReadableEmployee(employee)) {
        throw new NotFoundException(`Employee ${id} not found`);
      }

      return this.normalizeEmployeeForRead(employee);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throwPersistenceError(error, {
        defaultMessage: `Failed to fetch employee ${id}`,
        foreignKeyMessage: `Employee ${id} not found`,
      });
    }
  }

  async update(id: number, updateEmployeeDto: UpdateEmployeeDto) {
    const employee = await this.findOne(id);
    let company = employee.company;

    if (updateEmployeeDto.company_id !== undefined) {
      company = await this.findCompanyOrThrow(updateEmployeeDto.company_id);
    }

    if (updateEmployeeDto.first_name !== undefined) {
      employee.first_name = updateEmployeeDto.first_name;
    }

    if (updateEmployeeDto.last_name !== undefined) {
      employee.last_name = updateEmployeeDto.last_name;
    }

    if (updateEmployeeDto.email !== undefined) {
      employee.email = updateEmployeeDto.email.trim().toLowerCase();
    }

    if (updateEmployeeDto.company_name !== undefined) {
      employee.company_name = updateEmployeeDto.company_name?.trim() || null;
    }

    if (updateEmployeeDto.phone !== undefined) {
      employee.phone = updateEmployeeDto.phone;
    }

    if (updateEmployeeDto.status !== undefined) {
      employee.status = updateEmployeeDto.status?.trim() || null;
    }

    if (updateEmployeeDto.department !== undefined) {
      employee.department = updateEmployeeDto.department;
    }

    if (updateEmployeeDto.survey_token !== undefined) {
      employee.survey_token = updateEmployeeDto.survey_token;
    }

    employee.company = company;

    try {
      return await this.employeeRepository.save(employee);
    } catch (error) {
      throwPersistenceError(error, {
        defaultMessage: 'Failed to update employee',
        foreignKeyMessage: 'Company not found',
        duplicateMessage:
          'An employee with the same email or survey token already exists',
        constraintMessages: {
          UQ_employees_email: `Employee with email ${employee.email} already exists`,
          UQ_employees_survey_token:
            'An employee with this survey token already exists',
        },
      });
    }
  }

  async remove(id: number) {
    const employee = await this.findOne(id);
    employee.deleted_at = new Date();

    try {
      await this.employeeRepository.save(employee);
      return { deleted: true, id, deleted_at: employee.deleted_at };
    } catch (error) {
      throwPersistenceError(error, {
        defaultMessage: 'Failed to delete employee',
      });
    }
  }

  async importEmployees(payload: ImportEmployeesDto) {
    const company = await this.findCompanyOrThrow(payload.company_id);
    const rows = payload.rows?.length
      ? payload.rows
      : this.parseCsv(payload.csv ?? '');

    const normalizedRows = rows.filter((row) => row.email?.trim());
    const emails = normalizedRows.map((row) => row.email.trim().toLowerCase());

    const existingEmployees = emails.length
      ? await this.employeeRepository
          .createQueryBuilder('employee')
          .leftJoinAndSelect('employee.company', 'company')
          .where('LOWER(employee.email) IN (:...emails)', { emails })
          .getMany()
      : [];

    const existingByEmail = new Map(
      existingEmployees.map((employee) => [
        employee.email?.toLowerCase(),
        employee,
      ]),
    );

    const employees = normalizedRows.map((row) => {
      const email = row.email.trim().toLowerCase();
      const existingEmployee = existingByEmail.get(email);

      if (existingEmployee && existingEmployee.company.id !== company.id) {
        throw new ConflictException(
          `Employee with email ${email} already exists in another company`,
        );
      }

      if (existingEmployee) {
        existingEmployee.first_name = row.first_name?.trim() || 'N/A';
        existingEmployee.last_name = row.last_name?.trim() || 'N/A';
        existingEmployee.phone = row.phone?.trim() || null;
        existingEmployee.status = row.status?.trim() || null;
        existingEmployee.department = row.department?.trim() || null;
        existingEmployee.deleted_at = null;
        existingEmployee.company = company;
        existingEmployee.survey_token =
          existingEmployee.survey_token ?? randomUUID();
        return existingEmployee;
      }

      const newEmployee = this.employeeRepository.create();
      newEmployee.first_name = row.first_name?.trim() || 'N/A';
      newEmployee.last_name = row.last_name?.trim() || 'N/A';
      newEmployee.email = email;
      newEmployee.phone = row.phone?.trim() || null;
      newEmployee.status = row.status?.trim() || null;
      newEmployee.company_name = row.company_name?.trim() || null;
      newEmployee.department = row.department?.trim() || null;
      newEmployee.survey_token = randomUUID();
      newEmployee.company = company;
      return newEmployee;
    });

    let saved: Employee[];
    try {
      saved = await this.employeeRepository.save(employees);
    } catch (error) {
      throwPersistenceError(error, {
        defaultMessage: 'Failed to import employees',
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

    return {
      imported: saved.length,
      employees: saved,
    };
  }

  private parseCsv(csv: string): ImportEmployeeRowDto[] {
    const { rows } = parseCsvDocument(csv);
    const employees: ImportEmployeeRowDto[] = [];

    for (const row of rows) {
      const email = (
        row.email ??
        row.adresse_courriel ??
        row.courriel ??
        ''
      ).trim();

      if (!email || !email.includes('@')) {
        continue;
      }

      employees.push({
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
        company_name: EmployeeService.getCompanyNameFromCsvRow(row),
      });
    }

    return employees;
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

  private async findEmployeeByEmail(email: string) {
    return this.employeeRepository
      .createQueryBuilder('employee')
      .leftJoinAndSelect('employee.company', 'company')
      .where('LOWER(employee.email) = LOWER(:email)', {
        email: email.trim().toLowerCase(),
      })
      .getOne();
  }

  private isReadableEmployee(employee: Employee) {
    return Boolean(!employee.deleted_at && employee.email?.trim());
  }

  private normalizeEmployeeForRead(employee: Employee) {
    employee.first_name = employee.first_name?.trim() || 'Employe';
    employee.last_name = employee.last_name?.trim() || '';
    employee.department = employee.department?.trim() || 'Non renseigne';
    employee.responses =
      employee.responses?.filter((response) => !response.deleted_at) ?? [];
    employee.status = employee.responses.length > 0 ? 'OK' : '';

    return employee;
  }
}
