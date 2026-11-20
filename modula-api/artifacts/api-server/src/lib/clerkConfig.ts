export function hasClerkPublishableKey(): boolean {
  return Boolean(process.env.CLERK_PUBLISHABLE_KEY?.trim());
}

export function hasClerkSecretKey(): boolean {
  return Boolean(process.env.CLERK_SECRET_KEY?.trim());
}

export function isClerkConfigured(): boolean {
  return hasClerkPublishableKey() && hasClerkSecretKey();
}

export function isClerkPartiallyConfigured(): boolean {
  return hasClerkPublishableKey() !== hasClerkSecretKey();
}
