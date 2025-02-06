# 🌩️ CF Token Generator

A **Cloudflare Token Generator** built with TypeScript and Wrangler for secure, configurable API token creation. It fetches GitHub Actions IPs (by default) for IP whitelisting but allows full customization.

## 🚀 Features

- ✅ **Generates Cloudflare API Tokens** with custom permissions.
- 🌐 **GitHub Actions IPs whitelisted by default** (can be disabled).
- 🔄 **Customizable IP batches** from GitHub (e.g., `actions`, `pages`, etc.).
- ⚙️ **Configurable token permissions** and **optional expiration date**.
- 💡 Built with **TypeScript**, powered by **Wrangler**.

## 📦 Installation

```bash
git clone https://github.com/rastislavcore/cf-token-generator.git
cd cf-token-generator
npm install
```

## ⚙️ Configuration

### 1️⃣ **Environment Variables (.env)**

Create a `.env` file in the project root:

```env
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
ACCOUNT_ID=your_cloudflare_account_id
```

- **`CLOUDFLARE_API_TOKEN`**: A token with sufficient privileges to create new tokens.
- **`ACCOUNT_ID`**: Your Cloudflare account ID.

### 2️⃣ **Wrangler Config**

Basic `wrangler.json` (already included):

```json
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "cf-token-generator",
  "main": "src/index.ts",
  "compatibility_date": "2025-02-05"
}
```

## 🚀 Usage

### As a Global CLI Tool

1. Install globally

   ```bash
   npm install -g .
   ```

2. Run the generator

   ```bash
   cf-token-gen [options]
   ```

### Using npx

Globally installed

```bash
npx cf-token-gen [options]
```

Locally installed

```bash
npx ./src/cli.ts [options]
```

### Using bun

Globally installed

```bash
bunx cf-token-gen [options]
```

Locally installed

```bash
bun run ./src/cli.ts [options]
```

### 🗂️ **Command Options**

| Option                      | Description                                           | Default      |
| --------------------------- | ----------------------------------------------------- | ------------ |
| `--permissions` or `-p`     | Specify Cloudflare permissions (comma-separated)      | _Required_   |
| `--valid-until` or `-v`     | Set token expiration date (ISO format)                | _No expiry_  |
| `--batch` or `-b`           | GitHub IP batch to fetch (`actions`, `pages`, etc.)   | `actions`    |
| `--no-github-ips`           | Disable GitHub IP whitelisting                        | Enabled      |

### ✅ **Example Usages**

1️⃣ **Generate a Token with Read-Only DNS Permissions:**

```bash
cf-token-gen --permissions com.cloudflare.api.account:Account Settings Read
```

2️⃣ **Generate a Token Valid Until a Specific Date:**

```bash
cf-token-gen --permissions com.cloudflare.api.account:Account Settings Read --valid-until 2025-12-31T23:59:59Z
```

3️⃣ **Whitelist GitHub Pages IPs Instead of Actions:**

```bash
cf-token-gen --permissions com.cloudflare.api.account:Account Settings Read --batch pages
```

4️⃣ **Disable GitHub IP Whitelisting:**

```bash
cf-token-gen --permissions com.cloudflare.api.account:Account Settings Read --no-github-ips
```

5️⃣ **Get Permission Group ID:**

```bash
cf-token-gen get-permission-id "Account Settings Read"
```

## 🔒 Security

- **Sensitive data** like API tokens and account IDs should be managed in `.env` files (never hardcoded).
- **GitHub IPs** are fetched with retry mechanism and timeout handling.
- **Token storage** is saved to `cf-token.txt` in the current directory.

## 📜 License

Licensed under the **CORE License**

## 🤝 Contributing

1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/new-feature`).
3. Commit your changes (`git commit -am 'Add new feature'`).
4. Push to the branch (`git push origin feature/new-feature`).
5. Open a pull request.
