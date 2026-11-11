// Pre svih testova: zajednički E2E sadržaj (vežbe, treninzi, programi). Vidi e2e/fixtures.js.
import { installFixtures } from './fixtures.js';

export default async function globalSetup() {
  await installFixtures();
}
