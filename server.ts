Contents

/**
 * Netlify serverless function wrapper for the Express SSR server.
 * Converts Netlify's event/context into an Express-compatible request.
 */
import serverless from 'serverless-http';
// The built server bundle exports the Express app
// We import the handler from the compiled output
export { handler } from '../../dist/server.bundle.mjs';