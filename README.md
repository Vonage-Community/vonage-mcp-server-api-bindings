# Vonage API MCP server

## Available Tools

This MCP server provides access to various Vonage API functionalities through the following tools:

| Category                      | Tool Name                              | Description                                                                               |
| ----------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Account Management**        | `balance`                              | Get your Vonage account balance                                                           |
|                               | `list-applications`                    | List all applications attached to your API key with their configurations and capabilities |
|                               | `create-application`                   | Create a new Vonage application with a specified name                                     |
|                               | `list-purchased-numbers`               | List telephone numbers associated with your account and their metadata                    |
| **Number Management**         | `search-available-numbers`             | Search for available phone numbers to purchase from Vonage in a specific country          |
|                               | `link-number-to-vonage-application`    | Link an owned number to a specific Vonage Application                                     |
| **Reports**                   | `get-records-report`                   | Retrieve activity records from the Vonage Reports API (date-based or ID-based queries)    |
| **Messaging & Communication** | `SMS`                                  | Send SMS messages using Vonage                                                            |
|                               | `whatsapp-send-text`                   | Send text messages via WhatsApp                                                           |
|                               | `whatsapp-send-text-with-sms-failover` | Send a WhatsApp text message with automatic SMS failover                                  |
|                               | `rcs-send-text`                        | Send text messages via RCS                                                                |
|                               | `rcs-send-text-with-sms-failover`      | Send an RCS text message with automatic SMS failover                                      |
|                               | `outbound-voice-message`               | Send outbound voice messages with Vonage                                                  |
| **Data Visualization**        | `make-chart`                           | Create charts based on data retrieved                                                     |

### Usage Examples

#### Check Account Balance

```
Can you check my Vonage account balance?
```

#### List Your Phone Numbers

```
Can you list out the numbers that I own for Vonage?
```

#### Search for Available Numbers to Purchase

```
Can you search for available Vonage numbers to purchase in the US?
```

Or search with specific criteria:

```
Can you search for available Vonage numbers in the US with SMS and VOICE features?
```

```
Can you search for available numbers in GB starting with pattern "44207*"?
```

#### List Applications

```
Can you list out the applications on my account?
```

#### Create a New Application

```
Can you create a new Vonage application called "My Chat App"?
```

Or let the system suggest a name:

```
Can you create a new Vonage application?
```

#### Get a Records Report

Query by date range:

```
Can you get a report of all outbound SMS sent over the last week?
```

Query by specific ID:

```
Can you get the report for Voice Call ID 1234-abcd-5678-efgh?
```

#### Send an SMS

```
Can you send an SMS to +1234567890 with the message "Hello from Vonage!"?
```

#### Send a WhatsApp Message

```
Can you send a WhatsApp message to +1234567890 with the message "Hello from Vonage over WhatsApp!"?
```

#### Send a WhatsApp Message with SMS Failover

```
Can you send a WhatsApp message with SMS failover to +1234567890 saying "Hello from Vonage with failover!"?
```

#### Send an RCS Message

```
Can you send an RCS message to +1234567890 with the message "Hello from Vonage via RCS!"?
```

#### Send an RCS Message with SMS Failover

```
Can you send an RCS message with SMS failover to +1234567890 saying "Hello from Vonage RCS with fallback!"?
```

#### Generate a Chart

```
Please create a chart showing all the outbound SMS sent over the last week.
```

## Set up the MCP server

- [VS Code](https://code.visualstudio.com/docs/copilot/chat/mcp-servers#_add-an-mcp-server)
- [Cursor](https://docs.cursor.com/context/mcp)
- [Windsurf](https://docs.windsurf.com/windsurf/cascade/mcp)
- [Claude Desktop](https://modelcontextprotocol.io/quickstart/user)

The details of the MCP server should look like this.

```JSON
"vonage-mcp-server-api-bindings": {
    "type": "stdio",
    "command": "npx",
    "args": [
        "-y",
        "@vonage/vonage-mcp-server-api-bindings"
    ],
    "env": {
        "VONAGE_APPLICATION_ID": "<YOUR_VONAGE_APPLICATION_ID>",
        "VONAGE_PRIVATE_KEY64": "<YOUR_VONAGE_PRIVATE_KEY64>",
        "VONAGE_API_KEY": "<YOUR_VONAGE_API_KEY>",
        "VONAGE_API_SECRET": "<YOUR_VONAGE_API_SECRET>",
        "VONAGE_VIRTUAL_NUMBER": "<YOUR_VONAGE_VIRTUAL_NUMBER>",
        "VONAGE_WHATSAPP_NUMBER": "<YOUR_VONAGE_WHATSAPP_NUMBER>",
        "RCS_SENDER_ID": "<YOUR_RCS_SENDER_ID>"
    }
}
```

### Encoding your private key

`VONAGE_PRIVATE_KEY64` must be your application's private key file, base64 encoded on a single line.
Run one of these commands locally, replacing `private.key` with the path to your key file, and paste
the output into your config:

macOS:

```bash
base64 -i private.key
```

Linux:

```bash
base64 -w 0 private.key
```

Windows PowerShell:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes((Resolve-Path .\private.key)))
```

## Security

### STDIO transport

This server runs locally and talks to your MCP client (VS Code, Cursor, Claude Desktop, etc.) over
STDIO. Tool calls and their responses travel between the two processes as plaintext JSON-RPC. There
is no transport-layer encryption or authentication on this channel, which is how local MCP servers
are designed to work.

That is safe on a single-user machine you trust, which is the intended way to run this server. Keep
in mind that:

- Any process with enough privilege on the same machine can read or tamper with the STDIO stream. If
  the machine is compromised, the server cannot protect the data passing through it.
- In shared, multi-user, or containerised environments, other users or workloads may be able to
  observe the process. Only run the server where you trust everything else running alongside it.

### Storing credentials

The setup above puts your Vonage credentials, including `VONAGE_PRIVATE_KEY64`, into your MCP
client's config file (for example `claude_desktop_config.json` or `.cursor/mcp.json`) as plaintext.
Any process running as your user can read that file, and it is easy to leak by accident.

- Treat `VONAGE_PRIVATE_KEY64` like a private SSH key. Anyone who has it can act as your Vonage
  application.
- If the config file lives inside a project, such as `.cursor/mcp.json` or `.vscode/mcp.json`, add
  it to that project's `.gitignore` so it is never committed.
- Cloud sync services (iCloud, Dropbox, OneDrive, Google Drive) can silently upload config
  directories. Exclude those directories from sync, or keep credential-bearing config files outside
  synced folders.
- For stronger protection, keep secrets in your operating system's secret store instead: macOS
  Keychain, Windows Credential Manager, or the Linux Secret Service (for example GNOME Keyring or
  KWallet). Wiring the store into your MCP client's environment is up to you and depends on the
  client.
