const whatsappClient = require('./whatsapp-client');
const googleChatClient = require('./google-chat-client');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

class MessageProcessor {
  constructor() {
    this.processedMessages = new Set();
    this.lastProcessedTimestamp = Date.now();
    this.messageQueue = [];
    this.processingInProgress = false;
    console.log('[PROCESSOR] MessageProcessor initialized');
    console.log('[PROCESSOR] Last processed timestamp:', new Date(this.lastProcessedTimestamp).toISOString());
  }

  initialize() {
    // Register message handler with WhatsApp client
    console.log('[PROCESSOR] Registering message handler with WhatsApp client');
    whatsappClient.onMessage(this.queueMessage.bind(this));
    console.log('[PROCESSOR] Message handler registered with WhatsApp client');

    // Set up periodic logging of processed messages
    setInterval(() => {
      console.log('[PROCESSOR] Processed messages count:', this.processedMessages.size);
      console.log('[PROCESSOR] Message queue length:', this.messageQueue.length);
      console.log('[PROCESSOR] Last processed timestamp:', new Date(this.lastProcessedTimestamp).toISOString());
    }, 60000); // Log every minute

    // Start the message processing loop
    this.processMessageQueue();
  }

  /**
   * Queue a message for processing
   * @param {Object} message - WhatsApp message object
   */
  async queueMessage(message) {
    console.log(`[PROCESSOR] Queueing message: "${message.body}" from ${message.from || 'unknown'}`);

    // Generate a unique ID for the message
    const messageId = message.id ? message.id.id : `${message.from || ''}_${message.timestamp || Date.now()}_${message.body}`;

    // Skip if we've already processed this message or it's already in the queue
    if (this.processedMessages.has(messageId)) {
      console.log(`[PROCESSOR] Message already processed (ID: ${messageId}), skipping`);
      return;
    }

    // Check if message is already in the queue
    const isInQueue = this.messageQueue.some(queuedMsg => {
      const queuedId = queuedMsg.id ? queuedMsg.id.id : `${queuedMsg.from || ''}_${queuedMsg.timestamp || Date.now()}_${queuedMsg.body}`;
      return queuedId === messageId;
    });

    if (isInQueue) {
      console.log(`[PROCESSOR] Message already in queue (ID: ${messageId}), skipping`);
      return;
    }

    // Add to queue
    this.messageQueue.push(message);
    console.log(`[PROCESSOR] Message added to queue (ID: ${messageId}), queue length: ${this.messageQueue.length}`);
  }

  /**
   * Process the message queue sequentially
   */
  async processMessageQueue() {
    console.log('[PROCESSOR] Starting message queue processor');

    // Uruchom przetwarzanie kolejki w tle, aby nie blokować inicjalizacji
    setImmediate(async () => {
      console.log('[PROCESSOR] Message queue processor running in background');

      // Funkcja do przetwarzania kolejnej wiadomości
      const processNext = async () => {
        try {
          // Sprawdź, czy są wiadomości do przetworzenia
          if (this.messageQueue.length > 0 && !this.processingInProgress) {
            this.processingInProgress = true;

            // Pobierz następną wiadomość
            const message = this.messageQueue.shift();
            console.log(`[PROCESSOR] Processing message from queue: "${message.body}", remaining: ${this.messageQueue.length}`);

            await this.handleWhatsAppMessage(message);
          }
        } catch (error) {
          console.error('[PROCESSOR] Error in message queue processor:', error);
        } finally {
          this.processingInProgress = false;
        }

        // Zaplanuj następne sprawdzenie kolejki
        setTimeout(processNext, 100);
      };

      // Rozpocznij przetwarzanie
      processNext();
    });
  }

