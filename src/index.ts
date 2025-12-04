#!/usr/bin/env node
import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { Vonage } from '@vonage/server-sdk';
import { Auth } from '@vonage/auth';
import { Channels, MessageTypes } from '@vonage/messages';
import { NCCOBuilder, Talk } from '@vonage/voice';

const appId = process.env.VONAGE_APPLICATION_ID || '';
const privateKey = Buffer.from(
  process.env.VONAGE_PRIVATE_KEY64 || '',
  'base64'
);

const vonage = new Vonage(
  new Auth({
    apiKey: process.env.VONAGE_API_KEY!,
    apiSecret: process.env.VONAGE_API_SECRET!,
    applicationId: appId!,
    privateKey: privateKey,
  })
);

const virtualNumber = process.env.VONAGE_VIRTUAL_NUMBER;
const whatsappNumber = process.env.VONAGE_WHATSAPP_NUMBER;
const rcsSenderId = process.env.RCS_SENDER_ID;

async function formatPhoneNumber(phoneNumber: string) {
  // Format the phone number as needed
  let phoneNumberFormatted;
  const result = await vonage.numberInsights.basicLookup(phoneNumber);
  if (result && result.status === 0) {
    phoneNumberFormatted = result.international_format_number;
  }
  return phoneNumberFormatted;
}

// Channel configurations for modular messaging
const CHANNEL_CONFIGS = {
  whatsapp: {
    channel: Channels.WHATSAPP,
    getFrom: () => whatsappNumber,
    requiresValidation: () => !!whatsappNumber,
    validationError: 'VONAGE_WHATSAPP_NUMBER is not set.',
  },
  rcs: {
    channel: Channels.RCS,
    getFrom: () => rcsSenderId,
    requiresValidation: () => !!rcsSenderId,
    validationError: 'RCS_SENDER_ID is not set.',
  },
  sms: {
    channel: Channels.SMS,
    getFrom: () => virtualNumber,
    requiresValidation: () => !!virtualNumber,
    validationError: 'VONAGE_VIRTUAL_NUMBER is not set.',
  },
} as const;

// Unified messaging function for all channels
async function sendChannelMessage(
  channelKey: keyof typeof CHANNEL_CONFIGS,
  to: string,
  message: string,
  useFailover: boolean = false
) {
  const config = CHANNEL_CONFIGS[channelKey];

  // Validate channel requirements
  if (!config.requiresValidation()) {
    throw new Error(config.validationError);
  }

  // Format phone number
  const phoneNumberFormatted = await formatPhoneNumber(to);
  if (!phoneNumberFormatted) {
    throw new Error(`Invalid phone number format: ${to}`);
  }

  if (!message) {
    throw new Error('Message is required');
  }

  // Build failover configuration if requested
  const failover = useFailover
    ? [
        {
          messageType: MessageTypes.TEXT,
          channel: Channels.SMS,
          text: message,
          to: phoneNumberFormatted,
          from: virtualNumber,
        },
      ]
    : undefined;

  if (useFailover && !virtualNumber) {
    throw new Error('VONAGE_VIRTUAL_NUMBER required for failover');
  }

  // Send message using direct API
  const result = await vonage.messages.send({
    messageType: MessageTypes.TEXT,
    channel: config.channel,
    text: message,
    to: phoneNumberFormatted,
    from: config.getFrom(),
    ...(failover && { failover }),
  } as any);

  // Extract response data
  const messageUUID =
    (result as any).messageUUID || (result as any).message_uuid || 'unknown';
  const workflowId =
    (result as any).workflowId || (result as any).workflow_id || 'unknown';

  return { messageUUID, workflowId };
}

// Simple channel-specific wrapper functions
async function sendWhatsAppText(
  to: string,
  message: string,
  useFailover: boolean = false
) {
  return await sendChannelMessage('whatsapp', to, message, useFailover);
}

async function sendRCSText(
  to: string,
  message: string,
  useFailover: boolean = false
) {
  return await sendChannelMessage('rcs', to, message, useFailover);
}

async function sendSMSText(to: string, message: string) {
  return await sendChannelMessage('sms', to, message, false);
}

// Create an MCP server
const server = new McpServer({
  name: 'vonage-mcp-server-api-bindings',
  version: '0.0.1',
});

