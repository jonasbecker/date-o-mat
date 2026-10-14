// Where photo files live: a private Vercel Blob store in production, a local
// folder for development and tests. The rest of the app only sees this interface.
import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, get, put } from "@vercel/blob";
import { env } from "@/server/env";

export type PhotoStore = {
  put(pathname: string, bytes: Uint8Array, contentType: string): Promise<void>;
  /** Null if the file does not exist. */
  read(pathname: string): Promise<{ body: ReadableStream<Uint8Array> | Uint8Array; contentType: string } | null>;
  remove(pathnames: string[]): Promise<void>;
};

const blobStore: PhotoStore = {
  async put(pathname, bytes, contentType) {
    await put(pathname, Buffer.from(bytes), { access: "private", contentType, addRandomSuffix: false, allowOverwrite: false });
  },
  async read(pathname) {
    const result = await get(pathname, { access: "private" });
    if (!result || result.statusCode !== 200) return null;
    return { body: result.stream, contentType: result.blob.contentType };
  },
  async remove(pathnames) {
    if (pathnames.length) await del(pathnames);
  },
};

const LOCAL_ROOT = path.join(process.cwd(), ".data", "photos");

/** Only for development/tests (ENABLE_DEV_TOOLS=1 without a Blob token). */
const localStore: PhotoStore = {
  async put(pathname, bytes, contentType) {
    const file = path.join(LOCAL_ROOT, pathname);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, bytes);
    await writeFile(`${file}.type`, contentType);
  },
  async read(pathname) {
    const file = path.join(LOCAL_ROOT, pathname);
    try {
      const [body, contentType] = await Promise.all([readFile(file), readFile(`${file}.type`, "utf8")]);
      return { body: new Uint8Array(body), contentType };
    } catch {
      return null;
    }
  },
  async remove(pathnames) {
    await Promise.all(pathnames.flatMap((p) => [rm(path.join(LOCAL_ROOT, p), { force: true }), rm(path.join(LOCAL_ROOT, `${p}.type`), { force: true })]));
  },
};

/** Null when photos are not set up (no Blob store connected). */
export function photoStore(): PhotoStore | null {
  const kind = env().photoStorage;
  return kind === "blob" ? blobStore : kind === "local" ? localStore : null;
}
