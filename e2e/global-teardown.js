// Posle svih testova: brisanje zajedničkog E2E sadržaja. Vidi e2e/fixtures.js.
import { removeFixtures } from './fixtures.js';

export default async function globalTeardown() {
  await removeFixtures();
}
