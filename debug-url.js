const { google } = require('googleapis');
const config = require('./config');

async function debugUrl() {
  try {
    console.log('Config values:');
    console.log('GOOGLE_CHAT_SPACE:', config.googleChat.space);
    
    // Create authentication client using service account credentials
    const auth = new google.auth.GoogleAuth({
      keyFile: config.googleChat.credentialsPath,
      scopes: ['https://www.googleapis.com/auth/chat.bot'],
    });
    
    // Create Google Chat API client
    const chat = google.chat({
      version: 'v1',
      auth: auth,
    });
    
    // Log the URL that would be used
    const parent = config.googleChat.space;
    console.log('Parent value:', parent);
    
    // Construct the URL manually
    const baseUrl = 'https://chat.googleapis.com/v1/';
    const endpoint = `${parent}/messages`;
    console.log('Constructed URL:', baseUrl + endpoint);
    
    // Try to get spaces to see if authentication works
    console.log('Trying to list spaces...');
    try {
      const spaces = await chat.spaces.list();
      console.log('Spaces:', spaces.data);
    } catch (spacesError) {
      console.error('Error listing spaces:', spacesError);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

debugUrl();
