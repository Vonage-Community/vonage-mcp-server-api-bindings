# Vonage API MCP server

## Available Tools

This MCP server provides access to various Vonage API functionalities through the following tools:

| Category                      | Tool Name                              | Description                                                                               |
| ----------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Account Management**        | `balance`                              | Get your Vonage account balance                                                           |
|                               | `list-applications`                    | List all applications attached to your API key with their configurations and capabilities |
|                               | `create-application`                   | Create a new Vonage application with a specified name                                     |
|                               | `list-purchased-numbers`               | List telephone numbers associated with your account and their metadata                    |
| **Number Management**         | `link-number-to-vonage-application`    | Link an owned number to a specific Vonage Application                                     |
| **Messaging & Communication** | `SMS`                                  | Send SMS messages using Vonage                                                            |
|                               | `whatsapp-send-text`                   | Send text messages via WhatsApp                                                           |
|                               | `whatsapp-send-text-with-sms-failover` | Send a WhatsApp text message with automatic SMS failover                                  |
|                               | `rcs-send-text`                        | Send text messages via RCS                                                                |
|                               | `rcs-send-text-with-sms-failover`      | Send an RCS text message with automatic SMS failover                                      |
|                               | `outbound-voice-message`               | Send outbound voice messages with Vonage                                                  |
| **Verification**              | `start-verification`                   | Start a phone verification by sending a code via SMS or voice                             |
|                               | `check-verification`                   | Verify the code entered by the user                                                       |
|                               | `cancel-verification`                  | Cancel a pending verification request                                                     |

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

#### Create a New Application

```
Can you create a new Vonage application called "My Chat App"?
```

Or let the system suggest a name:

```
Can you create a new Vonage application?
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

#### Start a Phone Verification

```
Can you start a phone verification for +1234567890 with brand "MyApp"?
```

Or with voice call instead of SMS:

```
Can you start a voice verification for +1234567890 with brand "MyApp"?
```

#### Check a Verification Code

```
Can you check if the code 123456 is correct for verification request abc123-def456?
```

#### Cancel a Verification Request

```
Can you cancel the verification request abc123-def456?
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

> Right now, we only use a base64 encoded Private Key. I created a tool that will convert the
> private key file into the encoded string that you can copy and paste. Everything is done in your
> browser, no information is sent anywhere:
> [https://mylight.work/private-key-to-environment-variable](https://mylight.work/private-key-to-environment-variable)
