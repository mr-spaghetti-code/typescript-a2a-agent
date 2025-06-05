import Anthropic from '@anthropic-ai/sdk';

const anthropic_client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY, // Use environment variable
});

export default anthropic_client;
