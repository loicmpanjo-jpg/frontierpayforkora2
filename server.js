require('dotenv').config();

const express = require('express');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 4000;

// ═══════════════════════════════════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// ═══════════════════════════════════════════════════════════════════════════
// KORA SERVICE
// ═══════════════════════════════════════════════════════════════════════════

const koraClient = axios.create({
  baseURL: process.env.KORA_BASE_URL || 'https://api.korapay.com/merchant',
  headers: {
    'Authorization': `Bearer ${process.env.KORA_SECRET_KEY}`,
    'Content-Type': 'application/json'
  },
  timeout: 30000
});

// ═══════════════════════════════════════════════════════════════════════════
// VISA SERVICE (with mTLS support)
// ═══════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const https = require('https');

let visaClient = axios.create({
  baseURL: process.env.VISA_BASE_URL || 'https://sandbox.api.visa.com',
  headers: {
    'Content-Type': 'application/json',
    'ex-correlation-id': crypto.randomUUID()
  },
  timeout: 30000
});

// Add mTLS if certificates exist
if (process.env.VISA_CERT_PATH && process.env.VISA_KEY_PATH) {
  try {
    const cert = fs.readFileSync(process.env.VISA_CERT_PATH, 'utf8');
    const key = fs.readFileSync(process.env.VISA_KEY_PATH, 'utf8');
    const ca = process.env.VISA_CA_PATH ? fs.readFileSync(process.env.VISA_CA_PATH, 'utf8') : undefined;

    const agent = new https.Agent({
      cert: cert,
      key: key,
      ca: ca,
      rejectUnauthorized: true
    });

    visaClient.defaults.httpAgent = agent;
    visaClient.defaults.httpsAgent = agent;
  } catch (err) {
    console.warn('⚠️  mTLS certificates not found. Using standard HTTPS.');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// LOGGER
// ═══════════════════════════════════════════════════════════════════════════

const logger = {
  log: (msg) => console.log(`[${new Date().toISOString()}] ℹ️  ${msg}`),
  success: (msg) => console.log(`[${new Date().toISOString()}] ✅ ${msg}`),
  error: (msg) => console.error(`[${new Date().toISOString()}] ❌ ${msg}`),
  warn: (msg) => console.warn(`[${new Date().toISOString()}] ⚠️  ${msg}`)
};

// ═══════════════════════════════════════════════════════════════════════════
// KORA ROUTES
// ═══════════════════════════════════════════════════════════════════════════

app.post('/api/kora/test-connection', async (req, res) => {
  try {
    logger.log('Testing Kora connection...');
    const response = await koraClient.get('/');
    logger.success('Kora connection successful');
    res.json({ status: 'connected', provider: 'kora', timestamp: new Date() });
  } catch (err) {
    logger.error(`Kora connection failed: ${err.message}`);
    res.status(500).json({ error: 'Kora connection failed', details: err.message });
  }
});

app.post('/api/kora/transfer', async (req, res) => {
  try {
    const { amount, currency, bank, account, name, narration } = req.body;

    if (!amount || !currency || !bank || !account || !name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const payload = {
      reference: `FP-${Date.now()}`,
      destination: {
        type: 'bank_account',
        amount: amount,
        currency: currency,
        narration: narration || 'FrontierPay Transfer',
        bank_account: {
          bank: bank,
          account: account
        },
        customer: {
          name: name
        }
      }
    };

    logger.log(`Initiating Kora transfer: ${payload.reference}`);
    const response = await koraClient.post('/api/v1/transactions/disburse', payload);

    logger.success(`Transfer initiated: ${payload.reference}`);
    res.json({ status: 'success', reference: payload.reference, data: response.data });
  } catch (err) {
    logger.error(`Transfer failed: ${err.message}`);
    res.status(500).json({ error: 'Transfer failed', details: err.message });
  }
});

app.post('/api/kora/callback', (req, res) => {
  const ts = new Date().toISOString();
  const payload = req.body;

  logger.log(`Kora callback received: ${JSON.stringify(payload)}`);

  // Verify HMAC signature
  if (req.headers['x-signature'] && process.env.KORA_WEBHOOK_SECRET) {
    const expected = crypto
      .createHmac('sha256', process.env.KORA_WEBHOOK_SECRET)
      .update(JSON.stringify(payload))
      .digest('hex');

    if (req.headers['x-signature'] !== expected) {
      logger.error('Invalid Kora signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }
    logger.success('Kora signature verified');
  }

  const { eventType, transactionId, status } = payload;
  
  switch (eventType) {
    case 'disburse.success':
      logger.success(`Kora disbursement successful: ${transactionId}`);
      break;
    case 'disburse.failed':
      logger.error(`Kora disbursement failed: ${transactionId}`);
      break;
    default:
      logger.log(`Kora event: ${eventType}`);
  }

  res.json({ received: true, ts });
});

// ═══════════════════════════════════════════════════════════════════════════
// VISA ROUTES
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/visa/callback', (req, res) => {
  logger.log('Visa callback validation request received');
  res.status(200).send('OK');
});

app.post('/api/visa/test-connection', async (req, res) => {
  try {
    logger.log('Testing Visa TLS connection...');
    const response = await visaClient.post('/visadirect/fundstransfer/v1/pushfundstransactions', {
      systemsTraceAuditNumber: Math.floor(Math.random() * 1000000),
      retrievalReferenceNumber: `TEST${Date.now()}`,
      transactionIdentifier: `TEST${Date.now()}`,
      messageTypeIdentifier: '1200'
    });
    logger.success('Visa connection successful (mTLS)');
    res.json({ status: 'connected', provider: 'visa', method: 'mTLS', timestamp: new Date() });
  } catch (err) {
    logger.error(`Visa connection failed: ${err.message}`);
    res.status(500).json({ error: 'Visa connection failed', details: err.message });
  }
});

app.post('/api/visa/push-funds', async (req, res) => {
  try {
    const { amount, cardNumber, expiryDate, cvv, recipientName, amount_currency } = req.body;

    if (!amount || !cardNumber || !expiryDate || !cvv || !recipientName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const payload = {
      systemsTraceAuditNumber: Math.floor(Math.random() * 1000000),
      retrievalReferenceNumber: `FP-${Date.now()}`,
      localTransactionDateTime: new Date().toISOString(),
      amount: amount,
      currencyCode: amount_currency || '840', // USD
      cardAcceptor: {
        idCode: process.env.VISA_MERCHANT_ID || 'FRONTIERPAYME',
        terminalId: 'TERM001',
        name: 'FrontierPay Treasury'
      },
      messageTypeIdentifier: '1200',
      senderPrimaryAccountNumber: process.env.VISA_SENDER_ACCOUNT || '4111111111111111',
      receiverPrimaryAccountNumber: cardNumber,
      receiverName: recipientName,
      transactionCurrencyCode: '840',
      transactionIdentifier: `FPVD${Date.now()}`
    };

    logger.log(`Initiating Visa push funds: ${payload.retrievalReferenceNumber}`);
    const response = await visaClient.post('/visadirect/fundstransfer/v1/pushfundstransactions', payload);

    logger.success(`Visa push initiated: ${payload.retrievalReferenceNumber}`);
    res.json({ status: 'success', reference: payload.retrievalReferenceNumber, data: response.data });
  } catch (err) {
    logger.error(`Visa push failed: ${err.message}`);
    res.status(500).json({ error: 'Visa push failed', details: err.message });
  }
});

app.post('/api/visa/callback', (req, res) => {
  const ts = new Date().toISOString();
  const payload = req.body;

  logger.log(`Visa callback received: ${JSON.stringify(payload)}`);

  // Verify HMAC signature
  if (req.headers['x-visa-signature'] && process.env.VISA_WEBHOOK_SECRET) {
    const expected = crypto
      .createHmac('sha256', process.env.VISA_WEBHOOK_SECRET)
      .update(JSON.stringify(payload))
      .digest('hex');

    if (req.headers['x-visa-signature'] !== expected) {
      logger.error('Invalid Visa signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }
    logger.success('Visa signature verified');
  }

  const { eventType, transactionId, status } = payload;

  switch (eventType) {
    case 'PUSH_FUNDS_COMPLETED':
      logger.success(`Visa push completed: ${transactionId}`);
      break;
    case 'PUSH_FUNDS_FAILED':
      logger.error(`Visa push failed: ${transactionId}`);
      break;
    case 'SETTLEMENT_COMPLETED':
      logger.success(`Visa settlement completed: ${transactionId}`);
      break;
    default:
      logger.log(`Visa event: ${eventType}`);
  }

  res.json({ received: true, ts });
});

// ═══════════════════════════════════════════════════════════════════════════
// HEALTH CHECK
// ═══════════════════════════════════════════════════════════════════════════

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'FrontierPay Treasury',
    providers: ['Kora', 'Visa'],
    timestamp: new Date(),
    uptime: process.uptime()
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FALLBACK - SERVE FRONTEND
// ═══════════════════════════════════════════════════════════════════════════

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ═══════════════════════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════════════════════

app.listen(PORT, () => {
  logger.success(`FrontierPay Treasury running on http://localhost:${PORT}`);
  logger.log(`📡 Kora Webhook → http://localhost:${PORT}/api/kora/callback`);
  logger.log(`📡 Visa Webhook → http://localhost:${PORT}/api/visa/callback`);
});
