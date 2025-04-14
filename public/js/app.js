document.addEventListener('DOMContentLoaded', () => {
    // Elementy DOM
    const statusText = document.getElementById('status-text');
    const statusLight = document.getElementById('status-light');
    const qrPlaceholder = document.getElementById('qr-placeholder');
    const qrCode = document.getElementById('qr-code');
    const logsContainer = document.getElementById('logs');
    const clearLogsBtn = document.getElementById('clear-logs');
    const autoScrollBtn = document.getElementById('auto-scroll');
    
    let autoScroll = true;
    
    // Połączenie z serwerem przez Socket.IO
    const socket = io();
    
    // Obsługa zdarzeń Socket.IO
    socket.on('connect', () => {
        updateStatus('Połączono z serwerem', 'connecting');
        console.log('Połączono z serwerem Socket.IO');
    });
    
    socket.on('disconnect', () => {
        updateStatus('Rozłączono z serwerem', 'disconnected');
        console.log('Rozłączono z serwerem Socket.IO');
    });
    
    socket.on('whatsapp-status', (status) => {
        if (status === 'connected') {
            updateStatus('WhatsApp połączony', 'connected');
            hideQRCode();
        } else if (status === 'disconnected') {
            updateStatus('WhatsApp rozłączony', 'disconnected');
        } else if (status === 'connecting') {
            updateStatus('Łączenie z WhatsApp...', 'connecting');
        }
    });
    
    socket.on('qr-code', (qrData) => {
        displayQRCode(qrData);
        updateStatus('Zeskanuj kod QR', 'connecting');
    });
    
    socket.on('log', (logData) => {
        addLogEntry(logData);
    });
    
    // Funkcje pomocnicze
    function updateStatus(message, state) {
        statusText.textContent = message;
        statusLight.className = 'status-light ' + state;
    }
    
    function displayQRCode(qrData) {
        qrPlaceholder.style.display = 'none';
        qrCode.style.display = 'block';
        qrCode.innerHTML = '';
        
        const img = document.createElement('img');
        img.src = qrData;
        qrCode.appendChild(img);
    }
    
    function hideQRCode() {
        qrCode.style.display = 'none';
        qrPlaceholder.textContent = 'WhatsApp połączony';
        qrPlaceholder.style.display = 'block';
    }
    
    function addLogEntry(logData) {
        const { timestamp, level, message } = logData;
        
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';
        
        const timestampSpan = document.createElement('span');
        timestampSpan.className = 'log-timestamp';
        timestampSpan.textContent = formatTimestamp(timestamp);
        
        const levelSpan = document.createElement('span');
        levelSpan.className = `log-level-${level.toLowerCase()}`;
        levelSpan.textContent = `[${level.toUpperCase()}] `;
        
        const messageSpan = document.createElement('span');
        messageSpan.textContent = message;
        
        logEntry.appendChild(timestampSpan);
        logEntry.appendChild(levelSpan);
        logEntry.appendChild(messageSpan);
        
        logsContainer.appendChild(logEntry);
        
        if (autoScroll) {
            scrollToBottom();
        }
    }
    
    function formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('pl-PL', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit',
            hour12: false
        });
    }
    
    function scrollToBottom() {
        const logsContainerElement = document.getElementById('logs-container');
        logsContainerElement.scrollTop = logsContainerElement.scrollHeight;
    }
    
    // Event listeners
    clearLogsBtn.addEventListener('click', () => {
        logsContainer.innerHTML = '';
    });
    
    autoScrollBtn.addEventListener('click', () => {
        autoScroll = !autoScroll;
        autoScrollBtn.classList.toggle('active');
        
        if (autoScroll) {
            scrollToBottom();
        }
    });
    
    // Inicjalizacja
    updateStatus('Oczekiwanie na połączenie...', 'disconnected');
});
