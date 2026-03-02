import axios from 'axios';
import { getGatewayBase } from './utils.js';

export async function checkHealth() {
  const base = getGatewayBase();
  console.log(`Checking gateway at ${base}/health …`);

  try {
    const { data, status } = await axios.get(`${base}/health`, { timeout: 5000 });
    if (data.status === 'ok') {
      console.log(`✅ Gateway is UP`);
      console.log(`   Service:       ${data.service}`);
      console.log(`   Version:       ${data.version}`);
      console.log(`   Default model: ${data.config?.default_model}`);
      console.log(`   Time:          ${data.time}`);
    } else {
      console.log(`⚠️  Unexpected response:`, data);
    }
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      console.error(`❌ Gateway is not running at ${base}`);
      console.error(`   Start it with: ./claude-zeroclaw`);
    } else {
      console.error(`❌ Health check failed: ${err.message}`);
    }
    process.exit(1);
  }
}
