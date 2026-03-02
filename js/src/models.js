import axios from 'axios';
import { getGatewayBase, formatTable } from './utils.js';

export async function listModels() {
  const base = getGatewayBase();
  console.log(`Fetching models from ${base}/v1/models …\n`);

  try {
    const { data } = await axios.get(`${base}/v1/models`, { timeout: 5000 });
    const rows = data.data.map(m => [m.id, m.owned_by, new Date(m.created * 1000).toISOString()]);
    formatTable(['Model ID', 'Owner', 'Created'], rows);
    console.log(`\n  Total: ${rows.length} models`);
  } catch (err) {
    console.error(`❌ Failed to list models: ${err.message}`);
    process.exit(1);
  }
}
