module.exports = {
  apps: [
    {
      name: "rps-backend",
      cwd: "./rps-backend",
      script: "./dist/main.js",
      interpreter: "node",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        ADMIN_ALLOWED_EMAILS: "",
        ADMIN_BOOTSTRAP_EMAILS: "",
        ALLOWED_REGISTRATION_DOMAINS: ""
      },
      instances: 1,
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "500M",
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      kill_timeout: 5000,
      listen_timeout: 10000,
      error_file: "./logs/backend-error.log",
      out_file: "./logs/backend-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      force_start: true
    },
    {
      name: "rps-frontend",
      cwd: "./rps-frontend/nextjs-app",
      script: "./node_modules/next/dist/bin/next",
      args: "start -p 3001",
      interpreter: "node",
      env: {
        NODE_ENV: "production",
        PORT: 3001
      },
      instances: 1,
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "500M",
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      kill_timeout: 5000,
      listen_timeout: 10000,
      error_file: "./logs/frontend-error.log",
      out_file: "./logs/frontend-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      force_start: true
    }
  ],
  
  // PM2 Cluster mode (optional - for more performance)
  // Note: Use fork mode for Next.js with custom server
  // For high traffic, consider using cluster mode with proper session handling
  
  deploy: {
    production: {
      user: "deploy",
      host: "your-vps-host",
      ref: "origin/main",
      repo: "git@github.com:your-repo.git",
      path: "/var/www/rps",
      "pre-deploy-local": "",
      "post-deploy": "npm ci --omit=dev && npm run build && pm2 reload ecosystem.config.cjs --update-env"
    },
    development: {
      user: "deploy",
      host: "your-vps-host",
      ref: "origin/main",
      repo: "git@github.com:your-repo.git",
      path: "/var/www/rps-dev",
      env: {
        NODE_ENV: "development"
      }
    }
  }
};
