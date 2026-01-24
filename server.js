// server.js - PEŁNA WERSJA DO DZIAŁANIA
require('dotenv').config();

// Sprawdź zmienne środowiskowe
console.log('🔍 Sprawdzanie zmienne środowiskowe:');
console.log(`- PORT: ${process.env.PORT || '3000 (domyślny)'}`);
console.log(`- STRIPE_SECRET_KEY: ${process.env.STRIPE_SECRET_KEY ? 'OK' : 'BRAK'}`);
console.log(`- STRIPE_PUBLIC_KEY: ${process.env.STRIPE_PUBLIC_KEY ? 'OK' : 'BRAK'}`);
console.log(`- POSTGRES_URL: ${process.env.POSTGRES_URL ? 'OK' : 'BRAK'}`);
console.log(`- DATABASE_URL: ${process.env.DATABASE_URL ? 'OK' : 'BRAK'}`);

const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express();
const fs = require('fs');
const path = require('path');

// Middleware
app.use(express.json());
app.use(express.static(__dirname, {
    maxAge: '1d',
    setHeaders: (res, filePath) => {
        const ext = path.extname(filePath);
        const mimeTypes = {
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.html': 'text/html'
        };
        if (mimeTypes[ext]) {
            res.setHeader('Content-Type', mimeTypes[ext]);
        }
    }
}));

app.use('/assets', express.static(path.join(__dirname, 'assets'), { maxAge: '7d' }));
app.use('/assets/css', express.static(path.join(__dirname, 'assets/css'), { maxAge: '7d' }));

// Ustawienie CORS dla Stripe Webhook
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

// Endpoint główny
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Endpoint dla strony płatności
app.get('/payment.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'payment.html'));
});

// Endpoint dla sukcesu
app.get('/success.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'success.html'));
});

// KLUCZOWY ENDPOINT: Tworzenie PaymentIntent
app.post('/create-payment-intent', async (req, res) => {
    try {
        console.log('🔄 Tworzenie PaymentIntent...');
        console.log('📦 Otrzymane dane:', req.body);

        const { productPrice } = req.body;
        
        if (!productPrice || isNaN(productPrice)) {
            return res.status(400).send({ error: 'Nieprawidłowa cena produktu' });
        }

        const totalAmount = (parseFloat(productPrice) + 1) * 100; // +1 PLN dostawy
        
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(totalAmount),
            currency: 'pln',
            automatic_payment_methods: { enabled: true },
            metadata: {
                product_name: req.body.productName || 'Produkt',
                product_price: productPrice
            }
        });

        console.log('✅ PaymentIntent utworzony:', paymentIntent.id);
        
        res.send({ 
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id
        });
    } catch (error) {
        console.error('❌ Błąd tworzenia PaymentIntent:', error);
        res.status(400).send({ error: error.message });
    }
});

// Endpoint do aktualizacji statusu zamówienia
app.post('/update-order-status', async (req, res) => {
    try {
        const { paymentIntentId, status } = req.body;
        
        console.log(`🔄 Aktualizacja statusu zamówienia ${paymentIntentId} -> ${status}`);
        
        // Tu można dodać logikę zapisu do bazy danych
        // Na razie tylko logujemy
        console.log('✅ Status zaktualizowany (symulacja)');
        
        res.send({ success: true, message: 'Status zaktualizowany' });
    } catch (error) {
        console.error('❌ Błąd aktualizacji statusu:', error);
        res.status(500).send({ error: error.message });
    }
});

// Endpoint dla webhooków Stripe
app.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test'
        );
    } catch (err) {
        console.error('❌ Błąd webhooka:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Obsługa różnych typów eventów
    switch (event.type) {
        case 'payment_intent.succeeded':
            const paymentIntent = event.data.object;
            console.log(`✅ Płatność zakończona sukcesem: ${paymentIntent.id}`);
            // Tutaj można zaktualizować zamówienie w bazie danych
            break;
        case 'payment_intent.payment_failed':
            const failedPayment = event.data.object;
            console.log(`❌ Płatność nie powiodła się: ${failedPayment.id}`);
            break;
        default:
            console.log(`ℹ️  Nieobsługiwany event: ${event.type}`);
    }

    res.json({received: true});
});

// Obsługa 404
app.use((req, res) => {
    res.status(404).send('Strona nie znaleziona');
});

// Start serwera
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Serwer działa na porcie ${PORT}`);
    console.log(`🌐 Adres: http://localhost:${PORT}`);
    console.log(`💳 Stripe klucz: ${process.env.STRIPE_SECRET_KEY ? 'OK' : 'BRAK - ustaw STRIPE_SECRET_KEY w .env'}`);
});
