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
    try {
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
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error listing applications: ${typeof error === 'object' && error && 'message' in error ? (error as any).message : String(error)}`,
          },
        ],
      };
    }
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
    try {
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
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error listing purchased numbers: ${typeof error === 'object' && error && 'message' in error ? (error as any).message : String(error)}`,
          },
        ],
      };
    }
  }
);

(server.registerTool as any)(
  'search-available-numbers',
  {
    title: 'Search for available Vonage numbers to purchase',
    description: 'Search for available phone numbers that can be purchased from Vonage in a specific country',
    inputSchema: {
      country: z
        .string()
        .describe('The two-character country code in ISO 3166-1 alpha-2 format, e.g. US, GB, DE'),
      pattern: z
        .string()
        .optional()
        .describe('The number pattern to search for (optional). Use * to match any character.'),
      features: z
        .string()
        .optional()
        .describe('Comma-separated list of features (optional). Options: SMS, VOICE, MMS'),
      size: z
        .number()
        .optional()
        .describe('Maximum number of results to return (optional, default is 10, max is 100)'),
    },
  },
  async (args: any) => {
    const { country, pattern, features, size } = args as {
      country: string;
      pattern?: string;
      features?: string;
      size?: number;
    };
    
    try {
      const searchParams: any = {
        country: country.toUpperCase(),
      };

      if (pattern) {
        searchParams.pattern = pattern;
      }

      if (features) {
        searchParams.features = features.split(',').map((f: string) => f.trim().toUpperCase());
      }

      if (size) {
        searchParams.size = Math.min(size, 100); // Limit to max 100
      } else {
        searchParams.size = 10; // Default to 10
      }

      const availableNumbers = await vonage.numbers.getAvailableNumbers(searchParams);

      if (!availableNumbers || !availableNumbers.numbers || availableNumbers.numbers.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No available numbers found for country ${country}${pattern ? ` matching pattern "${pattern}"` : ''}`,
            },
          ],
        };
      }

      // Format the results nicely
      const numbersList = availableNumbers.numbers.map((num: any, index: number) => {
        const features = [];
        if (num.features) {
          if (num.features.includes('VOICE')) features.push('Voice');
          if (num.features.includes('SMS')) features.push('SMS');
          if (num.features.includes('MMS')) features.push('MMS');
        }
        return `${index + 1}. ${num.msisdn} (${num.country}) - Features: ${features.join(', ') || 'None'} - Type: ${num.type || 'N/A'} - Cost: ${num.cost || 'N/A'}`;
      }).join('\n');

      return {
        content: [
          {
            type: 'text',
            text: `Found ${availableNumbers.numbers.length} available number(s) in ${country}:\n\n${numbersList}\n\nFull details: ${JSON.stringify(availableNumbers, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error searching for available numbers: ${typeof error === 'object' && error && 'message' in error ? (error as any).message : String(error)}`,
          },
        ],
      };
    }
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

// Get records report (synchronous Reports API)
(server.registerTool as any)(
  'get-records-report',
  {
    title: 'Get Records Report',
    description:
      'Retrieve a report of activity records from the Vonage Reports API. ' +
      'Supports date-based queries (e.g. "all SMS sent over the last week") and ' +
      'ID-based queries (e.g. "report for Call ID 1234-abcd"). ' +
      'For date-based queries provide product, direction (required for SMS/MESSAGES), and optionally date_start/date_end. ' +
      'For ID-based queries provide product and id (comma-separated UUIDs, max 20).',
    inputSchema: {
      product: z
        .enum([
          'SMS',
          'SMS-TRAFFIC-CONTROL',
          'VOICE-CALL',
          'VOICE-FAILED',
          'VOICE-TTS',
          'IN-APP-VOICE',
          'WEBSOCKET-CALL',
          'ASR',
          'AMD',
          'VERIFY-API',
          'VERIFY-V2',
          'NUMBER-INSIGHT',
          'NUMBER-INSIGHT-V2',
          'CONVERSATION-EVENT',
          'CONVERSATION-MESSAGE',
          'MESSAGES',
          'VIDEO-API',
          'NETWORK-API-EVENT',
          'REPORTS-USAGE',
        ])
        .describe('The product to return records for.'),
      id: z
        .string()
        .optional()
        .describe(
          'UUID(s) of the message or call to look up. Comma-separated, max 20. ' +
            'When provided, only product, account_id, direction, include_message, and show_concatenated are used.'
        ),
      date_start: z
        .string()
        .optional()
        .describe(
          'ISO-8601 start date/time for the report (e.g. 2024-01-01T00:00:00Z). Defaults to 7 days ago.'
        ),
      date_end: z
        .string()
        .optional()
        .describe(
          'ISO-8601 end date/time for the report (e.g. 2024-01-08T00:00:00Z). Defaults to now.'
        ),
      direction: z
        .enum(['inbound', 'outbound'])
        .optional()
        .describe('Direction of communication. Required for SMS and MESSAGES.'),
      status: z.string().optional().describe('Filter by event status.'),
      from: z.string().optional().describe('Filter by sender ID/number.'),
      to: z.string().optional().describe('Filter by recipient phone number.'),
      country: z.string().optional().describe('Filter by country code.'),
      include_message: z
        .boolean()
        .optional()
        .describe('Include message content in response (SMS, MESSAGES).'),
      call_id: z
        .string()
        .optional()
        .describe('Filter by call ID (VOICE-CALL, WEBSOCKET-CALL).'),
      account_id: z
        .string()
        .optional()
        .describe(
          'Account ID (API key) to report on. Defaults to your API key.'
        ),
    },
  },
  async (args: any) => {
    const {
      product,
      id,
      date_start,
      date_end,
      direction,
      status,
      from,
      to,
      country,
      include_message,
      call_id,
      account_id,
    } = args as {
      product: string;
      id?: string;
      date_start?: string;
      date_end?: string;
      direction?: string;
      status?: string;
      from?: string;
      to?: string;
      country?: string;
      include_message?: boolean;
      call_id?: string;
      account_id?: string;
    };

    try {
      const apiKey = process.env.VONAGE_API_KEY!;
      const apiSecret = process.env.VONAGE_API_SECRET!;
      const resolvedAccountId = account_id || apiKey;

      const params = new URLSearchParams();
      params.set('product', product);
      params.set('account_id', resolvedAccountId);

      if (id) {
        params.set('id', id);
      } else {
        if (date_start) params.set('date_start', date_start);
        if (date_end) params.set('date_end', date_end);
        if (status) params.set('status', status);
        if (from) params.set('from', from);
        if (to) params.set('to', to);
        if (country) params.set('country', country);
        if (call_id) params.set('call_id', call_id);
      }

      if (direction) params.set('direction', direction);
      if (include_message !== undefined)
        params.set('include_message', String(include_message));

      const url = `https://api.nexmo.com/v2/reports/records?${params.toString()}`;
      const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString(
        'base64'
      );

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Reports API error ${response.status}: ${errorBody}`);
      }

      const data = (await response.json()) as any;
      const recordCount = data.total_count ?? data.items?.length ?? 0;

      return {
        content: [
          {
            type: 'text',
            text: `Records report for ${product}${id ? ` (ID: ${id})` : ''}:\nTotal records: ${recordCount}\n\n${JSON.stringify(data, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error retrieving records report: ${typeof error === 'object' && error && 'message' in error ? (error as any).message : String(error)}`,
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
