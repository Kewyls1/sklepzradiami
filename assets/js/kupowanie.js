// assets/js/kupowanie.js
document.addEventListener('DOMContentLoaded', function() {
    console.log('🛒 Skrypt kupowanie.js załadowany');
    
    // 1. ZMIANA ZDJĘCIA PO KLIKNIĘCIU W MINIATURĘ
    function changeImage(thumbnail) {
        const mainImg = document.getElementById('MainImg');
        
        if (!mainImg) {
            console.error('❌ Nie znaleziono elementu MainImg');
            return;
        }
        
        // Zmień źródło zdjęcia głównego
        mainImg.src = thumbnail.src;
        
        // Animacja przejścia
        mainImg.style.opacity = '0';
        setTimeout(() => {
            mainImg.style.opacity = '1';
            mainImg.style.transition = 'opacity 0.3s ease';
        }, 50);
        
        // Obsługa klasy 'active' na miniaturach
        document.querySelectorAll('.thumbnail').forEach(el => {
            el.classList.remove('active');
        });
        thumbnail.classList.add('active');
    }
    
    // Dodaj event listenery do miniaturek
    document.querySelectorAll('.thumbnail').forEach(thumb => {
        thumb.addEventListener('click', function() {
            changeImage(this);
        });
    });

    // 2. SKRYPT ZOOM (LUPA)
    function setupZoom() {
        const zoomer = document.querySelector('.img-zoom-container');
        const img = document.getElementById('MainImg');
        
        if (!zoomer || !img) return;
        
        zoomer.addEventListener('mousemove', function(e) {
            const rect = zoomer.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / zoomer.offsetWidth) * 100;
            const y = ((e.clientY - rect.top) / zoomer.offsetHeight) * 100;
            
            img.style.transformOrigin = x + '% ' + y + '%';
            img.style.transform = 'scale(2.5)';
        });
        
        zoomer.addEventListener('mouseleave', function() {
            img.style.transform = 'scale(1)';
            setTimeout(() => {
                img.style.transformOrigin = 'center center';
            }, 200);
        });
    }
    
    // 3. OBSŁUGA PRZYCISKU "KUP TERAZ"
    const buyNowBtn = document.getElementById('buy-now-btn');
    if (buyNowBtn) {
        buyNowBtn.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Pobierz dane produktu
            const productName = document.querySelector('.product-title')?.textContent || 'Produkt';
            const productPriceElement = document.querySelector('.current-price');
            const productImage = document.getElementById('MainImg')?.src || '';
            
            // Konwersja ceny - obsługa różnych formatów
            let price = 0;
            if (productPriceElement) {
                const priceText = productPriceElement.textContent.trim();
                // Usuń wszystko oprócz cyfr i przecinka/kropki
                const cleanPrice = priceText.replace(/[^\d,.]/g, '').replace(',', '.');
                price = parseFloat(cleanPrice) || 0;
            }
            
            // Pobierz ilość
            const quantityInput = document.querySelector('.qty-input');
            const quantity = quantityInput ? parseInt(quantityInput.value) || 1 : 1;
            
            // Walidacja
            if (price <= 0) {
                alert('❌ Błąd: Nieprawidłowa cena produktu');
                return;
            }
            
            // Oblicz łączną cenę
            const totalPrice = price * quantity;
            
            console.log('🛍️ Przekierowanie do płatności:', {
                product: productName,
                price: totalPrice,
                quantity: quantity,
                image: productImage
            });
            
            // Przygotuj URL
            const params = new URLSearchParams({
                name: encodeURIComponent(productName),
                price: totalPrice.toFixed(2),
                image: encodeURIComponent(productImage),
                quantity: quantity
            });
            
            // Przekieruj do strony płatności
            window.location.href = `/payment.html?${params}`;
        });
    } else {
        console.warn('⚠️ Nie znaleziono przycisku buy-now-btn');
    }
    
    // 4. OBSŁUGA ILOŚCI
    const quantityInput = document.querySelector('.qty-input');
    if (quantityInput) {
        const minusBtn = document.querySelector('.qty-minus');
        const plusBtn = document.querySelector('.qty-plus');
        
        if (minusBtn) {
            minusBtn.addEventListener('click', function() {
                let current = parseInt(quantityInput.value) || 1;
                if (current > 1) {
                    quantityInput.value = current - 1;
                    updatePrice();
                }
            });
        }
        
        if (plusBtn) {
            plusBtn.addEventListener('click', function() {
                let current = parseInt(quantityInput.value) || 1;
                quantityInput.value = current + 1;
                updatePrice();
            });
        }
        
        quantityInput.addEventListener('change', function() {
            let value = parseInt(this.value) || 1;
            if (value < 1) value = 1;
            if (value > 99) value = 99;
            this.value = value;
            updatePrice();
        });
    }
    
    // 5. AKTUALIZACJA CENY W ZALEŻNOŚCI OD ILOŚCI
    function updatePrice() {
        const quantityInput = document.querySelector('.qty-input');
        const productPriceElement = document.querySelector('.current-price');
        const totalPriceElement = document.querySelector('.total-price');
        
        if (!quantityInput || !productPriceElement || !totalPriceElement) return;
        
        const quantity = parseInt(quantityInput.value) || 1;
        const priceText = productPriceElement.textContent.trim();
        const cleanPrice = priceText.replace(/[^\d,.]/g, '').replace(',', '.');
        const unitPrice = parseFloat(cleanPrice) || 0;
        const totalPrice = unitPrice * quantity;
        
        // Formatuj z dwoma miejscami po przecinku
        totalPriceElement.textContent = totalPrice.toFixed(2).replace('.', ',') + ' PLN';
        
        // Jeśli jest element podsumowania, aktualizuj go
        const summaryElement = document.querySelector('.price-summary');
        if (summaryElement) {
            summaryElement.innerHTML = `
                <div>Cena jednostkowa: ${unitPrice.toFixed(2).replace('.', ',')} PLN</div>
                <div>Ilość: ${quantity}</div>
                <div style="font-weight: bold; margin-top: 5px;">Razem: ${totalPrice.toFixed(2).replace('.', ',')} PLN</div>
            `;
        }
    }
    
    // 6. INICJALIZACJA ZOOM
    setupZoom();
    
    // 7. DODATKOWE FUNKCJE DLA SKLEPU
    function addToCart(productId, productName, price) {
        // Pobierz aktualny koszyk z localStorage
        let cart = JSON.parse(localStorage.getItem('cart')) || [];
        
        // Sprawdź czy produkt już jest w koszyku
        const existingIndex = cart.findIndex(item => item.id === productId);
        
        if (existingIndex > -1) {
            // Zwiększ ilość
            cart[existingIndex].quantity += 1;
        } else {
            // Dodaj nowy produkt
            cart.push({
                id: productId,
                name: productName,
                price: price,
                quantity: 1,
                timestamp: new Date().toISOString()
            });
        }
        
        // Zapisz koszyk
        localStorage.setItem('cart', JSON.stringify(cart));
        
        // Aktualizuj ikonę koszyka
        updateCartIcon();
        
        // Powiadomienie
        showNotification(`Dodano "${productName}" do koszyka!`);
        
        console.log('🛒 Koszyk zaktualizowany:', cart);
    }
    
    function updateCartIcon() {
        const cartIcon = document.querySelector('.cart-icon');
        if (!cartIcon) return;
        
        const cart = JSON.parse(localStorage.getItem('cart')) || [];
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        
        // Znajdź lub stwórz badge
        let badge = cartIcon.querySelector('.cart-badge');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'cart-badge';
            cartIcon.appendChild(badge);
        }
        
        if (totalItems > 0) {
            badge.textContent = totalItems;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }
    
    function showNotification(message) {
        // Stwórz element powiadomienia
        const notification = document.createElement('div');
        notification.className = 'cart-notification';
        notification.innerHTML = `
            <div style="
                position: fixed;
                top: 20px;
                right: 20px;
                background: #4CAF50;
                color: white;
                padding: 15px 25px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 10000;
                animation: slideIn 0.3s ease;
            ">
                ${message}
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Usuń po 3 sekundach
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
        
        // Dodaj style animacji jeśli nie istnieją
        if (!document.querySelector('#notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    // 8. OBSŁUGA DODAWANIA DO KOSZYKA
    const addToCartBtn = document.querySelector('.add-to-cart-btn');
    if (addToCartBtn) {
        addToCartBtn.addEventListener('click', function() {
            const productId = this.dataset.productId || 'unknown';
            const productName = document.querySelector('.product-title')?.textContent || 'Produkt';
            const productPriceElement = document.querySelector('.current-price');
            const priceText = productPriceElement?.textContent.trim() || '0';
            const cleanPrice = priceText.replace(/[^\d,.]/g, '').replace(',', '.');
            const price = parseFloat(cleanPrice) || 0;
            
            addToCart(productId, productName, price);
        });
    }
    
    // 9. INICJALIZACJA IKONY KOSZYKA PO ZAŁADOWANIU STRONY
    updateCartIcon();
    
    // 10. DEBUG INFO
    console.log('✅ Skrypt kupowanie.js zainicjalizowany pomyślnie');
});
