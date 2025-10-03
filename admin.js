import { db, auth } from './firebase.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { collection, addDoc, getDocs, doc, setDoc, deleteDoc, updateDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

const IMGBB_API_KEY = "13aaae548cbbec9e7a5f0a4a6d8eed02"; // <-- REPLACE THIS WITH YOUR REAL KEY

if (!db || !auth) {
    console.error("Halting admin script: Firebase did not initialize correctly.");
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
            try { await signInWithEmailAndPassword(auth, email, password); } catch (error) { errorP.textContent = "Invalid email or password."; }
        });
        const logoutBtn = document.getElementById('admin-logout-btn');
        logoutBtn.addEventListener('click', () => signOut(auth));
    });

    function initDashboard() {
        const navButtons = document.querySelectorAll('#admin-nav button');
        const contentViews = document.querySelectorAll('.content-view');
        navButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetViewId = button.dataset.view;
                contentViews.forEach(view => view.style.display = view.id === targetViewId ? 'block' : 'none');
                navButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
            });
        });
        document.querySelector('#admin-nav button[data-view="orders-view"]').click();
        
        manageCategories();
        manageProducts();
        manageBanners();
        manageCustomers();
        manageOrders();
    }

    async function uploadImageDirectly(file, dropZoneEl) {
        if (!IMGBB_API_KEY || IMGBB_API_KEY === "YOUR_IMGBB_API_KEY") {
            alert("CRITICAL ERROR: ImgBB API Key is not set in admin.js.");
            return null;
        }
        const feedbackEl = document.createElement('div');
        feedbackEl.className = 'upload-feedback';
        feedbackEl.textContent = 'Uploading...';
        dropZoneEl.appendChild(feedbackEl);
        const formData = new FormData();
        formData.append('image', file);
        try {
            const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: formData });
            const result = await response.json();
            if (!response.ok || !result.success) { throw new Error(result.error?.message || 'Upload failed'); }
            feedbackEl.textContent = 'Success!';
            setTimeout(() => feedbackEl.remove(), 1500);
            return result.data.url;
        } catch (error) {
            console.error('Upload error:', error);
            feedbackEl.textContent = 'Upload Failed!';
            setTimeout(() => feedbackEl.remove(), 3000);
            return null;
        }
    }

    function setupDropZone(dropZoneId, isMultiple, onUpload) {
        const dropZoneEl = document.getElementById(dropZoneId);
        if (!dropZoneEl) { return; }
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.multiple = isMultiple;
        fileInput.style.display = 'none';
        dropZoneEl.appendChild(fileInput);
        dropZoneEl.addEventListener('click', () => fileInput.click());
        dropZoneEl.addEventListener('dragover', (e) => { e.preventDefault(); dropZoneEl.classList.add('drag-over'); });
        dropZoneEl.addEventListener('dragleave', () => dropZoneEl.classList.remove('drag-over'));
        dropZoneEl.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZoneEl.classList.remove('drag-over');
            if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
        });
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length) handleFiles(e.target.files);
        });
        async function handleFiles(files) {
            for (const file of files) {
                const url = await uploadImageDirectly(file, dropZoneEl);
                if (url) { onUpload(url); }
            }
        }
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
                if (id) { await setDoc(doc(db, "categories", id), { name }); }
                else { await addDoc(catCollection, { name }); }
                form.reset();
                idField.value = '';
                await renderCategories();
            } catch (error) { console.error("Error saving category:", error); }
        });
        async function renderCategories() {
            const querySnapshot = await getDocs(catCollection);
            listContainer.innerHTML = '';
            querySnapshot.forEach((docRef) => {
                const category = { id: docRef.id, ...docRef.data() };
                const item = document.createElement('div');
                item.className = 'list-item';
                item.innerHTML = `<span>${category.name}</span><div class="item-actions"><button class="edit-btn" data-id="${category.id}" data-name="${category.name}">Edit</button><button class="delete-btn" data-id="${category.id}">Delete</button></div>`;
                listContainer.appendChild(item);
            });
        }
        listContainer.addEventListener('click', async (e) => {
            const target = e.target;
            if (target.classList.contains('edit-btn')) { idField.value = target.dataset.id; nameField.value = target.dataset.name; }
            if (target.classList.contains('delete-btn')) {
                const id = target.dataset.id;
                if (confirm('Are you sure?')) { await deleteDoc(doc(db, "categories", id)); await renderCategories(); }
            }
        });
        await renderCategories();
    }

    async function manageProducts() {
        const form = document.getElementById('product-form');
        const listContainer = document.getElementById('product-list-container');
        const categorySelect = document.getElementById('product-category');
        const prodCollection = collection(db, "products");
        const bannerUrlInput = document.getElementById('product-banner-url');
        const detailUrlsTextarea = document.getElementById('product-detail-urls');
        const bannerPreview = document.querySelector('#banner-drop-zone .image-preview');
        const detailPreview = document.querySelector('#detail-drop-zone .image-preview-multiple');
        const bannerDropZone = document.getElementById('banner-drop-zone');
        setupDropZone('banner-drop-zone', false, (url) => { bannerUrlInput.value = url; bannerPreview.innerHTML = `<img src="${url}" alt="Banner preview">`; bannerDropZone.classList.add('has-image'); });
        setupDropZone('detail-drop-zone', true, (url) => {
            const currentUrls = detailUrlsTextarea.value ? detailUrlsTextarea.value.split('\n').filter(u => u) : [];
            currentUrls.push(url);
            detailUrlsTextarea.value = currentUrls.join('\n');
            renderDetailPreviews();
        });
        function renderDetailPreviews() {
            detailPreview.innerHTML = '';
            const urls = detailUrlsTextarea.value ? detailUrlsTextarea.value.split('\n').filter(u => u) : [];
            urls.forEach((url, index) => {
                if (!url) return;
                const imgContainer = document.createElement('div');
                imgContainer.className = 'img-container';
                imgContainer.innerHTML = `<img src="${url}" alt="Detail preview ${index + 1}"><button type="button" class="remove-img-btn" data-index="${index}">&times;</button>`;
                detailPreview.appendChild(imgContainer);
            });
        }
        detailPreview.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-img-btn')) {
                const indexToRemove = parseInt(e.target.dataset.index, 10);
                let urls = detailUrlsTextarea.value.split('\n');
                urls.splice(indexToRemove, 1);
                detailUrlsTextarea.value = urls.join('\n');
                renderDetailPreviews();
            }
        });
        function resetProductForm() { form.reset(); form['product-id'].value = ''; bannerUrlInput.value = ''; detailUrlsTextarea.value = ''; bannerPreview.innerHTML = ''; bannerDropZone.classList.remove('has-image'); detailPreview.innerHTML = ''; }
        async function populateCategoryDropdown() {
            const catSnapshot = await getDocs(collection(db, "categories"));
            categorySelect.innerHTML = '<option value="">Select Category</option>';
            catSnapshot.forEach(doc => categorySelect.innerHTML += `<option value="${doc.data().name}">${doc.data().name}</option>`);
        }
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const bannerUrl = bannerUrlInput.value;
            const detailUrls = detailUrlsTextarea.value ? detailUrlsTextarea.value.split('\n').filter(url => url) : [];
            const allImageUrls = [bannerUrl, ...detailUrls].filter(url => url);
            if (!bannerUrl) { alert("Please provide the Main Product Image."); return; }
            const originalPriceValue = form['product-original-price'].value;
            const product = {
                name: form['product-name'].value.trim(), description: form['product-description'].value.trim(), price: parseFloat(form['product-price'].value),
                originalPrice: originalPriceValue ? parseFloat(originalPriceValue) : null, imageUrl: bannerUrl, imageUrls: allImageUrls,
                paymentLink: form['product-payment-link'].value.trim(), category: form['product-category'].value,
            };
            const id = form['product-id'].value;
            if (!product.name || !product.price || !product.paymentLink || !product.category) { alert("Please fill all required fields."); return; }
            if (id) { await setDoc(doc(db, "products", id), product); } else { await addDoc(prodCollection, product); }
            resetProductForm();
            await renderProducts();
        });
        async function renderProducts() {
            await populateCategoryDropdown();
            const querySnapshot = await getDocs(prodCollection);
            listContainer.innerHTML = '';
            querySnapshot.forEach((docRef) => {
                const product = { id: docRef.id, ...docRef.data() };
                const item = document.createElement('div');
                item.className = 'list-item';
                item.innerHTML = `<span>${product.name} - ₹${product.price}</span><div class="item-actions"><button class="edit-btn" data-id="${docRef.id}">Edit</button><button class="delete-btn" data-id="${docRef.id}">Delete</button></div>`;
                listContainer.appendChild(item);
                item.querySelector('.edit-btn').addEventListener('click', () => {
                    resetProductForm();
                    form['product-id'].value = product.id; form['product-name'].value = product.name; form['product-description'].value = product.description;
                    form['product-original-price'].value = product.originalPrice || ''; form['product-price'].value = product.price;
                    bannerUrlInput.value = product.imageUrl || '';
                    if (product.imageUrl) { bannerPreview.innerHTML = `<img src="${product.imageUrl}">`; bannerDropZone.classList.add('has-image'); }
                    detailUrlsTextarea.value = (product.imageUrls || []).filter(url => url !== product.imageUrl).join('\n');
                    renderDetailPreviews();
                    form['product-payment-link'].value = product.paymentLink; form['product-category'].value = product.category;
                    window.scrollTo(0, 0);
                });
                item.querySelector('.delete-btn').addEventListener('click', async () => {
                    if (confirm('Are you sure?')) { await deleteDoc(doc(db, "products", product.id)); await renderProducts(); }
                });
            });
        }
        await renderProducts();
    }

    async function manageBanners() {
        const form = document.getElementById('banner-form');
        const listContainer = document.getElementById('banner-list-container');
        const bannerUrlInput = document.getElementById('banner-image-url');
        const bannerPreview = document.querySelector('#banner-upload-drop-zone .image-preview');
        setupDropZone('banner-upload-drop-zone', false, (url) => {
            bannerUrlInput.value = url;
            bannerPreview.innerHTML = `<img src="${url}" style="max-height: 100px;">`;
        });
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const imageUrl = bannerUrlInput.value.trim();
            if (!imageUrl) { alert("Please upload a banner image first."); return; }
            await addDoc(collection(db, "banners"), { imageUrl, createdAt: new Date() });
            form.reset(); bannerUrlInput.value = ''; bannerPreview.innerHTML = '';
            await renderBanners();
        });
        async function renderBanners() {
            const q = query(collection(db, "banners"), orderBy("createdAt", "desc"));
            const querySnapshot = await getDocs(q);
            listContainer.innerHTML = '';
            querySnapshot.forEach((docRef) => {
                const banner = { id: docRef.id, ...docRef.data() };
                const item = document.createElement('div');
                item.className = 'list-item';
                item.innerHTML = `<img src="${banner.imageUrl}" style="width: 150px; height: auto; border-radius: 5px;"><div class="item-actions"><button class="delete-btn" data-id="${banner.id}">Delete</button></div>`;
                listContainer.appendChild(item);
            });
        }
        listContainer.addEventListener('click', async (e) => {
            if (e.target.classList.contains('delete-btn')) {
                const id = e.target.dataset.id;
                if (confirm('Are you sure?')) { await deleteDoc(doc(db, "banners", id)); await renderBanners(); }
            }
        });
        await renderBanners();
    }
    
    async function manageCustomers() {
        const listContainer = document.getElementById('customer-list-container');
        const querySnapshot = await getDocs(collection(db, "customers"));
        listContainer.innerHTML = querySnapshot.empty ? '<p>No customers or leads found.</p>' : '';
        querySnapshot.forEach(docRef => {
            const customer = { id: docRef.id, ...docRef.data() };
            const item = document.createElement('div');
            item.className = 'list-item';
            item.innerHTML = `<span><strong>Name:</strong> ${customer.name}</span><span><strong>Phone:</strong> ${customer.phone}</span>`;
            listContainer.appendChild(item);
        });
    }

    async function manageOrders() {
        const pendingContainer = document.getElementById('pending-order-list-container');
        const completedContainer = document.getElementById('completed-order-list-container');
        const subNavButtons = document.querySelectorAll('.sub-nav-btn');
        const subViews = document.querySelectorAll('.sub-view');
        
        subNavButtons.forEach(button => {
            button.addEventListener('click', () => {
                subNavButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                const targetSubViewId = button.dataset.subView;
                subViews.forEach(view => {
                    view.classList.toggle('active', view.id === targetSubViewId);
                });
            });
        });

        async function renderOrders() {
            const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
            const querySnapshot = await getDocs(q);
            pendingContainer.innerHTML = '';
            completedContainer.innerHTML = '';
            let hasPending = false;
            let hasCompleted = false;
            querySnapshot.forEach(docRef => {
                const order = { id: docRef.id, ...docRef.data() };
                const orderDate = order.createdAt.toDate().toLocaleString();
                const item = document.createElement('div');
                item.className = 'order-item';
                item.innerHTML = `
                    <p><strong>Order ID:</strong> ${order.id}</p>
                    <p><strong>Date:</strong> ${orderDate}</p>
                    <p><strong>Customer:</strong> ${order.customerName} (${order.customerPhone})</p>
                    <p><strong>Address:</strong> ${order.customerAddress || 'N/A'}</p>
                    <p><strong>Product:</strong> ${order.productName}</p>
                    <p><strong>Amount:</strong> ₹${order.amount.toFixed(2)}</p>
                    <p><strong>Payment ID:</strong> ${order.paymentId || 'N/A'}</p>
                    <div class="order-actions">
                        <p><strong>Status:</strong> 
                            <select class="order-status-selector" data-id="${order.id}">
                                <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
                                <option value="paid" ${order.status === 'paid' ? 'selected' : ''}>Paid</option>
                                <option value="dispatched" ${order.status === 'dispatched' ? 'selected' : ''}>Dispatched</option>
                                <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Delivered</option>
                                <option value="failed" ${order.status === 'failed' ? 'selected' : ''}>Failed</option>
                            </select>
                        </p>
                        <button class="delete-order-btn delete-btn" data-id="${order.id}">Delete</button>
                    </div>`;
                
                if (order.status === 'pending' || order.status === 'failed') {
                    pendingContainer.appendChild(item);
                    hasPending = true;
                } else {
                    completedContainer.appendChild(item);
                    hasCompleted = true;
                }
            });
            if (!hasPending) pendingContainer.innerHTML = '<p>No pending or failed orders found.</p>';
            if (!hasCompleted) completedContainer.innerHTML = '<p>No completed orders found.</p>';
        }

        const handleOrderActions = async (e) => {
            if (e.target.classList.contains('delete-order-btn') || e.target.classList.contains('order-status-selector')) {
                e.stopPropagation();
                if (e.target.classList.contains('delete-order-btn')) {
                    const orderId = e.target.dataset.id;
                    if (confirm(`Are you sure you want to permanently delete this order?\n\nID: ${orderId}`)) {
                        await deleteDoc(doc(db, "orders", orderId));
                        await renderOrders();
                    }
                }
                if (e.target.classList.contains('order-status-selector')) {
                    const orderId = e.target.dataset.id;
                    const newStatus = e.target.value;
                    await updateDoc(doc(db, "orders", orderId), { status: newStatus });
                    alert('Status updated!');
                    await renderOrders();
}
            }
        };
        const ordersView = document.getElementById('orders-view');
        ordersView.addEventListener('click', handleOrderActions);
        ordersView.addEventListener('change', handleOrderActions);
        await renderOrders();
    }
}
