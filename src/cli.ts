#!/usr/bin/env node
import axios from 'axios';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import dotenv from 'dotenv';

// Initialize dotenv
dotenv.config();

const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ACCOUNT_ID = process.env.ACCOUNT_ID;

if (!CLOUDFLARE_API_TOKEN || !ACCOUNT_ID) {
    console.error('❌ Missing CLOUDFLARE_API_TOKEN or ACCOUNT_ID in the .env file.');
    process.exit(1);
}

// Fetch GitHub IPs with timeout and retry
async function fetchGitHubIPs(batch: string = 'actions', retries: number = 3): Promise<string[]> {
    try {
        const response = await axios.get('https://api.github.com/meta', {
            timeout: 5000 // 5 second timeout
        });
        return response.data[batch] || [];
    } catch (error) {
        if (retries > 0) {
            console.log(`⚠️ Retrying GitHub IP fetch (${retries} attempts remaining)...`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
            return fetchGitHubIPs(batch, retries - 1);
        }
        console.error(`❌ Failed to fetch GitHub IPs for batch "${batch}":`, error);
        return [];
    }
}

// Convert CLI permission name to spaced format
function toSpacedName(permissionName: string): string {
    return permissionName
        .replace(/([A-Z])/g, ' $1')
        .trim();
}

// Map of permission strings to their corresponding group IDs
function getPermissionGroupIds(): Record<string, string> {
    const permissions: Record<string, string> = {};

    for (const [key, value] of Object.entries(process.env)) {
        if (key.startsWith('PERMISSION_')) {
            // Convert PERMISSION_AccountSettingsRead to Account Settings Read
            const permissionKey = key
                .replace('PERMISSION_', '')
                .replace(/([A-Z])/g, ' $1')
                .trim();
            permissions[permissionKey] = value!;
        }
    }

    return permissions;
}

// Create Cloudflare Token
async function createToken(
    name: string,
    permissions: string[],
    expiration?: string,
    whitelistGitHubIPs: boolean = true,
    githubIPBatch: string = 'actions'
) {
    try {
        const permissionGroupIds = getPermissionGroupIds();
        const githubIPs = whitelistGitHubIPs ? await fetchGitHubIPs(githubIPBatch) : [];

        const payload = {
            name,
            policies: await Promise.all(permissions.map(async (permission) => {
                // Ensure the permission string is valid
                if (!permission || typeof permission !== 'string') {
                    throw new Error(`Invalid permission format: ${permission}`);
                }

                // Split the permission into service and permissionName (support both : and /)
                const separator = permission.includes(':') ? ':' : '/';
                const [service, permissionName] = permission.split(separator);
                if (!service || !permissionName) {
                    throw new Error(
                        `Invalid permission format. Expected "service:permissionName" or "service/permissionName", got: ${permission}`
                    );
                }

                let resource = permissionGroupIds[permissionName.trim()] || '';

                if (!resource) {
                    console.log(`⚠️ Permission group ID for "${permissionName}" not found in .env, fetching from API...`);
                    const groupId = await getPermissionGroupId(permissionName.trim());
                    resource = `${service}.${groupId}`;
                }

                // Ensure the resource includes the account tag
                if (ACCOUNT_ID && !resource.startsWith(ACCOUNT_ID)) {
                    // Only prefix with account ID if it's not already part of the resource
                    if (!resource.includes(ACCOUNT_ID)) {
                        resource = `${ACCOUNT_ID}.${resource}`;
                    }
                }

                return {
                    effect: 'allow',
                    permission_groups: [{
                        id: resource.split('.').pop()!,
                        meta: {
                            key: 'service',
                            value: service
                        }
                    }],
                    resources: {
                        [resource]: '*'
                    }
                };
            })),
            condition: whitelistGitHubIPs
                ? {
                      request_ip: {
                          in: githubIPs,
                      },
                  }
                : undefined,
            expires_on: expiration || undefined,
            not_before: new Date().toISOString().split('.')[0] + 'Z'
        };

        const response = await axios.post(
            `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/tokens`,
            payload,
            {
                headers: {
                    Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        if (response.data.success) {
            console.log('✅ Token Created Successfully:');
            console.log(`Token ID: ${response.data.result.id}`);
            console.log(`Expires On: ${response.data.result.expires_on}`);
            console.log('Token Value: (stored in cf-token.txt)');

            const fs = require('fs');
            fs.writeFileSync('cf-token.txt', response.data.result.value);
            console.log('Token has been saved to cf-token.txt in the current directory');
        } else {
            throw new Error(response.data.errors.map((e: any) => e.message).join('\n'));
        }
    } catch (error: any) {
        console.error('❌ Error Creating Token:', error.response?.data || error.message);
        process.exit(1);
    }
}

async function getPermissionGroupId(permissionName: string): Promise<string> {
    try {
        const response = await axios.get(
            `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/tokens/permission_groups`,
            {
                headers: {
                    Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        if (response.data.success) {
            const group = response.data.result.find((g: any) =>
                g.name === permissionName // Exact match for permission name
            );

            if (group) {
                return group.id;
            } else {
                throw new Error(`Permission group "${permissionName}" not found`);
            }
        } else {
            throw new Error(response.data.errors.map((e: any) => e.message).join('\n'));
        }
    } catch (error: any) {
        console.error('❌ Error Getting Permission Group ID:', error.response?.data?.errors || error.message);
        process.exit(1);
    }
}

// CLI Setup
yargs(hideBin(process.argv))
    .command(
        '$0',
        'Generate Cloudflare API Tokens',
        (yargs) => {
            return yargs
                .option('permissions', {
                    alias: 'p',
                    describe: 'Specify Cloudflare permissions (comma-separated, format: "com.cloudflare.api.account:Account Settings Read" or "com.cloudflare.api.account/Account Settings Read")',
                    type: 'array',
                    demandOption: true,
                })
                .option('valid-until', {
                    alias: 'v',
                    describe: 'Set token expiration date (ISO format)',
                    type: 'string',
                })
                .option('batch', {
                    alias: 'b',
                    describe: 'GitHub IP batch to fetch (actions, pages, etc.)',
                    type: 'string',
                    default: 'actions',
                })
                .option('no-github-ips', {
                    describe: 'Disable GitHub IP whitelisting',
                    type: 'boolean',
                    default: false,
                })
                .help()
                .alias('help', 'h');
        },
        async (argv) => {
            await createToken(
                'Generated Token',
                (argv.permissions as string[]).flatMap(p => p.split(',')),
                argv['valid-until'],
                !argv['no-github-ips'],
                argv.batch
            );
        }
    )
    .command(
        'get-permission-id <name>',
        'Get the ID for a permission group',
        {},
        async (argv) => {
            const permissionId = await getPermissionGroupId(argv.name as string);
            console.log(`Permission ID for "${argv.name}": ${permissionId}`);
        }
    )
    .parse();
