// Dyfnz Product Lookup Widget - Main JavaScript
// Handles manufacturer lookup, product search, and Zoho integration

class ProductWidget {
    constructor() {
        this.currentManufacturer = null;
        this.currentProducts = [];
        this.selectedProduct = null;
        this.searchTimeout = null;
        
        this.initializeElements();
        this.bindEvents();
        this.loadManufacturers();
        
        DEBUG.log('Widget initialized in', ENVIRONMENT.getMode(), 'mode');
    }
    
    initializeElements() {
        // UI Elements
        this.statusIndicator = document.getElementById('status-indicator');
        this.manufacturerSelect = document.getElementById('manufacturer-select');
        this.manufacturerSpinner = document.getElementById('manufacturer-spinner');
        this.manufacturerStats = document.getElementById('manufacturer-stats');
        
        this.productSearchGroup = document.getElementById('product-search-group');
        this.productSearch = document.getElementById('product-search');
        this.productSpinner = document.getElementById('product-spinner');
        this.searchStats = document.getElementById('search-stats');
        
        this.productResults = document.getElementById('product-results');
        this.resultsCount = document.getElementById('results-count');
        this.sourceIndicator = document.getElementById('source-indicator');
        this.productsList = document.getElementById('products-list');
        
        this.errorDisplay = document.getElementById('error-display');
        this.errorMessage = document.getElementById('error-message');
        this.retryButton = document.getElementById('retry-button');
        
        this.selectedProductDiv = document.getElementById('selected-product');
        this.selectedDetails = document.getElementById('selected-details');
        this.addToQuoteBtn = document.getElementById('add-to-quote-btn');
        this.clearSelectionBtn = document.getElementById('clear-selection-btn');
    }
    
    bindEvents() {
        // Manufacturer selection
        this.manufacturerSelect.addEventListener('change', (e) => {
            this.onManufacturerChange(e.target.value);
        });
        
        // Product search with debouncing
        this.productSearch.addEventListener('input', (e) => {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => {
                this.searchProducts(e.target.value);
            }, WIDGET_CONFIG.SEARCH_DEBOUNCE_MS);
        });
        
        // Error retry
        this.retryButton.addEventListener('click', () => {
            this.hideError();
            this.loadManufacturers();
        });
        
        // Product selection actions
        this.addToQuoteBtn.addEventListener('click', () => {
            this.addToQuote();
        });
        
