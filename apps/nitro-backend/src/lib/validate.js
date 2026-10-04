import { HttpError } from './http-error.js';

/** Parse `data` with a zod schema or throw a 400 HttpError that lists the problems. */
export function parse(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new HttpError(400, 'Validation failed.', 'VALIDATION', result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
  }
  return result.data;
}
