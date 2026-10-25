const DEFAULT_AUTH_DOMAIN = 'neurogestor-app.web.app';

export const resolveAuthDomain = (configuredDomain?: string): string => {
  const normalized = configuredDomain?.trim();
  return normalized || DEFAULT_AUTH_DOMAIN;
};