export function cloudData(store) {
  return Object.fromEntries(Object.entries(store).filter(([key]) => !["posts", "outbox"].includes(key) && !key.startsWith("_")));
}

export async function saveRecoveryData(client, userId, store) {
  if (store.userId !== userId) throw new Error("Account changed before saving.");
  const { data, error } = await client.rpc("save_recovery_data", {
    payload: cloudData(store), expected_revision: store._revision || 0,
  });
  if (error) throw error;
  const revision = Number(data);
  if (!Number.isSafeInteger(revision) || revision < 1) throw new Error("The server did not confirm this save.");
  return revision;
}

export const isSyncConflict = (error) => error?.code === "40001";
