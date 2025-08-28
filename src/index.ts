import 'dotenv/config';
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { Vonage } from '@vonage/server-sdk';
import { Auth } from '@vonage/auth';
import { Channels, MessageTypes } from '@vonage/messages';
import { NCCOBuilder, Talk } from '@vonage/voice';

const appId = process.env.VONAGE_APPLICATION_ID
const privateKey = Buffer.from(process.env.VONAGE_PRIVATE_KEY64!, 'base64');

const vonage = new Vonage(new Auth({
  apiKey: process.env.VONAGE_API_KEY!,
  apiSecret: process.env.VONAGE_API_SECRET!,
  applicationId: appId!,
  privateKey: privateKey
}));

const virtualNumber = process.env.VONAGE_VIRTUAL_NUMBER;

async function formatPhoneNumber(phoneNumber: string) {
  // Format the phone number as needed
  let phoneNumberFormatted;
  const result = await vonage.numberInsights.basicLookup(phoneNumber);
  // return JSON.stringify(result);
  if (result && result.status === 0) {
    phoneNumberFormatted = result.international_format_number;
  }
  return phoneNumberFormatted;
}


// Create an MCP server
const server = new McpServer({
  name: "vonage-mcp-server-api-bindings",
  version: "0.0.1"
});

// Get account balance
server.registerTool("balance",
  {
    title: "Account balance",
    description: "Get your Vonage Account balance",
    inputSchema: { }
  },
  async ({ }) => {
    try {
      // "await" the result of the send call
      const response = await vonage.accounts.getBalance()

      // On success, return the content object
      return {
        content: [{
          type: "text",
          text: `Current account balance is ${response.value.toFixed(2)}.`
        }]
      };

    } catch (error) {
      // If an error occurs, return the content object with the error message
      return {
        content: [{
          type: "text",
          text: `Error getting balance: ${typeof error === 'object' && error && 'message' in error ? (error as any).message : String(error)}`
        }]
      };
    }
  }
);


// Send an SMS
server.registerTool("SMS",
  {
    title: "SMS message",
    description: "Send an SMS message with Vonage",
    inputSchema: { to: z.string(), message: z.string() }
  },
  async ({ to, message }) => {
    try {
      // "await" the result of the send call
      const phoneNumberFormatted = await formatPhoneNumber(to);
      if (!phoneNumberFormatted) {
        throw new Error(`Invalid phone number format: ${to}`);
      }
      if (!message || !phoneNumberFormatted || !virtualNumber) {
        throw new Error("Required parameters missing");
      }
      const { messageUUID } = await vonage.messages.send({
        messageType: MessageTypes.TEXT,
        channel: Channels.SMS,
        text: message,
        to: phoneNumberFormatted,
        from: virtualNumber,
      });

      // On success, return the content object
      return {
        content: [{
          type: "text",
          text: `Message "${message}" sent to ${to}: ${messageUUID}`
        }]
      };

    } catch (error) {
      // If an error occurs, return the content object with the error message
      console.error(error);
      return {
        content: [{
          type: "text",
          text: `Error sending SMS JSON: ${error}`
        }]
      };
    }
  }
);

// Send an Outbound Voice Message
server.registerTool("outbound-voice-message",
  {
    title: "Outbound Voice Message",
    description: "Send an outbound voice message with Vonage",
    inputSchema: { to: z.string(), message: z.string() }
  },
  async ({ to, message }) => {
    const builder = new NCCOBuilder();
    builder.addAction(new Talk(message));

    try {
      const phoneNumberFormatted = await formatPhoneNumber(to);
      if (!phoneNumberFormatted) {
        throw new Error(`Invalid phone number format: ${to}`);
      }
      if (!message || !phoneNumberFormatted || !virtualNumber) {
        throw new Error("Required parameters missing");
      }
      // "await" the result of the send call
      const result = await vonage.voice.createOutboundCall({
        ncco: builder.build(),
        to: [
          {
            type: 'phone',
            number: phoneNumberFormatted,
          }],
        from:  {
            type: 'phone',
            number: virtualNumber!,
        }        
      });

      // On success, return the content object
      return {
        content: [{
          type: "text",
          text: `Voice Message "${message}" sent to ${to}: ${JSON.stringify(result)}`
        }]
      };

    } catch (error) {
      // If an error occurs, return the content object with the error message
      console.error(error);
      return {
        content: [{
          type: "text",
          text: `Error sending SMS JSON?: ${error}`
        }]
      };
    }
  }
);

server.registerTool("list-applications",
  {
    title: "List my applications",
    description: "List out the applications that are attached to my API key",
    inputSchema: {  }
  },
  async () => {
  const apps = await vonage.applications.listApplications({});

      // On success, return the content object
      return {
        content: [{
          type: "text",
          text: `Applications: ${JSON.stringify(apps)}`
        }]
      };
  }
);

server.registerTool("list-purchased-numbers",
  {
    title: "List the telephone numbers associated with my Vonage Account",
    description: "List of the telephone numbers that are currently associated with my account and their metadata",
    inputSchema: {  }
  },
  async () => {
    const numbers = await vonage.numbers.getOwnedNumbers();

      // On success, return the content object
      return {
        content: [{
          type: "text",
          text: `Numbers: ${JSON.stringify(numbers)}`
        }]
      };
  }
);

server.registerTool("link-number-to-vonage-application",
  {
    title: "Link an owned number to the assigned Vonage Application",
    description: "Link an owned number to the assigned Vonage Application",
    inputSchema: { 
      msisdn: z.string().describe("The phone number to link to the Vonage Application, in E.164 format, e.g. +12025550123"),
      applicationId: z.string().describe("The Vonage Application ID to link the number to")
     }
  },
  async ({msisdn, applicationId}) => {
    applicationId = applicationId.replace(/\s+/g, '');
    const numbers = await vonage.numbers.getOwnedNumbers({
      pattern: msisdn,
      searchPattern: 0
    });

    if (!numbers || numbers.numbers.length === 0) {
      return {
        content: [{
          type: "text",
          text: `I could not find the number "${msisdn}" attached to your account.`
        }]
      };
    }

    const number = numbers.numbers[0];
    if (number.app_id === applicationId) {
      return {
        content: [{
          type: "text",
          text: `The number "${msisdn}" is already linked to the Vonage Application ID ${applicationId}.`
        }]
      };
    }

    const newData = {
      country: number.country,
      msisdn: number.msisdn,
      app_id: applicationId,
      moHttpUrl: number.moHttpUrl,
      moSmppSysType: number.moSmppSysType,
      voiceCallbackType: number.voiceCallbackType,
      voiceCallbackValue: applicationId,
      voiceStatusCallback: number.voiceStatusCallback,
      messagesCallbackType: number.messagesCallbackType,
      messagesCallbackValue: number.messagesCallbackValue,
    }

    const response = await vonage.numbers.updateNumber(newData);

    // On success, return the content object
    return {
      content: [{
        type: "text",
        text: `Response: ${JSON.stringify(response)}`
        }]
      };
  }
);


// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);