import { db, auth } from './firebase.js';

import {
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";

import {
    collection,
    addDoc,
    getDocs,
    doc,
    setDoc,
    deleteDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// Main execution block. Halts if Firebase fails to initialize.
if (!db || !auth) {
    console.error("Halting admin script: Firebase did not initialize correctly (db or auth is missing).");
} else {
    
    document.addEventListener('DOMContentLoaded', () => {
        const loginSection = document.getElementById('login-section');
        const dashboardSection = document.getElementById('dashboard-section');

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

        const loginBtn = document.getElementById('admin-login-btn'); 
        loginBtn.addEventListener('click', async () => {
            const email = document.getElementById('admin-email').value;
            const password = document.getElementById('admin-password').value;
            const errorP = document.getElementById('login-error');
            errorP.textContent = '';

            try {
                await signInWithEmailAndPassword(auth, email, password);
            } catch (error) {
                console.error("Login failed:", error.message);
                 if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
                    errorP.textContent = "Invalid email or password.";
                } else {
                    errorP.textContent = "An error occurred during login.";
                }
            }
        });

        const logoutBtn = document.getElementById('admin-logout-btn');
        logoutBtn.addEventListener('click', () => {
            signOut(auth);
        });
    });

    function initDashboard() {
        const navButtons = document.querySelectorAll('#admin-nav button');
        const contentViews = document.querySelectorAll('.content-view');

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

        // Set the default view to Categories
        document.querySelector('#admin-nav button[data-view="categories-view"]').click();
        
        // Initialize all management sections
        manageCategories();
        manageProducts();
        manageCustomers();
        manageOrders();
    }
    
    async function manageCategories() {
        const form = document.getElementById('category-form');
        const listContainer = document.getElementById('category-list-container');
        const idField = document.getElementById('category-id');
        const nameField = document.getElementById('category-name');
        const catCollection = collection(db, "categories");
    
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = idField.value;
            const name = nameField.value.trim();
            if (!name) return;
    
            try {
                if (id) {
                    await setDoc(doc(db, "categories", id), { name });
                } else {
                    await addDoc(catCollection, { name });
                }
                form.reset();
                idField.value = '';
                await renderCategories();
            } catch (error) {
                console.error("Error saving category:", error);
            }
        });
    
        async function renderCategories() {
            const querySnapshot = await getDocs(catCollection);
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
    
        listContainer.addEventListener('click', async (e) => {
            const target = e.target;
            if (target.classList.contains('edit-btn')) {
                idField.value = target.dataset.id;
                nameField.value = target.dataset.name;
            }
            if (target.classList.contains('delete-btn')) {
                const id = target.dataset.id;
                if (confirm('Are you sure you want to delete this category?')) {
                    try {
                        await deleteDoc(doc(db, "categories", id));
                        await renderCategories();
                    } catch (error) {
                        console.error("Error deleting category:", error);
                    }
                }
            }
        });
    
        await renderCategories();
    }
    
    async function manageProducts() {
        const form = document.getElementById('product-form');
        const listContainer = document.getElementById('product-list-container');
        const categorySelect = document.getElementById('product-category');
        const prodCollection = collection(db, "products");
    
        async function populateCategoryDropdown() {
            const catSnapshot = await getDocs(collection(db, "categories"));
            const currentValue = categorySelect.value;
            categorySelect.innerHTML = '<option value="">Select Category</option>';
            catSnapshot.forEach(doc => {
                categorySelect.innerHTML += `<option value="${doc.data().name}">${doc.data().name}</option>`;
            });
            categorySelect.value = currentValue;
        }
    
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const originalPriceValue = form['product-original-price'].value;
            const product = {
                name: form['product-name'].value.trim(),
                description: form['product-description'].value.trim(),
                price: parseFloat(form['product-price'].value),
                originalPrice: originalPriceValue ? parseFloat(originalPriceValue) : null,
                imageUrl: form['product-image-url'].value.trim(),
                paymentLink: form['product-payment-link'].value.trim(),
                category: form['product-category'].value,
            };
            const id = form['product-id'].value;
    
            if (!product.name || !product.price || !product.imageUrl || !product.category || !product.paymentLink) {
                alert("Please fill all required fields, including Payment Link.");
                return;
            }
            
            try {
                if (id) {
                    await setDoc(doc(db, "products", id), product);
                } else {
                    await addDoc(prodCollection, product);
                }
                form.reset();
                form['product-id'].value = '';
                await renderProducts();
            } catch(error) {
                console.error("Error saving product:", error);
            }
        });
        
        async function renderProducts() {
            await populateCategoryDropdown(); 
            const querySnapshot = await getDocs(prodCollection);
            listContainer.innerHTML = '';
            querySnapshot.forEach((doc) => {
                const product = { id: doc.id, ...doc.data() };
                const item = document.createElement('div');
                item.className = 'list-item';
                item.innerHTML = `
                    <span>${product.name} - ₹${product.price}</span>
                    <div class="item-actions">
                        <button class="edit-btn" data-id="${doc.id}">Edit</button>
                        <button class="delete-btn" data-id="${doc.id}">Delete</button>
                    </div>`;
                listContainer.appendChild(item);
    
                item.querySelector('.edit-btn').addEventListener('click', () => {
                    form['product-id'].value = product.id;
                    form['product-name'].value = product.name;
                    form['product-description'].value = product.description;
                    form['product-original-price'].value = product.originalPrice || '';
                    form['product-price'].value = product.price;
                    form['product-image-url'].value = product.imageUrl;
                    form['product-payment-link'].value = product.paymentLink;
                    form['product-category'].value = product.category;
                    window.scrollTo(0, 0); 
                });
    
                item.querySelector('.delete-btn').addEventListener('click', async () => {
                    if (confirm('Are you sure you want to delete this product?')) {
                        try {
                            await deleteDoc(doc(db, "products", product.id));
                            await renderProducts();
                        } catch (error) {
                            console.error("Error deleting product: ", error);
                        }
                    }
                });
            });
        }
        
        await renderProducts();
    }
    
    // NEW FUNCTION TO MANAGE CUSTOMERS
    async function manageCustomers() {
        const listContainer = document.getElementById('customer-list-container');
        const customerCollection = collection(db, "customers");

        async function renderCustomers() {
            const querySnapshot = await getDocs(customerCollection);
            if (querySnapshot.empty) {
                listContainer.innerHTML = '<p>No customers or leads found.</p>';
                return;
            }
            listContainer.innerHTML = '';
            querySnapshot.forEach(doc => {
                const customer = { id: doc.id, ...doc.data() };
                const item = document.createElement('div');
                item.className = 'list-item';
                item.innerHTML = `
                    <span><strong>Name:</strong> ${customer.name}</span>
                    <span><strong>Phone:</strong> ${customer.phone}</span>
                `;
                listContainer.appendChild(item);
            });
        }

        await renderCustomers();
    }

    async function manageOrders() {
        const listContainer = document.getElementById('order-list-container');
        
        async function renderOrders() {
            const querySnapshot = await getDocs(collection(db, "orders"));
            if (querySnapshot.empty) {
                listContainer.innerHTML = '<p>No orders found yet.</p>';
                return;
            }
            listContainer.innerHTML = '';
            querySnapshot.forEach(doc => {
                const order = { id: doc.id, ...doc.data() };
                const item = document.createElement('div');
                item.className = 'order-item';
                
                let productsHtml = order.products.map(p => `<li>${p.name} (Qty: ${p.quantity})</li>`).join('');
    
                item.innerHTML = `
                    <p><strong>Order ID:</strong> ${order.id}</p>
                    <p><strong>Customer:</strong> ${order.customerEmail || 'N/A'}</p>
                    <p><strong>Total:</strong> ₹${order.total.toFixed(2)}</p>
                    <p><strong>Status:</strong> 
                        <select class="order-status-selector" data-id="${order.id}">
                            <option value="Pending" ${order.status === 'Pending' ? 'selected' : ''}>Pending</option>
                            <option value="Paid" ${order.status === 'Paid' ? 'selected' : ''}>Paid</option>
                            <option value="Delivered" ${order.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
                        </select>
                    </p>
                    <p><strong>Products:</strong></p>
                    <ul>${productsHtml}</ul>
                `;
                listContainer.appendChild(item);
            });
        }
    
        listContainer.addEventListener('change', async e => {
            if (e.target.classList.contains('order-status-selector')) {
                const orderId = e.target.dataset.id;
                const newStatus = e.target.value;
                await updateDoc(doc(db, "orders", orderId), {
                    status: newStatus
                });
                alert('Status updated!');
            }
        });
    
        await renderOrders();
    }
}
