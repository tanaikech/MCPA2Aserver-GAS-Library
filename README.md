<a name="top"></a>

# MCPA2Aserver for Google Apps Script library

[![MIT License](http://img.shields.io/badge/license-MIT-blue.svg?style=flat)](LICENCE)

<a name="description"></a>

## Description

MCPA2Aserver is a Google Apps Script library designed to consolidate Generative AI protocols into a single server solution. It enables developers to easily build and deploy servers that support both the **Model Context Protocol (MCP)** and the **Agent-to-Agent (A2A)** protocol.

By handling request routing and protocol-specific logic, this library allows a single Google Apps Script deployment to function as a versatile endpoint for various AI agent interactions. Whether you are building an MCP server to provide tools to an AI model or an A2A agent to communicate with other agents, this library simplifies the implementation process within the Google Apps Script environment.

<a name="prerequisites"></a>

## 🛠 Prerequisites

- **Node.js**: (Latest LTS recommended)
- **Google Account**: To host the GAS server.
- **Gemini API Key**: [Get one here](https://ai.google.dev/gemini-api/docs/api-key).
- **Google Cloud SDK**: For local authentication (`gcloud` CLI).

---

<a name="usage"></a>

## Usage

### Install library

**Library's Script ID**

```
1xRlK6KPhqp374qAyumrtVXXNEtb7iZ_rD7yRuYxccQuYieKCCao9VuB6
```

- **Please copy and paste the above Script ID into the search box of the "Libraries" in your Google Apps Script project.**
- [Installation Guide of Google Apps Script library](https://developers.google.com/apps-script/guides/libraries)

### Sample script 1

#### A2A server

1. Sample script
   Create a new Google Apps Script project. In this case, both the standalone type and the container-bound type can be used. Please copy and paste the following 2 scripts into the script editor.

   `a2a-server.js`: This is the main script for the A2A server.

   ```javascript
   /**
    * Script for Consolidating Generative AI Protocols: A Single Server Solution for MCP and A2A
    * Author: Tanaike
    * v1.1.0
    */

   // --- Your variables ---
   const object = {
     apiKey: "{apiKey}", // Your API key for using Gemini API.
     model: "models/gemini-3-flash-preview",
     accessKey: "sample", // If you want to use an access key for requesting Web Apps, please use this.
     webAppsUrl: "https://script.google.com/macros/s/###/exec", // Your deployed Web Apps URL.
     // logSpreadsheetId: "{spreadsheetId}", // If you use this, the logs are stored to Google Spreadsheet.
   };

   // --- Entry Points ---
   const doGet = (e) => main(e);
   const doPost = (e) => main(e);

   /**
    * Main Dispatcher Function
    * Routes the request to either A2A handler or MCP handler based on the payload or path.
    *
    * @param {EventObject} e - The event object from doGet/doPost
    * @return {ContentService.TextOutput} The JSON response
    */
   function main(e) {
     const context = createServerContext_(); // Load sample tools.
     const m = MCPA2Aserver;
     m.a2a = true; // If this is true, this server is used as the A2A server. You can use both mcp and a2a as true.
     m.mcp = true; // If this is true, this server is used as the MCP server. You can use both mcp and a2a as true.
     m.apiKey = object.apiKey;
     m.model = object.model;
     if (object.accessKey) m.accessKey = object.accessKey;
     if (object.logSpreadsheetId) m.logSpreadsheetId = object.logSpreadsheetId;
     const res = m.main(e, context);
     return res;
   }
   ```

   `sample-context.js`: This is the agent card and 2 sample skills for the A2A server.

   ```javascript
   function createServerContext_() {
     const functions = {
       params_: {
         get_exchange_rate: {
           description: "Use this to get current exchange rate.",
           parameters: {
             type: "object",
             properties: {
               currency_from: {
                 type: "string",
                 description:
                   "Source currency (major currency). Default is USD.",
               },
               currency_to: {
                 type: "string",
                 description:
                   "Destination currency (major currency). Default is EUR.",
               },
               currency_date: {
                 type: "string",
                 description:
                   "Date of the currency. Default is latest. It should be ISO format (YYYY-MM-DD).",
               },
             },
             required: ["currency_from", "currency_to", "currency_date"],
           },
         },

         get_current_weather: {
           description: [
             "Use this to get the weather using the latitude and the longitude.",
             "At that time, convert the location to the latitude and the longitude and provide them to the function.",
             `The date is required to be included. The date format is "yyyy-MM-dd HH:mm"`,
             `If you cannot know the location, decide the location using the timezone.`,
           ].join("\n"),
           parameters: {
             type: "object",
             properties: {
               latitude: {
                 type: "number",
                 description: "The latitude of the inputed location.",
               },
               longitude: {
                 type: "number",
                 description: "The longitude of the inputed location.",
               },
               date: {
                 type: "string",
                 description: `Date for searching the weather. The date format is "yyyy-MM-dd HH:mm"`,
               },
               timezone: {
                 type: "string",
                 description: `The timezone. In the case of Japan, "Asia/Tokyo" is used.`,
               },
             },
             required: ["latitude", "longitude", "date", "timezone"],
           },
         },
       },

       /**
        * Ref: https://github.com/google/A2A/blob/main/samples/python/agents/langgraph/agent.py#L19
        */
       get_exchange_rate: (object) => {
         console.log("Run the function get_exchange_rate.");
         console.log(object); // Check arguments.
         const {
           currency_from = "USD",
           currency_to = "EUR",
           currency_date = "latest",
         } = object;
         let res;
         try {
           const resStr = UrlFetchApp.fetch(
             `https://api.frankfurter.app/${currency_date}?from=${currency_from}&to=${currency_to}`
           ).getContentText();
           const obj = JSON.parse(resStr);
           res = [
             `The raw data from the API is ${resStr}. The detailed result is as follows.`,
             `The currency rate at ${currency_date} from "${currency_from}" to "${currency_to}" is ${obj.rates[currency_to]}.`,
           ].join("\n");
         } catch ({ stack }) {
           res = stack;
         }
         console.log(res); // Check response.
         return {
           mcp: {
             jsonrpc: "2.0",
             result: { content: [{ type: "text", text: res }], isError: false },
           },
           a2a: { result: res },
         };
       },

       /**
        * This function returns the current weather.
        * The API is from https://open-meteo.com/
        *
        * { latitude = "35.681236", longitude = "139.767125", date = "2025-05-27 12:00", timezone = "Asia/Tokyo" } is Tokyo station.
        */
       get_current_weather: (object) => {
         console.log("Run the function get_current_weather.");
         console.log(object); // Check arguments.
         const {
           latitude = "35.681236",
           longitude = "139.767125",
           date = "2025-05-27 12:00",
           timezone = "Asia/Tokyo",
         } = object;
         let res;
         try {
           // Ref: https://open-meteo.com/en/docs?hourly=weather_code&current=weather_code#weather_variable_documentation
           const code = {
             0: "Clear sky",
             1: "Mainly clear, partly cloudy, and overcast",
             2: "Mainly clear, partly cloudy, and overcast",
             3: "Mainly clear, partly cloudy, and overcast",
             45: "Fog and depositing rime fog",
             48: "Fog and depositing rime fog",
             51: "Drizzle: Light, moderate, and dense intensity",
             53: "Drizzle: Light, moderate, and dense intensity",
             55: "Drizzle: Light, moderate, and dense intensity",
             56: "Freezing Drizzle: Light and dense intensity",
             57: "Freezing Drizzle: Light and dense intensity",
             61: "Rain: Slight, moderate and heavy intensity",
             63: "Rain: Slight, moderate and heavy intensity",
             65: "Rain: Slight, moderate and heavy intensity",
             66: "Freezing Rain: Light and heavy intensity",
             67: "Freezing Rain: Light and heavy intensity",
             71: "Snow fall: Slight, moderate, and heavy intensity",
             73: "Snow fall: Slight, moderate, and heavy intensity",
             75: "Snow fall: Slight, moderate, and heavy intensity",
             77: "Snow grains",
             80: "Rain showers: Slight, moderate, and violent",
             81: "Rain showers: Slight, moderate, and violent",
             82: "Rain showers: Slight, moderate, and violent",
             85: "Snow showers slight and heavy",
             86: "Snow showers slight and heavy",
             95: "Thunderstorm: Slight or moderate",
             96: "Thunderstorm with slight and heavy hail",
             99: "Thunderstorm with slight and heavy hail",
           };
           const endpoint = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=weather_code&timezone=${encodeURIComponent(
             timezone
           )}`;
           const resObj = UrlFetchApp.fetch(endpoint, {
             muteHttpExceptions: true,
           });
           if (resObj.getResponseCode() == 200) {
             const obj = JSON.parse(resObj.getContentText());
             const {
               hourly: { time, weather_code },
             } = obj;
             const widx = time.indexOf(date.replace(" ", "T").trim());
             if (widx != -1) {
               res = code[weather_code[widx]];
             } else {
               res = "No value was returned. Please try again.";
             }
           } else {
             res = "No value was returned. Please try again.";
           }
         } catch ({ stack }) {
           res = stack;
         }
         console.log(res); // Check response.
         return {
           mcp: {
             jsonrpc: "2.0",
             result: { content: [{ type: "text", text: res }], isError: false },
           },
           a2a: { result: res },
         };
       },
     };

     /**
      * If you want to return the file content to MCP client, please set the return value as follows.
      * {
      *   jsonrpc: "2.0",
      *   result: {
      *    content: [
      *      {
      *        type: "text",
      *         text: "sample text",
      *       },
      *       {
      *         type: "image",
      *         data: "base64 data",
      *         mimeType: "mimetype",
      *       },
      *     ],
      *     isError: false,
      *   }
      * }
      *
      * If you want to return the file content to A2A client, please set the return value as follows.
      * {
      *   result: {
      *     type: "file",
      *     kind: "file",
      *     file: {
      *       name: "filename",
      *       bytes: "base64 data",
      *       mimeType: "mimetype",
      *     },
      *     metadata: null
      *   }
      * }
      *
      */

     // for A2A
     const agentCard = {
       name: "API Manager",
       description: [
         `Provide management for using various APIs.`,
         `- Run with exchange values between various currencies. For example, this answers "What is the exchange rate between USD and GBP?".`,
         `- Return the weather information by providing the location and the date, and the time.`,
       ].join("\n"),
       provider: {
         organization: "Tanaike",
         url: "https://github.com/tanaikech",
       },
       version: "1.0.0",
       // "url": "https://script.google.com/macros/s/###/exec?accessKey=sample", // <--- Please replace this to your Web Apps URL.
       url: `${object.webAppsUrl}?accessKey=${object.accessKey}`,
       defaultInputModes: ["text/plain"],
       defaultOutputModes: ["text/plain"],
       capabilities: {
         streaming: false,
         pushNotifications: false,
         stateTransitionHistory: false,
       },
       skills: [
         {
           id: "get_exchange_rate",
           name: "Currency Exchange Rates Tool",
           description: "Helps with exchange values between various currencies",
           tags: ["currency conversion", "currency exchange"],
           examples: ["What is exchange rate between USD and GBP?"],
           inputModes: ["text/plain"],
           outputModes: ["text/plain"],
         },
         {
           id: "get_current_weather",
           name: "Get current weather",
           description:
             "This agent can return the weather information by providing the location and the date, and the time.",
           tags: ["weather"],
           examples: [
             "Return the weather in Tokyo for tomorrow's lunchtime.",
             "Return the weather in Tokyo for 9 AM on May 27, 2025.",
           ],
           inputModes: ["text/plain"],
           outputModes: ["text/plain"],
         },
       ],
     };

     // for MCP
     const itemsForMCP = [
       {
         type: "initialize",
         value: {
           protocolVersion: "2024-11-05", // or "2025-03-26"
           capabilities: { tools: { listChanged: false } },
           serverInfo: { name: "API Manager", version: "1.0.0" },
         },
       },
       ...Object.keys(functions.params_).map((f) => ({
         type: "tools/list",
         function: functions[f],
         value: {
           name: f,
           description: functions.params_[f].description,
           inputSchema: functions.params_[f].parameters,
         },
       })),
     ];

     return {
       A2AObj: { functions: (_) => functions, agentCard: (_) => agentCard },
       MCPObj: itemsForMCP,
     };
   }
   ```

2. **Deploy as Web App**

   - Open the script editor.
   - Click **Deploy** > **New deployment**.
   - Select **Web App**.
   - **Execute as**: Me.
   - **Who has access**: Anyone.
   - Copy the **Web App URL**.

3. **Configuration**

   Update the `object` variable in the GAS script:

   ```javascript
   const object = {
     apiKey: "YOUR_GEMINI_API_KEY",
     model: "models/gemini-3-flash-preview",
     accessKey: "sample", // Optional security key
     webAppsUrl: "YOUR_WEB_APP_URL",
   };
   ```

   _Note: Redeploy the Web App after updating the code._

#### A2A client

1.  **Clone and Install**

    ```bash
    git clone https://github.com/tanaikech/a2a-for-google-apps-script
    cd a2a-for-google-apps-script/a2a-client
    npm install
    ```

2.  **Set Environment Variables**
    Create a `.env` file in the `a2a-client` directory:

    ```text
    GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
    GEMINI_MODEL="models/gemini-3-flash-preview"
    A2A_WEB_APPS_URL="https://script.google.com/macros/s/###/exec?accessKey=sample"
    ```

3.  **Authentication**
    This client uses a custom proxy that requires a Google Access Token. Login via gcloud:
    ```bash
    gcloud auth application-default login --scopes="https://www.googleapis.com/auth/drive.readonly"
    ```

#### Testing

Verify basic connectivity and TSI logic. Run the following command under the directory `a2a-for-google-apps-script/a2a-client`.

```bash
npm run test1
```

**Result:**

```text
Prompt: How much is 10 yen in USD?
Response: 10 yen is approximately **0.0641 USD**...
Prompt: What is the weather forecast for Tokyo?
Response: The weather forecast for Tokyo... is clear sky.
```

### Sample script 2

As the sample script 2, 160 tools of [ToolsForMCPServer](https://github.com/tanaikech/ToolsForMCPServer) are used as the skills for managing Google Workspace. The details of this can be seen at the following repository.

[https://github.com/tanaikech/a2a-for-google-apps-script](https://github.com/tanaikech/a2a-for-google-apps-script)

---

<a name="advanced"></a>

## 💡 Advanced: Remote MCP

This server can also be used as a remote MCP server with the Gemini CLI. Add this to your `.gemini/setting.json`:

```json
"mcpServers": {
  "gas_web_apps": {
    "command": "npx",
    "args": [
      "mcp-remote",
      "https://script.google.com/macros/s/###/exec?accessKey=sample"
    ],
    "timeout": 300000
  }
}
```

---

<a name="license"></a>

## Licence

[MIT](LICENCE)

<a name="author"></a>

## Author

[Tanaike](https://tanaikech.github.io/about/)

[Donate](https://tanaikech.github.io/donate/)

<a name="history"></a>

## Update History

- v1.0.1 (January 1, 2026)
  - Initial release.

[TOP](#top)
