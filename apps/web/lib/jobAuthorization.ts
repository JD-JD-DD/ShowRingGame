export function isAuthorizedJobRequest(args: {
  authorization: string | null;
  cronSecret?: string;
  manualSecret?: string;
}): boolean {
  return [args.cronSecret, args.manualSecret]
    .filter((secret): secret is string => Boolean(secret))
    .some((secret) => args.authorization === `Bearer ${secret}`);
}
