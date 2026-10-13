// Prints fresh values for the secret environment variables.
// Usage: npm run gen:keys  → copy the output into .env.local and Vercel.
import { generateKeyPairSync, randomBytes } from "node:crypto";

// Web Push VAPID keys: P-256 key pair, encoded the way browsers expect.
const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const pub = publicKey.export({ format: "jwk" });
const priv = privateKey.export({ format: "jwk" });
const uncompressedPoint = Buffer.concat([
  Buffer.from([0x04]),
  Buffer.from(pub.x, "base64url"),
  Buffer.from(pub.y, "base64url"),
]);

console.log(`TOKEN_ENCRYPTION_KEY=${randomBytes(32).toString("base64")}`);
console.log(`CRON_SECRET=${randomBytes(24).toString("base64url")}`);
console.log(`VAPID_PUBLIC_KEY=${uncompressedPoint.toString("base64url")}`);
console.log(`VAPID_PRIVATE_KEY=${priv.d}`);
