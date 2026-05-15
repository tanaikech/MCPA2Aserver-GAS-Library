/**
 * MCPA2Aserver: Class Object for Consolidating Generative AI Protocols: A Single Server Solution for MCP and A2A
 * Author: Tanaike
 * v1.2.0
 * 
 * ### Description
 * This class provides a consolidated server solution for Model Context Protocol (MCP) and Agent-to-Agent (A2A) communication directly within your Google Apps Script project.
 * 
 * ### Usage
 * ```javascript
 * const mcpA2A = new MCPA2Aserver();
 * // REQUIRED: Inject LockService from the client environment to prevent concurrency issues across library scopes.
 * mcpA2A.setServices({ lock: LockService.getScriptLock() });
 * 
 * mcpA2A.apiKey = "YOUR_API_KEY";
 * mcpA2A.model = "models/gemini-3-flash-preview";
 * mcpA2A.mcp = true; // Set to true to enable MCP server functionality
 * mcpA2A.a2a = true; // Set to true to enable A2A server functionality
 * mcpA2A.accessKey = "YOUR_ACCESS_KEY"; // Optional: Access key for secure access
 * mcpA2A.logSpreadsheetId = "YOUR_SPREADSHEET_ID"; // Optional: Spreadsheet ID for logging
 * mcpA2A.useToolsForMCPServer = true; // Use ToolsForMCPServer
 * 
 * // Run the main dispatcher
 * const response = mcpA2A.main(e, context);
 * return response;
 * ```
 */
