import { Controller, Get, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

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
  constructor(private readonly dataSource: DataSource) {}

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
      await this.dataSource.query('SELECT 1');
      health.checks.database = 'healthy';
    } catch (error) {
      this.logger.error('Database health check failed', error);
      health.checks.database = 'unhealthy';
    }

    // Check n8n webhook endpoint (if configured)
    const n8nUrl = process.env.N8N_WEBHOOK_URL;
    if (n8nUrl) {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        const controller = new AbortController();
        timeout = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(
          n8nUrl.replace(/\/[^/]*$/, '/healthz') ||
            'http://localhost:5678/healthz',
          {
            method: 'GET',
            signal: controller.signal,
          },
        );
        health.checks.n8n = response.ok ? 'healthy' : 'unavailable';
      } catch {
        health.checks.n8n = 'unavailable';
      } finally {
        if (timeout) {
          clearTimeout(timeout);
        }
      }
    } else {
      health.checks.n8n = 'not-configured';
    }

    const n8nHealthRequired = process.env.N8N_HEALTH_REQUIRED === 'true';
    const overallHealthy =
      health.checks.database === 'healthy' &&
      (!n8nHealthRequired ||
        health.checks.n8n === 'healthy' ||
        health.checks.n8n === 'not-configured');

    return {
      ...health,
      status: overallHealthy ? 'healthy' : 'degraded',
    };
  }
}
