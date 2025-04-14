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
      this.qrCode = qr;
      this.status = 'connecting';
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
      this._findTargetGroup();
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
}

module.exports = new WhatsAppClient();
