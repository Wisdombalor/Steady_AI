import test from "node:test";
import assert from "node:assert/strict";
import { resolveAccountStore } from "../src/lib/account.js";

const freshStore = () => ({ done: 0, name: "", posts: [], outbox: [], checks: [], start: 0 });
const user = { id: "new-user", email: "new@example.com", user_metadata: { full_name: "New User" } };
const resolve = (remote, local = freshStore(), account = user) => resolveAccountStore(account, remote, local, freshStore);

test("a new Google or email account starts onboarding", () => {
  assert.equal(resolve(null).done, 0);
  assert.equal(resolve(null).name, "New User");
});

test("an old account without completed setup still starts onboarding", () => {
  assert.equal(resolve(null, freshStore(), { ...user, created_at: "2020-01-01" }).done, 0);
});

test("completed cloud onboarding restores the dashboard and recovery data", () => {
  const next = resolve({ done: 1, start: 123, name: "Saved Name", checks: [1] });
  assert.equal(next.done, 1);
  assert.equal(next.start, 123);
  assert.equal(next.name, "Saved Name");
  assert.deepEqual(next.checks, [1]);
});

test("incomplete cloud setup cannot inherit another account's completed state", () => {
  const next = resolve({ done: 0, start: 123 }, { ...freshStore(), done: 1, userId: "other" });
  assert.equal(next.done, 0);
  assert.equal(next.start, 123);
});

test("switching accounts discards local completion, private posts and outbox", () => {
  const next = resolve(null, { ...freshStore(), userId: "other", done: 1, name: "Other", posts: [1], outbox: [2] });
  assert.equal(next.done, 0);
  assert.equal(next.name, "New User");
  assert.deepEqual(next.posts, []);
  assert.deepEqual(next.outbox, []);
});

test("anonymous browser completion does not onboard a newly signed-in account", () => {
  assert.equal(resolve(null, { ...freshStore(), done: 1 }).done, 0);
});

test("same-account local progress survives when no cloud row exists", () => {
  const next = resolve(null, { ...freshStore(), userId: user.id, done: 1, start: 456 });
  assert.equal(next.done, 1);
  assert.equal(next.start, 456);
});

test("legacy matching email preserves completion and gains account ownership", () => {
  const next = resolve(null, { ...freshStore(), email: "NEW@EXAMPLE.COM", done: 1 });
  assert.equal(next.done, 1);
  assert.equal(next.userId, user.id);
});

test("stable ownership takes precedence over a matching legacy email", () => {
  assert.equal(resolve(null, { ...freshStore(), email: user.email, userId: "other", done: 1 }).done, 0);
});

test("refreshing an incomplete same-account store does not mark it complete", () => {
  assert.equal(resolve({ done: 0 }, { ...freshStore(), userId: user.id, done: 1 }).done, 0);
});
