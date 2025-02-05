import axios from 'axios';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import dotenv from 'dotenv';

dotenv.config();

const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ACCOUNT_ID = process.env.ACCOUNT_ID;

if (!CLOUDFLARE_API_TOKEN || !ACCOUNT_ID) {
	console.error('❌ Missing CLOUDFLARE_API_TOKEN or ACCOUNT_ID in the .env file.');
	process.exit(1);
}

// Fetch GitHub IPs
async function fetchGitHubIPs(batch: string = 'actions'): Promise<string[]> {
	try {
		const response = await axios.get('https://api.github.com/meta');
		return response.data[batch] || [];
	} catch (error) {
		console.error(`❌ Failed to fetch GitHub IPs for batch "${batch}":`, error);
		return [];
	}
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
		const githubIPs = whitelistGitHubIPs ? await fetchGitHubIPs(githubIPBatch) : [];

		const payload = {
			name,
			policies: [
				{
					effect: 'allow',
					permissions,
					resources: permissions.map((perm) => perm.split(':')[0]), // Example: "com.cloudflare.api.account.zone:read"
				},
			],
			condition: whitelistGitHubIPs
				? {
						request_ip: {
							in: githubIPs,
						},
				  }
				: undefined,
			expires_on: expiration || undefined,
		};

		const response = await axios.post(
			`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/api_tokens`,
			payload,
			{
				headers: {
					Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
					'Content-Type': 'application/json',
				},
			}
		);

		console.log('✅ Token Created Successfully:\n', response.data);
	} catch (error: any) {
		console.error('❌ Error Creating Token:', error.response?.data || error.message);
	}
}

// Yargs CLI Setup
yargs(hideBin(process.argv))
	.command(
		'create-token',
		'Create a Cloudflare API Token',
		(yargs) => {
			return yargs
				.option('name', {
					alias: 'n',
					describe: 'Name of the API token',
					type: 'string',
					demandOption: true,
				})
				.option('permissions', {
					alias: 'p',
					describe: 'Permissions in format resource:effect (e.g., com.cloudflare.api.account.zone:read)',
					type: 'array',
					demandOption: true,
				})
				.option('expiration', {
					alias: 'e',
					describe: 'Expiration date (ISO 8601 format)',
					type: 'string',
				})
				.option('no-github-ips', {
					describe: 'Disable GitHub Actions IP whitelisting',
					type: 'boolean',
					default: false,
				})
				.option('ip-batch', {
					alias: 'b',
					describe: 'GitHub IP batch to whitelist (e.g., actions, pages)',
					type: 'string',
					default: 'actions',
				});
		},
		(argv) => {
			createToken(
				argv.name as string,
				argv.permissions as string[],
				argv.expiration as string,
				!argv['no-github-ips'],
				argv['ip-batch'] as string
			);
		}
	)
	.demandCommand(1, '❗ You need to specify a command (e.g., create-token)')
	.help()
	.argv;
