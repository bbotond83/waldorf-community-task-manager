import assert from "node:assert/strict";
import test from "node:test";
import { failure, fakeData, ok } from "../../tests/support/data-fakes.ts";
import {
  classifyDataFailure,
  malformedResponse,
  RetryableDataFailure,
  TerminalDataFailure,
} from "./errors.ts";
import { DataGateway } from "./gateway.ts";

const gatewayWith = (handlers: Parameters<typeof fakeData>[0]) => {
  const fake = fakeData(handlers);
  return { fake, gateway: new DataGateway(fake.database) };
};

test("a named function returns its envelope, with the extra fields", async () => {
  const { fake, gateway } = gatewayWith({
    rpc: () => ok({ state: "success", reference: "r1", code: null, version: 3 }),
  });
  const result = await gateway.call("duty_sign_up", { p_task_id: "t" }, "key-1");
  assert.deepEqual(result, { state: "success", reference: "r1", code: null, version: 3 });
  assert.deepEqual(fake.rpcCalls, [{ name: "duty_sign_up", args: { p_task_id: "t" } }]);
});

test("a missing reference and code become null", async () => {
  const { gateway } = gatewayWith({ rpc: () => ok({ state: "denied" }) });
  assert.deepEqual(await gateway.call("x", {}), { state: "denied", reference: null, code: null });
});

test("a permission error is a denied envelope, not a failure", async () => {
  const { gateway } = gatewayWith({ rpc: () => failure("42501", "permission denied for table") });
  const result = await gateway.call("x", {});
  assert.equal(result.state, "denied");
});

test("a duplicate is a conflict and a rejected value a validation envelope", async () => {
  const duplicate = gatewayWith({ rpc: () => failure("23505") });
  assert.equal((await duplicate.gateway.call("x", {})).state, "conflict");
  const rejected = gatewayWith({ rpc: () => failure("22P02") });
  const result = await rejected.gateway.call("x", {});
  assert.deepEqual([result.state, result.code], ["validation", "request_invalid"]);
});

test("a lost connection or a deadlock is retryable", async () => {
  for (const handler of [
    () => failure("08006", "connection failure"),
    () => failure("40P01", "deadlock detected"),
    () => failure("", "fetch failed"),
  ]) {
    const { gateway } = gatewayWith({ rpc: handler });
    await assert.rejects(gateway.call("x", {}), RetryableDataFailure);
  }
});

test("anything else unexpected is terminal, and the database text never travels in the error", async () => {
  const { gateway } = gatewayWith({ rpc: () => failure("XX000", "secret table detail") });
  await assert.rejects(gateway.call("x", {}), (error) => {
    assert.ok(error instanceof TerminalDataFailure);
    assert.doesNotMatch(String(error), /secret/);
    return true;
  });
});

test("a thrown network error is retryable", async () => {
  const { gateway } = gatewayWith({
    rpc: () => {
      throw new Error("fetch failed");
    },
  });
  await assert.rejects(gateway.call("x", {}), RetryableDataFailure);
});

test("an answer that is not an envelope is a terminal failure", async () => {
  for (const data of [
    "text",
    { reference: null },
    { state: 5 },
    { state: "success", reference: 5 },
    { state: "success", code: 1 },
    [1],
  ]) {
    const { gateway } = gatewayWith({ rpc: () => ok(data) });
    await assert.rejects(gateway.call("x", {}), TerminalDataFailure);
  }
});

test("a table read returns the rows, and its failures map like a function's", async () => {
  const { fake, gateway } = gatewayWith({ table: () => ok([{ id: "a" }]) });
  const rows = await gateway.select("rows", (client) =>
    client.from("families").select("id").eq("id", "a"),
  );
  assert.deepEqual(rows, [{ id: "a" }]);
  assert.equal(fake.queries[0]?.table, "families");
  const down = gatewayWith({ table: () => failure("08006") });
  await assert.rejects(
    down.gateway.select("rows", (client) => client.from("families").select("id")),
    RetryableDataFailure,
  );
  const broken = gatewayWith({ table: () => failure("XX000") });
  await assert.rejects(
    broken.gateway.select("rows", (client) => client.from("families").select("id")),
    TerminalDataFailure,
  );
});

test("failures are classified once: only the retryable kind is retried", () => {
  assert.equal(classifyDataFailure(new RetryableDataFailure()), "retryable");
  assert.equal(classifyDataFailure(new TerminalDataFailure("UNEXPECTED_RESPONSE")), "terminal");
  assert.equal(classifyDataFailure(new Error("anything")), "terminal");
  assert.ok(malformedResponse() instanceof TerminalDataFailure);
});
