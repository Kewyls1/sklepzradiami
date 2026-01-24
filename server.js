// server.js - WERSJA Z .env I VERCEL POSTGRES
require('dotenv').config(); // Dodaj na początku pliku
const { sql } = require('@vercel/postgres'); // Import bazy danych

// Najpierw naprawmy problem z File - użyj natywnej implementacji z Node.js 18+
if (typeof global.File === 'undefined') {
    // Dla Node.js 18+ używamy natywnego File z node:buffer
    if (typeof require('node:buffer').File !== 'undefined') {
        global.File = require('node:buffer').File;
        global.Blob = require('node:buffer').Blob;
    } else {
        // Fallback dla starszych wersji Node.js
        const { Readable } = require('stream');
        global.File = class File {
            constructor(parts, name, options = {}) {
                this.name = name;
                this.type = options.type || '';
                this.lastModified = options.lastModified || Date.now();
            }
        };
        global.Blob = class Blob {
            constructor(parts, options = {}) {
                this.type = options.type || '';
                this.size = 0;
            }
        };
    }
}

const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); // Zmienione: użycie zmiennej środowiskowej
const app = express();
const fs = require('fs');
const path = require('path');

// WAŻNE: Poprawna obsługa plików statycznych
app.use(express.static(__dirname, {
    // Ustawienia cache dla różnych typów plików
    maxAge: '1d',
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        } else if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        } else if (filePath.endsWith('.png')) {
            res.setHeader('Content-Type', 'image/png');
        } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
            res.setHeader('Content-Type', 'image/jpeg');
        }
    }
}));

// Dodatkowo, obsłuż foldery z zasobami
app.use('/assets', express.static(path.join(__dirname, 'assets'), {
    maxAge: '7d'
}));

app.use('/assets/css', express.static(path.join(__dirname, 'assets/css'), {
    maxAge: '1d'
}));

app.use('/assets/js', express.static(path.join(__dirname, 'assets/js'), {
    maxAge: '1d'
}));

app.use('/assets/images', express.static(path.join(__dirname, 'assets/images'), {
    maxAge: '30d'
}));

app.use('/assets/products', express.static(path.join(__dirname, 'assets/products'), {
    maxAge: '30d'
}));

app.use(express.json());

