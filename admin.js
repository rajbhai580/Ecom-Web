import { db, auth } from './firebase.js';
import {
    // Authentication
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
    // Firestore
    collection,
    addDoc,
    getDocs,
    doc,
    setDoc,
    deleteDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const loginSection = document.getElementById('login-section');
    const dashboardSection = document.getElementById('dashboard-section');

    // Check user's auth state
    onAuthStateChanged(auth, user => {
        if (user) {
            loginSection.classList.remove('active');
            dashboardSection.classList.add('active');
            initDashboard();
        } else {
            dashboardSection.classList.remove('active');
            loginSection.classList.add('active');
        }
    });

    // Login logic
    const loginBtn = document.getElementById('admin-login-btn');
    loginBtn.addEventListener('click', async () => {
        const email = document.getElementById('admin-email').value;
        const password = document.getElementById('admin-password').value;
        const errorP = document.getElementById('login-error');
        try {
            await signInWithEmailAndPassword(auth, email, password);
            errorP.textContent = '';
        } catch (error) {
            errorP.textContent = error.message;
        }
    });

    // Logout logic
    const logoutBtn = document.getElementById('admin-logout-btn');
    logoutBtn.addEventListener('click', () => {
        signOut(auth);
    });
});

function initDashboard() {
    const navButtons = document.querySelectorAll('#admin-nav button');
    const contentViews = document.querySelectorAll('.content-view');

    // Navigation
    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetViewId = button.dataset.view;
            contentViews.forEach(view => {
                view.style.display = view.id === targetViewId ? 'block' : 'none';
            });
            navButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
        });
    });

    // Default view
    document.querySelector('#admin-nav button[data-view="categories-view"]').click();
    
    // Initialize all management sections
    manageCategories();
    manageProducts();
    manageOrders();
}

// --- CATEGORY MANAGEMENT ---
async function manageCategories() {
    const form = document.getElementById('category-form');
    const listContainer = document.getElementById('category-list-container');
    const idField = document.getElementById('category-id');
    const nameField = document.getElementById('category-name');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = idField.value;
        const name = nameField.value;
        if (!name) return;

        if (id) { // Update
            await setDoc(doc(db, "categories", id), { name });
        } else { // Create
            await addDoc(collection(db, "categories"), { name });
        }
        form.reset();
        renderCategories();
    });

    async function renderCategories() {
        const querySnapshot = await getDocs(collection(db, "categories"));
        listContainer.innerHTML = '';
        querySnapshot.forEach((doc) => {
            const category = { id: doc.id, ...doc.data() };
            const item = document.createElement('div');
            item.className = 'list-item';
            item.innerHTML = `
                <span>${category.name}</span>
                <div class="item-actions">
                    <button class="edit-btn" data-id="${category.id}" data-name="${category.name}">Edit</button>
                    <button class="delete-btn" data-id="${category.id}">Delete</button>
                </div>
            `;
            listContainer.appendChild(item);
        });
    }

    listContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('edit-btn')) {
            idField.value = e.target.dataset.id;
            nameField.value = e.target.dataset.name;
        }
        if (e.target.classList.contains('delete-btn')) {
            const id = e.target.dataset.id;
            if (confirm('Are you sure you want to delete this category?')) {
                deleteDoc(doc(db, "categories", id)).then(renderCategories);
            }
        }
    });

    renderCategories();
}

