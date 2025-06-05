import "dotenv/config";
import express from "express";
import { v4 as uuidv4 } from "uuid"; // For generating unique IDs

import {
  InMemoryTaskStore,
  TaskStore,
  schema,
  A2AExpressApp,
  AgentExecutor,
  RequestContext,
  IExecutionEventBus,
  DefaultRequestHandler,
} from "../../server/index.js";
import anthropic_client from "./anthropic.js";
import { getCurrentWeatherTool, executeTool } from "./tools.js";
import { weatherAgentCard } from "./agent-card.js";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY environment variable is required");
  process.exit(1);
}

// Simple store for contexts
const contexts: Map<string, schema.Message[]> = new Map();

// Load the system prompt from file
const systemPrompt = readFileSync(
  join(__dirname, "weather_agent.prompt"),
  "utf-8",
);

/**
 * WeatherAgentExecutor implements the agent's core logic.
 */
class WeatherAgentExecutor implements AgentExecutor {
  async execute(
    requestContext: RequestContext,
    eventBus: IExecutionEventBus,
  ): Promise<void> {
    const userMessage = requestContext.userMessage;
    const existingTask = requestContext.task;

    // Determine IDs for the task and context
    const taskId = existingTask?.id || uuidv4();
    const contextId =
      userMessage.contextId || existingTask?.contextId || uuidv4(); // DefaultRequestHandler should ensure userMessage.contextId

    console.log(
      `[WeatherAgentExecutor] Processing message ${userMessage.messageId} for task ${taskId} (context: ${contextId})`,
    );

    // 1. Publish initial Task event if it's a new task
    if (!existingTask) {
      const initialTask: schema.Task = {
        kind: "task",
        id: taskId,
        contextId: contextId,
        status: {
          state: schema.TaskState.Submitted,
          timestamp: new Date().toISOString(),
        },
        history: [userMessage], // Start history with the current user message
        metadata: userMessage.metadata, // Carry over metadata from message if any
      };
      eventBus.publish(initialTask);
    }

    // 2. Publish "working" status update
    const workingStatusUpdate: schema.TaskStatusUpdateEvent = {
      kind: "status-update",
      taskId: taskId,
      contextId: contextId,
      status: {
        state: schema.TaskState.Working,
        message: {
          kind: "message",
          role: "agent",
          messageId: uuidv4(),
          parts: [
            { kind: "text", text: "Processing your question, hang tight!" },
          ],
          taskId: taskId,
          contextId: contextId,
        },
        timestamp: new Date().toISOString(),
      },
      final: false,
    };
    eventBus.publish(workingStatusUpdate);

    // 3. Prepare messages for Anthropic
    const historyForAnthropic = contexts.get(contextId) || [];
    if (
      !historyForAnthropic.find((m) => m.messageId === userMessage.messageId)
    ) {
      historyForAnthropic.push(userMessage);
    }
    contexts.set(contextId, historyForAnthropic);

    const messages = historyForAnthropic
      .map((m) => ({
        role: (m.role === "agent" ? "assistant" : "user") as
          | "user"
          | "assistant",
        content: m.parts
          .filter(
            (p): p is schema.TextPart =>
              p.kind === "text" && !!(p as schema.TextPart).text,
          )
          .map((p) => (p as schema.TextPart).text)
          .join(" "),
      }))
      .filter((m) => m.content.length > 0);

    if (messages.length === 0) {
      console.warn(
        `[WeatherAgentExecutor] No valid text messages found in history for task ${taskId}.`,
      );
      const failureUpdate: schema.TaskStatusUpdateEvent = {
        kind: "status-update",
        taskId: taskId,
        contextId: contextId,
        status: {
          state: schema.TaskState.Failed,
          message: {
            kind: "message",
            role: "agent",
            messageId: uuidv4(),
            parts: [{ kind: "text", text: "No message found to process." }],
            taskId: taskId,
            contextId: contextId,
          },
          timestamp: new Date().toISOString(),
        },
        final: true,
      };
      eventBus.publish(failureUpdate);
      return;
    }

    const goal =
      (existingTask?.metadata?.goal as string | undefined) ||
      (userMessage.metadata?.goal as string | undefined);

    try {
      // 4. Create system message with interpolated values
      let systemMessage = systemPrompt
        .replace("GOAL_PLACEHOLDER", goal || "No specific goal provided")
        .replace("NOW_PLACEHOLDER", new Date().toISOString());

      // 5. Run the Anthropic API call
      const response = await anthropic_client.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 4000,
        system: systemMessage,
        messages,
        tools: [getCurrentWeatherTool],
      });

      // Check if the request has been cancelled
      if (requestContext.isCancelled()) {
        console.log(
          `[WeatherAgentExecutor] Request cancelled for task: ${taskId}`,
        );

        const cancelledUpdate: schema.TaskStatusUpdateEvent = {
          kind: "status-update",
          taskId: taskId,
          contextId: contextId,
          status: {
            state: schema.TaskState.Canceled,
            timestamp: new Date().toISOString(),
          },
          final: true, // Cancellation is a final state
        };
        eventBus.publish(cancelledUpdate);
        return;
      }

