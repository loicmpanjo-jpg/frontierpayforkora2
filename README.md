# FrontierPay Treasury Layer

**Unified payment routing and orchestration for Kora (Africa) and Visa Direct (Global)**

---

## 🎯 Overview

FrontierPay Treasury is a unified payment routing engine that integrates:
- **Kora** - Bank transfers, collections, and disbursements (Africa-focused)
- **Visa Direct** - Push-to-card transfers with global reach

This repository contains the complete backend and frontend implementation with security best practices.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 14+ and npm
- Kora API credentials
- Visa API credentials and mTLS certificates

### Installation

```bash
# Clone the repository
git clone https://github.com/loicmpanjo-jpg/frontierpayforkora2.git
cd frontierpayforkora2

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your API credentials
```

### Run Server

```bash
# Development
npm run dev

# Production
npm start
```

The server will start on `http://localhost:4000`

---

## 🔌 API Endpoints

### Health Check
```
GET /health
```
Returns service status and uptime.

### Kora Integration

#### Test Connection
```
POST /api/kora/test-connection
```
Validates Kora API connectivity.

#### Initiate Transfer
```
POST /api/kora/transfer
Body: {
  "amount": 1000,
  "currency": "NGN",
  "bank": "044",
  "account": "0000000000",
  "name": "Recipient Name",
  "narration": "Transfer description"
}
```

#### Webhook Callback
```
POST /api/kora/callback
```
Receives and processes Kora webhook events.

### Visa Integration

#### Test mTLS Connection
```
POST /api/visa/test-connection
```
Validates Visa API connectivity with mTLS.

#### Push Funds to Card
```
POST /api/visa/push-funds
Body: {
  "amount": 5000,
  "cardNumber": "4111111111111111",
  "expiryDate": "1225",
  "cvv": "123",
  "recipientName": "Recipient Name",
  "amount_currency": "840"
}
```

#### Webhook Callback
```
POST /api/visa/callback
```
Receives and processes Visa webhook events.

---

## 🔒 Security Features

### ✅ Implemented Protections

1. **XSS Prevention**
   - Safe DOM methods (textContent instead of innerHTML)
   - Content Security Policy headers
   - Input validation

2. **Webhook Security**
   - HMAC-SHA256 signature verification
   - Payload validation
   - Timing attack protection

3. **mTLS Support**
   - Certificate-based authentication with Visa
   - Secure certificate storage in .gitignore
   - Support for custom CA certificates

4. **Secrets Management**
   - Environment variables for all credentials
   - .env file protected by .gitignore
   - Separate configs per environment

5. **Security Headers**
   ```
   X-Content-Type-Options: nosniff
   X-Frame-Options: DENY
   X-XSS-Protection: 1; mode=block
   Content-Security-Policy: default-src 'self'
   ```

### 🔐 Best Practices

**Never:**
- Commit .env files to Git
- Expose API keys in frontend
- Log sensitive data
- Use hardcoded credentials
- Share private certificates

**Always:**
- Use .env.example as a template
- Rotate credentials regularly
- Validate all inputs
- Verify webhook signatures
- Use HTTPS in production
- Enable mTLS for sensitive APIs

---

## 📋 Configuration

### .env Template

```env
PORT=4000

# Kora
KORA_BASE_URL=https://api.korapay.com/merchant
KORA_PUBLIC_KEY=your_public_key
KORA_SECRET_KEY=your_secret_key
KORA_WEBHOOK_SECRET=your_webhook_secret

# Visa
VISA_BASE_URL=https://sandbox.api.visa.com
VISA_KEY_ID=your_key_id
VISA_API_KEY=your_api_key
VISA_CERT_PATH=./certs/cert.pem
VISA_KEY_PATH=./certs/private.key
VISA_WEBHOOK_SECRET=your_webhook_secret

NODE_ENV=development
```

---

## 🏗️ Architecture

```
User Wallet
    ↓
FrontierPay API
    ↓
Routing Engine
    ↓
Treasury Layer
    ↓
Provider Adapters
    ├── Kora Adapter
    └── Visa Adapter
    ↓
Sandbox APIs
    ├── Kora Sandbox
    └── Visa Sandbox
```

---

## 📊 Frontend Dashboard

Access the interactive dashboard at `http://localhost:4000`

Features:
- 🧪 **Kora Tests** - Connection and transfer simulation
- 🧪 **Visa Tests** - mTLS and push-funds simulation
- 📊 **Activity Logs** - Real-time request/response monitoring
- 🔒 **Security Guide** - Best practices reference
- 💚 **Health Monitor** - System status indicator

---

## 📁 Project Structure

```
.
├── server.js              # Main Express app
├── package.json           # Dependencies
├── .env.example           # Configuration template
├── .gitignore             # Git exclusions
├── public/
│   └── index.html         # Frontend dashboard
├── certs/                 # SSL certificates (not committed)
└── logs/                  # Application logs
```

---

## 🧪 Testing

### Manual Testing

```bash
# Test Kora connection
curl -X POST http://localhost:4000/api/kora/test-connection

# Test Visa connection
curl -X POST http://localhost:4000/api/visa/test-connection

# Health check
curl http://localhost:4000/health
```

### Frontend Testing
1. Open http://localhost:4000 in browser
2. Navigate to Kora or Visa integration sections
3. Click test buttons to verify connectivity
4. View results in Activity Logs

---

## 🐛 Troubleshooting

### Kora Connection Failed
- Verify `KORA_SECRET_KEY` is correct
- Check API endpoint is reachable
- Ensure .env file is loaded (`npm start` vs direct node)

### Visa mTLS Error
- Verify certificate files exist in `certs/` directory
- Check certificate paths in .env
- Validate certificate expiration
- Ensure CA certificate is correct

### Webhook Signature Verification Failed
- Verify webhook secret matches
- Check request body hasn't been modified
- Ensure correct hash algorithm (SHA256)
- Validate timestamp is recent

### Port Already in Use
```bash
# Use different port
PORT=5000 npm start

# Or kill process on port 4000
lsof -ti:4000 | xargs kill -9
```

---

## 📚 Documentation

- [Kora API Docs](https://docs.korapay.com)
- [Visa Developer Docs](https://developer.visa.com)

---

## 🤝 Contributing

1. Create a feature branch
2. Commit changes
3. Push to GitHub
4. Create Pull Request

---

## 📄 License

MIT

---

## 👥 Support

For issues or questions:
1. Check [Troubleshooting](#troubleshooting) section
2. Review security headers in [Configuration](#configuration)
3. Consult API provider documentation
4. Open an issue on GitHub

---

## ✨ Features Roadmap

- [ ] Rate limiting
- [ ] Request queuing
- [ ] Retry logic with exponential backoff
- [ ] Database integration for transaction history
- [ ] Admin dashboard
- [ ] Multi-currency support
- [ ] Compliance reporting
- [ ] Advanced routing rules

---

**Built with ❤️ for secure payment orchestration**