// --- PRODUCT MANAGEMENT ---
async function manageProducts() {
    const form = document.getElementById('product-form');
    const listContainer = document.getElementById('product-list-container');
    const categorySelect = document.getElementById('product-category');

    // Populate category dropdown
    const catSnapshot = await getDocs(collection(db, "categories"));
    categorySelect.innerHTML = '<option value="">Select Category</option>';
    catSnapshot.forEach(doc => {
        categorySelect.innerHTML += `<option value="${doc.data().name}">${doc.data().name}</option>`;
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const product = {
            name: form['product-name'].value,
            description: form['product-description'].value,
            price: parseFloat(form['product-price'].value),
            imageUrl: form['product-image-url'].value,
            category: form['product-category'].value,
        };
        const id = form['product-id'].value;
        
        if (id) {
            await setDoc(doc(db, "products", id), product);
        } else {
            await addDoc(collection(db, "products"), product);
        }
        form.reset();
        renderProducts();
    });
    
     async function renderProducts() {
        const querySnapshot = await getDocs(collection(db, "products"));
        listContainer.innerHTML = '';
        querySnapshot.forEach((doc) => {
            const product = { id: doc.id, ...doc.data() };
            const item = document.createElement('div');
            item.className = 'list-item';
            item.innerHTML = `
                <span>${product.name} - $${product.price}</span>
                <div class="item-actions">
                    <button class="edit-btn" data-id="${doc.id}">Edit</button>
                    <button class="delete-btn" data-id="${doc.id}">Delete</button>
                </div>`;
            listContainer.appendChild(item);

            item.querySelector('.edit-btn').addEventListener('click', () => {
                form['product-id'].value = product.id;
                form['product-name'].value = product.name;
                form['product-description'].value = product.description;
                form['product-price'].value = product.price;
                form['product-image-url'].value = product.imageUrl;
                form['product-category'].value = product.category;
            });
             item.querySelector('.delete-btn').addEventListener('click', () => {
                 if (confirm('Are you sure?')) {
                    deleteDoc(doc(db, "products", product.id)).then(renderProducts);
                 }
            });
        });
    }
    renderProducts();
}


// --- ORDER MANAGEMENT ---
async function manageOrders() {
    const listContainer = document.getElementById('order-list-container');
    
    async function renderOrders() {
        const querySnapshot = await getDocs(collection(db, "orders"));
        listContainer.innerHTML = '';
        querySnapshot.forEach(doc => {
            const order = { id: doc.id, ...doc.data() };
            const item = document.createElement('div');
            item.className = 'order-item';
            
            let productsHtml = order.products.map(p => `<li>${p.name} (Qty: ${p.quantity})</li>`).join('');

            item.innerHTML = `
                <p><strong>Order ID:</strong> ${order.id}</p>
                <p><strong>Customer:</strong> ${order.customerEmail}</p>
                <p><strong>Total:</strong> $${order.total.toFixed(2)}</p>
                <p><strong>Status:</strong> 
                    <select class="order-status-selector" data-id="${order.id}">
                        <option value="Pending" ${order.status === 'Pending' ? 'selected' : ''}>Pending</option>
                        <option value="Paid" ${order.status === 'Paid' ? 'selected' : ''}>Paid</option>
                        <option value="Delivered" ${order.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
                    </select>
                </p>
                <p><strong>Products:</strong></p>
                <ul>${productsHtml}</ul>
                <p><strong>Payment Link:</strong> ${order.paymentLink || 'Not Generated'}</p>
                <button class="generate-link-btn" data-id="${order.id}" data-amount="${order.total}">Generate Payment Link</button>
            `;
            listContainer.appendChild(item);
        });
    }

    listContainer.addEventListener('click', async e => {
        // Generate Razorpay Link
        if (e.target.classList.contains('generate-link-btn')) {
            const orderId = e.target.dataset.id;
            const amount = e.target.dataset.amount;
            
            // **গুরুত্বপূর্ণ:** এখানে সরাসরি API কল করা নিরাপদ নয়। 
            // এটি Firebase Function এর মাধ্যমে করতে হবে।
            // আপাতত আমরা একটি ডেমো লিঙ্ক তৈরি করছি।
            const razorpayLink = prompt(`Generating link for Order ${orderId} of amount $${amount}. \nEnter mock payment link:`, `https://rzp.io/i/mock${orderId}`);
            
            if (razorpayLink) {
                await updateDoc(doc(db, "orders", orderId), {
                    paymentLink: razorpayLink
                });
                renderOrders();
            }
        }
    });
    
    listContainer.addEventListener('change', async e => {
        // Update Order Status
        if (e.target.classList.contains('order-status-selector')) {
            const orderId = e.target.dataset.id;
            const newStatus = e.target.value;
            await updateDoc(doc(db, "orders", orderId), {
                status: newStatus
            });
            alert('Status updated!');
        }
    });

    renderOrders();
}
