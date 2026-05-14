import {
  BadRequestException,
  ConflictException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { throwPersistenceError } from './database-error.util';

describe('throwPersistenceError', () => {
  it('rethrows existing HTTP exceptions unchanged', () => {
    const error = new NotFoundException('Missing resource');

    expect(() =>
      throwPersistenceError(error, { defaultMessage: 'Default failure' }),
    ).toThrow(error);
    expect(error).toBeInstanceOf(HttpException);
  });

  it('maps duplicate key errors to conflict exceptions', () => {
    expect(() =>
      throwPersistenceError(
        { code: '23505', constraint: 'UQ_users_email' },
        {
          defaultMessage: 'Failed to save user',
          duplicateMessage: 'Duplicate user',
          constraintMessages: {
            UQ_users_email: 'Email already exists',
          },
        },
      ),
    ).toThrow(new ConflictException('Email already exists'));
  });

  it('maps foreign key errors from nested driver errors', () => {
    expect(() =>
      throwPersistenceError(
        { driverError: { code: '23503' } },
        {
          defaultMessage: 'Failed to save response',
          foreignKeyMessage: 'Employee or question not found',
        },
      ),
    ).toThrow(new BadRequestException('Employee or question not found'));
  });

  it('maps not-null and check errors to bad requests', () => {
    expect(() =>
      throwPersistenceError(
        { code: '23502' },
        {
          defaultMessage: 'Failed to create company',
          notNullMessage: 'Company name is required',
        },
      ),
    ).toThrow(new BadRequestException('Company name is required'));

    expect(() =>
      throwPersistenceError(
        { code: '23514' },
        {
          defaultMessage: 'Failed to create campaign',
          checkMessage: 'Invalid date range',
        },
      ),
    ).toThrow(new BadRequestException('Invalid date range'));
  });

  it('falls back to an internal server error for unknown persistence errors', () => {
    expect(() =>
      throwPersistenceError(
        { code: 'UNKNOWN' },
        { defaultMessage: 'Unexpected persistence failure' },
      ),
    ).toThrow(
      new InternalServerErrorException('Unexpected persistence failure'),
    );
  });
});