        this.clearSelectionBtn.addEventListener('click', () => {
            this.clearSelection();
        });
    }
    
    setStatus(status, message) {
        this.statusIndicator.className = `status-${status}`;
        this.statusIndicator.textContent = message;
        DEBUG.log('Status:', status, message);
    }
    
    showSpinner(element) {
        element.classList.add('active');
    }
    
    hideSpinner(element) {
        element.classList.remove('active');
    }
    
    showError(message) {
        this.errorMessage.textContent = message;
        this.errorDisplay.style.display = 'block';
        this.setStatus('error', 'Error');
    }
    
    hideError() {
        this.errorDisplay.style.display = 'none';
    }
    
    async loadManufacturers() {
        this.setStatus('loading', 'Loading...');
        this.showSpinner(this.manufacturerSpinner);
        this.hideError();
        
        try {
            const url = API.buildUrl(WIDGET_CONFIG.ENDPOINTS.MANUFACTURER_LOOKUP, {
                limit: 1000  // Request all manufacturers (no artificial limit)
            });
            
            DEBUG.log('Loading manufacturers from:', url);
            const response = await API.makeRequest(url);
            
            if (response.success && response.data && response.data.manufacturers) {
                this.populateManufacturers(response.data.manufacturers);
                this.manufacturerStats.textContent = 
                    `${response.data.manufacturers.length} manufacturers available`;
                this.setStatus('success', 'Ready');
            } else {
                throw new Error(response.error?.message || 'Invalid response format');
            }
        } catch (error) {
            DEBUG.error('Failed to load manufacturers:', error);
            this.showError(WIDGET_CONFIG.MESSAGES.API_ERROR);
        } finally {
            this.hideSpinner(this.manufacturerSpinner);
        }
    }
    
    populateManufacturers(manufacturers) {
        // Clear existing options
        this.manufacturerSelect.innerHTML = '<option value="">Select a manufacturer...</option>';
        
        // Add manufacturer options
        manufacturers.forEach(manufacturer => {
            const option = document.createElement('option');
            option.value = manufacturer.manufacturer_name;
            option.textContent = `${manufacturer.manufacturer_name} (${manufacturer.product_count} products)`;
            this.manufacturerSelect.appendChild(option);
        });
        
        this.manufacturerSelect.disabled = false;
        DEBUG.log('Populated', manufacturers.length, 'manufacturers');
    }
    
    onManufacturerChange(manufacturerName) {
        this.currentManufacturer = manufacturerName;
        this.clearProducts();
        this.clearSelection();
        
        if (manufacturerName) {
            this.productSearchGroup.style.display = 'block';
            this.productSearch.disabled = false;
            this.productSearch.focus();
            this.searchProducts(''); // Load all products for this manufacturer
        } else {
            this.productSearchGroup.style.display = 'none';
            this.productResults.style.display = 'none';
        }
    }
    
    async searchProducts(searchTerm = '') {
        if (!this.currentManufacturer) {
            DEBUG.log('No manufacturer selected');
            return;
        }
        
        this.setStatus('loading', 'Searching...');
        this.showSpinner(this.productSpinner);
        this.hideError();
        
        try {
            const endpoint = WIDGET_CONFIG.FEATURES.HYBRID_SEARCH ? 
                WIDGET_CONFIG.ENDPOINTS.HYBRID_LOOKUP : 
                WIDGET_CONFIG.ENDPOINTS.PRODUCT_SEARCH;
                
            const url = API.buildUrl(endpoint, {
                manufacturer: this.currentManufacturer,
                search: searchTerm,
                limit: WIDGET_CONFIG.DEFAULT_LIMIT
            });
            
            DEBUG.log('Searching products:', url);
            const response = await API.makeRequest(url);
            
            if (response.success && response.data) {
                this.displayProducts(response.data);
                this.setStatus('success', 'Ready');
            } else {
                throw new Error(response.error?.message || 'Invalid response format');
            }
        } catch (error) {
            DEBUG.error('Failed to search products:', error);
            this.showError(WIDGET_CONFIG.MESSAGES.API_ERROR);
        } finally {
            this.hideSpinner(this.productSpinner);
        }
    }
    
    displayProducts(data) {
        const products = data.products || [];
        this.currentProducts = products;
        
        // Update results count with total available information
        const totalAvailable = data.source_counts?.total_available || products.length;
        const displayedCount = products.length;
        
        if (totalAvailable > displayedCount) {
            this.resultsCount.textContent = `Showing ${displayedCount} of ${totalAvailable} products`;
        } else {
            this.resultsCount.textContent = `${displayedCount} products found`;
        }
        
        // Completely hide the source indicator - no more confusing tags
        this.sourceIndicator.style.display = 'none';
        
        // Update search stats
        const searchInfo = data.query_info || {};
        if (searchInfo.search_term) {
            this.searchStats.textContent = `Searching for "${searchInfo.search_term}"`;
        } else {
            this.searchStats.textContent = 'Showing all products';
        }
        
        // Clear and populate products list
        this.productsList.innerHTML = '';
        
        if (products.length === 0) {
            this.productsList.innerHTML = 
                '<div class="product-item">No products found for this search</div>';
        } else {
            products.forEach((product, index) => {
                this.productsList.appendChild(this.createProductElement(product, index));
            });
        }
        
        this.productResults.style.display = 'block';
        DEBUG.log('Displayed', products.length, 'products');
    }
    
    createProductElement(product, index) {
        const div = document.createElement('div');
        div.className = 'product-item';
        div.dataset.index = index;
        
        const nameDiv = document.createElement('div');
        nameDiv.className = 'product-name';
        nameDiv.textContent = product.manufacturer_part_number;
        
        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'product-details';
        
        const description = document.createElement('span');
        description.textContent = product.part_description.length > 50 ? 
            product.part_description.substring(0, 50) + '...' : 
            product.part_description;
        
        const price = document.createElement('span');
        price.className = 'product-price';
        if (product.msrp && WIDGET_CONFIG.FEATURES.PRICING_DISPLAY) {
            price.textContent = `$${parseFloat(product.msrp).toFixed(2)}`;
        } else {
            price.textContent = 'Price on request';
        }
        
        detailsDiv.appendChild(description);
        detailsDiv.appendChild(price);
        
        div.appendChild(nameDiv);
        div.appendChild(detailsDiv);
        
        div.addEventListener('click', () => {
            this.selectProduct(product, div);
        });
        
        return div;
    }
    
    selectProduct(product, element) {
        // Update UI selection
        document.querySelectorAll('.product-item').forEach(item => {
            item.classList.remove('selected');
        });
        element.classList.add('selected');
        
        this.selectedProduct = product;
        this.displaySelectedProduct(product);
        
        DEBUG.log('Selected product:', product.manufacturer_part_number);
    }
    
    displaySelectedProduct(product) {
        this.selectedDetails.innerHTML = `
            <div class="detail-row">
                <span class="detail-label">Part Number:</span>
                <span class="detail-value">${product.manufacturer_part_number}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Description:</span>
                <span class="detail-value">${product.part_description}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Manufacturer:</span>
                <span class="detail-value">${product.manufacturer_name}</span>
            </div>
            ${product.msrp ? `
            <div class="detail-row">
                <span class="detail-label">MSRP:</span>
                <span class="detail-value">$${parseFloat(product.msrp).toFixed(2)}</span>
            </div>
            ` : ''}
            ${product.contract_price ? `
            <div class="detail-row">
                <span class="detail-label">Contract Price:</span>
                <span class="detail-value">$${parseFloat(product.contract_price).toFixed(2)}</span>
            </div>
            ` : ''}
            <div class="detail-row">
                <span class="detail-label">Source:</span>
                <span class="detail-value">${product.source === 'supabase' ? 'Product Catalog' : 'Local CRM'}</span>
            </div>
        `;
        
        this.selectedProductDiv.style.display = 'block';
    }
    
    clearProducts() {
        this.currentProducts = [];
        this.productResults.style.display = 'none';
        this.searchStats.textContent = '';
    }
    
    clearSelection() {
        this.selectedProduct = null;
        this.selectedProductDiv.style.display = 'none';
        document.querySelectorAll('.product-item').forEach(item => {
            item.classList.remove('selected');
        });
    }
    
    addToQuote() {
        if (!this.selectedProduct) {
            DEBUG.log('No product selected');
            return;
        }
        
        DEBUG.log('Adding to quote:', this.selectedProduct);
        
        if (ENVIRONMENT.isZohoEmbedded()) {
            this.addToZohoQuote(this.selectedProduct);
        } else {
            // Standalone mode - just show success message
            alert(`Product "${this.selectedProduct.manufacturer_part_number}" would be added to quote in Zoho CRM.`);
        }
    }
    
    addToZohoQuote(product) {
        // This will be implemented when embedded in Zoho
        // For now, just simulate the action
        try {
            const quoteData = {
                [WIDGET_CONFIG.ZOHO.FIELD_MAPPING.manufacturer_part_number]: product.manufacturer_part_number,
                [WIDGET_CONFIG.ZOHO.FIELD_MAPPING.part_description]: product.part_description,
                [WIDGET_CONFIG.ZOHO.FIELD_MAPPING.msrp]: product.msrp,
                [WIDGET_CONFIG.ZOHO.FIELD_MAPPING.manufacturer_name]: product.manufacturer_name
            };
            
            DEBUG.log('Zoho quote data prepared:', quoteData);
            
            // In actual Zoho environment, this would use Zoho SDK:
            // ZOHO.CRM.UI.Record.populate(quoteData);
            
            this.setStatus('success', 'Added to Quote');
            setTimeout(() => {
                this.setStatus('idle', 'Ready');
            }, 2000);
            
        } catch (error) {
            DEBUG.error('Failed to add to Zoho quote:', error);
            this.showError('Failed to add product to quote');
        }
    }
}

// Initialize widget when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.productWidget = new ProductWidget();
});