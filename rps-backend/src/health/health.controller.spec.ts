import { DataSource } from 'typeorm';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  const originalEnv = {
    N8N_HEALTH_REQUIRED: process.env.N8N_HEALTH_REQUIRED,
    N8N_WEBHOOK_URL: process.env.N8N_WEBHOOK_URL,
  };
  const originalFetch = global.fetch;

  afterEach(() => {
    restoreEnvValue('N8N_HEALTH_REQUIRED', originalEnv.N8N_HEALTH_REQUIRED);
    restoreEnvValue('N8N_WEBHOOK_URL', originalEnv.N8N_WEBHOOK_URL);
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('stays healthy when n8n is unavailable but optional', async () => {
    process.env.N8N_WEBHOOK_URL =
      'http://localhost:5678/webhook/sondage-rps-solutions-tech';
    delete process.env.N8N_HEALTH_REQUIRED;
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;
    const controller = new HealthController(createDataSourceMock());

    await expect(controller.getHealth()).resolves.toMatchObject({
      status: 'healthy',
      checks: {
        database: 'healthy',
        n8n: 'unavailable',
      },
    });
  });

  it('degrades when n8n is required and unavailable', async () => {
    process.env.N8N_WEBHOOK_URL =
      'http://localhost:5678/webhook/sondage-rps-solutions-tech';
    process.env.N8N_HEALTH_REQUIRED = 'true';
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;
    const controller = new HealthController(createDataSourceMock());

    await expect(controller.getHealth()).resolves.toMatchObject({
      status: 'degraded',
      checks: {
        database: 'healthy',
        n8n: 'unavailable',
      },
    });
  });

  it('degrades when the database is unhealthy', async () => {
    delete process.env.N8N_WEBHOOK_URL;
    const controller = new HealthController(
      createDataSourceMock(jest.fn().mockRejectedValue(new Error('db down'))),
    );
    jest.spyOn((controller as any).logger, 'error').mockImplementation();

    await expect(controller.getHealth()).resolves.toMatchObject({
      status: 'degraded',
      checks: {
        database: 'unhealthy',
        n8n: 'not-configured',
      },
    });
  });
});

function createDataSourceMock(query = jest.fn().mockResolvedValue([{ ok: 1 }])) {
  return { query } as unknown as DataSource;
}

function restoreEnvValue(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
