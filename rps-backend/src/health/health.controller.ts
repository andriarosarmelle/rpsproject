import { Controller, Get, Logger } from '@nestjs/common';
import { Client } from 'pg';

type HealthStatus = 'healthy' | 'unhealthy' | 'unavailable' | 'not-configured';

interface HealthCheck {
  status: string;
  timestamp: string;
  checks: {
    database: HealthStatus;
    n8n: HealthStatus;
  };
}

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  private async checkDatabase(): Promise<boolean> {
    const client = new Client({
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      user: process.env.DB_USER ?? 'postgres',
      password: process.env.DB_PASSWORD ?? 'postgres',
      database: process.env.DB_NAME ?? 'rps_platform',
      connectionTimeoutMillis: 5000,
    });

    await client.connect();

    try {
      await client.query('SELECT 1');
      return true;
    } finally {
      await client.end();
    }
  }

  @Get()
  async getHealth(): Promise<HealthCheck> {
    const health: HealthCheck = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'unknown' as HealthStatus,
        n8n: 'unknown' as HealthStatus,
      },
    };

    // Check database connectivity
    try {
      const isConnected = await this.checkDatabase();
      health.checks.database = isConnected ? 'healthy' : 'unhealthy';
    } catch (error) {
      this.logger.error('Database health check failed', error);
      health.checks.database = 'unhealthy';
    }

    // Check n8n webhook endpoint (if configured)
    const n8nUrl = process.env.N8N_WEBHOOK_URL;
    if (n8nUrl) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(n8nUrl.replace(/\/[^/]*$/, '/healthz') || 'http://localhost:5678/healthz', {
          method: 'GET',
          signal: controller.signal,
        });
        clearTimeout(timeout);
        health.checks.n8n = response.ok ? 'healthy' : 'unavailable';
      } catch {
        health.checks.n8n = 'unavailable';
      }
    } else {
      health.checks.n8n = 'not-configured';
    }

    const overallHealthy =
      health.checks.database === 'healthy' &&
      (health.checks.n8n === 'healthy' || health.checks.n8n === 'not-configured');

    return {
      ...health,
      status: overallHealthy ? 'healthy' : 'degraded',
    };
  }
}
