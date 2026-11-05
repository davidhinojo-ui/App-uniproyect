// Use the same bundled application exercised by the local runtime tests.
// This avoids Node ESM loading uncompiled TypeScript/JSON dependencies on Vercel.
import bundled from '../build-server/replica.cjs';

export default bundled.default;
