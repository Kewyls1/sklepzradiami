// server.js - PEŁNA WERSJA DO DZIAŁANIA
require('dotenv').config();

// Sprawdź zmienne środowiskowe
console.log('🔍 Sprawdzanie zmiennych środowiskowych:');
console.log(`- PORT: ${process.env.PORT || '3000 (domyślny)'}`);
console.log(`- STRIPE_SECRET_KEY: ${process.env.STRIPE_SECRET_KEY ? 'OK' : 'BRAK'}`);
console.log(`- STRIPE_PUBLIC_KEY: ${process.env.STRIPE_PUBLIC_KEY ? 'OK' : 'BRAK'}`);
console.log(`- POSTGRES_URL: ${process.env.POSTGRES_URL ? 'OK' : 'BRAK'}`);
console.log(`- DATABASE_URL: ${process.env.DATABASE_URL ? 'OK' : 'BRAK'}`);

const { sql } = require('@vercel/postgres');

// Polyfill dla File/Blob w Node.js
if (typeof global.File === 'undefined') {
    try {
        if (typeof require('node:buffer').File !== 'undefined') {
            global.File = require('node:buffer').File;
            global.Blob = require('node:buffer').Blob;
        }
    } catch (error) {
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
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express();
const fs = require('fs');
const path = require('path');

// Middleware
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
app.use('/assets/css', express.static(path.join(__dirname, 'assets/css'), { maxAge: '1d' }));
app.use('/assets/js', express.static(path.join(__dirname, 'assets/js'), { maxAge: '1d' }));
app.use('/assets/images', express.static(path.join(__dirname, 'assets/images'), { maxAge: '30d' }));
app.use('/assets/products', express.static(path.join(__dirname, 'assets/products'), { maxAge: '30d' }));

app.use(express.json());

// Funkcja zapisująca zamówienie z backupem
async function saveOrder(orderData) {
    // Zapisz do pliku backup zawsze
    try {
        const backupFile = path.join(__dirname, 'orders_backup.json');
        let orders = [];
        
        if (fs.existsSync(backupFile)) {
            const content = fs.readFileSync(backupFile, 'utf8');
            if (content.trim()) {
                orders = JSON.parse(content);
            }
        }
        
        orders.push({
            ...orderData,
            timestamp: new Date().toISOString(),
            backup: true
        });
        
        fs.writeFileSync(backupFile, JSON.stringify(orders, null, 2));
        console.log("📝 Zamówienie zapisane do backup pliku");
    } catch (backupError) {
        console.error("❌ Błąd backupu:", backupError.message);
    }

    // Spróbuj zapisać do bazy danych jeśli connection string istnieje
    const dbUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    if (!dbUrl) {
        console.log("⚠️ Brak connection string - pomijam bazę danych");
        return;
    }

    try {
        await sql`
            CREATE TABLE IF NOT EXISTS orders (
                id SERIAL PRIMARY KEY,
                payment_intent_id TEXT UNIQUE,
                amount DECIMAL(10, 2),
                currency TEXT DEFAULT 'PLN',
                product_name TEXT,
                email TEXT,
                full_name TEXT,
                address JSONB,
                phone TEXT,
                delivery TEXT,
                status TEXT DEFAULT 'pending',
                client_secret TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;
        
        await sql`
            INSERT INTO orders (payment_intent_id, amount, product_name, email, full_name, address, phone, delivery, status, client_secret)
            VALUES (
                ${orderData.paymentIntentId}, 
                ${orderData.amount}, 
                ${orderData.productName}, 
                ${orderData.email}, 
                ${orderData.fullName}, 
                ${JSON.stringify(orderData.address)}, 
                ${orderData.phone}, 
                ${orderData.delivery}, 
                ${orderData.status || 'pending'}, 
                ${orderData.clientSecret}
            )
            ON CONFLICT (payment_intent_id) DO UPDATE SET
                status = EXCLUDED.status;
        `;
        
        console.log("✅ Zamówienie zapisane w bazie danych!");
    } catch (dbError) {
        console.error("❌ Błąd bazy danych:", dbError.message);
    }
}

// Endpointy
app.post('/admin-login', async (req, res) => {
    try {
        const { password } = req.body;
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
        
        if (password !== adminPassword) {
            return res.status(401).json({ 
                success: false, 
                message: "Błędne hasło",
                hint: `Wprowadzone hasło: "${password}"` 
            });
        }

        // Spróbuj pobrać z bazy
        const dbUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
        let orders = [];
        
        if (dbUrl) {
            try {
                const result = await sql`SELECT * FROM orders ORDER BY created_at DESC`;
                orders = result.rows;
            } catch (dbError) {
                console.error("❌ Błąd bazy danych:", dbError.message);
            }
        }
        
        // Zawsze dodaj z backup pliku
        try {
            const backupFile = path.join(__dirname, 'orders_backup.json');
            if (fs.existsSync(backupFile)) {
                const backupOrders = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
                // Dodaj tylko unikalne zamówienia (po payment_intent_id)
                const existingIds = new Set(orders.map(o => o.payment_intent_id));
                backupOrders.forEach(order => {
                    if (!existingIds.has(order.paymentIntentId)) {
                        orders.push({
                            payment_intent_id: order.paymentIntentId,
                            amount: order.amount,
                            product_name: order.productName,
                            email: order.email,
                            full_name: order.fullName,
                            address: order.address,
                            phone: order.phone,
                            delivery: order.delivery,
                            status: order.status,
                            client_secret: order.clientSecret,
                            created_at: order.timestamp,
                            backup: true
                        });
                    }
                });
            }
        } catch (backupError) {
            console.error("❌ Błąd backupu:", backupError.message);
        }
        
        res.json({ 
            success: true, 
            orders,
            adminPassword: adminPassword,
            hasDatabase: !!dbUrl
        });
    } catch (error) {
        console.error("❌ Błąd admin-login:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

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

        // Walidacja
        if (!email || !fullName || !address1 || !zip || !city || !phone) {
            return res.status(400).json({ 
                error: 'Brakujące wymagane pola',
                code: 'VALIDATION_ERROR'
            });
        }

        const unitAmount = Math.round(parseFloat(productPrice) * 100);
        if (isNaN(unitAmount) || unitAmount <= 0) {
            return res.status(400).json({ 
                error: 'Nieprawidłowa cena produktu',
                code: 'INVALID_PRICE'
            });
        }

        const shippingAmount = 100; // 1.00 PLN
        const totalAmount = unitAmount + shippingAmount;

        // Tworzenie PaymentIntent w Stripe
        const paymentIntent = await stripe.paymentIntents.create({
            amount: totalAmount,
            currency: 'pln',
            automatic_payment_methods: { 
                enabled: true 
            },
            description: `Zakup: ${productName}`,
            metadata: {
                'Produkt': productName,
                'E-mail': email,
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

        // Przygotuj dane zamówienia
        const orderData = {
            paymentIntentId: paymentIntent.id,
            amount: totalAmount / 100,
            productName,
            email,
            fullName,
            address: {
                line1: address1,
                line2: address2 || '',
                zip,
                city,
                country: 'PL'
            },
            phone,
            delivery,
            status: 'pending',
            clientSecret: paymentIntent.client_secret
        };
        
        // Zapisz zamówienie (do backupu i/lub bazy)
        await saveOrder(orderData);

        console.log('✅ Utworzono PaymentIntent:', paymentIntent.id);
        
        res.json({ 
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            amount: totalAmount
        });
    } catch (error) {
        console.error('❌ Błąd tworzenia payment intent:', error);
        res.status(500).json({ 
            error: error.message,
            code: error.type || 'STRIPE_ERROR'
        });
    }
});

app.post('/update-order-status', async (req, res) => {
    try {
        const { paymentIntentId, status } = req.body;
        
        // Aktualizuj w bazie jeśli istnieje
        const dbUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
        if (dbUrl) {
            await sql`
                UPDATE orders 
                SET status = ${status} 
                WHERE payment_intent_id = ${paymentIntentId}
            `;
        }
        
        // Aktualizuj w backup pliku
        try {
            const backupFile = path.join(__dirname, 'orders_backup.json');
            if (fs.existsSync(backupFile)) {
                let orders = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
                orders = orders.map(order => {
                    if (order.paymentIntentId === paymentIntentId) {
                        return { ...order, status, updated: new Date().toISOString() };
                    }
                    return order;
                });
                fs.writeFileSync(backupFile, JSON.stringify(orders, null, 2));
            }
        } catch (backupError) {
            console.error("❌ Błąd aktualizacji backupu:", backupError.message);
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Błąd aktualizacji statusu:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint do debugowania bazy
app.get('/debug-db', async (req, res) => {
    try {
        const dbUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
        let dbInfo = { exists: !!dbUrl, url: dbUrl ? 'OK (ukryty)' : 'BRAK' };
        
        if (dbUrl) {
            try {
                const result = await sql`SELECT COUNT(*) as count FROM orders`;
                dbInfo.count = result.rows[0].count;
            } catch (dbError) {
                dbInfo.error = dbError.message;
            }
        }
        
        // Sprawdź backup plik
        const backupFile = path.join(__dirname, 'orders_backup.json');
        const backupExists = fs.existsSync(backupFile);
        let backupInfo = { exists: backupExists };
        
        if (backupExists) {
            try {
                const content = fs.readFileSync(backupFile, 'utf8');
                const orders = JSON.parse(content);
                backupInfo.count = orders.length;
                backupInfo.latest = orders.slice(-1)[0] || null;
            } catch (e) {
                backupInfo.error = e.message;
            }
        }
        
        res.json({
            environment: {
                NODE_ENV: process.env.NODE_ENV || 'development',
                PORT: process.env.PORT || 3000,
                HAS_STRIPE: !!process.env.STRIPE_SECRET_KEY,
                HAS_ADMIN: !!process.env.ADMIN_PASSWORD
            },
            database: dbInfo,
            backup: backupInfo,
            server: {
                time: new Date().toISOString(),
                uptime: process.uptime()
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpointy statyczne
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/product', (req, res) => {
    res.sendFile(path.join(__dirname, 'product.html'));
});

app.get('/payment', (req, res) => {
    try {
        const filePath = path.join(__dirname, 'payment.html');
        let html = fs.readFileSync(filePath, 'utf8');
        
        // Wstrzykujemy klucz publiczny Stripe
        const stripeKey = process.env.STRIPE_PUBLIC_KEY || 'pk_test_51SRFlGETbCF5SCca4luNtP4tBkN1g7ObCeyCLPd6xRVRhGx9RCBj2cEv4kYlkU24pWE4rvocABJRuhNaz1PFmZfM00udXcfGvc';
        html = html.replace(
            "const stripe = Stripe('pk_test_51SRFlGETbCF5SCca4luNtP4tBkN1g7ObCeyCLPd6xRVRhGx9RCBj2cEv4kYlkU24pWE4rvocABJRuhNaz1PFmZfM00udXcfGvc');",
            `const stripe = Stripe('${stripeKey}');`
        );
        
        res.send(html);
    } catch (error) {
        console.error('❌ Błąd wczytywania payment.html:', error);
        res.status(500).send('Błąd serwera');
    }
});

app.get('/success', (req, res) => {
    res.sendFile(path.join(__dirname, 'success.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Endpoint do wyszukiwania
app.get('/api/search', (req, res) => {
    try {
        const query = req.query.q?.toLowerCase() || '';
        const indexFile = path.join(__dirname, 'index.html');
        
        if (!fs.existsSync(indexFile)) {
            return res.json({ success: true, query, count: 0, results: [] });
        }
        
        const html = fs.readFileSync(indexFile, 'utf8');
        const searchResults = [];
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
        console.error('❌ Błąd wyszukiwania:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Middleware do logowania
app.use((req, res, next) => {
    console.log(`${new Date().toLocaleString('pl-PL')} - ${req.method} ${req.url}`);
    next();
});

// Start serwera
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n✅ ============================`);
    console.log(`✅ Serwer działa na porcie ${PORT}`);
    console.log(`✅ ============================`);
    console.log(`📦 Strona główna: http://localhost:${PORT}`);
    console.log(`💰 Płatności: http://localhost:${PORT}/payment?price=99.99&name=Test&image=test.jpg`);
    console.log(`🔐 Admin: http://localhost:${PORT}/admin`);
    console.log(`🐛 Debug: http://localhost:${PORT}/debug-db`);
    console.log(`🔍 Stripe: ${process.env.STRIPE_SECRET_KEY ? 'OK' : 'BRAK'}`);
    console.log(`🗄️  Baza danych: ${process.env.POSTGRES_URL || process.env.DATABASE_URL ? 'OK' : 'BRAK (używam backup pliku)'}`);
    console.log(`🔑 Admin hasło: ${process.env.ADMIN_PASSWORD || 'admin123 (domyślne)'}`);
    console.log(`✅ ============================\n`);
});
