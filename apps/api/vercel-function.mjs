import { buildApp } from './dist/app.js';
import { bootstrapData } from './dist/bootstrap.js';
import { seed } from './dist/data/seed.js';
const app = buildApp();
let ready;
function ensure() { if (!ready) ready = Promise.resolve().then(() => bootstrapData()).catch(() => seed()); return ready; }
export default async function handler(req, res) { await ensure(); return app(req, res); }
