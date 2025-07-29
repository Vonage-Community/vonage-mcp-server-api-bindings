# Vonage API MCP server

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
    }
}
```

> Right now, we only use a base64 encoded Private Key. I created a tool that will convert the private key file into the encoded string that you can copy and paste. Everything is done in your browser, no inforamtion is sent anywhere: [https://mylight.work/private-key-to-environment-variable](https://mylight.work/private-key-to-environment-variable)