// Get account balance
server.registerTool(
  'balance',
  {
    title: 'Account balance',
    description: 'Get your Vonage Account balance',
    inputSchema: {},
  },
  async () => {
    try {
      // "await" the result of the send call
      const response = await vonage.accounts.getBalance();

      // On success, return the content object
      return {
        content: [
          {
            type: 'text',
            text: `Current account balance is ${response.value.toFixed(2)}.`,
          },
        ],
      };
    } catch (error) {
      // If an error occurs, return the content object with the error message
      return {
        content: [
          {
            type: 'text',
            text: `Error getting balance: ${typeof error === 'object' && error && 'message' in error ? (error as any).message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Send an SMS
(server.registerTool as any)(
  'SMS',
  {
    title: 'SMS message',
    description: 'Send SMS messages with Vonage',
    inputSchema: { to: z.string(), message: z.string() },
  },
  async (args: any) => {
    const { to, message } = args as { to: string; message: string };
    try {
      const { messageUUID } = await sendSMSText(to, message);

      // On success, return the content object
      return {
        content: [
          {
            type: 'text',
            text: `Message "${message}" sent to ${to}: ${messageUUID}`,
          },
        ],
      };
    } catch (error) {
      // If an error occurs, return the content object with the error message
      return {
        content: [
          {
            type: 'text',
            text: `Error sending SMS: ${typeof error === 'object' && error && 'message' in error ? (error as any).message : String(error)}`,
          },
        ],
      };
    }
  }
);

(server.registerTool as any)(
  'whatsapp-send-text',
  {
    title: 'WhatsApp Text Message',
    description: 'Send a text message via WhatsApp using Vonage Messages API',
    inputSchema: {
      to: z
        .string()
        .describe(
          'Recipient WhatsApp number in E.164 format (e.g., +14155552671)'
        ),
      message: z.string().describe('Text message to send'),
    },
  },
  async (args: any) => {
    const { to, message } = args as { to: string; message: string };
    try {
      const { messageUUID } = await sendWhatsAppText(to, message, true);

      return {
        content: [
          {
            type: 'text',
            text: `WhatsApp message sent to ${to}: "${message}"\nMessage UUID: ${messageUUID}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error sending WhatsApp message: ${typeof error === 'object' && error && 'message' in error ? (error as any).message : String(error)}`,
          },
        ],
      };
    }
  }
);

(server.registerTool as any)(
  'whatsapp-send-text-with-sms-failover',
  {
    title: 'WhatsApp Text Message with SMS Failover',
    description:
      'Send a WhatsApp text message with automatic SMS failover using the Vonage Messages API failover feature',
    inputSchema: {
      to: z
        .string()
        .describe(
          'Recipient phone number in E.164 format (e.g., +14155552671)'
        ),
      message: z.string().describe('Text message to send'),
    },
  },
  async (args: any) => {
    const { to, message } = args as { to: string; message: string };
    try {
      const { messageUUID, workflowId } = await sendWhatsAppText(
        to,
        message,
        true
      );

      return {
        content: [
          {
            type: 'text',
            text: `WhatsApp message with SMS failover sent to ${to}: "${message}"
Message UUID: ${messageUUID}
Workflow ID: ${workflowId}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error sending WhatsApp message with failover: ${typeof error === 'object' && error && 'message' in error ? (error as any).message : String(error)}`,
          },
        ],
      };
    }
  }
);

(server.registerTool as any)(
  'rcs-send-text',
  {
    title: 'RCS Text Message',
    description: 'Send a text message via RCS using Vonage Messages API',
    inputSchema: {
      to: z
        .string()
        .describe(
          'Recipient phone number in E.164 format (e.g., +14155552671)'
        ),
      message: z.string().describe('Text message to send'),
    },
  },
  async ({ to, message }: { to: string; message: string }) => {
    try {
      const { messageUUID } = await sendRCSText(to, message);

      return {
        content: [
          {
            type: 'text',
            text: `RCS message sent to ${to}: "${message}"\nMessage UUID: ${messageUUID}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error sending RCS message: ${typeof error === 'object' && error && 'message' in error ? (error as any).message : String(error)}`,
          },
        ],
      };
    }
  }
);

(server.registerTool as any)(
  'rcs-send-text-with-sms-failover',
  {
    title: 'RCS Text Message with SMS Failover',
    description:
      'Send an RCS text message with automatic SMS failover using the Vonage Messages API failover feature',
    inputSchema: {
      to: z
        .string()
        .describe(
          'Recipient phone number in E.164 format (e.g., +14155552671)'
        ),
      message: z.string().describe('Text message to send'),
    },
  },
  async (args: any) => {
    const { to, message } = args as { to: string; message: string };
    try {
      const { messageUUID, workflowId } = await sendRCSText(to, message, true);

      return {
        content: [
          {
            type: 'text',
            text: `RCS message with SMS failover sent to ${to}: "${message}"
Message UUID: ${messageUUID}
Workflow ID: ${workflowId}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error sending RCS message with failover: ${typeof error === 'object' && error && 'message' in error ? (error as any).message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Send an Outbound Voice Message
(server.registerTool as any)(
  'outbound-voice-message',
  {
    title: 'Outbound Voice Message',
    description: 'Send an outbound voice message with Vonage',
    inputSchema: { to: z.string(), message: z.string() },
  },
  async ({ to, message }: { to: string; message: string }) => {
    const builder = new NCCOBuilder();
    builder.addAction(new Talk(message));

    try {
      const phoneNumberFormatted = await formatPhoneNumber(to);
      if (!phoneNumberFormatted) {
        throw new Error(`Invalid phone number format: ${to}`);
      }
      if (!message || !phoneNumberFormatted || !virtualNumber) {
        throw new Error('Required parameters missing');
      }
      // "await" the result of the send call
      const result = await vonage.voice.createOutboundCall({
        ncco: builder.build(),
        to: [
          {
            type: 'phone',
            number: phoneNumberFormatted,
          },
        ],
        from: {
          type: 'phone',
          number: virtualNumber!,
        },
      });

      // On success, return the content object
      return {
        content: [
          {
            type: 'text',
            text: `Voice Message "${message}" sent to ${to}: ${JSON.stringify(result)}`,
          },
        ],
      };
    } catch (error) {
      // If an error occurs, return the content object with the error message
      return {
        content: [
          {
            type: 'text',
            text: `Error sending voice message: ${typeof error === 'object' && error && 'message' in error ? (error as any).message : String(error)}`,
          },
        ],
      };
    }
  }
);

server.registerTool(
  'list-applications',
  {
    title: 'List my applications',
    description: 'List out the applications that are attached to my API key',
    inputSchema: {},
  },
  async () => {
    const apps = await vonage.applications.listApplications({});

    // On success, return the content object
    return {
      content: [
        {
          type: 'text',
          text: `Applications: ${JSON.stringify(apps)}`,
        },
      ],
    };
  }
);

(server.registerTool as any)(
  'create-application',
  {
    title: 'Create a new Vonage Application',
    description: 'Create a new Vonage application with a specified name',
    inputSchema: {
      name: z
        .string()
        .optional()
        .describe(
          'The name of the application to create. If not provided, a default name will be generated.'
        ),
    },
  },
  async (args: any) => {
    const { name } = args as { name?: string };
    try {
      const applicationName =
        name || `Vonage App ${new Date().toISOString().split('T')[0]}`;

      const application = await vonage.applications.createApplication({
        name: applicationName,
        capabilities: {},
      });

      return {
        content: [
          {
            type: 'text',
            text: `Application created successfully:
Name: ${application.name}
Application ID: ${application.id}
${application.keys?.private_key ? `Private Key: ${application.keys.private_key}` : ''}

Full details: ${JSON.stringify(application, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error creating application: ${typeof error === 'object' && error && 'message' in error ? (error as any).message : String(error)}`,
          },
        ],
      };
    }
  }
);

server.registerTool(
  'list-purchased-numbers',
  {
    title: 'List the telephone numbers associated with my Vonage Account',
    description:
      'List of the telephone numbers that are currently associated with my account and their metadata',
    inputSchema: {},
  },
  async () => {
    const numbers = await vonage.numbers.getOwnedNumbers();

    // On success, return the content object
    return {
      content: [
        {
          type: 'text',
          text: `Numbers: ${JSON.stringify(numbers)}`,
        },
      ],
    };
  }
);

(server.registerTool as any)(
  'link-number-to-vonage-application',
  {
    title: 'Link an owned number to the assigned Vonage Application',
    description: 'Link an owned number to the assigned Vonage Application',
    inputSchema: {
      msisdn: z
        .string()
        .describe(
          'The phone number to link to the Vonage Application, in E.164 format, e.g. +12025550123'
        ),
      applicationId: z
        .string()
        .describe('The Vonage Application ID to link the number to'),
    },
  },
  async ({
    msisdn,
    applicationId,
  }: {
    msisdn: string;
    applicationId: string;
  }) => {
    try {
      applicationId = applicationId.replace(/\s+/g, '');
      const numbers = await vonage.numbers.getOwnedNumbers({
        pattern: msisdn,
        searchPattern: 0,
      });

      if (!numbers || !numbers.numbers || numbers.numbers.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `I could not find the number "${msisdn}" attached to your account.`,
            },
          ],
        };
      }

      const number = numbers.numbers[0];

      // Check if number is already linked to the application
      const currentAppId =
        (number as any).app_id || (number as any).applicationId;
      if (currentAppId === applicationId) {
        return {
          content: [
            {
              type: 'text',
              text: `The number "${msisdn}" is already linked to the Vonage Application ID ${applicationId}.`,
            },
          ],
        };
      }

      // Build update parameters with proper type checking
      const updateParams: any = {
        country: number.country || '',
        msisdn: number.msisdn || '',
        voiceCallbackType: number.voiceCallbackType,
        voiceCallbackValue: applicationId,
        messagesCallbackType: number.messagesCallbackType,
        messagesCallbackValue: number.messagesCallbackValue,
      };

      // Add optional fields if they exist
      if ('moHttpUrl' in number) {
        updateParams.moHttpUrl = (number as any).moHttpUrl;
      }

      // Set application ID (try both possible property names)
      updateParams.app_id = applicationId;
      updateParams.applicationId = applicationId;

      const response = await vonage.numbers.updateNumber(updateParams);

      // On success, return the content object
      return {
        content: [
          {
            type: 'text',
            text: `Successfully linked number "${msisdn}" to application ${applicationId}. Response: ${JSON.stringify(response)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error linking number: ${typeof error === 'object' && error && 'message' in error ? (error as any).message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Start receiving messages on stdin and sending messages on stdout
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
