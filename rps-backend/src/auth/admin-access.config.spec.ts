import {
  getAllowedAdminEmails,
  getAllowedRegistrationDomains,
  getBootstrapAdminEmails,
  isRegistrationAllowed,
} from './admin-access.config';

describe('admin-access.config', () => {
  const originalEnv = {
    ADMIN_ALLOWED_EMAILS: process.env.ADMIN_ALLOWED_EMAILS,
    ADMIN_BOOTSTRAP_EMAILS: process.env.ADMIN_BOOTSTRAP_EMAILS,
    ALLOWED_REGISTRATION_DOMAINS: process.env.ALLOWED_REGISTRATION_DOMAINS,
  };

  afterEach(() => {
    restoreEnvValue('ADMIN_ALLOWED_EMAILS', originalEnv.ADMIN_ALLOWED_EMAILS);
    restoreEnvValue(
      'ADMIN_BOOTSTRAP_EMAILS',
      originalEnv.ADMIN_BOOTSTRAP_EMAILS,
    );
    restoreEnvValue(
      'ALLOWED_REGISTRATION_DOMAINS',
      originalEnv.ALLOWED_REGISTRATION_DOMAINS,
    );
  });

  it('normalizes configured admin emails', () => {
    process.env.ADMIN_ALLOWED_EMAILS =
      ' Admin@Example.com,second@example.com, ,THIRD@EXAMPLE.COM ';

    expect(getAllowedAdminEmails()).toEqual([
      'admin@example.com',
      'second@example.com',
      'third@example.com',
    ]);
  });

  it('uses bootstrap emails when explicitly configured', () => {
    process.env.ADMIN_ALLOWED_EMAILS = 'admin@example.com';
    process.env.ADMIN_BOOTSTRAP_EMAILS = 'first@example.com,SECOND@example.com';

    expect(getBootstrapAdminEmails()).toEqual([
      'first@example.com',
      'second@example.com',
    ]);
  });

  it('falls back to allowed admin emails for bootstrap', () => {
    process.env.ADMIN_ALLOWED_EMAILS = 'admin@example.com';
    delete process.env.ADMIN_BOOTSTRAP_EMAILS;

    expect(getBootstrapAdminEmails()).toEqual(['admin@example.com']);
  });

  it('restricts registration to configured email domains', () => {
    process.env.ALLOWED_REGISTRATION_DOMAINS =
      'example.com, consulting.example';

    expect(getAllowedRegistrationDomains()).toEqual([
      'example.com',
      'consulting.example',
    ]);
    expect(isRegistrationAllowed('USER@EXAMPLE.COM')).toBe(true);
    expect(isRegistrationAllowed('person@consulting.example')).toBe(true);
    expect(isRegistrationAllowed('person@other.example')).toBe(false);
    expect(isRegistrationAllowed('person@fakeexample.com')).toBe(false);
  });

  it('denies registration when no domain is configured', () => {
    delete process.env.ALLOWED_REGISTRATION_DOMAINS;

    expect(isRegistrationAllowed('admin@example.com')).toBe(false);
  });
});

function restoreEnvValue(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
