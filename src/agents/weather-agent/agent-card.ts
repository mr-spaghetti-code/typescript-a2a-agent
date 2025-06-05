import { schema } from "../../server/index.js";

/**
 * Weather Agent Card Configuration
 *
 * This file contains the agent card configuration that defines how the weather agent
 * appears to clients and what capabilities it advertises.
 *
 * Key customizable properties:
 * - name: Display name of the agent
 * - description: Brief description of what the agent does
 * - url: Base URL where the agent is hosted
 * - version: Version of the agent
 * - skills: Array of skills the agent can perform with examples
 * - examples: Sample queries users can try
 */
export const weatherAgentCard: schema.AgentCard = {
  name: "Weather Assistant",
  description:
    "A helpful assistant that provides current weather information for any location.",
  // Adjust the base URL and port as needed. /a2a is the default base in A2AExpressApp
  url: "https://catena-weather-agent.replit.app/", // Example: if baseUrl in A2AExpressApp
  provider: {
    organization: "Catena Labs",
    url: "https://www.catenalabs.com", // Added provider URL
  },
  version: "0.1.0", // Updated version
  capabilities: {
    streaming: true, // The new framework supports streaming
    pushNotifications: false, // Assuming not implemented for this agent yet
    stateTransitionHistory: true, // Agent uses history
  },
  // authentication: null, // Property 'authentication' does not exist on type 'AgentCard'.
  securitySchemes: undefined, // Or define actual security schemes if any
  security: undefined,
  defaultInputModes: ["text"],
  defaultOutputModes: ["text", "task-status"], // task-status is a common output mode
  skills: [
    {
      id: "weather_information",
      name: "Weather Information",
      description: "Get current weather information for any location.",
      tags: ["weather", "temperature", "forecast"],
      examples: [
        "What's the weather like in San Francisco?",
        "How hot is it in New York today?",
        "Is it raining in London?",
        "What's the temperature in Tokyo?",
        "Tell me about the weather in Sydney",
        "What are the current conditions in Los Angeles?",
      ],
      inputModes: ["text"], // Explicitly defining for skill
      outputModes: ["text", "task-status"], // Explicitly defining for skill
    },
  ],
  supportsAuthenticatedExtendedCard: false,
};
