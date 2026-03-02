#!/usr/bin/env node
/**
 * Claude ZeroClaw — JavaScript utility layer
 * Provides config wizard, health check, and model listing CLI utilities.
 */
import 'dotenv/config';
import { checkHealth } from './health.js';
import { printBanner }  from './utils.js';

const cmd = process.argv[2];

printBanner();

switch (cmd) {
  case 'health':
    await checkHealth();
    break;
  case 'config':
    const { runConfigWizard } = await import('./config-wizard.js');
    await runConfigWizard();
    break;
  case 'models': {
    const { listModels } = await import('./models.js');
    await listModels();
    break;
  }
  default:
    console.log('Usage: node src/index.js <health|config|models>');
    console.log('');
    console.log('  health   — check gateway is running');
    console.log('  config   — interactive .env config wizard');
    console.log('  models   — list available Claude models');
}
