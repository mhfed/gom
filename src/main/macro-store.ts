import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { renameSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { validMacro, type Macro } from "./macro.ts";
type Space = "normal" | "private";
export class MacroStore {
  private directory: string;
  private codec: {
    encrypt(value: string): Promise<string>;
    decrypt(value: string): Promise<string>;
  };
  private pending: Promise<unknown> = Promise.resolve();
  constructor(directory: string, codec: MacroStore["codec"]) {
    this.directory = directory;
    this.codec = codec;
  }
  private path(space: Space, slot: number): string {
    if (
      !["normal", "private"].includes(space) ||
      !Number.isInteger(slot) ||
      slot < 1 ||
      slot > 5
    )
      throw new Error("invalid macro slot");
    return join(
      this.directory,
      slot === 1 ? `${space}.json` : `${space}-${slot}.json`,
    );
  }
  async load(space: Space, slot = 1): Promise<Macro | null> {
    let encoded: string;
    try {
      encoded = await readFile(this.path(space, slot), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
    if (encoded.length > 500_000) throw new Error("macro too large");
    const parsed: unknown = JSON.parse(await this.codec.decrypt(encoded));
    if (!validMacro(parsed)) throw new Error("invalid macro");
    return parsed;
  }
  save(
    space: Space,
    macro: Macro,
    valid: () => boolean,
    slot = 1,
  ): Promise<boolean> {
    const copy = structuredClone(macro);
    const run = async () => {
      if (!validMacro(copy) || !valid()) return false;
      const destination = this.path(space, slot);
      await this.load(space, slot); // Do not overwrite unreadable data.
      if (!valid()) return false;
      const encoded = await this.codec.encrypt(JSON.stringify(copy));
      if (!encoded || encoded.length > 500_000 || !valid()) return false;
      await mkdir(this.directory, { recursive: true, mode: 0o700 });
      const tmp = join(this.directory, `.${randomUUID()}.tmp`);
      try {
        await writeFile(tmp, encoded, { mode: 0o600, flag: "wx" });
        if (!valid()) return false;
        renameSync(tmp, destination);
        return true;
      } finally {
        await unlink(tmp).catch(() => {});
      }
    };
    const result = this.pending.then(run, run);
    this.pending = result.catch(() => {});
    return result;
  }
  remove(space: Space, slot: number, valid: () => boolean): Promise<boolean> {
    const run = async () => {
      const path = this.path(space, slot);
      if (!valid()) return false;
      await this.load(space, slot);
      if (!valid()) return false;
      try {
        unlinkSync(path);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      return true;
    };
    const result = this.pending.then(run, run);
    this.pending = result.catch(() => {});
    return result;
  }
}
