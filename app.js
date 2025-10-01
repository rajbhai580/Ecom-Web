import { db } from './firebase.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

let allProducts = [];
let cart = JSON.parse(localStorage.getItem('cart')) || [];

// --- ডেটাবেস থেকে ডেটা লোড করার ফাংশন ---
async function loadCategoriesFromDB() {
    const container = document.getElementById('category-list');
    const querySnapshot = await getDocs(collection(db, "categories"));
    container.innerHTML = '';
    querySnapshot.forEach(doc => {
        const category = doc.data();
        container.innerHTML += `<div class="category-chip">${category.name}</div>`;
    });
}

async function loadProductsFromDB() {
    const grid = document.getElementById('product-grid');
    const querySnapshot = await getDocs(collection(db, "products"));
    allProducts = [];
    querySnapshot.forEach(doc => {
        allProducts.push({ id: doc.id, ...doc.data() });
    });
    renderProducts(allProducts);
}

// --- রেন্ডার ফাংশন ---
function renderProducts(productsToRender) {
    const grid = document.getElementById('product-grid');
    grid.innerHTML = productsToRender.map(p => `
        <div class="product-card" data-id="${p.id}">
            <button class="wishlist-btn"><i class="far fa-heart"></i></button>
            <img src="${p.imageUrl}" alt="${p.name}">
            <p class="brand">${p.category}</p>
            <p class="name">${p.name}</p>
            <div class="price-add">
                <span class="price">$${p.price.toFixed(2)}</span>
                <button class="add-btn" data-id="${p.id}">+</button>
            </div>
        </div>
    `).join('');
}
function renderProductDetails(productId) {
    const product = mockProducts.find(p => p.id === productId);
    const container = document.getElementById('product-detail-content');
    container.innerHTML = `
        <img src="${product.imageUrl}" alt="${product.name}" class="product-image-lg">
        <div class="product-info">
            <h5>${product.brand}</h5>
            <h2>${product.name}</h2>
            <div class="rating">
                <i class="fas fa-star"></i>
                <span>${product.rating} (${product.reviews} Reviews)</span>
            </div>
            <div class="product-price-details">
                <span class="current-price">$${product.price.toFixed(2)} USD</span>
                ${product.originalPrice ? `<span class="original-price">$${product.originalPrice.toFixed(2)}</span>` : ''}
                ${product.originalPrice ? `<span class="discount-tag">-${Math.round((1 - product.price / product.originalPrice) * 100)}%</span>` : ''}
            </div>
             <div class="product-variants horizontal-scroll">
                <button class="variant-btn">30ml</button>
                <button class="variant-btn selected">100ml</button>
            </div>
            <div class="product-info-row"><i class="fas fa-check-circle" style="color: var(--primary-color);"></i> In stock</div>
            <p class="product-description">An exfoliating toner for targeting dullness, texture and signs of aging. Suited to all skin types.</p>
            <div class="info-accordion"><span>Description</span> <i class="fas fa-chevron-right"></i></div>
            <div class="info-accordion"><span>Ingredients</span> <i class="fas fa-chevron-right"></i></div>
            <div class="info-accordion"><span>How to use</span> <i class="fas fa-chevron-right"></i></div>
        </div>
    `;
    document.getElementById('add-to-cart-details-btn').dataset.id = productId;
}

function renderCart() {
    const container = document.getElementById('cart-items-container');
    if (cart.length === 0) {
        container.innerHTML = '<p>Your cart is empty.</p>';
        return;
    }
    container.innerHTML = cart.map(item => {
        const product = mockProducts.find(p => p.id === item.id);
        return `
            <div class="cart-item">
                <img src="${product.imageUrl}" alt="${product.name}">
                <div class="cart-item-info">
                    <h4>${product.name}</h4>
                    <p>${product.description || ''}</p>
                    <div class="cart-item-actions">
                        <strong>$${(product.price * item.quantity).toFixed(2)}</strong>
                        <div class="quantity-stepper">
                            <button data-id="${item.id}" class="quantity-change" data-change="-1">-</button>
                            <span>${item.quantity}</span>
                            <button data-id="${item.id}" class="quantity-change" data-change="1">+</button>
                        </div>
                    </div>
                </div>
                <i class="fas fa-times remove-item-btn" data-id="${item.id}"></i>
            </div>
        `;
    }).join('');
    updateCartTotal();
}

function updateCartTotal() {
    const total = cart.reduce((sum, item) => {
        const product = mockProducts.find(p => p.id === item.id);
        return sum + (product.price * item.quantity);
    }, 0);
    document.getElementById('cart-total-price').textContent = `$${total.toFixed(2)} USD`;
    document.getElementById('cart-badge-count').textContent = cart.reduce((sum, item) => sum + item.quantity, 0);
}


// --- VIEW SWITCHING LOGIC ---
function switchView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => {
        n.classList.toggle('active', n.dataset.view === viewId);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    loadCategoriesFromDB();
    loadProductsFromDB();
    updateCartTotal(); // Load cart count on page load

    // Bottom Navigation
    document.querySelector('.bottom-nav').addEventListener('click', (e) => {
        const navItem = e.target.closest('.nav-item');
        if (navItem && navItem.dataset.view) {
            e.preventDefault();
            switchView(navItem.dataset.view);
            if (navItem.dataset.view === 'cart-view') {
                renderCart();
            }
        }
    });
    
    // Product Clicks
    document.getElementById('product-grid').addEventListener('click', (e) => {
        const card = e.target.closest('.product-card');
        const addBtn = e.target.closest('.add-btn');

        if (addBtn) {
            const productId = addBtn.dataset.id;
            addToCart(productId);
        } else if (card) {
            const productId = card.dataset.id;
            renderProductDetails(productId);
            switchView('details-view');
        }
    });
    
    // Back Buttons
    document.getElementById('back-to-home-btn').addEventListener('click', () => switchView('home-view'));
    document.getElementById('back-from-cart-btn').addEventListener('click', () => switchView('home-view'));

    // Details Page Add to Cart
    document.getElementById('add-to-cart-details-btn').addEventListener('click', (e) => {
        addToCart(e.target.dataset.id);
    });

    // Cart Actions
    document.getElementById('cart-items-container').addEventListener('click', (e) => {
        if (e.target.closest('.quantity-change')) {
            const btn = e.target.closest('.quantity-change');
            updateQuantity(btn.dataset.id, parseInt(btn.dataset.change));
        }
        if (e.target.closest('.remove-item-btn')) {
            removeFromCart(e.target.closest('.remove-item-btn').dataset.id);
        }
    });
});

// --- CART LOGIC ---
function addToCart(productId) {
    const existingItem = cart.find(item => item.id === productId);
    if (existingItem) {
        existingItem.quantity++;
    } else {
        cart.push({ id: productId, quantity: 1 });
    }
    updateCartTotal();
    console.log('Cart:', cart);
}

function updateQuantity(productId, change) {
    const item = cart.find(item => item.id === productId);
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) {
            removeFromCart(productId);
        } else {
            renderCart();
        }
    }
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    renderCart();
}
