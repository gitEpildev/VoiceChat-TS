/**
 * Replaces {username} in a template string with the provided username.
 */
export function applyNameTemplate(template: string, username: string): string {
  return template.replace(/\{username\}/g, username);
}
