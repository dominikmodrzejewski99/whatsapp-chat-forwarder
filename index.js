const whatsappClient = require('./whatsapp-client');
const googleChatClient = require('./google-chat-client');
const messageProcessor = require('./message-processor');
const fs = require('fs');
const path = require('path');
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const qrcode = require('qrcode');

// Utworzenie aplikacji Express
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Udostępnij obiekt io globalnie, aby był dostępny w innych modułach
global.io = io;

// Konfiguracja middleware
app.use(express.static('public'));
app.use(express.json());

// Nasłuchiwanie na porcie określonym przez Cloud Run lub domyślnie 8080
const PORT = process.env.PORT || 8080;

// Tablica do przechowywania logów
const logs = [];
const MAX_LOGS = 1000; // Maksymalna liczba logów do przechowywania

// Flaga zapobiegająca rekurencji
let isLogging = false;

// Funkcja do bezpiecznej serializacji obiektów (unikanie cykli)
function safeStringify(obj) {
    const seen = new WeakSet();
    return JSON.stringify(obj, (key, value) => {
        if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) {
                return '[Circular Reference]';
            }
            seen.add(value);
        }
        return value;
    });
}

// Funkcja do dodawania logów
function addLog(level, message) {
    // Zapobiegaj rekurencji
    if (isLogging) return;
    isLogging = true;

    try {
        // Konwertuj obiekty na stringi, aby uniknąć problemów z cyklicznymi referencjami
        let messageStr;
        if (typeof message === 'object' && message !== null) {
            try {
                messageStr = safeStringify(message);
            } catch (e) {
                messageStr = String(message);
            }
        } else {
            messageStr = String(message);
        }

        const logEntry = {
            timestamp: Date.now(),
            level,
            message: messageStr
        };

        logs.push(logEntry);

        // Ogranicz liczbę przechowywanych logów
        if (logs.length > MAX_LOGS) {
            logs.shift(); // Usuń najstarszy log
        }

        // Wyślij log do wszystkich połączonych klientów
        io.emit('log', logEntry);
    } catch (error) {
        // Użyj oryginalnych funkcji console, aby uniknąć rekurencji
        originalConsoleError('Error in addLog:', error);
    } finally {
        isLogging = false;
    }
}

// Nadpisanie standardowych funkcji console
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleInfo = console.info;

console.log = function() {
    if (isLogging) {
        return originalConsoleLog.apply(console, arguments);
    }
    try {
        const message = Array.from(arguments).map(arg =>
            typeof arg === 'object' && arg !== null ? safeStringify(arg) : String(arg)
        ).join(' ');
        addLog('INFO', message);
    } catch (e) {
        originalConsoleError('Error in console.log override:', e);
    }
    return originalConsoleLog.apply(console, arguments);
};

console.error = function() {
    if (isLogging) {
        return originalConsoleError.apply(console, arguments);
    }
    try {
        const message = Array.from(arguments).map(arg =>
            typeof arg === 'object' && arg !== null ? safeStringify(arg) : String(arg)
        ).join(' ');
        addLog('ERROR', message);
    } catch (e) {
        originalConsoleError('Error in console.error override:', e);
    }
    return originalConsoleError.apply(console, arguments);
};

console.warn = function() {
    if (isLogging) {
        return originalConsoleWarn.apply(console, arguments);
    }
    try {
        const message = Array.from(arguments).map(arg =>
            typeof arg === 'object' && arg !== null ? safeStringify(arg) : String(arg)
        ).join(' ');
        addLog('WARNING', message);
    } catch (e) {
        originalConsoleError('Error in console.warn override:', e);
    }
    return originalConsoleWarn.apply(console, arguments);
};

console.info = function() {
    if (isLogging) {
        return originalConsoleInfo.apply(console, arguments);
    }
    try {
        const message = Array.from(arguments).map(arg =>
            typeof arg === 'object' && arg !== null ? safeStringify(arg) : String(arg)
        ).join(' ');
        addLog('INFO', message);
    } catch (e) {
        originalConsoleError('Error in console.info override:', e);
    }
    return originalConsoleInfo.apply(console, arguments);
};

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

// Konfiguracja endpointów API
app.get('/api/logs', (req, res) => {
  res.json(logs);
});

app.get('/api/status', (req, res) => {
  res.json({
    whatsapp: whatsappClient.getStatus(),
    googleChat: googleChatClient.isConfigured() ? 'configured' : 'not_configured'
  });
});

// Obsługa połączeń Socket.IO
io.on('connection', (socket) => {
  console.log('New client connected');

  // Wyślij aktualne logi do nowego klienta
  logs.forEach(log => {
    socket.emit('log', log);
  });

  // Wyślij aktualny status WhatsApp
  socket.emit('whatsapp-status', whatsappClient.getStatus());

  // Jeśli jest dostępny kod QR, wyślij go
  const qrCode = whatsappClient.getQRCode();
  console.log('QR Code available:', qrCode ? 'Yes' : 'No');

  if (qrCode) {
    console.log('Converting QR code to data URL...');
    qrcode.toDataURL(qrCode, (err, url) => {
      if (!err) {
        console.log('QR code converted successfully, sending to client');
        socket.emit('qr-code', url);
      } else {
        console.error('Error converting QR code to data URL:', err);
      }
    });
  } else {
    console.log('No QR code available to send');
  }

  // Obsługa żądania nowego kodu QR
  socket.on('request-qr', () => {
    console.log('Client requested new QR code');
    try {
      // Zresetuj sesję WhatsApp i wygeneruj nowy kod QR
      whatsappClient.resetSession()
        .then(() => {
          console.log('WhatsApp session reset successfully');
        })
        .catch(err => {
          console.error('Error resetting WhatsApp session:', err);
        });
    } catch (error) {
      console.error('Error handling request-qr event:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Start the application
console.log('Starting application...');
main();

// Uruchom serwer HTTP
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Web interface available at http://localhost:${PORT}`);
});
