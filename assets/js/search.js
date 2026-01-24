// Wyszukiwanie i filtrowanie produktów
document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('productSearch');
    const searchBtn = document.getElementById('searchBtn');
    const minPriceInput = document.getElementById('minPrice');
    const maxPriceInput = document.getElementById('maxPrice');
    const applyFilterBtn = document.getElementById('applyFilter');
    const resetFilterBtn = document.getElementById('resetFilter');
    const sortSelect = document.getElementById('sortBy');
    const resultsInfo = document.getElementById('searchResultsInfo');
    
    let allProducts = [];
    
    // Inicjalizacja
    function initSearchFilter() {
        // Pobierz wszystkie produkty
        const productElements = document.querySelectorAll('.product-grid .showcase');
        allProducts = Array.from(productElements).map(product => ({
            element: product,
            title: product.dataset.title,
            description: product.dataset.description,
            price: parseFloat(product.dataset.price),
            category: product.dataset.category
        }));
        
        updateResultsInfo(allProducts.length, allProducts.length);
    }
    
    // Funkcja wyszukiwania
    function searchProducts() {
        const searchTerm = searchInput.value.toLowerCase().trim();
        const minPrice = parseFloat(minPriceInput.value) || 0;
        const maxPrice = parseFloat(maxPriceInput.value) || Infinity;
        const sortValue = sortSelect.value;
        
        let filteredProducts = allProducts;
        
        // Filtrowanie po wyszukiwaniu
        if (searchTerm) {
            filteredProducts = filteredProducts.filter(product => 
                product.title.includes(searchTerm) || 
                product.description.includes(searchTerm)
            );
        }
        
        // Filtrowanie po cenie
        filteredProducts = filteredProducts.filter(product => 
            product.price >= minPrice && product.price <= maxPrice
        );
        
        // Sortowanie
        filteredProducts.sort((a, b) => {
            switch(sortValue) {
                case 'price_asc':
                    return a.price - b.price;
                case 'price_desc':
                    return b.price - a.price;
                case 'name_asc':
                    return a.element.querySelector('.showcase-title').textContent.localeCompare(
                        b.element.querySelector('.showcase-title').textContent
                    );
                case 'name_desc':
                    return b.element.querySelector('.showcase-title').textContent.localeCompare(
                        a.element.querySelector('.showcase-title').textContent
                    );
                default:
                    return 0;
            }
        });
        
        // Ukryj wszystkie produkty
        allProducts.forEach(product => {
            product.element.style.display = 'none';
        });
        
        // Pokaż przefiltrowane produkty
        filteredProducts.forEach(product => {
            product.element.style.display = 'block';
        });
        
        // Dodaj komunikat o braku wyników
        showNoResultsMessage(filteredProducts.length === 0);
        
        // Aktualizuj informację o wynikach
        updateResultsInfo(filteredProducts.length, allProducts.length);
    }
    
    // Funkcja resetująca filtry
    function resetFilters() {
        searchInput.value = '';
        minPriceInput.value = '';
        maxPriceInput.value = '';
        sortSelect.value = 'default';
        
        // Pokaż wszystkie produkty
        allProducts.forEach(product => {
            product.element.style.display = 'block';
        });
        
        // Ukryj komunikat o braku wyników
        showNoResultsMessage(false);
        
        // Aktualizuj informację
        updateResultsInfo(allProducts.length, allProducts.length);
    }
    
    // Funkcja pokazująca komunikat o braku wyników
    function showNoResultsMessage(show) {
        let noResultsMsg = document.querySelector('.no-products-found');
        
        if (show && !noResultsMsg) {
            noResultsMsg = document.createElement('div');
            noResultsMsg.className = 'no-products-found';
            noResultsMsg.innerHTML = `
                <ion-icon name="search-outline"></ion-icon>
                <h3>Nie znaleziono produktów</h3>
                <p>Spróbuj zmienić kryteria wyszukiwania lub filtry</p>
            `;
            
            const productGrid = document.querySelector('.product-grid');
            productGrid.appendChild(noResultsMsg);
        } else if (!show && noResultsMsg) {
            noResultsMsg.remove();
        }
    }
    
    // Funkcja aktualizująca informację o wynikach
    function updateResultsInfo(filtered, total) {
        if (filtered === total) {
            resultsInfo.textContent = `Wyświetlam wszystkie ${total} produktów`;
        } else {
            resultsInfo.textContent = `Znaleziono ${filtered} z ${total} produktów`;
        }
    }
    
    // Event listeners
    if (searchInput && searchBtn) {
        searchBtn.addEventListener('click', searchProducts);
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                searchProducts();
            }
        });
    }
    
    if (applyFilterBtn) {
        applyFilterBtn.addEventListener('click', searchProducts);
    }
    
    if (resetFilterBtn) {
        resetFilterBtn.addEventListener('click', resetFilters);
    }
    
    if (sortSelect) {
        sortSelect.addEventListener('change', searchProducts);
    }
    
    // Inicjalizacja przy załadowaniu strony
    initSearchFilter();
    
    // Obsługa wyszukiwania z headera (opcjonalnie)
    const headerSearch = document.querySelector('.header-search-container .search-field');
    const headerSearchBtn = document.querySelector('.header-search-container .search-btn');
    
    if (headerSearch && headerSearchBtn) {
        headerSearchBtn.addEventListener('click', function() {
            const term = headerSearch.value;
            if (term) {
                searchInput.value = term;
                searchProducts();
                // Przewiń do sekcji produktów
                document.querySelector('.product-main').scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
        
        headerSearch.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                const term = headerSearch.value;
                if (term) {
                    searchInput.value = term;
                    searchProducts();
                    document.querySelector('.product-main').scrollIntoView({
                        behavior: 'smooth'
                    });
                }
            }
        });
    }
});