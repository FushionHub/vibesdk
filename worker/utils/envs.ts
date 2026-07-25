export function isProd(env: Env) {
    return env.ENVIRONMENT === 'prod' || env.ENVIRONMENT === 'production';
}

export function isDev(env: Env) {
    return env.ENVIRONMENT === 'dev' || env.ENVIRONMENT === 'development' || env.ENVIRONMENT === 'local';
}

/**
 * Whether email/password authentication (login + registration) is enabled.
 * Controlled independently of OAuth via the ENABLE_EMAIL_AUTH var. Enabled by
 * default; set ENABLE_EMAIL_AUTH="false" to disable and make the deployment
 * OAuth-only.
 */
export function isEmailAuthEnabled(env: Env) {
    return (env.ENABLE_EMAIL_AUTH as string | undefined) !== 'false';
}
