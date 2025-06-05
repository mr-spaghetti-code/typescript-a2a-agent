## Agents

- [Weather Agent](src/agents/weather-agent/README.md)

## Testing the Agents

First, follow the instructions in the agent's README file, then run `npx tsx ./cli.ts` to start up a command-line client to talk to the agents. Example:

1. Navigate to the samples/js directory:
    ```bash
    cd samples/js
    ```
2. Run npm install:
    ```bash
    npm install
    ```
3. Run an agent:
```bash
export ANTHROPIC_API_KEY=<your_api_key>
npm run agents:weather-agent

# in a separate terminal
npm run a2a:cli
```