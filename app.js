import { db } from './firebase.js';
import { collection, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

let allProducts = [];

// --- CORE LOGIC ---
document.addEventListener('DOMContentLoaded', () => {
    checkUserDetails();
    loadData();
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('user-details-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('user-name-input').value.trim();
        const phone = document.getElementById('user-phone-input').value.trim();
        if (name && phone) saveUserDetails(name, phone);
    });
    document.getElementById('product-grid').addEventListener('click', handleProductGridClick);
    document.getElementById('buy-now-btn').addEventListener('click', (e) => handleBuyNow(e.target.dataset.id));
    document.querySelector('.bottom-nav').addEventListener('click', handleNavigation);
    document.querySelectorAll('.back-to-home').forEach(btn => btn.addEventListener('click', () => switchView('home-view')));
}

// --- USER & GREETING ---
function checkUserDetails() {
    const userName = localStorage.getItem('customerName');
    if (userName) {
        greetUser(userName);
    } else {
        document.getElementById('user-details-modal').classList.remove('hidden');
    }
}
function greetUser(name) { document.getElementById('user-greeting-name').textContent = name; }
function saveUserDetails(name, phone) {
    localStorage.setItem('customerName', name);
    localStorage.setItem('customerPhone', phone);
    greetUser(name);
    document.getElementById('user-details-modal').classList.add('hidden');
}

// --- DATA FETCHING ---
async function loadData() {
    await loadBannersFromDB();
    await loadCategoriesFromDB();
    await loadProductsFromDB();
}
async function loadBannersFromDB() {
    const container = document.getElementById('promo-carousel');
    const q = query(collection(db, "banners"), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) { container.parentElement.style.display = 'none'; return; }
    container.innerHTML = '';
    querySnapshot.forEach(doc => {
        container.innerHTML += `<div class="carousel-slide"><img src="${doc.data().imageUrl}" alt="Promotional Banner"></div>`;
    });
    initCarousel();
}
async function loadCategoriesFromDB() {
    const container = document.getElementById('category-list-short');
    const q = query(collection(db, "categories"));
    const querySnapshot = await getDocs(q);
    container.innerHTML = '';
    querySnapshot.forEach(doc => {
        container.innerHTML += `<div class="category-chip">${doc.data().name}</div>`;
    });
}
async function loadProductsFromDB() {
    const grid = document.getElementById('product-grid');
    grid.innerHTML = "<p>Loading products...</p>";
    allProducts = [];
    const querySnapshot = await getDocs(collection(db, "products"));
    querySnapshot.forEach(doc => allProducts.push({ id: doc.id, ...doc.data() }));
    renderProducts(allProducts);
}

// --- "MY ORDERS" PAGE LOGIC ---
async function loadCustomerOrders() {
    const container = document.getElementById('customer-orders-list');
    const customerPhone = localStorage.getItem('customerPhone');
    if (!customerPhone) {
        container.innerHTML = "<p>Your orders will appear here after you make a purchase.</p>";
        return;
    }
    container.innerHTML = "<p>Loading your orders...</p>";
    try {
        const ordersRef = collection(db, "orders");
        const q = query(ordersRef, where("customerPhone", "==", customerPhone), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            container.innerHTML = "<p>You haven't placed any orders yet.</p>";
            return;
        }
        container.innerHTML = '';
        querySnapshot.forEach(doc => {
            const order = doc.data();
            const orderDate = order.createdAt.toDate().toLocaleDateString();
            container.innerHTML += `
                <div class="customer-order-card">
                    <h4>${order.productName}</h4>
                    <p>Amount: ₹${order.amount.toFixed(2)}</p>
                    <p>Date: ${orderDate}</p>
                    <p>Status: <span class="order-status ${order.status}">${order.status}</span></p>
                </div>`;
        });
    } catch (error) {
        console.error("Error loading orders:", error);
        container.innerHTML = "<p>Could not load your orders.</p>";
    }
}

// --- "BUY NOW" WORKFLOW ---
function handleBuyNow(productId) {
    const customerName = localStorage.getItem('customerName');
    const customerPhone = localStorage.getItem('customerPhone');
    if (!customerName || !customerPhone) {
        alert("Please provide your details first.");
        checkUserDetails();
        return;
    }
    const product = allProducts.find(p => p.id === productId);
    if (!product || !product.paymentLink) {
        alert("Sorry, this product cannot be purchased right now.");
        return;
    }
    
    // NEW SIMPLER LOGIC: Add customer and product info to the link
    // and redirect immediately. No "pending" orders are created.
    const paymentUrl = new URL(product.paymentLink);
    // Add info for the webhook to use later
    paymentUrl.searchParams.set('notes[product_id]', product.id);
    paymentUrl.searchParams.set('notes[product_name]', product.name);
    paymentUrl.searchParams.set('notes[customer_name]', customerName);
    paymentUrl.searchParams.set('notes[customer_phone]', customerPhone);
    // Pre-fill the form for a better user experience
    paymentUrl.searchParams.set('prefill[name]', customerName);
    paymentUrl.searchParams.set('prefill[contact]', customerPhone);
    
    console.log("Redirecting to Razorpay...");
    window.location.href = paymentUrl.toString();
}

// --- UI & NAVIGATION ---
function handleProductGridClick(e) {
    const buyBtn = e.target.closest('.buy-now-grid-btn');
    const card = e.target.closest('.product-card');
    if (buyBtn) { handleBuyNow(buyBtn.dataset.id); } 
    else if (card) { renderProductDetails(card.dataset.id); switchView('details-view'); }
}
function handleNavigation(e) {
    const navItem = e.target.closest('.nav-item');
    if (!navItem) return;
    const viewId = navItem.dataset.view;
    if (viewId === 'orders-view') {
        loadCustomerOrders();
    }
    switchView(viewId);
}
function switchView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId)?.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === viewId));
}
function renderProducts(products) {
    const grid = document.getElementById('product-grid');
    if (!products || products.length === 0) {
        grid.innerHTML = "<p>No products found. Add products in the admin panel.</p>";
        return;
    }
    grid.innerHTML = products.map(p => {
        let priceHTML = `<span class="current-price">₹${p.price.toFixed(2)}</span>`;
        let discountTag = '';
        if (p.originalPrice && p.originalPrice > p.price) {
            const discount = Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100);
            priceHTML += `<span class="original-price">₹${p.originalPrice.toFixed(2)}</span>`;
            discountTag = `<span class="discount-tag">${discount}% OFF</span>`;
        }
        return `
        <div class="product-card" data-id="${p.id}">
            <button class="wishlist-btn"><i class="far fa-heart"></i></button>
            <div class="product-image-container"><img src="${p.imageUrl}" alt="${p.name}"></div>
            <p class="brand">${p.category}</p>
            <p class="name">${p.name}</p>
            <div class="price-container">${priceHTML}${discountTag}</div>
            <button class="btn-primary buy-now-grid-btn" data-id="${p.id}">Buy Now</button>
        </div>`;
    }).join('');
}
function renderProductDetails(productId) {
    const product = allProducts.find(p => p.id === productId);
    const container = document.getElementById('product-detail-content');
    let priceHTML = `<span class="current-price" style="font-size: 1.8rem;">₹${product.price.toFixed(2)}</span>`;
    if (product.originalPrice && product.originalPrice > product.price) {
        priceHTML += `<span class="original-price" style="font-size: 1.2rem;">₹${product.originalPrice.toFixed(2)}</span>`;
    }
    let imageCarouselHTML = `<div class="carousel-container detail-image-carousel">`;
    product.imageUrls.forEach(url => {
        imageCarouselHTML += `<div class="carousel-slide"><img src="${url}" alt="${product.name}" class="product-image-lg"></div>`;
    });
    imageCarouselHTML += `</div>`;
    container.innerHTML = `
        ${imageCarouselHTML}
        <div class="product-info">
            <h5>${product.category}</h5>
            <h2>${product.name}</h2>
            <div class="price-container">${priceHTML}</div>
            <p class="product-description">${product.description || ''}</p>
        </div>`;
    document.getElementById('buy-now-btn').dataset.id = productId;
}
function initCarousel() {
    const carousel = document.getElementById('promo-carousel');
    const dotsContainer = document.getElementById('carousel-dots');
    const slides = carousel.querySelectorAll('.carousel-slide');
    if (slides.length <= 1) { dotsContainer.style.display = 'none'; return; }
    dotsContainer.innerHTML = '';
    slides.forEach((_, index) => {
        dotsContainer.innerHTML += `<div class="dot ${index === 0 ? 'active' : ''}" data-index="${index}"></div>`;
    });
    const dots = dotsContainer.querySelectorAll('.dot');
    let currentIndex = 0;
    const totalSlides = slides.length;
    function updateCarousel() {
        carousel.scrollTo({ left: slides[currentIndex].offsetLeft, behavior: 'smooth' });
        dots.forEach(dot => dot.classList.remove('active'));
        dots[currentIndex].classList.add('active');
    }
    setInterval(() => {
        currentIndex = (currentIndex + 1) % totalSlides;
        updateCarousel();
    }, 4000);
}
