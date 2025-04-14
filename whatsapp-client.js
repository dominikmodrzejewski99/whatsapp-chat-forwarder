const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const config = require('./config');

class WhatsAppClient {
  constructor() {
    console.log('Initializing WhatsApp client...');
    console.log(`Target group name: "${config.whatsapp.groupName}"`);

    console.log('Creating WhatsApp client with options...');
    this.client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        headless: 'new', // Use 'new' instead of true
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ],
        timeout: 60000, // Increase timeout to 60 seconds
      },
      clientId: 'whatsapp-gchat-integration',
      webVersionCache: {
        type: 'none', // Disable web version cache
      },
      restartOnAuthFail: true,
    });
    console.log('WhatsApp client created');

    this.targetGroupName = config.whatsapp.groupName;
    this.targetGroup = null;
    this.messageHandlers = [];

    // Add a Set to track processed message IDs and prevent duplicates
    this.processedMessageIds = new Set();

    // Przechowywanie najnowszego kodu QR
    this.currentQR = null;
    this.lastQRTimestamp = 0;

    // Status i kod QR
    this.status = 'disconnected';
    this.qrCode = null;

    this._setupEventHandlers();
    console.log('WhatsApp client initialized');
  }

  _setupEventHandlers() {
    console.log('Setting up WhatsApp event handlers...');

    this.client.on('qr', (qr) => {
      // Generate and display QR code for WhatsApp Web authentication
      console.log('Received QR code. Scan the QR code below to log in to WhatsApp Web:');
      qrcode.generate(qr, { small: true });

      // Zapisz kod QR do późniejszego użycia
      console.log('Saving QR code for later use. QR code length:', qr.length);
      this.qrCode = qr;
      this.currentQR = qr;
      this.lastQRTimestamp = Date.now();
      console.log(`QR code timestamp: ${new Date(this.lastQRTimestamp).toISOString()}`);
      this.status = 'connecting';

      // Emituj zdarzenie do wszystkich klientów
      if (global.io) {
        console.log('Emitting QR code to all connected clients');
        global.io.emit('whatsapp-status', 'connecting');

        // Konwertuj kod QR na URL danych i wyślij
        const qrcode = require('qrcode');
        qrcode.toDataURL(qr, (err, url) => {
          if (!err) {
            console.log('QR code converted to data URL, emitting to clients');
            global.io.emit('qr-code', url);
          } else {
            console.error('Error converting QR code to data URL:', err);
          }
        });
      } else {
        console.log('Socket.IO not available, cannot emit QR code');
      }
    });

    this.client.on('loading_screen', (percent, message) => {
      console.log('LOADING SCREEN', percent, message);
      this.status = 'connecting';
    });

    this.client.on('authenticated', () => {
      console.log('WhatsApp client authenticated');
      this.status = 'authenticated';
    });

    this.client.on('auth_failure', (msg) => {
      console.error('WhatsApp authentication failed:', msg);
      this.status = 'disconnected';
    });

    this.client.on('ready', () => {
      console.log('WhatsApp client is ready!');
      this.status = 'connected';
      this.qrCode = null; // Wyczyść kod QR po połączeniu
      this._findTargetGroup();

      // Powiadom klientów o połączeniu
      if (global.io) {
        console.log('Emitting connected status to all clients');
        global.io.emit('whatsapp-status', 'connected');
      }
    });

    // Funkcja do przetwarzania wiadomości - używana przez oba zdarzenia
    const processMessage = async (message, eventType) => {
      console.log(`[LISTENER] ${eventType} message: ${message.body} (from: ${message.from || 'unknown'}, to: ${message.to || 'unknown'})`);

      // Generuj unikalny identyfikator wiadomości
      const messageId = message.id ? message.id.id : `${message.from || ''}_${message.timestamp || Date.now()}_${message.body}`;

      // Sprawdź, czy wiadomość była już przetwarzana
      if (this.processedMessageIds.has(messageId)) {
        console.log(`[LISTENER] Message already processed (ID: ${messageId}), skipping`);
        return;
      }

      let shouldProcess = false;

      // Określ, czy wiadomość powinna być przetwarzana
      if (message.from === this.targetGroup) {
        console.log(`[LISTENER] Message from target group ${this.targetGroupName}: ${message.body}`);
        shouldProcess = true;
      } else if (message.fromMe && message.to === this.targetGroup) {
        console.log(`[LISTENER] Message sent by me to target group ${this.targetGroupName}: ${message.body}`);
        shouldProcess = true;
      } else {
        console.log(`[LISTENER] Message not from/to target group, ignoring.`);
      }

      // Przetwarzaj wiadomość, jeśli powinna być przetwarzana
      if (shouldProcess) {
        // Dodaj wiadomość do przetworzonych przed wywołaniem handlerów
        // aby zapobiec podwójnemu przetwarzaniu
        this.processedMessageIds.add(messageId);
        console.log(`[LISTENER] Message marked as processed (ID: ${messageId})`);

        // Wywołaj wszystkie zarejestrowane handlery wiadomości
        console.log(`[LISTENER] Calling ${this.messageHandlers.length} message handlers...`);
        for (const handler of this.messageHandlers) {
          await handler(message);
        }

        // Ogranicz rozmiar zbioru przetworzonych wiadomości
        if (this.processedMessageIds.size > 100) {
          console.log('[LISTENER] Clearing oldest processed message IDs (exceeded 100 messages)');
          const idsArray = Array.from(this.processedMessageIds);
          this.processedMessageIds = new Set(idsArray.slice(-50)); // Zachowaj 50 najnowszych
        }
      }
    };

    // Nasłuchuj tylko zdarzenia 'message' - ignoruj 'message_create'
    this.client.on('message', async (message) => {
      await processMessage(message, 'Received');
    });

    // Wyłączamy obsługę zdarzenia 'message_create' aby uniknąć duplikatów
    // Jeśli potrzebujesz obsługiwać wiadomości wysyłane przez bota, możesz odkomentować poniższy kod
    /*
    this.client.on('message_create', async (message) => {
      // Przetwarzaj tylko wiadomości wysyłane przez bota (fromMe === true)
      if (message.fromMe) {
        await processMessage(message, 'Created');
      }
    });
    */

    // Add more event listeners for debugging
    this.client.on('message_ack', (message, ack) => {
      console.log(`[LISTENER] Message acknowledgement: ${message.body} (ack: ${ack})`);
    });

    this.client.on('group_join', (notification) => {
      console.log(`[LISTENER] Someone joined a group: ${notification.chatId}`);
    });

    this.client.on('group_leave', (notification) => {
      console.log(`[LISTENER] Someone left a group: ${notification.chatId}`);
    });

    this.client.on('group_update', (notification) => {
      console.log(`[LISTENER] Group updated: ${notification.chatId}`);
    });

    this.client.on('change_state', state => {
      console.log(`[LISTENER] Client state changed to: ${state}`);
    });

    this.client.on('disconnected', (reason) => {
      console.log('[LISTENER] WhatsApp client was disconnected', reason);
      this.status = 'disconnected';

      // Powiadom klientów o rozłączeniu
      if (global.io) {
        console.log('Emitting disconnected status to all clients');
        global.io.emit('whatsapp-status', 'disconnected');
      }
    });

    console.log('WhatsApp event handlers set up');
  }

  async _findTargetGroup() {
    try {
      console.log('Finding target group...');
      const chats = await this.client.getChats();
      console.log(`Found ${chats.length} chats`);

      // Log all group chats for debugging
      const groupChats = chats.filter(chat => chat.isGroup);
      console.log(`Found ${groupChats.length} group chats:`);
      groupChats.forEach(chat => {
        console.log(`- Group: "${chat.name}" (ID: ${chat.id._serialized})`);
      });

      const targetChat = chats.find(
        chat => chat.isGroup && chat.name === this.targetGroupName
      );

      if (targetChat) {
        this.targetGroup = targetChat.id._serialized;
        console.log(`Found target group: ${this.targetGroupName} (ID: ${this.targetGroup})`);
        console.log('Now listening for messages in this group...');
      } else {
        console.error(`Target group "${this.targetGroupName}" not found!`);
        console.log('Available groups:');
        chats.filter(chat => chat.isGroup).forEach(chat => {
          console.log(`- ${chat.name}`);
        });
      }
    } catch (error) {
      console.error('Error finding target group:', error);
    }
  }

  async start() {
    console.log('Starting WhatsApp client...');
    try {
      console.log('Initializing WhatsApp client...');
      await this.client.initialize();
      console.log('WhatsApp client initialized successfully');
    } catch (error) {
      console.error('Error initializing WhatsApp client:', error);
      console.error('Stack trace:', error.stack);
    }
  }

  onMessage(handler) {
    console.log('Registering message handler');
    this.messageHandlers.push(handler);
    console.log(`Total message handlers: ${this.messageHandlers.length}`);
  }

  /**
   * Pobierz aktualny status połączenia WhatsApp
   * @returns {string} Status połączenia ('disconnected', 'connecting', 'authenticated', 'connected')
   */
  getStatus() {
    return this.status;
  }

  /**
   * Pobierz aktualny kod QR (jeśli dostępny)
   * @returns {string|null} Kod QR lub null jeśli nie jest dostępny
   */
  getQRCode() {
    return this.qrCode;
  }

  /**
   * Resetuje sesję WhatsApp, aby wygenerować nowy kod QR
   * @returns {Promise<void>}
   */
  async resetSession() {
    console.log('Resetting WhatsApp session to generate new QR code...');

    try {
      // Najpierw rozłącz obecną sesję
      if (this.client) {
        console.log('Logging out from current session...');
        try {
          await this.client.logout();
          console.log('Logged out successfully');
        } catch (logoutError) {
          console.log('Error during logout or already logged out:', logoutError.message);
          // Kontynuuj mimo błędu wylogowania
        }

        // Zatrzymaj klienta
        console.log('Destroying current client...');
        try {
          await this.client.destroy();
          console.log('Client destroyed successfully');
        } catch (destroyError) {
          console.log('Error destroying client:', destroyError.message);
          // Kontynuuj mimo błędu
        }
      }

      // Usuń dane sesji
      console.log('Resetting status and QR code...');
      this.status = 'disconnected';
      this.qrCode = null;
      this.targetGroup = null;

      // Powiadom klientów o zmianie statusu
      if (global.io) {
        global.io.emit('whatsapp-status', 'disconnected');
      }

      // Utwórz nowego klienta
      console.log('Creating new WhatsApp client...');
      this.client = new Client({
        authStrategy: new LocalAuth({ clientId: 'whatsapp-gchat-integration-' + Date.now() }),
        puppeteer: {
          headless: 'new',
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
          ],
          timeout: 60000,
        },
        webVersionCache: {
          type: 'none',
        },
        restartOnAuthFail: true,
      });

      // Skonfiguruj obsługę zdarzeń
      this._setupEventHandlers();

      // Zainicjuj nowego klienta
      console.log('Initializing new WhatsApp client...');
      await this.client.initialize();
      console.log('New WhatsApp client initialized successfully');

      return true;
    } catch (error) {
      console.error('Error resetting WhatsApp session:', error);
      throw error;
    }
  }
}

module.exports = new WhatsAppClient();
