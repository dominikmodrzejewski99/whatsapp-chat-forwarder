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

    // Check if credentials.json exists
    const credentialsPath = path.resolve('./credentials.json');
    console.log('Checking for credentials.json at:', credentialsPath);

    if (fs.existsSync(credentialsPath)) {
      console.log('credentials.json found');
      try {
        const stats = fs.statSync(credentialsPath);
        console.log('File size:', stats.size, 'bytes');
        console.log('File permissions:', stats.mode.toString(8));

        // Try to read the file to make sure it's accessible
        const fileContent = fs.readFileSync(credentialsPath, 'utf8');
        console.log('File is readable. First 100 characters:', fileContent.substring(0, 100) + '...');
      } catch (fileError) {
        console.error('Error reading credentials.json:', fileError);
      }
    } else {
      console.error('credentials.json not found!');
      console.log('Available files in current directory:');
      fs.readdirSync('./').forEach(file => {
        console.log('- ' + file);
      });
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
