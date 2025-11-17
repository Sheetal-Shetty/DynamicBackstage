import { createBackendModule } from '@backstage/backend-plugin-api';
import { scaffolderActionsExtensionPoint } from '@backstage/plugin-scaffolder-node';
import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

export function createDockerComposeAction() {
  return createTemplateAction({
    id: 'custom:docker-compose',
    description: 'Runs docker compose from a provided compose file',

    schema: {
      input: {
        type: 'object',
        required: ['composeFile'],
        properties: {
          composeFile: { type: 'string' },
          workDir: { type: 'string' },
        },
      },
    },

    async handler(ctx) {
      const cwd = ctx.input.workDir ?? ctx.workspacePath;
      const composePath = path.join(cwd, ctx.input.composeFile);

      ctx.logger.info(`composeFile from user: ${ctx.input.composeFile}`);
      ctx.logger.info(`Workspace path: ${cwd}`);
      ctx.logger.info(`Resolved composePath: ${composePath}`);

      // Check if file exists
      if (!fs.existsSync(composePath)) {
        ctx.logger.error(`Compose file NOT FOUND at: ${composePath}`);
        throw new Error(`Compose file not found: ${composePath}`);
      }

      ctx.logger.info(`Compose file exists. Starting Docker Compose...`);

      // === Execute docker compose using spawn (full logs) ===
      const proc = spawn('/usr/bin/docker', ['compose', '-f', composePath, 'up', '-d'], {
        cwd,
      });

      proc.stdout.on('data', data => {
        ctx.logger.info(`DOCKER OUT: ${data.toString()}`);
      });

      proc.stderr.on('data', data => {
        ctx.logger.error(`DOCKER ERR: ${data.toString()}`);
      });

      await new Promise((resolve, reject) => {
        proc.on('close', code => {
          if (code === 0) {
            ctx.logger.info('Docker Compose executed successfully.');
            resolve(null);
          } else {
            ctx.logger.error(`Docker Compose exited with code ${code}`);
            reject(new Error(`Docker exited with code ${code}`));
          }
        });
      });
    },
  });
}

export const dockerComposeModule = createBackendModule({
  moduleId: 'docker-compose-actions',
  pluginId: 'scaffolder',
  register(env) {
    env.registerInit({
      deps: { scaffolder: scaffolderActionsExtensionPoint },
      async init({ scaffolder }) {
        scaffolder.addActions(createDockerComposeAction());
      },
    });
  },
});
