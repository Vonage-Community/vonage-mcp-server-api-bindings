# Vonage API MCP server

## Available Tools

This MCP server provides access to various Vonage API functionalities through the following tools:

| Category                      | Tool Name                           | Description                                                                               |
| ----------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------- |
| **Account Management**        | `balance`                           | Get your Vonage account balance                                                           |
|                               | `list-applications`                 | List all applications attached to your API key with their configurations and capabilities |
|                               | `list-purchased-numbers`            | List telephone numbers associated with your account and their metadata                    |
| **Number Management**         | `link-number-to-vonage-application` | Link an owned number to a specific Vonage Application                                     |
| **Messaging & Communication** | `SMS`                               | Send SMS messages using Vonage                                                            |
|                               | `outbound-voice-message`            | Send outbound voice messages with Vonage                                                  |

### Usage Examples

#### Check Account Balance

```
Can you check my Vonage account balance?
```

#### List Your Phone Numbers

```
Can you list out the numbers that I own for Vonage?
```

#### List Applications

```
Can you list out the applications on my account?
```

#### Send an SMS

```
Can you send an SMS to +1234567890 with the message "Hello from Vonage!"?
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
        "VONAGE_VIRTUAL_NUMBER": "<YOUR_VONAGE_VIRTUAL_NUMBER>"
    }
}
```

> Right now, we only use a base64 encoded Private Key. I created a tool that will convert the
> private key file into the encoded string that you can copy and paste. Everything is done in your
> browser, no inforamtion is sent anywhere:
> [https://mylight.work/private-key-to-environment-variable](https://mylight.work/private-key-to-environment-variable)
