import { getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as schema from "@/server/db/schema";
import { NOT_STAMPED, STAMPED } from "./stamp-tables";

const tables = Object.values(schema)
  .filter((t) => is(t, PgTable))
  .map((t) => getTableName(t as PgTable))
  .sort();

describe("the couple's fingerprint", () => {
  it("covers every table – or says why not (a forgotten one would not refresh by itself)", () => {
    const known = new Set([...Object.keys(STAMPED), ...Object.keys(NOT_STAMPED)]);
    expect(tables.filter((t) => !known.has(t))).toEqual([]);
  });

  it("names only real tables, each once", () => {
    expect([...Object.keys(STAMPED), ...Object.keys(NOT_STAMPED)].filter((t) => !tables.includes(t))).toEqual([]);
    expect(Object.keys(STAMPED).filter((t) => t in NOT_STAMPED)).toEqual([]);
  });
});