  /**
   * Process a message from WhatsApp and forward it to Google Chat
   * @param {Object} message - WhatsApp message object
   */
  async handleWhatsAppMessage(message) {
    console.log(`[PROCESSOR] Processing message: "${message.body}" from ${message.from || 'unknown'}`);

    try {
      // Log message object properties
      console.log('[PROCESSOR] Message properties:');
      console.log('[PROCESSOR] - id:', message.id ? JSON.stringify(message.id) : 'undefined');
      console.log('[PROCESSOR] - from:', message.from);
      console.log('[PROCESSOR] - to:', message.to);
      console.log('[PROCESSOR] - body:', message.body);
      console.log('[PROCESSOR] - timestamp:', message.timestamp);
      console.log('[PROCESSOR] - fromMe:', message.fromMe);
      console.log('[PROCESSOR] - hasMedia:', message.hasMedia);

      // Generate a unique ID for the message
      const messageId = message.id ? message.id.id : `${message.from || ''}_${message.timestamp || Date.now()}_${message.body}`;
      console.log(`[PROCESSOR] Generated message ID: ${messageId}`);

      // Double-check if we've already processed this message (belt and suspenders)
      if (this.processedMessages.has(messageId)) {
        console.log(`[PROCESSOR] Message already processed (ID: ${messageId}), skipping`);
        return;
      }

      // Skip messages older than our last processed timestamp
      if (message.timestamp && message.timestamp * 1000 < this.lastProcessedTimestamp) {
        console.log(`[PROCESSOR] Message is older than last processed timestamp (${new Date(this.lastProcessedTimestamp).toISOString()}), skipping`);
        return;
      }

      // Mark this message as processed BEFORE processing it
      // This prevents race conditions where the same message could be processed twice
      this.processedMessages.add(messageId);
      console.log(`[PROCESSOR] Message marked as processed (ID: ${messageId})`);

      // Process all messages (no filtering)
      console.log('[PROCESSOR] Processing message...');

      let formattedMessage = '';

      // Check if message has media
      if (message.hasMedia) {
        console.log('[PROCESSOR] Message has media, adding media info...');
        try {
          const media = await message.downloadMedia();
          console.log('[PROCESSOR] Media downloaded:', media.mimetype);

          // Format message with media info
          formattedMessage = this.formatMessageWithMediaInfo(message.body, message.from, media.mimetype);
        } catch (mediaError) {
          console.error('[PROCESSOR] Error downloading media:', mediaError);
          // If media download fails, just format the text
          formattedMessage = this.formatMessageForGoogleChat(message.body, message.from);
        }
      } else {
        // Format message without media
        formattedMessage = this.formatMessageForGoogleChat(message.body, message.from);
      }

      console.log(`[PROCESSOR] Formatted message for Google Chat: "${formattedMessage}"`);

      // Send the message to Google Chat
      console.log('[PROCESSOR] Sending message to Google Chat...');
      try {
        await googleChatClient.sendMessage(formattedMessage);
        console.log('[PROCESSOR] Message sent to Google Chat successfully');
      } catch (sendError) {
        console.error('[PROCESSOR] Error sending message to Google Chat:', sendError);
        if (sendError.response) {
          console.error('[PROCESSOR] Response data:', sendError.response.data);
          console.error('[PROCESSOR] Response status:', sendError.response.status);
        }
        // Even if sending fails, we don't remove from processedMessages
        // to prevent duplicate attempts
      }

      this.lastProcessedTimestamp = Date.now();
      console.log('[PROCESSOR] Last processed timestamp updated to:', new Date(this.lastProcessedTimestamp).toISOString());

      // Limit the size of the processed messages set
      if (this.processedMessages.size > 100) {
        console.log('[PROCESSOR] Clearing oldest processed messages (exceeded 100 messages)');
        // Convert to array, remove oldest entries, convert back to Set
        const messagesArray = Array.from(this.processedMessages);
        this.processedMessages = new Set(messagesArray.slice(-50)); // Keep the 50 most recent
      }
    } catch (error) {
      console.error('[PROCESSOR] Error processing message:', error);
      console.error('[PROCESSOR] Stack trace:', error.stack);
    }
  }

  /**
   * Format a WhatsApp message for Google Chat
   * @param {string} messageText - The original message text
   * @param {string} sender - The sender of the message
   * @returns {string} - Formatted message for Google Chat
   */
  formatMessageForGoogleChat(messageText, sender) {
    // Use the requested template
    return `🐻 Głodny Niedźwiedź pisze: ${messageText}`;
  }

  /**
   * Format a WhatsApp message with media info for Google Chat
   * @param {string} messageText - The original message text
   * @param {string} sender - The sender of the message
   * @param {string} mimeType - The MIME type of the media
   * @returns {string} - Formatted message for Google Chat
   */
  formatMessageWithMediaInfo(messageText, sender, mimeType) {
    // Create a message with the requested template and media info
    let formattedMessage = `🐻 Głodny Niedźwiedź pisze: ${messageText}`;

    // Add media type info
    if (mimeType.startsWith('image/')) {
      formattedMessage += `\n\n[Załącznik: Zdjęcie]`;
    } else if (mimeType.startsWith('video/')) {
      formattedMessage += `\n\n[Załącznik: Film]`;
    } else if (mimeType.startsWith('audio/')) {
      formattedMessage += `\n\n[Załącznik: Audio]`;
    } else {
      formattedMessage += `\n\n[Załącznik: ${mimeType}]`;
    }

    return formattedMessage;
  }
}

module.exports = new MessageProcessor();
