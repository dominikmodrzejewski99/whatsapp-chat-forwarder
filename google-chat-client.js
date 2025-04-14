const axios = require('axios');
const config = require('./config');

class GoogleChatClient {
  constructor() {
    this.webhookUrl = config.googleChat.webhookUrl;
    console.log(`GoogleChatClient constructor - Using webhook URL`);
  }

  async initialize() {
    try {
      console.log('Initializing Google Chat client with webhook...');
      
      if (!this.webhookUrl) {
        throw new Error('Webhook URL is not configured. Please set GOOGLE_CHAT_WEBHOOK_URL in .env file.');
      }
      
      console.log('Google Chat client initialized successfully with webhook');
    } catch (error) {
      console.error('Error initializing Google Chat client:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      throw error;
    }
  }

  async sendMessage(message) {
    console.log(`Attempting to send message to Google Chat...`);
    
    if (!this.webhookUrl) {
      console.error('Webhook URL is not configured');
      throw new Error('Webhook URL is not configured');
    }

    try {
      console.log(`Sending message to webhook...`);
      
      let payload;
      
      // Check if message is a JSON string (for cards format)
      if (typeof message === 'string' && message.startsWith('{') && message.endsWith('}')) {
        try {
          // Parse the JSON string
          payload = JSON.parse(message);
          console.log('Sending message as JSON payload');
        } catch (jsonError) {
          // If parsing fails, send as text
          console.log('Failed to parse message as JSON, sending as text');
          payload = { text: message };
        }
      } else {
        // Regular text message
        payload = { text: message };
      }
      
      const response = await axios.post(this.webhookUrl, payload);

      console.log('Message sent to Google Chat successfully');
      console.log('Response status:', response.status);
      return response.data;
    } catch (error) {
      console.error('Error sending message to Google Chat:', error);
      if (error.response) {
        console.error('Response data:', JSON.stringify(error.response.data, null, 2));
        console.error('Response status:', error.response.status);
      }
      throw error;
    }
  }
}

module.exports = new GoogleChatClient();
