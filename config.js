// Dyfnz Product Lookup Widget Configuration
// Connect to Supabase Edge Functions for product data

const WIDGET_CONFIG = {
    // Supabase Edge Function Endpoints
    SUPABASE_URL: 'https://tydxdpntshbobomemzxj.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5ZHhkcG50c2hib2JvbWVtenhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4MTg0MjcsImV4cCI6MjA3NjM5NDQyN30.cVcmS7yKqAF1LBOTz0ZNgxgaEILLi7FuWX9E8eZjZac',
    ENDPOINTS: {
        MANUFACTURER_LOOKUP: '/functions/v1/manufacturer-lookup',
        PRODUCT_SEARCH: '/functions/v1/product-search', 
        HYBRID_LOOKUP: '/functions/v1/hybrid-product-lookup'
    },
    
    // API Configuration
    DEFAULT_LIMIT: 25,
    SEARCH_DEBOUNCE_MS: 300,
    REQUEST_TIMEOUT_MS: 10000,
    
    // UI Configuration
    MAX_RESULTS_DISPLAY: 50,
    SHOW_SOURCE_INDICATORS: true,
    ENABLE_REAL_TIME_SEARCH: true,
    
    // Feature Flags
    FEATURES: {
        HYBRID_SEARCH: true,        // Include both Supabase + Zoho products
        PRICING_DISPLAY: true,      // Show MSRP and contract pricing
        CATEGORY_FILTERING: false,  // Future enhancement
        BULK_SELECTION: false       // Future enhancement
    },
    
    // Error Messages
    MESSAGES: {
        LOADING_MANUFACTURERS: 'Loading manufacturers...',
        NO_MANUFACTURERS: 'No manufacturers found',
        LOADING_PRODUCTS: 'Searching products...',
        NO_PRODUCTS: 'No products found for this manufacturer',
        NETWORK_ERROR: 'Network error. Please check your connection and try again.',
        API_ERROR: 'Unable to retrieve product data. Please try again.',
        INVALID_SELECTION: 'Please select a valid manufacturer first'
    },
    
    // Zoho Integration Settings
    ZOHO: {
        // These will be populated when embedded in Zoho CRM
        ADD_TO_QUOTE_ENABLED: true,
        AUTO_POPULATE_FIELDS: true,
        FIELD_MAPPING: {
            'manufacturer_part_number': 'Product_Code',
            'part_description': 'Product_Name', 
            'msrp': 'Unit_Price',
            'manufacturer_name': 'Manufacturer'
        }
    }
};

// Environment Detection
const ENVIRONMENT = {
    isZohoEmbedded: () => {
        try {
            return window.parent !== window && 
                   window.parent.location.host.includes('zoho');
        } catch (e) {
            return false;
        }
    },
    
    isStandalone: () => {
        return window === window.top;
    },
    
    getMode: () => {
        if (ENVIRONMENT.isZohoEmbedded()) return 'zoho';
        if (ENVIRONMENT.isStandalone()) return 'standalone';
        return 'embedded';
    }
};

// API Helper Functions
const API = {
    buildUrl: (endpoint, params = {}) => {
        const url = new URL(WIDGET_CONFIG.SUPABASE_URL + endpoint);
        Object.keys(params).forEach(key => {
            if (params[key] !== null && params[key] !== undefined) {
                url.searchParams.append(key, params[key]);
            }
        });
        return url.toString();
    },
    
    makeRequest: async (url, options = {}) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), WIDGET_CONFIG.REQUEST_TIMEOUT_MS);
        
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': WIDGET_CONFIG.SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${WIDGET_CONFIG.SUPABASE_ANON_KEY}`,
                    ...options.headers
                }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Request timed out');
            }
            throw error;
        }
    }
};

// Debug Mode (for development)
const DEBUG = {
    enabled: ENVIRONMENT.isStandalone() && (window.location.hostname === 'localhost' || window.location.hostname.includes('github.io')),
    log: (...args) => {
        if (DEBUG.enabled) console.log('[Widget Debug]', ...args);
    },
    error: (...args) => {
        if (DEBUG.enabled) console.error('[Widget Error]', ...args);
    }
};

// Export for widget.js
window.WIDGET_CONFIG = WIDGET_CONFIG;
window.ENVIRONMENT = ENVIRONMENT; 
window.API = API;
window.DEBUG = DEBUG;