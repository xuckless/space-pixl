// Lets Node's built-in type stripping resolve extension-less relative imports
// (`import { x } from './plan'`) the way the bundler does, so the pure modules
// under src/ run untouched under `node --test`.
import { register } from 'node:module'

register(
  'data:text/javascript,' +
    encodeURIComponent(`
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context)
  } catch (err) {
    if (err?.code === 'ERR_MODULE_NOT_FOUND' && /^\\.\\.?\\//.test(specifier) && !/\\.[a-z]+$/.test(specifier)) {
      return next(specifier + '.ts', context)
    }
    throw err
  }
}
`),
  import.meta.url
)