var MCPA2Aserver = class MCPA2Aserver {
  
  /**
   * Initializes the MCPA2Aserver properties.
   */
  constructor() {
    /** @type {String} API key for using Gemini API. */
    this.apiKey = "";
    
    /** @type {String} Model version to be used for generative AI. */
    this.model = "models/gemini-3-flash-preview";
    
    /** @type {String} Access key to restrict access to the Web Apps. */
    this.accessKey = "";
    
    /** @type {String} Google Sheets ID used for storing logs. */
    this.logSpreadsheetId = "";
    
    /** @type {Boolean} If true, tools from ToolsForMCPServer library are integrated automatically. */
    this.useToolsForMCPServer = false;
    
    /** @type {String} The URL of the deployed Web App. */
    this.webAppsUrl = "";
    
    /** @type {Boolean} Enable MCP Server routing. */
    this.mcp = false;
    
    /** @type {Boolean} Enable A2A Server routing. */
    this.a2a = false;

    /** @type {GoogleAppsScript.Lock.Lock|null} LockService instance injected from the executing environment. */
    this.lock = null;

    /** @private */
    this.CONFIG = {
      API_KEY: this.apiKey,
      MODEL: this.model,
      WELL_KNOWN_PATHS: [".well-known/agent-card.json", ".well-known/agent.json"],
      METHODS: {
        A2A: ["tasks/send", "message/send"],
        MCP: [
          "initialize", "notifications/initialized", "notifications/cancelled",
          "resources/list", "prompts/list", "tools/list", "tools/call"
        ]
      }
    };
  }

  /**
   * ### Description
   * Injects dependencies such as LockService from the calling context.
   * This ensures concurrency mechanisms operate correctly even when used as a GAS library.
   * 
   * @param {Object} services - Object containing the services.
   * @param {GoogleAppsScript.Lock.Lock} services.lock - The lock instance from the executing client context.
   * @return {MCPA2Aserver}
   */
  setServices(services = {}) {
    const { lock } = services;
    if (lock && lock.toString() === "Lock") {
      this.lock = lock;
    }
    return this;
  }

  /**
   * Main Dispatcher Method
   * Routes the incoming request to either the A2A handler or the MCP handler based on the payload or path.
   * 
   * @param {EventObject} e - The event object from doGet/doPost
   * @param {Object} context - (Optional) Custom context providing A2AObj and MCPObj.
   * @return {ContentService.TextOutput} The JSON response
   */
  main(e, context = null) {
    if (!this.lock) {
      throw new Error("Fatal: LockService is required. Please set it using setServices({ lock: LockService.getScriptLock() }) before calling main().");
    }
    if (!this.apiKey) {
      return ContentService.createTextOutput("Set your API key for using Gemini API.");
    }
    if (this.useToolsForMCPServer === true && !this.webAppsUrl) {
      return ContentService.createTextOutput("When you use ToolsForMCPServer, set webAppsUrl.");
    }
    
    this.CONFIG.API_KEY = this.apiKey;
    this.CONFIG.MODEL = this.model;
    
    this.webAppsUrl = this.accessKey && this.webAppsUrl && !this.webAppsUrl.includes("accessKey=") 
      ? `${this.webAppsUrl}?accessKey=${this.accessKey}` 
      : this.webAppsUrl;

    if (this.useToolsForMCPServer === true) {
      context = this.createServerContext_();
    } else if (this.useToolsForMCPServer === false && !context) {
      return ContentService.createTextOutput("No tools.");
    }

    const route = this.determineRoute_(e);

    if (route.type === "A2A" && this.a2a === true) {
      return this.handleA2ARequest_(e, context.A2AObj);
    }

    if (route.type === "MCP" && this.mcp === true) {
      return this.handleMCPRequest_(e, context.MCPObj);
    }

    // Fallback / Empty response
    return ContentService.createTextOutput("{}").setMimeType(ContentService.MimeType.JSON);
  }

  /**
   * Creates the context objects (Tools, Functions) required for the handlers when useToolsForMCPServer is true.
   * 
   * @private
   * @return {Object} The context objects for A2A and MCP.
   */
  createServerContext_() {
    const m = ToolsForMCPServer;
    m.apiKey = this.CONFIG.API_KEY;
    m.model = this.CONFIG.MODEL;

    const tools = m.getTools();

    // Transform MCP tools into A2A compatible function map
    const functions = [...tools]
      .filter(e => e.type === "tools/list")
      .reduce((acc, tool) => {
        const funcName = tool.value.name;
        // Map for Function Calling schema
        acc.params_[funcName] = {
          description: tool.value.description,
          parameters: tool.value.inputSchema,
        };
        // Actual function execution reference
        acc[funcName] = tool.function;
        return acc;
      }, { params_: {} });

    agentCard_ToolsForMCPServer.url = this.webAppsUrl;

    return {
      A2AObj: {
        functions: () => functions,
        agentCard: () => agentCard_ToolsForMCPServer
      },
      MCPObj: tools,
    };
  }

  /**
   * Determines the routing type based on the event object.
   * 
   * @private
   * @param {EventObject} e - The event object from doGet/doPost
   * @return {Object} An object containing the route type ("A2A", "MCP", or "UNKNOWN").
   */
  determineRoute_(e) {
    // 1. Check Path Info (e.g. for Agent Discovery)
    if (e.pathInfo && this.CONFIG.WELL_KNOWN_PATHS.includes(e.pathInfo)) {
      return { type: "A2A" };
    }

    // 2. Check POST Data (JSON-RPC Methods)
    if (e.postData && e.postData.contents) {
      try {
        const obj = JSON.parse(e.postData.contents);
        if (obj.method) {
          if (this.CONFIG.METHODS.A2A.includes(obj.method)) {
            return { type: "A2A" };
          }
          if (this.CONFIG.METHODS.MCP.includes(obj.method)) {
            return { type: "MCP" };
          }
        }
      } catch (err) {
        console.warn("Invalid JSON in request", err);
      }
    }
    return { type: "UNKNOWN" };
  }

  /**
   * Handles requests destined for the A2A Server.
   * 
   * @private
   * @param {EventObject} e - The event object from doGet/doPost
   * @param {Object} A2AObj - The A2A context object.
   * @return {ContentService.TextOutput} The evaluated response.
   */
  handleA2ARequest_(e, A2AObj) {
    try {
      const { agentCard, functions } = A2AObj;
      const object = {
        eventObject: e,
        agentCard: agentCard, // Pass the getter function
        functions: functions, // Pass the getter function
        apiKey: this.apiKey,
        agentCardUrls: [],
      };

      // Initialize A2A Application
      const o = { model: this.CONFIG.MODEL };
      if (this.accessKey) {
        o.accessKey = this.accessKey;
      }
      if (this.logSpreadsheetId) {
        o.log = true;
        o.spreadsheetId = this.logSpreadsheetId;
      }
      const res = new A2AApp(o).setServices({ lock: this.lock }).server(object);
      return res;
    } catch (err) {
      console.error(err.stack);
      return ContentService.createTextOutput(err.stack);
    }
  }

  /**
   * Handles requests destined for the MCP Server.
   * 
   * @private
   * @param {EventObject} e - The event object from doGet/doPost
   * @param {Object} MCPObj - The MCP context object.
   * @return {ContentService.TextOutput} The evaluated response.
   */
  handleMCPRequest_(e, MCPObj) {
    try {
      const object = { eventObject: e, items: MCPObj };
      const o = {};
      if (this.accessKey) {
        o.accessKey = this.accessKey;
      }
      if (this.logSpreadsheetId) {
        o.log = true;
        o.spreadsheetId = this.logSpreadsheetId;
      }
      const res = new MCPApp(o)
        .setServices({ lock: this.lock })
        .server(object);
      return res;
    } catch (err) {
      console.error(err.stack);
      return ContentService.createTextOutput(err.stack);
    }
  }
}