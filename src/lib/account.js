// Local progress belongs to an account. Recognize legacy stores by email
// until their next successful restore writes the stable user ID.
export function resolveAccountStore(user, remote, local, freshStore) {
  const email = user.email || "";
  const ownsLocal = local.userId
    ? local.userId === user.id
    : !!email && local.email?.toLowerCase() === email.toLowerCase();
  const saved = remote ?? (ownsLocal ? local : {});
  const meta = user.user_metadata || {};
  return {
    ...freshStore(),
    ...saved,
    userId: user.id,
    email,
    name: saved.name || meta.name || meta.full_name || email.split("@")[0] || "",
    posts: ownsLocal ? local.posts : [],
    outbox: ownsLocal ? local.outbox : [],
  };
}
