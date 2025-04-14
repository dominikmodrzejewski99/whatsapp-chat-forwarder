require('dotenv').config();

console.log('Loading configuration...');
console.log('Environment variables:');
console.log('WHATSAPP_GROUP_NAME:', process.env.WHATSAPP_GROUP_NAME);
console.log('GOOGLE_CHAT_WEBHOOK_URL:', process.env.GOOGLE_CHAT_WEBHOOK_URL ? 'Configured' : 'Not configured');
console.log('MESSAGE_CHECK_INTERVAL:', process.env.MESSAGE_CHECK_INTERVAL);
console.log('GOOGLE_CREDENTIALS:', process.env.GOOGLE_CREDENTIALS ? 'Configured' : 'Not configured');

// Parsuj dane uwierzytelniające Google z zmiennej środowiskowej, jeśli istnieje
let googleCredentials = null;
if (process.env.GOOGLE_CREDENTIALS) {
  try {
    googleCredentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    console.log('Successfully parsed Google credentials from environment variable');
  } catch (error) {
    console.error('Error parsing GOOGLE_CREDENTIALS environment variable:', error.message);
  }
}

const config = {
  whatsapp: {
    groupName: process.env.WHATSAPP_GROUP_NAME || 'Food Delivery Channel',
  },
  googleChat: {
    webhookUrl: process.env.GOOGLE_CHAT_WEBHOOK_URL,
    credentials: googleCredentials,
  },
  app: {
    messageCheckInterval: parseInt(process.env.MESSAGE_CHECK_INTERVAL || '60000', 10),
  }
};

console.log('Configuration loaded:');
console.log('WhatsApp Group Name:', config.whatsapp.groupName);
console.log('Google Chat Webhook URL:', config.googleChat.webhookUrl ? 'Configured' : 'Not configured');
console.log('Message Check Interval:', config.app.messageCheckInterval);

module.exports = config;
