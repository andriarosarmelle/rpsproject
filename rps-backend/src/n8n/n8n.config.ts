const DEFAULT_N8N_BASE_URL = 'http://127.0.0.1:5678/n8n';
const DEFAULT_N8N_WEBHOOK_PATH = '/webhook/sondage-rps-solutions-tech';
const DEFAULT_N8N_INVITATION_WEBHOOK_PATH = '/webhook/send-survey-invitations';
const WEBHOOK_SUFFIX_PATTERN = /\/webhook(?:-test|-waiting)?\/.+$/i;

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function ensureLeadingSlash(value: string) {
  return value.startsWith('/') ? value : `/${value}`;
}

function getConfiguredN8nUrl() {
  return (
    process.env.N8N_WEBHOOK_URL?.trim() ||
    process.env.N8N_BASE_URL?.trim() ||
    DEFAULT_N8N_BASE_URL
  );
}

function getConfiguredN8nBaseUrl() {
  return process.env.N8N_BASE_URL?.trim() || DEFAULT_N8N_BASE_URL;
}

export function getN8nWebhookUrl() {
  return buildWebhookUrl(
    getConfiguredN8nUrl(),
    process.env.N8N_WEBHOOK_PATH?.trim() || DEFAULT_N8N_WEBHOOK_PATH,
  );
}

export function getN8nInvitationWebhookUrl() {
  const invitationWebhookUrl = process.env.N8N_INVITATION_WEBHOOK_URL?.trim();
  const invitationWebhookPath = process.env.N8N_INVITATION_WEBHOOK_PATH?.trim();

  if (!invitationWebhookUrl && !invitationWebhookPath) {
    return null;
  }

  return buildWebhookUrl(
    invitationWebhookUrl || getConfiguredN8nBaseUrl(),
    invitationWebhookPath || DEFAULT_N8N_INVITATION_WEBHOOK_PATH,
  );
}

function buildWebhookUrl(configuredUrl: string, webhookPath: string) {
  const trimmedUrl = trimTrailingSlash(configuredUrl);

  if (WEBHOOK_SUFFIX_PATTERN.test(trimmedUrl)) {
    return trimmedUrl;
  }

  return `${trimmedUrl}${ensureLeadingSlash(webhookPath)}`;
}
