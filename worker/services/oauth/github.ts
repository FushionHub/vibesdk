/**
 * GitHub OAuth Provider
 * Implements GitHub OAuth 2.0 authentication
 */

import { BaseOAuthProvider } from './base';
import type { OAuthUserInfo } from '../../types/auth-types';
import { OAuthProvider } from '../../types/auth-types';
import { createLogger } from '../../logger';
import { createGitHubHeaders, extractGitHubErrorText } from '../../utils/githubUtils';

const logger = createLogger('GitHubOAuth');

/**
 * GitHub OAuth Provider implementation
 */
export class GitHubOAuthProvider extends BaseOAuthProvider {
    protected readonly provider: OAuthProvider = 'github';
    protected readonly authorizationUrl = 'https://github.com/login/oauth/authorize';
    protected readonly tokenUrl = 'https://github.com/login/oauth/access_token';
    protected readonly userInfoUrl = 'https://api.github.com/user';
    protected readonly emailsUrl = 'https://api.github.com/user/emails';
    
    // Minimal scopes for authentication only - NO repo access
    protected readonly scopes = [
        'read:user',
        'user:email'
    ];
    
    /**
     * Get user info from GitHub
     */
    async getUserInfo(accessToken: string): Promise<OAuthUserInfo> {
        try {
            // Get basic user info
            const userResponse = await fetch(this.userInfoUrl, {
                headers: createGitHubHeaders(accessToken)
            });
            
            if (!userResponse.ok) {
                const error = await extractGitHubErrorText(userResponse);
                logger.error('Failed to get user info', { 
                    status: userResponse.status, 
                    error: error.substring(0, 200) // Log only first 200 chars
                });
                throw new Error('Failed to retrieve user information from GitHub');
            }
            
            const userData = await userResponse.json() as {
                id: number;
                login: string;
                email?: string;
                name?: string;
                avatar_url?: string;
            };

            // Always resolve the email via the /emails endpoint so the verification
            // status of the selected email is known. The /user endpoint's `email`
            // field does not carry a verified flag, so trusting it would force us to
            // assume verification, which is exactly the takeover vector we must avoid.
            const emailsResponse = await fetch(this.emailsUrl, {
                headers: createGitHubHeaders(accessToken)
            });

            let chosen: { email: string; verified: boolean } | undefined;
            if (emailsResponse.ok) {
                const emails = await emailsResponse.json() as Array<{
                    email: string;
                    verified: boolean;
                    primary: boolean;
                }>;

                // Prefer a verified primary email, then any verified email. Never fall
                // back to an unverified address.
                chosen = emails.find(e => e.primary && e.verified)
                    ?? emails.find(e => e.verified);
            }

            // If the emails endpoint was unavailable but the profile carried an email,
            // surface it as unverified so the auth layer can fail closed.
            const email = chosen?.email ?? userData.email;
            if (!email) {
                throw new Error('Could not retrieve user email from GitHub');
            }

            return {
                id: String(userData.id),
                email,
                name: userData.name || userData.login,
                picture: userData.avatar_url,
                emailVerified: chosen?.verified ?? false
            };
        } catch (error) {
            logger.error('Error getting user info', error);
            throw error;
        }
    }
    
    /**
     * Create GitHub OAuth provider instance
     */
    static create(env: Env, baseUrl: string): GitHubOAuthProvider {
        if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
            throw new Error('GitHub OAuth credentials not configured');
        }
        
        const redirectUri = `${baseUrl}/api/auth/callback/github`;
        
        return new GitHubOAuthProvider(
            env.GITHUB_CLIENT_ID,
            env.GITHUB_CLIENT_SECRET,
            redirectUri
        );
    }
}