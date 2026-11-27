/** The invitation behind a `next` path: the accept page is where sign in, then sign up, were reached from. */
export const invitationIdFrom = (next: string): string | undefined => /^\/accept-invitation\/([\w-]+)/.exec(next)?.[1]
