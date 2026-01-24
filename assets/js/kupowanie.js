
    // 1. ZMIANA ZDJĘCIA PO KLIKNIĘCIU W MINIATURĘ
    function changeImage(thumbnail) {
      const mainImg = document.getElementById('MainImg');
      
      // Zmień źródło zdjęcia głównego
      mainImg.src = thumbnail.src;
      
      // Obsługa klasy 'active' na miniaturach
      document.querySelectorAll('.thumbnail').forEach(el => el.classList.remove('active'));
      thumbnail.classList.add('active');
    }

    // 2. SKRYPT ZOOM (LUPA)
    function zoom(e) {
      const zoomer = e.currentTarget;
      const img = document.getElementById('MainImg');
      
      // Oblicz pozycję myszki wewnątrz kontenera
      offsetX = e.offsetX;
      offsetY = e.offsetY;
      x = offsetX / zoomer.offsetWidth * 100;
      y = offsetY / zoomer.offsetHeight * 100;

      // Przesuń i powiększ zdjęcie
      img.style.transformOrigin = x + '% ' + y + '%';
      img.style.transform = "scale(2.5)"; // Siła przybliżenia (2.5x)
    }

    function resetZoom() {
      const img = document.getElementById('MainImg');
      img.style.transform = "scale(1)";
      setTimeout(() => {
        img.style.transformOrigin = "center center";
      }, 200);
    }

  document.getElementById('buy-now-btn').addEventListener('click', function() {
    // Pobierz dane produktu
    const productName = document.querySelector('.product-title').textContent;
    const productPrice = document.querySelector('.current-price').textContent;
    const productImage = document.getElementById('MainImg').src;
    
    // Przygotuj URL z parametrami
    const paymentUrl = '/payment.html?' + new URLSearchParams({
      name: encodeURIComponent(productName),
      price: productPrice.replace(/[^0-9.,]/g, '').replace(',', '.'),
      image: encodeURIComponent(productImage),
      quantity: document.querySelector('.qty-input') ? document.querySelector('.qty-input').value : '1'
    }).toString();
    
    // Przekieruj do strony płatności
    window.location.href = paymentUrl;
  });


