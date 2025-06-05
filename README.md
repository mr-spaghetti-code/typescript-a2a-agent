This repo showcases a very simple agent implemented in TypeScript that uses A2A.

[![Try it yourself](https://replit.com/badge?caption=Try%20it%20yourself)](https://replit.new/github.com/mr-spaghetti-code/typescript-a2a-agent)

## Agents

- [Weather Agent](src/agents/weather-agent/README.md)

## Testing the Agents

1. Run npm install:
   
    ```bash
    npm install
    ```
2. Run the agent:
    ```bash
    export ANTHROPIC_API_KEY=<your_api_key>
    npm run agents:weather-agent
    ```
    Your agent will now be live at http://localhost:41241/. If you've deployed this on Replit, it will also be reachable in your configured URL.

4. In a separate terminal or machine
    ```bash
    npm run a2a:cli [Agent URL (optional)]
    ```