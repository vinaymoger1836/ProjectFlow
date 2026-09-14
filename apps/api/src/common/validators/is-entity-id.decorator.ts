import { Matches, ValidationOptions } from 'class-validator';

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates that a string is a standard PostgreSQL-compatible UUID (8-4-4-4-12 hex).
 * Unlike class-validator's default @IsUUID(), this supports deterministic seed UUIDs
 * and non-v4 compliant standard 128-bit UUID identifiers.
 */
export function IsEntityId(validationOptions?: ValidationOptions) {
  return Matches(UUID_REGEX, {
    message: '$property must be a valid UUID',
    ...validationOptions,
  });
}
