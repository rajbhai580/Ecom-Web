import { db } from './firebase.js';
import { collection, getDocs, doc, getDoc, addDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

let allProducts = [];
let cart = JSON.parse(localStorage.getItem('cart')) || [];

// --- DATABASE FETCHING FUNCTIONS ---
async function loadCategoriesFromDB() {
    const container = document.getElementById('category-list');
    try {
        const querySnapshot = await getDocs(collection(db, "categories"));
        container.innerHTML = '';
        querySnapshot.forEach(doc => {
            const category = doc.data();
            container.innerHTML += `<div class="category-chip">${category.name}</div>`;
        });
    } catch (error) {
        console.error("Error loading categories:", error);
        container.innerHTML = "<p>Could not load categories.</p>";
    }
}

async function loadProductsFromDB() {
    const grid = document.getElementById('product-grid');
    try {
        const querySnapshot = await getDocs(collection(db, "products"));
        allProducts = []; // Clear previous products
        querySnapshot.forEach(doc => {
            allProducts.push({ id: doc.id, ...doc.data() });
        });
        renderProducts(allProducts);
    } catch (error) {
        console.error("Error loading products:", error);
        grid.innerHTML = "<p>Could not load products.</p>";
    }
}

// --- RENDER FUNCTIONS ---
function renderProducts(productsToRender) {
    const grid = document.getElementById('product-grid');
    if (!productsToRender || productsToRender.length === 0) {
        grid.innerHTML = "<p>No products found. Add products in the admin panel.</p>";
        return;
    }
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
    // FIX #1: Changed 'mockProducts' to 'allProducts'
    const product = allProducts.find(p => p.id === productId);
    if (!product) {
        console.error("Product not found for details view!");
        return;
    }

    const container = document.getElementById('product-detail-content');
    container.innerHTML = `
        <img src="${product.imageUrl}" alt="${product.name}" class="product-image-lg">
        <div class="product-info">
            <h5>${product.category}</h5>
            <h2>${product.name}</h2>
            <div class="product-price-details">
                <span class="current-price">$${product.price.toFixed(2)} USD</span>
            </div>
            <p class="product-description">${product.description || 'No description available.'}</p>
        </div>
    `;
    document.getElementById('add-to-cart-details-btn').dataset.id = productId;
}

function renderCart() {
    const container = document.getElementById('cart-items-container');
    if (cart.length === 0) {
        container.innerHTML = '<p>Your cart is empty.</p>';
        updateCartTotal();
        return;
    }
    container.innerHTML = cart.map(item => {
        // FIX #2: Changed 'mockProducts' to 'allProducts'
        const product = allProducts.find(p => p.id === item.id);
        if (!product) return ''; // If product not found, don't render it in cart

        return `
            <div class="cart-item">
                <img src="${product.imageUrl}" alt="${product.name}">
                <div class="cart-item-info">
                    <h4>${product.name}</h4>
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
        // FIX #3: Changed 'mockProducts' to 'allProducts'
        const product = allProducts.find(p => p.id === item.id);
        if (product) {
            return sum + (product.price * item.quantity);
        }
        return sum; // If product not found, don't add to total
    }, 0);

    const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);

    document.getElementById('cart-total-price').textContent = `$${total.toFixed(2)} USD`;
    const badge = document.getElementById('cart-badge-count');
    badge.textContent = totalQuantity;
    badge.style.display = totalQuantity > 0 ? 'flex' : 'none';
}

// --- VIEW SWITCHING LOGIC ---
function switchView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const targetView = document.getElementById(viewId);
    if (targetView) {
        targetView.classList.add('active');
    }
    document.querySelectorAll('.nav-item').forEach(n => {
        n.classList.toggle('active', n.dataset.view === viewId);
    });
}
window.switchView = switchView;

// --- EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    loadCategoriesFromDB();
    loadProductsFromDB();
    updateCartTotal();

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
    
    document.getElementById('back-to-home-btn').addEventListener('click', () => switchView('home-view'));
    document.getElementById('back-from-cart-btn').addEventListener('click', () => switchView('home-view'));

    document.getElementById('add-to-cart-details-btn').addEventListener('click', (e) => {
        addToCart(e.target.dataset.id);
    });

    document.getElementById('cart-items-container').addEventListener('click', (e) => {
        if (e.target.closest('.quantity-change')) {
            const btn = e.target.closest('.quantity-change');
            updateQuantity(btn.dataset.id, parseInt(btn.dataset.change));
        }
        if (e.target.closest('.remove-item-btn')) {
            removeFromCart(e.target.dataset.id);
        }
    });
});

// --- CART LOGIC ---
function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
}

function addToCart(productId) {
    const existingItem = cart.find(item => item.id === productId);
    if (existingItem) {
        existingItem.quantity++;
    } else {
        cart.push({ id: productId, quantity: 1 });
    }
    saveCart();
    updateCartTotal();
    // Optional: Add a visual confirmation
    alert('Product added to cart!');
}

function updateQuantity(productId, change) {
    const item = cart.find(item => item.id === productId);
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) {
            removeFromCart(productId);
        } else {
            saveCart();
            renderCart();
        }
    }
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    renderCart();
}
