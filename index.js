const whatsappClient = require('./whatsapp-client');
const googleChatClient = require('./google-chat-client');
const messageProcessor = require('./message-processor');
const fs = require('fs');
const path = require('path');
const http = require('http');

// Utworzenie prostego serwera HTTP dla Cloud Run
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200);
    res.end('OK');
  } else {
    res.writeHead(200);
    res.end('WhatsApp to Google Chat integration is running');
  }
});

// Nasłuchiwanie na porcie określonym przez Cloud Run lub domyślnie 8080
const PORT = process.env.PORT || 8080;

async function main() {
  try {
    console.log('Starting WhatsApp to Google Chat integration...');
    console.log('Current directory:', process.cwd());

    // Sprawdź, czy zmienne środowiskowe są skonfigurowane
    console.log('Checking environment variables for credentials...');

    // Sprawdź konfigurację Google Chat
    if (process.env.GOOGLE_CHAT_WEBHOOK_URL) {
      console.log('Google Chat webhook URL found in environment variables');
    } else {
      console.warn('Google Chat webhook URL not found in environment variables!');
      console.warn('Please set GOOGLE_CHAT_WEBHOOK_URL environment variable');
    }

    // Sprawdź konfigurację WhatsApp
    if (process.env.WHATSAPP_GROUP_NAME) {
      console.log('WhatsApp group name found in environment variables:', process.env.WHATSAPP_GROUP_NAME);
    } else {
      console.warn('WhatsApp group name not found in environment variables!');
      console.warn('Please set WHATSAPP_GROUP_NAME environment variable');
    }

    // Initialize Google Chat client
    console.log('Initializing Google Chat client...');
    try {
      await googleChatClient.initialize();
      console.log('Google Chat client initialized successfully');
    } catch (gchatError) {
      console.error('Failed to initialize Google Chat client:', gchatError);
      console.error('Stack trace:', gchatError.stack);
    }

    // Initialize message processor
    console.log('Initializing message processor...');
    messageProcessor.initialize();
    console.log('Message processor initialized');

    // Start WhatsApp client (this will generate a QR code for authentication)
    console.log('Starting WhatsApp client...');
    await whatsappClient.start();
    console.log('WhatsApp client started');

    console.log('Integration is running. Scan the QR code to authenticate WhatsApp Web.');
  } catch (error) {
    console.error('Error starting integration:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('Shutting down...');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  console.error('Stack trace:', error.stack);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled promise rejection:', reason);
});

// Start the application
console.log('Starting application...');
main();

// Uruchom serwer HTTP
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
