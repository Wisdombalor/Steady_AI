// Local progress belongs to an account. Recognize legacy stores by email
// until their next successful restore writes the stable user ID.
export function resolveAccountStore(user, remote, local, freshStore) {
  const email = user.email || "";
  const ownsLocal = local.userId
    ? local.userId === user.id
    : !!email && local.email?.toLowerCase() === email.toLowerCase();
  // Guest recovery belongs to this device. Import it when creating an
  // account without cloud progress, but never import a different account.
  const guest = !local.userId && !local.email;
  const recoveryFields = ["name","bio","avatar","country","start","spend","cc","urges","periods","chats","trusted","hidden","rules","test","done","checks"];
  const defaults = freshStore();
  const hasProgress = local.start || local.urges?.length || local.checks?.length || local.chats?.length || local.trusted?.length;
  // Older releases did not record pending saves or a server revision. A
  // differing legacy snapshot needs an explicit choice, not a guessed winner.
  const legacyConflict = !!(ownsLocal && local._revision == null && hasProgress && remote && recoveryFields.some((field) => JSON.stringify(local[field] ?? defaults[field]) !== JSON.stringify(remote[field] ?? defaults[field])));
  const saved = ownsLocal && (local._pendingSync || legacyConflict)
    ? local
    : remote ?? (ownsLocal || guest ? local : {});
  const meta = user.user_metadata || {};
  return {
    ...freshStore(),
    ...saved,
    userId: user.id,
    email,
    name: saved.name || meta.name || meta.full_name || email.split("@")[0] || "",
    country: saved.country || (guest ? local.country : null) || "NG",
    // A stale completion flag alone is not evidence of finished setup.
    done: saved.done && (remote || ownsLocal || (saved.start && saved.name)) ? 1 : 0,
    posts: ownsLocal || (guest && !remote) ? local.posts || [] : [],
    outbox: ownsLocal || (guest && !remote) ? local.outbox || [] : [],
    _pendingSync: !!(ownsLocal && local._pendingSync) || legacyConflict || !remote,
    _legacyConflict: legacyConflict,
  };
}

