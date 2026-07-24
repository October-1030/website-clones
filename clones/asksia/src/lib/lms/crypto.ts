import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { LmsError } from "./types";

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";

function decodeKey(environment: NodeJS.ProcessEnv): Buffer {
  const encoded = environment.STUDYPAL_LMS_ENCRYPTION_KEY?.trim();
  if (!encoded) {
    throw new LmsError(
      "LMS token encryption is not configured.",
      "lms_encryption_not_configured",
      503,
    );
  }
  let key: Buffer;
  try {
    key = Buffer.from(encoded, "base64");
  } catch {
    throw new LmsError("LMS token encryption key is invalid.", "lms_encryption_invalid", 503);
  }
  if (key.length !== 32 || key.toString("base64").replace(/=+$/, "") !== encoded.replace(/=+$/, "")) {
    throw new LmsError("LMS token encryption key must be 32 random bytes encoded as base64.", "lms_encryption_invalid", 503);
  }
  return key;
}

export function encryptLmsToken(
  plaintext: string,
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const clean = plaintext.trim();
  if (!clean || clean.length > 8_000) {
    throw new LmsError("LMS token length is invalid.", "invalid_lms_token", 400);
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, decodeKey(environment), iv);
  const ciphertext = Buffer.concat([cipher.update(clean, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptLmsToken(
  envelope: string,
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const [version, ivEncoded, tagEncoded, ciphertextEncoded, extra] = envelope.split(".");
  if (version !== VERSION || !ivEncoded || !tagEncoded || !ciphertextEncoded || extra) {
    throw new LmsError("Stored LMS token is invalid.", "invalid_lms_token_envelope", 503);
  }
  try {
    const decipher = createDecipheriv(ALGORITHM, decodeKey(environment), Buffer.from(ivEncoded, "base64url"));
    decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextEncoded, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch (error) {
    if (error instanceof LmsError) throw error;
    throw new LmsError("Stored LMS token could not be decrypted.", "lms_token_decryption_failed", 503);
  }
}
