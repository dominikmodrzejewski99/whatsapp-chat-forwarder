# WhatsApp to Google Chat Integration

This application automatically forwards food delivery information from a WhatsApp group to a Google Chat channel.

## Prerequisites

- Node.js (v14 or higher)
- npm
- Google Chat webhook URL

## Setup

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Configure the .env file with your WhatsApp group name and Google Chat webhook URL

## Configuration

Edit the `.env` file to configure the application:

```
# WhatsApp Configuration
WHATSAPP_GROUP_NAME="Food Delivery Channel"

# Google Chat Configuration
GOOGLE_CHAT_WEBHOOK_URL="https://chat.googleapis.com/v1/spaces/YOUR_SPACE_ID/messages?key=YOUR_KEY&token=YOUR_TOKEN"

# Google Credentials (as a JSON string)
GOOGLE_CREDENTIALS='{"type":"service_account","project_id":"your-project","private_key_id":"key-id","private_key":"-----BEGIN PRIVATE KEY-----\nkey-content\n-----END PRIVATE KEY-----\n","client_email":"service-account@project.iam.gserviceaccount.com","client_id":"client-id","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/service-account%40project.iam.gserviceaccount.com"}'

# Application Configuration
MESSAGE_CHECK_INTERVAL=60000  # Check for new messages every 60 seconds

# Port Configuration (for Cloud Run)
PORT=8080
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

## Deployment on Google Cloud Run

1. Build the Docker image:
   ```
   docker build -t gcr.io/[PROJECT_ID]/whatsapp-gchat-integration .
   ```

2. Push the image to Container Registry:
   ```
   docker push gcr.io/[PROJECT_ID]/whatsapp-gchat-integration
   ```

3. Deploy to Cloud Run:
   ```
   gcloud run deploy whatsapp-gchat-integration \
     --image gcr.io/[PROJECT_ID]/whatsapp-gchat-integration \
     --platform managed \
     --region europe-west1 \
     --allow-unauthenticated \
     --memory 512Mi \
     --timeout 300s \
     --cpu 1 \
     --set-env-vars WHATSAPP_GROUP_NAME="Your Group Name",GOOGLE_CHAT_WEBHOOK_URL="https://chat.googleapis.com/v1/spaces/YOUR_SPACE_ID/messages?key=YOUR_KEY&token=YOUR_TOKEN"
   ```

## Troubleshooting

- If you're having trouble connecting to WhatsApp, try deleting the `.wwebjs_auth` directory and restarting the application
- Make sure your Google Chat webhook URL is correct
- Check the console output for error messages