// Funkcja zapisująca zamówienie do Vercel Postgres
async function saveOrder(orderData) {
    try {
        await sql`
            CREATE TABLE IF NOT EXISTS orders (
                id SERIAL PRIMARY KEY,
                payment_intent_id TEXT,
                amount DECIMAL(10, 2),
                product_name TEXT,
                email TEXT,
                full_name TEXT,
                address TEXT,
                status TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;
        await sql`
            INSERT INTO orders (payment_intent_id, amount, product_name, email, full_name, address, status)
            VALUES (${orderData.paymentIntentId}, ${orderData.amount}, ${orderData.productName}, ${orderData.email}, ${orderData.fullName}, ${JSON.stringify(orderData.address)}, 'pending');
        `;
        console.log("✅ Zamówienie zapisane w Vercel Postgres!");
    } catch (error) {
        console.error("❌ Błąd bazy danych:", error.message);
    }
}

// Endpoint dla admina
app.post('/admin-login', async (req, res) => { // Dodane: async
    const { password } = req.body;
    if (password === process.env.ADMIN_PASSWORD) { // Zmienione: użycie zmiennej środowiskowej
        try {
            const { rows: orders } = await sql`SELECT * FROM orders ORDER BY created_at DESC`;
            res.json({ success: true, orders });
        } catch (error) {
            console.error("❌ Błąd bazy danych przy pobieraniu zamówień:", error);
            res.status(500).json({ success: false, message: "Błąd bazy danych" });
        }
    } else {
        res.status(401).json({ success: false, message: "Błędne hasło" });
    }
});

// Endpoint do tworzenia Payment Intent
app.post('/create-payment-intent', async (req, res) => {
    try {
        const { 
            productPrice, 
            productName, 
            email, 
            fullName, 
            address1, 
            address2, 
            zip, 
            city, 
            phone, 
            delivery
        } = req.body;

        const unitAmount = Math.round(productPrice * 100);
        const shippingAmount = 100; // 1,00 PLN

        // Tworzymy PaymentIntent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: unitAmount + shippingAmount,
            currency: 'pln',
            automatic_payment_methods: { 
                enabled: true 
            },
            description: `Zakup: ${productName}`,
            metadata: {
                'Produkt': productName,
                'E-mail klienta': email,
                'Imię i nazwisko': fullName,
                'Adres': `${address1}${address2 ? ', ' + address2 : ''}`,
                'Kod pocztowy': zip,
                'Miasto': city,
                'Telefon': phone,
                'Metoda dostawy': delivery,
                'Data': new Date().toLocaleString('pl-PL')
            },
            shipping: {
                name: fullName,
                phone: phone,
                address: {
                    line1: address1,
                    line2: address2 || "",
                    postal_code: zip,
                    city: city,
                    country: 'PL',
                },
            }
        });

        // Zapisujemy zamówienie do bazy danych
        const orderData = {
            paymentIntentId: paymentIntent.id,
            amount: (unitAmount + shippingAmount) / 100,
            currency: 'PLN',
            productName,
            productPrice,
            email,
            fullName,
            address: {
                line1: address1,
                line2: address2,
                zip,
                city,
                country: 'PL'
            },
            phone,
            delivery,
            status: 'pending',
            clientSecret: paymentIntent.client_secret
        };
        
        await saveOrder(orderData); // Dodane: await

        console.log('Utworzono PaymentIntent:', paymentIntent.id);
        
        res.json({ 
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id
        });
    } catch (error) {
        console.error('Błąd tworzenia payment intent:', error);
        res.status(500).json({ 
            error: error.message,
            code: error.code
        });
    }
});

// Funkcje do obsługi produktów
let generateProducts;
try {
    generateProducts = require('./generate-products');
} catch (error) {
    console.warn('Uwaga: generate-products.js nie mógł być załadowany:', error.message);
    generateProducts = { updateIndexHTML: () => [] };
}

// Automatyczna aktualizacja produktów przy starcie
try {
    console.log('🔄 Aktualizowanie listy produktów...');
    generateProducts.updateIndexHTML();
    console.log('✅ Produkty zaktualizowane!');
} catch (error) {
    console.error('❌ Błąd aktualizacji produktów:', error.message);
}

// Endpoint do ręcznej aktualizacji produktów
app.get('/admin/update-products', (req, res) => {
    try {
        const products = generateProducts.updateIndexHTML();
        res.json({ 
            success: true, 
            message: `Zaktualizowano ${products.length} produktów`,
            products 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Endpoint do wyszukiwania produktów
app.get('/api/search', (req, res) => {
    try {
        const query = req.query.q?.toLowerCase() || '';
        console.log('🔍 Wyszukiwanie produktów:', query);
        
        // Wczytaj index.html i przetwórz
        const indexFile = path.join(__dirname, 'index.html');
        const html = fs.readFileSync(indexFile, 'utf8');
        
        // Proste wyszukiwanie - w prawdziwej aplikacji użyj bazy danych
        const searchResults = [];
        
        // Znajdź wszystkie produkty w HTML (to jest uproszczone)
        // W rzeczywistej aplikacji lepiej przechowywać produkty w JSON
        const productMatches = html.match(/data-title="([^"]+)"/g) || [];
        
        productMatches.forEach(match => {
            const title = match.replace('data-title="', '').replace('"', '').toLowerCase();
            if (title.includes(query)) {
                searchResults.push({ title });
            }
        });
        
        res.json({ 
            success: true, 
            query,
            count: searchResults.length,
            results: searchResults 
        });
    } catch (error) {
        console.error('Błąd wyszukiwania:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Middleware do logowania zapytań (pomocne w debugowaniu)
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Endpointy statyczne
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/product', (req, res) => {
    res.sendFile(path.join(__dirname, 'product.html'));
});

// Endpoint do dynamicznego wstrzykiwania klucza publicznego do payment.html
app.get('/payment', (req, res) => {
    const filePath = path.join(__dirname, 'payment.html');
    let html = fs.readFileSync(filePath, 'utf8');
    
    // Wstrzykujemy klucz publiczny Stripe z .env
    html = html.replace(
        "const stripe = Stripe('pk_live_51RbLjTEYLaNHeZVgDNwIqC6y7LgDx7NK15piII7kb5T1X1yf9Qat2e3VOaMYF599mDSsA30K7p6yiCChnLiyaCmS00zVmShdnL');",
        `const stripe = Stripe('${process.env.STRIPE_PUBLIC_KEY}');`
    );
    
    res.send(html);
});

app.get('/success', (req, res) => {
    res.sendFile(path.join(__dirname, 'success.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Endpoint do debugowania - pokazuje czy pliki są dostępne
app.get('/debug-assets', (req, res) => {
    const assetsPath = path.join(__dirname, 'assets/css/style-prefix.css');
    const exists = fs.existsSync(assetsPath);
    
    res.json({
        assetsPath,
        exists,
        currentDir: __dirname,
        files: fs.readdirSync(__dirname)
    });
});

// Endpoint do weryfikacji płatności
app.get('/verify-payment/:paymentIntentId', async (req, res) => {
    try {
        const paymentIntent = await stripe.paymentIntents.retrieve(req.params.paymentIntentId);
        res.json(paymentIntent);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000; // Zmienione: użycie zmiennej środowiskowej
app.listen(PORT, () => {
    console.log(`✅ Serwer działa na porcie ${PORT}`);
    console.log(`📦 Strona główna: http://localhost:${PORT}`);
    console.log(`📁 Debugowanie assetów: http://localhost:${PORT}/debug-assets`);
    console.log(`🔍 Przykład wyszukiwania: http://localhost:${PORT}/api/search?q=diagnostyczny`);
    console.log(`🔑 Klucz Stripe: ${process.env.STRIPE_SECRET_KEY ? 'OK' : 'BRAK'}`);
});