      // Handle tool calls if present
      let responseText = "";

      // Check if there are any tool_use blocks in the response
      const hasToolUse = response.content.some(
        (content) => content.type === "tool_use",
      );

      if (hasToolUse) {
        // Collect all tool results
        const toolResults: any[] = [];

        for (const content of response.content) {
          if (content.type === "tool_use") {
            try {
              const toolResult = await executeTool(content.name, content.input);
              toolResults.push({
                type: "tool_result",
                tool_use_id: content.id,
                content: JSON.stringify(toolResult, null, 2),
              });
            } catch (error) {
              console.error(`Error executing tool ${content.name}:`, error);
              toolResults.push({
                type: "tool_result",
                tool_use_id: content.id,
                content: JSON.stringify(
                  { error: `Error executing tool: ${error}` },
                  null,
                  2,
                ),
              });
            }
          }
        }

        // Continue conversation with all tool results
        const toolResponse = await anthropic_client.messages.create({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 4000,
          system: systemMessage,
          messages: [
            ...messages,
            { role: "assistant", content: response.content },
            { role: "user", content: toolResults },
          ],
        });

        // Extract text from the tool response
        if (toolResponse.content[0]?.type === "text") {
          responseText = toolResponse.content[0].text;
        }
      } else {
        // No tools, just extract text from the response
        const textContent = response.content.find(
          (content) => content.type === "text",
        );
        if (textContent && textContent.type === "text") {
          responseText = textContent.text;
        }
      }

      console.info(`[WeatherAgentExecutor] Prompt response: ${responseText}`);
      const lines = responseText.trim().split("\n");
      const finalStateLine = lines.at(-1)?.trim().toUpperCase();
      const agentReplyText = lines
        .slice(0, lines.length - 1)
        .join("\n")
        .trim();

      let finalA2AState: schema.TaskState = schema.TaskState.Unknown;

      if (finalStateLine === "COMPLETED") {
        finalA2AState = schema.TaskState.Completed;
      } else if (finalStateLine === "AWAITING_USER_INPUT") {
        finalA2AState = schema.TaskState.InputRequired;
      } else {
        console.warn(
          `[WeatherAgentExecutor] Unexpected final state line from prompt: ${finalStateLine}. Defaulting to 'completed'.`,
        );
        finalA2AState = schema.TaskState.Completed; // Default if LLM deviates
      }

      // 5. Publish final task status update
      const agentMessage: schema.Message = {
        kind: "message",
        role: "agent",
        messageId: uuidv4(),
        parts: [{ kind: "text", text: agentReplyText || "Completed." }], // Ensure some text
        taskId: taskId,
        contextId: contextId,
      };
      historyForAnthropic.push(agentMessage);
      contexts.set(contextId, historyForAnthropic);

      const finalUpdate: schema.TaskStatusUpdateEvent = {
        kind: "status-update",
        taskId: taskId,
        contextId: contextId,
        status: {
          state: finalA2AState,
          message: agentMessage,
          timestamp: new Date().toISOString(),
        },
        final: true,
      };
      eventBus.publish(finalUpdate);

      console.log(
        `[WeatherAgentExecutor] Task ${taskId} finished with state: ${finalA2AState}`,
      );
    } catch (error: any) {
      console.error(
        `[WeatherAgentExecutor] Error processing task ${taskId}:`,
        error,
      );
      const errorUpdate: schema.TaskStatusUpdateEvent = {
        kind: "status-update",
        taskId: taskId,
        contextId: contextId,
        status: {
          state: schema.TaskState.Failed,
          message: {
            kind: "message",
            role: "agent",
            messageId: uuidv4(),
            parts: [{ kind: "text", text: `Agent error: ${error.message}` }],
            taskId: taskId,
            contextId: contextId,
          },
          timestamp: new Date().toISOString(),
        },
        final: true,
      };
      eventBus.publish(errorUpdate);
    }
  }
}

// --- Server Setup ---

async function main() {
  // 1. Create TaskStore
  const taskStore: TaskStore = new InMemoryTaskStore();

  // 2. Create AgentExecutor
  const agentExecutor: AgentExecutor = new WeatherAgentExecutor();

  // 3. Create DefaultRequestHandler
  const requestHandler = new DefaultRequestHandler(
    weatherAgentCard,
    taskStore,
    agentExecutor,
  );

  // 4. Create and setup A2AExpressApp
  const appBuilder = new A2AExpressApp(requestHandler);
  const expressApp = appBuilder.setupRoutes(express());

  // 5. Start the server
  const PORT = process.env.PORT || 41241;
  expressApp.listen(PORT, () => {
    console.log(
      `[WeatherAgent] Server using new framework started on https://catena-weather-agent.replit.app/`,
    );
    console.log(
      `[WeatherAgent] Agent Card: https://catena-weather-agent.replit.app/.well-known/agent.json`,
    );
    console.log(
      `[WeatherAgent] Note: use http://localhost:${PORT}/ if running locally.`,
    );
    console.log("[WeatherAgent] Press Ctrl+C to stop the server");
  });
}

main().catch(console.error);
