// This is a simplified representation. You will need to implement
// the full Firebase interactions (getDocs, addDoc, etc.)

document.addEventListener('DOMContentLoaded', () => {
    // Mock data - replace with Firebase calls
    const products = [
        { id: '1', name: 'Product 1', description: 'Description 1', price: 10, stock: 100, imageUrl: 'https://via.placeholder.com/150', category: 'Category A' },
        { id: '2', name: 'Product 2', description: 'Description 2', price: 20, stock: 50, imageUrl: 'https://via.placeholder.com/150', category: 'Category B' },
    ];

    const productList = document.getElementById('product-list');

    function renderProducts(productsToRender) {
        productList.innerHTML = '';
        productsToRender.forEach(product => {
            const productCard = document.createElement('div');
            productCard.className = 'product-card';
            productCard.innerHTML = `
                <img src="${product.imageUrl}" alt="${product.name}">
                <h3>${product.name}</h3>
                <p>$${product.price}</p>
                <button onclick="viewProduct('${product.id}')">View Details</button>
                <button onclick="addToCart('${product.id}')">Add to Cart</button>
            `;
            productList.appendChild(productCard);
        });
    }

    // Initial render
    renderProducts(products);

    // Navigation
    // Implement logic to show/hide sections based on nav link clicks
});

function viewProduct(productId) {
    // Find product in your data and populate the modal
    alert(`Viewing product ${productId}`);
    // Show the modal
}

function addToCart(productId) {
    // Add product to a cart array (use localStorage or Firestore)
    alert(`Added product ${productId} to cart`);
    // Update cart count
}
