# WhatsApp to Google Chat Integration

This application automatically forwards food delivery information from a WhatsApp group to a Google Chat channel.

## Prerequisites

- Node.js (v14 or higher)
- npm
- A Google Cloud Platform account with the Google Chat API enabled
- A service account with permissions to post to Google Chat

## Setup

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a service account in Google Cloud Platform and download the credentials JSON file
4. Place the credentials file in the project directory (or specify its location in the .env file)
5. Configure the .env file with your WhatsApp group name and Google Chat space ID

## Configuration

Edit the `.env` file to configure the application:

```
# WhatsApp Configuration
WHATSAPP_GROUP_NAME="Food Delivery Channel"

# Google Chat Configuration
GOOGLE_APPLICATION_CREDENTIALS="./credentials.json"
GOOGLE_CHAT_SPACE="spaces/YOUR_SPACE_ID"

# Application Configuration
MESSAGE_CHECK_INTERVAL=60000  # Check for new messages every 60 seconds
```

## Running the Application

Start the application with:

```
npm start
```

The first time you run the application, you'll need to scan a QR code to authenticate with WhatsApp Web. After scanning, the application will start monitoring the specified WhatsApp group for food delivery messages and forward them to Google Chat.

## How It Works

1. The application connects to WhatsApp Web using the whatsapp-web.js library
2. It monitors messages in the specified WhatsApp group
3. When a message containing food delivery information is detected, it's formatted and sent to Google Chat
4. The application keeps track of processed messages to avoid duplicates

## Customizing Message Detection

You can customize how the application detects food delivery messages by modifying the `isFoodDeliveryMessage` function in `message-processor.js`. By default, it looks for keywords related to food delivery.

## Troubleshooting

- If you're having trouble connecting to WhatsApp, try deleting the `.wwebjs_auth` directory and restarting the application
- Make sure your Google service account has the necessary permissions to post to the Google Chat space
- Check the console output for error messages
