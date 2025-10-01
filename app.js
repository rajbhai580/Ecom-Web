// Start of app.js code
import { db } from './firebase.js';
import { collection, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

let allProducts = [];

// --- USER DETAILS & GREETING ---
function checkUserDetails() {
    const userName = localStorage.getItem('customerName');
    if (userName) {
        greetUser(userName);
    } else {
        document.getElementById('user-details-modal').classList.remove('hidden');
    }
}
function greetUser(name) {
    document.getElementById('user-greeting-name').textContent = name;
}
async function saveUserDetails(name, phone) {
    try {
        await addDoc(collection(db, "customers"), { name, phone });
        localStorage.setItem('customerName', name);
        localStorage.setItem('customerPhone', phone);
        greetUser(name);
        document.getElementById('user-details-modal').classList.add('hidden');
    } catch (error) {
        console.error("Error saving customer details: ", error);
        alert("Could not save details. Please try again.");
    }
}

// --- DATA FETCHING & RENDERING ---
async function loadData() {
    await loadCategoriesFromDB();
    await loadProductsFromDB();
}
async function loadCategoriesFromDB() {
    const shortListContainer = document.getElementById('category-list-short');
    try {
        const querySnapshot = await getDocs(collection(db, "categories"));
        shortListContainer.innerHTML = '';
        querySnapshot.forEach(doc => {
            shortListContainer.innerHTML += `<div class="category-chip">${doc.data().name}</div>`;
        });
    } catch (error) { console.error("Error loading categories:", error); }
}
async function loadProductsFromDB() {
    const grid = document.getElementById('product-grid');
    try {
        const querySnapshot = await getDocs(collection(db, "products"));
        allProducts = [];
        querySnapshot.forEach(doc => allProducts.push({ id: doc.id, ...doc.data() }));
        renderProducts(allProducts);
    } catch (error) { console.error("Error loading products:", error); }
}
function renderProducts(products) {
    const grid = document.getElementById('product-grid');
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
            <img src="${p.imageUrl}" alt="${p.name}">
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
    container.innerHTML = `
        <img src="${product.imageUrl}" alt="${product.name}" class="product-image-lg">
        <div class="product-info">
            <h5>${product.category}</h5>
            <h2>${product.name}</h2>
            <div class="price-container">${priceHTML}</div>
            <p class="product-description">${product.description || ''}</p>
        </div>`;
    document.getElementById('buy-now-btn').dataset.id = productId;
}

// --- "BUY NOW" LOGIC ---
async function handleBuyNow(productId) {
    const product = allProducts.find(p => p.id === productId);
    const customerName = localStorage.getItem('customerName');
    const customerPhone = localStorage.getItem('customerPhone');

    if (!product || !product.paymentLink) {
        alert("Sorry, payment link is not available.");
        return;
    }
    if (!customerName || !customerPhone) {
        alert("Please provide your details first.");
        checkUserDetails();
        return;
    }
    
    try {
        const orderRef = await addDoc(collection(db, "orders"), {
            customerName: customerName,
            customerPhone: customerPhone,
            productName: product.name,
            productId: product.id,
            amount: product.price,
            status: "pending",
            createdAt: new Date()
        });
        
        console.log("Created pending order with ID:", orderRef.id);
        
        // This is the new part that uses your Payment Page link
        const paymentUrl = new URL(product.paymentLink);
        // We can pre-fill the fields for the customer
        paymentUrl.searchParams.set('description', `Order for ${product.name}`);
        paymentUrl.searchParams.set('notes[order_id]', orderRef.id); // This is how the webhook knows the order
        paymentUrl.searchParams.set('prefill[name]', customerName);
        paymentUrl.searchParams.set('prefill[contact]', customerPhone);
        
        window.location.href = paymentUrl.toString();
        
    } catch (error) {
        console.error("Error creating pending order:", error);
        alert("Could not start purchase. Please try again.");
    }
}

// --- EVENT LISTENERS & VIEW SWITCHING ---
document.addEventListener('DOMContentLoaded', () => {
    checkUserDetails();
    loadData();

    document.getElementById('user-details-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('user-name-input').value;
        const phone = document.getElementById('user-phone-input').value;
        saveUserDetails(name, phone);
    });

    document.getElementById('product-grid').addEventListener('click', async (e) => {
        const buyBtn = e.target.closest('.buy-now-grid-btn');
        const card = e.target.closest('.product-card');
        if (buyBtn) { await handleBuyNow(buyBtn.dataset.id); } 
        else if (card) { renderProductDetails(card.dataset.id); switchView('details-view'); }
    });
    
    document.getElementById('buy-now-btn').addEventListener('click', async (e) => {
        await handleBuyNow(e.target.dataset.id);
    });
    
    document.querySelector('.bottom-nav').addEventListener('click', (e) => {
        const navItem = e.target.closest('.nav-item');
        if (navItem) switchView(navItem.dataset.view);
    });
    document.querySelectorAll('.back-to-home').forEach(btn => {
        btn.addEventListener('click', () => switchView('home-view'));
    });
    document.querySelectorAll('.see-all-btn').forEach(btn => {
        btn.addEventListener('click', (e) => { e.preventDefault(); switchView(btn.dataset.view); });
    });
});

function switchView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId)?.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => {
        n.classList.toggle('active', n.dataset.view === viewId);
    });
}
// End of app.js code
