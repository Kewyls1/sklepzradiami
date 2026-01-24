// generate-products.js - Zaktualizowana wersja
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

// Ścieżki
const productsDir = path.join(__dirname, 'produkty');
const indexFile = path.join(__dirname, 'index.html');

// Funkcja do parsowania pliku HTML produktu
function parseProductFile(filePath) {
    try {
        const html = fs.readFileSync(filePath, 'utf8');
        const $ = cheerio.load(html);
        
        // Wyciąganie danych z product.html
        const title = $('h1.product-title').text().trim();
        const currentPrice = $('.current-price').text().trim();
        const originalPrice = $('.original-price').text().trim();
        const category = $('.product-category').text().trim();
        
        // Pobieranie opisu - szukamy różnych możliwych elementów
        let description = '';
        const descElement = $('.product-description, .description, .opis-produktu');
        if (descElement.length > 0) {
            description = descElement.text().trim().substring(0, 200) + '...';
        }
        
        // Szukanie głównego obrazu
        let mainImage = $('#MainImg').attr('src');
        if (!mainImage) {
            mainImage = $('.main-image').attr('src');
        }
        if (!mainImage) {
            mainImage = $('img[alt*="produkt"], img[alt*="product"]').first().attr('src');
        }
        
        const productName = path.basename(filePath, '.html');
        
        return {
            filename: productName + '.html',
            title,
            description,
            currentPrice,
            originalPrice,
            category,
            mainImage: mainImage || './assets/images/default-product.jpg',
            link: `produkty/${productName}.html`,
            rating: 5,
            badge: calculateBadge(currentPrice, originalPrice)
        };
    } catch (error) {
        console.error(`Błąd parsowania pliku ${filePath}:`, error);
        return null;
    }
}

// Funkcja obliczająca badge
function calculateBadge(current, original) {
    if (!original) return null;
    
    const currentNum = parseFloat(current.replace(/[^0-9.,]/g, '').replace(',', '.'));
    const originalNum = parseFloat(original.replace(/[^0-9.,]/g, '').replace(',', '.'));
    
    if (!isNaN(currentNum) && !isNaN(originalNum) && originalNum > currentNum) {
        const discount = Math.round(((originalNum - currentNum) / originalNum) * 100);
        return {
            text: `${discount}%`,
            type: 'discount'
        };
    }
    
    return null;
}

// Funkcja generująca HTML produktu
function generateProductHTML(product) {
    return `
        <div class="showcase" 
             data-title="${product.title.toLowerCase()}" 
             data-category="${product.category.toLowerCase()}"
             data-description="${product.description.toLowerCase()}">
            <div class="showcase-banner">
                <img src="${product.mainImage}" alt="${product.title}" width="300" class="product-img default">
                <img src="${product.mainImage}" alt="${product.title}" width="300" class="product-img hover">
            </div>
            
            <div class="showcase-content">
                <a href="#" class="showcase-category">${product.category}</a>
                <a href="${product.link}">
                    <h3 class="showcase-title">${product.title}</h3>
                </a>
                
                <div class="showcase-rating">
                    ${generateStars(product.rating)}
                </div>
                
                <div class="price-box">
                    <p class="price">${product.currentPrice}</p>
                </div>
                
                <a href="${product.link}" class="btn-offer">
                    <span>Zobacz ofertę</span>
                    <ion-icon name="arrow-forward-outline"></ion-icon>
                </a>
                <br>
            </div>
        </div>
    `;
}

// Funkcja generująca gwiazdki oceny
function generateStars(rating) {
    let stars = '';
    for (let i = 1; i <= 5; i++) {
        stars += '<ion-icon name="star"></ion-icon>';
    }
    return stars;
}

// Główna funkcja aktualizująca index.html
function updateIndexHTML() {
    console.log('📦 Aktualizowanie listy produktów...');
    
    // Wczytaj wszystkie pliki HTML z folderu produkty
    const productFiles = fs.readdirSync(productsDir)
        .filter(file => file.endsWith('.html'));
    
    const products = productFiles.map(file => {
        return parseProductFile(path.join(productsDir, file));
    }).filter(product => product !== null);
    
    // Wczytaj index.html
    let indexHTML = fs.readFileSync(indexFile, 'utf8');
    const $ = cheerio.load(indexHTML);
    
    // Znajdź kontener na produkty
    const productGrid = $('.product-grid');
    
    // Wyczyść istniejące produkty
    productGrid.empty();
    
    // Dodaj nowe produkty
    products.forEach(product => {
        productGrid.append(generateProductHTML(product));
    });
    
    // Dodaj wiadomość o braku wyników
    productGrid.append(`
        <div class="no-results-message" style="display: none; text-align: center; grid-column: 1 / -1; padding: 40px;">
            <ion-icon name="search-outline" style="font-size: 60px; color: #ccc;"></ion-icon>
            <h3>Nie znaleziono produktów</h3>
            <p>Spróbuj zmienić kryteria wyszukiwania</p>
        </div>
    `);
    
    // Zapisz zaktualizowany plik
    fs.writeFileSync(indexFile, $.html());
    
    console.log(`✅ Zaktualizowano ${products.length} produktów!`);
    return products;
}

// Uruchomienie
if (require.main === module) {
    updateIndexHTML();
}

module.exports = { updateIndexHTML };