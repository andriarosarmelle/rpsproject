import { getN8nWebhookUrl } from './n8n.config';

describe('getN8nWebhookUrl', () => {
  const originalEnv = {
    N8N_BASE_URL: process.env.N8N_BASE_URL,
    N8N_WEBHOOK_PATH: process.env.N8N_WEBHOOK_PATH,
    N8N_WEBHOOK_URL: process.env.N8N_WEBHOOK_URL,
  };

  afterEach(() => {
    restoreEnvValue('N8N_BASE_URL', originalEnv.N8N_BASE_URL);
    restoreEnvValue('N8N_WEBHOOK_PATH', originalEnv.N8N_WEBHOOK_PATH);
    restoreEnvValue('N8N_WEBHOOK_URL', originalEnv.N8N_WEBHOOK_URL);
  });

  it('keeps a fully configured webhook URL unchanged', () => {
    process.env.N8N_WEBHOOK_URL =
      'http://localhost:5678/webhook/sondage-rps-solutions-tech';
    delete process.env.N8N_BASE_URL;
    delete process.env.N8N_WEBHOOK_PATH;

    expect(getN8nWebhookUrl()).toBe(
      'http://localhost:5678/webhook/sondage-rps-solutions-tech',
    );
  });

  it('builds the webhook URL from a local base URL and path', () => {
    process.env.N8N_WEBHOOK_URL = 'http://localhost:5678';
    process.env.N8N_WEBHOOK_PATH = '/webhook/sondage-rps-solutions-tech';
    delete process.env.N8N_BASE_URL;

    expect(getN8nWebhookUrl()).toBe(
      'http://localhost:5678/webhook/sondage-rps-solutions-tech',
    );
  });

  it('uses the default local n8n path when no environment value is set', () => {
    delete process.env.N8N_WEBHOOK_URL;
    delete process.env.N8N_BASE_URL;
    delete process.env.N8N_WEBHOOK_PATH;

    expect(getN8nWebhookUrl()).toBe(
      'http://127.0.0.1:5678/n8n/webhook/sondage-rps-solutions-tech',
    );
  });
});

function restoreEnvValue(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
