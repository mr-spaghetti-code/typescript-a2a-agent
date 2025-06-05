// Define the weather tool schema for Anthropic
export const getCurrentWeatherTool = {
  name: "getCurrentWeather",
  description: "Get current weather information for a specific location",
  input_schema: {
    type: "object" as const,
    properties: {
      location: {
        type: "string" as const,
        description: "The city and country/state (e.g., 'San Francisco, CA' or 'London, UK')"
      }
    },
    required: ["location"]
  }
};

// Dummy weather data for different locations
const dummyWeatherData: Record<string, any> = {
  "san francisco": {
    location: "San Francisco, CA",
    temperature: 68,
    temperature_celsius: 20,
    condition: "Partly Cloudy",
    humidity: 65,
    wind_speed: 8,
    wind_direction: "W",
    feels_like: 70,
    feels_like_celsius: 21,
    visibility: 10,
    uv_index: 5,
    last_updated: new Date().toISOString()
  },
  "new york": {
    location: "New York, NY",
    temperature: 75,
    temperature_celsius: 24,
    condition: "Sunny",
    humidity: 45,
    wind_speed: 12,
    wind_direction: "SW",
    feels_like: 78,
    feels_like_celsius: 26,
    visibility: 10,
    uv_index: 7,
    last_updated: new Date().toISOString()
  },
  "london": {
    location: "London, UK",
    temperature: 59,
    temperature_celsius: 15,
    condition: "Light Rain",
    humidity: 80,
    wind_speed: 15,
    wind_direction: "NW",
    feels_like: 55,
    feels_like_celsius: 13,
    visibility: 8,
    uv_index: 2,
    last_updated: new Date().toISOString()
  },
  "tokyo": {
    location: "Tokyo, Japan",
    temperature: 72,
    temperature_celsius: 22,
    condition: "Overcast",
    humidity: 70,
    wind_speed: 6,
    wind_direction: "E",
    feels_like: 74,
    feels_like_celsius: 23,
    visibility: 9,
    uv_index: 4,
    last_updated: new Date().toISOString()
  },
  "sydney": {
    location: "Sydney, Australia",
    temperature: 77,
    temperature_celsius: 25,
    condition: "Clear",
    humidity: 55,
    wind_speed: 10,
    wind_direction: "SE",
    feels_like: 80,
    feels_like_celsius: 27,
    visibility: 10,
    uv_index: 8,
    last_updated: new Date().toISOString()
  }
};

// Default weather for unknown locations
const defaultWeather = {
  location: "Unknown Location",
  temperature: 70,
  temperature_celsius: 21,
  condition: "Partly Cloudy",
  humidity: 60,
  wind_speed: 5,
  wind_direction: "N",
  feels_like: 72,
  feels_like_celsius: 22,
  visibility: 10,
  uv_index: 5,
  last_updated: new Date().toISOString()
};

// Tool execution function
export async function executeGetCurrentWeather(location: string) {
  console.log("[dummy:getCurrentWeather]", JSON.stringify(location));
  
  // Simple lookup - normalize the location string
  const normalizedLocation = location.toLowerCase().trim();
  
  // Check if we have data for this location
  let weatherData = null;
  for (const key in dummyWeatherData) {
    if (normalizedLocation.includes(key)) {
      weatherData = dummyWeatherData[key];
      break;
    }
  }
  
  // If no match found, use default weather but update the location
  if (!weatherData) {
    weatherData = { ...defaultWeather, location: location };
  }

  return {
    success: true,
    data: weatherData
  };
}

// Tool execution dispatcher
export async function executeTool(toolName: string, input: any) {
  switch (toolName) {
    case "getCurrentWeather":
      return await executeGetCurrentWeather(input.location);
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
