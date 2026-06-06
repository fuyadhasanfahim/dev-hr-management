module.exports = {
  apps: [
    {
      name: "devhr-server",
      cwd: "/var/www/dev-hr-management/server",
      script: "dist/server.js",
      interpreter: "node",
      node_args: "--max-old-space-size=2048",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "devhr-auth",
      cwd: "/var/www/dev-hr-management/auth",
      script: "node_modules/.bin/next",
      args: "start -p 3010",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "devhr-dashboard",
      cwd: "/var/www/dev-hr-management/dashboard",
      script: "node_modules/.bin/next",
      args: "start -p 3011",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "devhr-support",
      cwd: "/var/www/dev-hr-management/support",
      script: "node_modules/.bin/next",
      args: "start -p 3012",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "devhr-payment",
      cwd: "/var/www/dev-hr-management/payment",
      script: "node_modules/.bin/next",
      args: "start -p 3013",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
