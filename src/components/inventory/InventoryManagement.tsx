import React, { useState, useMemo } from 'react';
import {
  ShoppingBag,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  Printer,
  Check,
  AlertTriangle,
  RotateCcw,
  Package,
  TrendingUp,
  DollarSign,
  CreditCard,
  Building2,
  Calendar,
  X,
  FileText,
  Clock,
  ArrowUpRight,
  Filter,
  SlidersHorizontal,
  ChevronRight,
  Minus,
  CheckCircle2,
} from 'lucide-react';
import { db } from '../../db/storage';
import { printDocument } from '../../services/printService';
import { Product, ProductCategory, PaymentMethod, Sale, StockPurchase } from '../../types';
import { GymTownLogo } from '../common/GymTownLogo';

export const InventoryManagement: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'pos' | 'dashboard' | 'products' | 'purchases' | 'transactions'>('pos');
  const [dbTick, setDbTick] = useState(0);

  // Period filter for Sales Dashboard & Reports
  const [salesPeriod, setSalesPeriod] = useState<'today' | 'week' | 'month' | 'all'>('today');

  // Search & category filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'LOW' | 'OUT'>('ALL');

  // POS State (Cart)
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [posDiscount, setPosDiscount] = useState<number>(0);
  const [posPaymentMethod, setPosPaymentMethod] = useState<PaymentMethod>('Cash');
  const [posCustomerType, setPosCustomerType] = useState<'WALK_IN' | 'MEMBER'>('WALK_IN');
  const [posMemberQuery, setPosMemberQuery] = useState('');
  const [posSelectedMember, setPosSelectedMember] = useState<{ id: string; rollNumber: string; name: string } | null>(null);
  const [posNotes, setPosNotes] = useState('');
  const [posError, setPosError] = useState<string | null>(null);
  const [lastCompletedSale, setLastCompletedSale] = useState<Sale | null>(null);
  const [showReceiptDrawer, setShowReceiptDrawer] = useState(false);

  // Drawers & Modals
  const [showAddProductDrawer, setShowAddProductDrawer] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showAdjustStockDrawer, setShowAdjustStockDrawer] = useState(false);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [adjustQty, setAdjustQty] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState('Manual physical count adjustment');
  const [adjustType, setAdjustType] = useState<'ADJUSTMENT' | 'DAMAGED' | 'EXPIRED'>('ADJUSTMENT');

  const [showRestockDrawer, setShowRestockDrawer] = useState(false);
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);

  // Restock Form State
  const [restockSupplier, setRestockSupplier] = useState('');
  const [restockSupplierContact, setRestockSupplierContact] = useState('');
  const [restockItems, setRestockItems] = useState<{ productId: string; quantity: number; unitPurchasePrice: number; expiryDate?: string }[]>([
    { productId: '', quantity: 12, unitPurchasePrice: 0 },
  ]);
  const [restockPaymentMethod, setRestockPaymentMethod] = useState<PaymentMethod>('Cash');
  const [restockNotes, setRestockNotes] = useState('');

  // Toast
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'danger' } | null>(null);

  const showToast = (text: string, type: 'success' | 'danger' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const refreshData = () => {
    setDbTick((t) => t + 1);
  };

  // Queries
  const products = db.getProducts();
  const salesMetrics = useMemo(() => db.getSalesMetrics(salesPeriod), [salesPeriod, dbTick]);
  const lowStockProducts = useMemo(() => db.getLowStockProducts(), [dbTick]);
  const suppliers = db.getSuppliers();
  const allSales = db.getSales();
  const purchases = db.getStockPurchases();
  const transactions = db.getInventoryTransactions();
  const members = db.getMembers();

  const categories: ProductCategory[] = [
    'Energy Drinks',
    'Protein Shakes',
    'Bottled Water',
    'Protein Bars',
    'Snacks',
    'Supplements',
    'Gym Accessories',
    'Other',
  ];

  // Filtered Products for POS / Catalog
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (!p.isActive) return false;
      const matchCat = selectedCategory === 'ALL' || p.category === selectedCategory;
      const matchQuery =
        !searchQuery ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStock =
        stockFilter === 'ALL' ||
        (stockFilter === 'LOW' && p.stockQuantity <= p.minStockLevel && p.stockQuantity > 0) ||
        (stockFilter === 'OUT' && p.stockQuantity <= 0);
      return matchCat && matchQuery && matchStock;
    });
  }, [products, selectedCategory, searchQuery, stockFilter, dbTick]);

  // Cart Calculations
  const cartSubtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.product.sellingPrice * item.quantity, 0);
  }, [cart]);

  const cartTotalPayable = Math.max(0, cartSubtotal - (posDiscount || 0));

  // Add Item to Cart
  const addToCart = (product: Product) => {
    setPosError(null);
    if (product.stockQuantity <= 0) {
      setPosError(`${product.name} is out of stock`);
      return;
    }

    const existingIndex = cart.findIndex((item) => item.product.id === product.id);
    if (existingIndex > -1) {
      const currentQty = cart[existingIndex].quantity;
      if (currentQty + 1 > product.stockQuantity) {
        setPosError(`Cannot add more. Only ${product.stockQuantity} units available.`);
        return;
      }
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      setCart(updated);
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
  };

  const updateCartQty = (productId: string, delta: number) => {
    setPosError(null);
    const existingIndex = cart.findIndex((item) => item.product.id === productId);
    if (existingIndex === -1) return;

    const item = cart[existingIndex];
    const newQty = item.quantity + delta;

    if (newQty <= 0) {
      setCart(cart.filter((_, i) => i !== existingIndex));
      return;
    }

    if (newQty > item.product.stockQuantity) {
      setPosError(`Cannot exceed current stock (${item.product.stockQuantity} units)`);
      return;
    }

    const updated = [...cart];
    updated[existingIndex].quantity = newQty;
    setCart(updated);
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setPosDiscount(0);
    setPosError(null);
    setPosSelectedMember(null);
    setPosNotes('');
  };

  // Complete POS Sale
  const handleConfirmSale = () => {
    setPosError(null);
    if (cart.length === 0) {
      setPosError('Cart is empty. Add products before confirming sale.');
      return;
    }

    const salePayload = {
      items: cart.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
      discount: posDiscount,
      paymentMethod: posPaymentMethod,
      memberId: posSelectedMember?.id,
      memberRollNumber: posSelectedMember?.rollNumber,
      memberName: posSelectedMember?.name || (posCustomerType === 'WALK_IN' ? 'Walk-in Counter Guest' : 'Gym Member'),
      notes: posNotes,
    };

    const res = db.recordSale(salePayload);
    if (!res.success || !res.sale) {
      setPosError(res.error || 'Failed to record sale');
      return;
    }

    setLastCompletedSale(res.sale);
    clearCart();
    refreshData();
    setShowReceiptDrawer(true);
    showToast(`Sale confirmed! Invoice #${res.sale.invoiceNumber}`);
  };

  // Restock Submit
  const handleConfirmRestock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockSupplier.trim()) {
      showToast('Please specify a supplier name', 'danger');
      return;
    }

    const validItems = restockItems.filter((i) => i.productId && i.quantity > 0);
    if (validItems.length === 0) {
      showToast('Please select at least one product with quantity > 0', 'danger');
      return;
    }

    const res = db.recordStockPurchase({
      supplierName: restockSupplier.trim(),
      supplierContact: restockSupplierContact.trim(),
      items: validItems,
      paymentMethod: restockPaymentMethod,
      purchaseDate: new Date().toISOString().split('T')[0],
      notes: restockNotes,
    });

    if (res.success && res.purchase) {
      showToast(`Purchase recorded (${res.purchase.purchaseNumber}). Stock updated!`);
      setShowRestockDrawer(false);
      setRestockItems([{ productId: '', quantity: 12, unitPurchasePrice: 0 }]);
      setRestockNotes('');
      refreshData();
    } else {
      showToast(res.error || 'Failed to record purchase', 'danger');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0D0E10] text-[#ECEAE6]">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-[6px] border text-xs font-semibold shadow-xl transition-all duration-150 ${
            toastMessage.type === 'success'
              ? 'bg-[#15171A] border-[#262A30] border-l-4 border-l-[#3DB88B] text-[#ECEAE6]'
              : 'bg-[#15171A] border-[#262A30] border-l-4 border-l-[#E5484D] text-[#E5484D]'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-[#3DB88B]" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-[#E5484D]" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Module Subheader & Sub-Navigation */}
      <div className="h-12 border-b border-[#262A30] bg-[#15171A] px-5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 font-condensed uppercase tracking-[0.04em] text-sm font-bold text-[#ECEAE6]">
            <ShoppingBag className="w-4 h-4 text-[#D9383A]" />
            <span>Inventory & Daily Sales</span>
            <span className="text-[#8B909A] font-normal text-xs">/</span>
            <span className="text-[#8B909A] text-xs font-medium">Front Desk Store</span>
          </div>

          {lowStockProducts.length > 0 && (
            <span className="ml-2 status-pill-warning cursor-pointer" onClick={() => { setActiveSubTab('products'); setStockFilter('LOW'); }}>
              <AlertTriangle className="w-3 h-3 text-[#E5AE4A]" />
              <span>{lowStockProducts.length} low stock</span>
            </span>
          )}
        </div>

        {/* Sub-tab Navigation */}
        <div className="flex items-center gap-1 bg-[#0D0E10] p-1 rounded-[6px] border border-[#262A30]">
          <button
            onClick={() => setActiveSubTab('pos')}
            className={`px-3 py-1 rounded-[4px] text-xs font-medium transition-all duration-150 cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'pos'
                ? 'bg-[#D9383A] text-[#ECEAE6] font-semibold'
                : 'text-[#8B909A] hover:text-[#ECEAE6] hover:bg-[#1C1F23]'
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>POS / Daily Sale</span>
          </button>

          <button
            onClick={() => setActiveSubTab('dashboard')}
            className={`px-3 py-1 rounded-[4px] text-xs font-medium transition-all duration-150 cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'dashboard'
                ? 'bg-[#D9383A] text-[#ECEAE6] font-semibold'
                : 'text-[#8B909A] hover:text-[#ECEAE6] hover:bg-[#1C1F23]'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Sales & Profit Reports</span>
          </button>

          <button
            onClick={() => setActiveSubTab('products')}
            className={`px-3 py-1 rounded-[4px] text-xs font-medium transition-all duration-150 cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'products'
                ? 'bg-[#D9383A] text-[#ECEAE6] font-semibold'
                : 'text-[#8B909A] hover:text-[#ECEAE6] hover:bg-[#1C1F23]'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Products ({products.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('purchases')}
            className={`px-3 py-1 rounded-[4px] text-xs font-medium transition-all duration-150 cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'purchases'
                ? 'bg-[#D9383A] text-[#ECEAE6] font-semibold'
                : 'text-[#8B909A] hover:text-[#ECEAE6] hover:bg-[#1C1F23]'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restocking</span>
          </button>

          <button
            onClick={() => setActiveSubTab('transactions')}
            className={`px-3 py-1 rounded-[4px] text-xs font-medium transition-all duration-150 cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'transactions'
                ? 'bg-[#D9383A] text-[#ECEAE6] font-semibold'
                : 'text-[#8B909A] hover:text-[#ECEAE6] hover:bg-[#1C1F23]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Audit Log</span>
          </button>
        </div>
      </div>

      {/* Main Tab Views */}
      <div className="flex-1 overflow-hidden">
        {/* ======================================================== */}
        {/* SUB-TAB 1: FAST POS / DAILY SALES COUNTER */}
        {/* ======================================================== */}
        {activeSubTab === 'pos' && (
          <div className="h-full flex flex-col md:flex-row overflow-hidden">
            {/* Left 68%: Product Catalog Grid & Quick Select */}
            <div className="flex-1 flex flex-col border-r border-[#262A30] overflow-hidden">
              {/* Filter Strip */}
              <div className="p-3 border-b border-[#262A30] bg-[#15171A] flex flex-wrap items-center justify-between gap-2.5">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="w-3.5 h-3.5 text-[#8B909A] absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search product code or name..."
                    className="w-full bg-[#1C1F23] border border-[#262A30] rounded-[6px] pl-8 pr-3 py-1.5 text-xs text-[#ECEAE6] placeholder:text-[#8B909A] focus:ring-2 focus:ring-[#D9383A] focus:outline-none"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8B909A] hover:text-[#ECEAE6]"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Category Pills */}
                <div className="flex items-center gap-1 overflow-x-auto max-w-full py-0.5">
                  <button
                    onClick={() => setSelectedCategory('ALL')}
                    className={`px-2.5 py-1 rounded-[6px] text-[11px] uppercase font-bold tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                      selectedCategory === 'ALL'
                        ? 'bg-[#D9383A] text-[#ECEAE6]'
                        : 'bg-[#1C1F23] text-[#8B909A] hover:text-[#ECEAE6] border border-[#262A30]'
                    }`}
                  >
                    All Items
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-2.5 py-1 rounded-[6px] text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                        selectedCategory === cat
                          ? 'bg-[#D9383A] text-[#ECEAE6]'
                          : 'bg-[#1C1F23] text-[#8B909A] hover:text-[#ECEAE6] border border-[#262A30]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Products Grid */}
              <div className="flex-1 overflow-y-auto p-4">
                {filteredProducts.length === 0 ? (
                  <div className="h-48 flex flex-col items-center justify-center text-[#8B909A] text-xs">
                    <Package className="w-8 h-8 mb-2 stroke-[1.5] text-[#262A30]" />
                    <p>No products found in this category.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {filteredProducts.map((prod) => {
                      const isOutOfStock = prod.stockQuantity <= 0;
                      const isLowStock = prod.stockQuantity > 0 && prod.stockQuantity <= prod.minStockLevel;
                      const cartItem = cart.find((i) => i.product.id === prod.id);

                      return (
                        <div
                          key={prod.id}
                          onClick={() => !isOutOfStock && addToCart(prod)}
                          className={`group p-3 rounded-[8px] border text-left transition-all duration-150 relative flex flex-col justify-between ${
                            isOutOfStock
                              ? 'bg-[#15171A]/40 border-[#262A30] opacity-50 cursor-not-allowed'
                              : 'bg-[#15171A] border-[#262A30] hover:border-[#D9383A] hover:bg-[#1C1F23] cursor-pointer'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="font-mono text-[10px] text-[#8B909A]">{prod.code}</span>
                              {isOutOfStock ? (
                                <span className="status-pill-danger text-[10px]">Out of Stock</span>
                              ) : isLowStock ? (
                                <span className="status-pill-warning text-[10px]">{prod.stockQuantity} Left</span>
                              ) : (
                                <span className="text-[10px] text-[#8B909A] font-mono tabular-nums">
                                  {prod.stockQuantity} {prod.unit || 'units'}
                                </span>
                              )}
                            </div>

                            <h4 className="font-medium text-xs text-[#ECEAE6] line-clamp-2 leading-tight">
                              {prod.name}
                            </h4>
                            <span className="text-[10px] text-[#8B909A] mt-0.5 block">{prod.category}</span>
                          </div>

                          <div className="mt-3 pt-2.5 border-t border-[#262A30] flex items-center justify-between">
                            <span className="font-condensed text-base font-bold text-[#ECEAE6] tabular-nums tracking-wide">
                              Rs. {prod.sellingPrice.toLocaleString()}
                            </span>

                            {cartItem ? (
                              <span className="px-1.5 py-0.5 rounded-[4px] bg-[#D9383A] text-[#ECEAE6] font-mono text-[11px] font-bold">
                                {cartItem.quantity} in cart
                              </span>
                            ) : (
                              <span className="text-[11px] font-semibold text-[#8B909A] group-hover:text-[#ECEAE6] transition-colors">
                                + Add
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right 32%: POS Order Cart & Checkout Drawer */}
            <div className="w-full md:w-[380px] lg:w-[420px] bg-[#15171A] flex flex-col shrink-0 h-full">
              {/* Cart Header */}
              <div className="p-3.5 border-b border-[#262A30] flex items-center justify-between bg-[#1C1F23]">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-[#D9383A]" />
                  <h3 className="font-condensed uppercase tracking-[0.04em] text-sm font-bold text-[#ECEAE6]">
                    Current Sale ({cart.reduce((a, b) => a + b.quantity, 0)} items)
                  </h3>
                </div>
                {cart.length > 0 && (
                  <button
                    onClick={clearCart}
                    className="text-[11px] text-[#8B909A] hover:text-[#E5484D] transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear</span>
                  </button>
                )}
              </div>

              {/* Cart Items List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {posError && (
                  <div className="p-2.5 rounded-[6px] bg-[#1C1F23] border-l-4 border-l-[#E5484D] border-[#262A30] text-xs text-[#E5484D] flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{posError}</span>
                  </div>
                )}

                {cart.length === 0 ? (
                  <div className="h-48 flex flex-col items-center justify-center text-[#8B909A] text-xs text-center px-4">
                    <ShoppingCart className="w-8 h-8 mb-2 stroke-[1.5] text-[#262A30]" />
                    <p className="font-medium text-[#ECEAE6]">Cart is empty</p>
                    <p className="text-[11px] text-[#8B909A] mt-0.5">Click any product on the left to start a counter sale.</p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div
                      key={item.product.id}
                      className="p-2.5 rounded-[6px] bg-[#1C1F23] border border-[#262A30] flex items-center justify-between gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] text-[#8B909A]">{item.product.code}</span>
                          <span className="font-mono text-xs font-semibold text-[#ECEAE6] tabular-nums">
                            Rs. {(item.product.sellingPrice * item.quantity).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-[#ECEAE6] truncate">{item.product.name}</p>
                        <span className="text-[10px] text-[#8B909A]">
                          Rs. {item.product.sellingPrice} each
                        </span>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-1 bg-[#15171A] rounded-[4px] border border-[#262A30] p-0.5 shrink-0">
                        <button
                          onClick={() => updateCartQty(item.product.id, -1)}
                          className="w-5 h-5 flex items-center justify-center text-[#8B909A] hover:text-[#ECEAE6] cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center font-mono font-bold text-xs text-[#ECEAE6] tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateCartQty(item.product.id, 1)}
                          className="w-5 h-5 flex items-center justify-center text-[#8B909A] hover:text-[#ECEAE6] cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="text-[#8B909A] hover:text-[#E5484D] p-1 cursor-pointer"
                        title="Remove item"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Customer Link & Payment Method (Sticky bottom) */}
              <div className="p-3.5 border-t border-[#262A30] bg-[#1C1F23] space-y-3">
                {/* Customer Toggle */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-semibold">
                      Customer
                    </label>
                    <div className="flex items-center gap-2 text-[10px]">
                      <button
                        type="button"
                        onClick={() => {
                          setPosCustomerType('WALK_IN');
                          setPosSelectedMember(null);
                        }}
                        className={`cursor-pointer ${
                          posCustomerType === 'WALK_IN' ? 'text-[#D9383A] font-bold' : 'text-[#8B909A]'
                        }`}
                      >
                        Walk-in Guest
                      </button>
                      <span className="text-[#262A30]">|</span>
                      <button
                        type="button"
                        onClick={() => setPosCustomerType('MEMBER')}
                        className={`cursor-pointer ${
                          posCustomerType === 'MEMBER' ? 'text-[#D9383A] font-bold' : 'text-[#8B909A]'
                        }`}
                      >
                        Gym Member
                      </button>
                    </div>
                  </div>

                  {posCustomerType === 'MEMBER' && (
                    <div className="relative mt-1">
                      <input
                        type="text"
                        value={posMemberQuery}
                        onChange={(e) => {
                          setPosMemberQuery(e.target.value);
                          const found = members.find(
                            (m) =>
                              m.rollNumber.toLowerCase() === e.target.value.toLowerCase().trim() ||
                              m.fullName.toLowerCase().includes(e.target.value.toLowerCase().trim())
                          );
                          if (found) {
                            setPosSelectedMember({ id: found.id, rollNumber: found.rollNumber, name: found.fullName });
                          }
                        }}
                        placeholder="Type Roll # or Member Name..."
                        className="w-full bg-[#15171A] border border-[#262A30] rounded-[6px] px-2.5 py-1.5 text-xs text-[#ECEAE6] focus:ring-2 focus:ring-[#D9383A] focus:outline-none"
                      />
                      {posSelectedMember && (
                        <div className="text-[10px] text-[#3DB88B] mt-1 font-mono">
                          Linked: {posSelectedMember.name} ({posSelectedMember.rollNumber})
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Payment Method Selector */}
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-semibold block mb-1">
                    Payment Method
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(['Cash'] as PaymentMethod[]).map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setPosPaymentMethod(method)}
                        className={`py-1.5 text-[11px] font-semibold rounded-[6px] border transition-all cursor-pointer text-center ${
                          posPaymentMethod === method
                            ? 'bg-[#D9383A] border-[#D9383A] text-[#ECEAE6]'
                            : 'bg-[#15171A] border-[#262A30] text-[#8B909A] hover:text-[#ECEAE6]'
                        }`}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subtotal, Discount & Total */}
                <div className="space-y-1.5 pt-2 border-t border-[#262A30] text-xs">
                  <div className="flex items-center justify-between text-[#8B909A]">
                    <span>Subtotal:</span>
                    <span className="font-mono text-[#ECEAE6] tabular-nums">Rs. {cartSubtotal.toLocaleString()}</span>
                  </div>

                  <div className="flex items-center justify-between text-[#8B909A]">
                    <span>Discount (PKR):</span>
                    <input
                      type="number"
                      min="0"
                      value={posDiscount || ''}
                      onChange={(e) => setPosDiscount(Number(e.target.value) || 0)}
                      placeholder="0"
                      className="w-20 text-right bg-[#15171A] border border-[#262A30] rounded-[4px] px-1.5 py-0.5 text-xs font-mono text-[#ECEAE6] focus:ring-1 focus:ring-[#D9383A] focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-[#262A30]">
                    <span className="font-condensed uppercase tracking-wider text-sm font-bold text-[#ECEAE6]">
                      Total Payable:
                    </span>
                    <span className="font-condensed text-xl font-bold text-[#D9383A] tabular-nums">
                      Rs. {cartTotalPayable.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Confirm Sale Button */}
                <button
                  type="button"
                  disabled={cart.length === 0}
                  onClick={handleConfirmSale}
                  className={`w-full py-2.5 rounded-[6px] text-xs font-bold uppercase tracking-wider transition-all duration-150 flex items-center justify-center gap-2 ${
                    cart.length > 0
                      ? 'bg-[#D9383A] hover:bg-[#C92A2C] text-[#ECEAE6] cursor-pointer focus:ring-2 focus:ring-[#D9383A]'
                      : 'bg-[#262A30] text-[#8B909A] cursor-not-allowed opacity-50'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  <span>Confirm Sale & Deduct Stock</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* SUB-TAB 2: DAILY SALES DASHBOARD & PROFIT REPORTS */}
        {/* ======================================================== */}
        {activeSubTab === 'dashboard' && (
          <div className="h-full overflow-y-auto p-5 space-y-5">
            {/* Period Switcher Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-condensed uppercase tracking-[0.04em] text-lg font-bold text-[#ECEAE6]">
                  Sales Performance & Profit Accounting
                </h2>
                <p className="text-xs text-[#8B909A]">
                  Real-time sales revenue, cost of goods sold (COGS), and net gross profit.
                </p>
              </div>

              {/* Period Tabs */}
              <div className="flex items-center gap-1 bg-[#15171A] p-1 rounded-[6px] border border-[#262A30] self-start">
                {(['today', 'week', 'month', 'all'] as const).map((period) => (
                  <button
                    key={period}
                    onClick={() => setSalesPeriod(period)}
                    className={`px-3 py-1 rounded-[4px] text-xs font-medium uppercase tracking-wider transition-all cursor-pointer ${
                      salesPeriod === period
                        ? 'bg-[#D9383A] text-[#ECEAE6] font-bold'
                        : 'text-[#8B909A] hover:text-[#ECEAE6]'
                    }`}
                  >
                    {period === 'today' ? 'Today' : period === 'week' ? '7 Days' : period === 'month' ? 'This Month' : 'All Time'}
                  </button>
                ))}
              </div>
            </div>

            {/* CONNECTED KPI STRIP: Single bordered container with vertical dividers */}
            <div className="border border-[#262A30] rounded-[8px] bg-[#15171A] grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 divide-y lg:divide-y-0 lg:divide-x divide-[#262A30] overflow-hidden">
              {/* Cell 1: Sales Revenue */}
              <div className="p-4">
                <span className="text-[11px] uppercase tracking-[0.04em] text-[#8B909A] font-semibold block">
                  Total Sales Revenue
                </span>
                <div className="font-condensed text-2xl font-bold text-[#ECEAE6] tabular-nums mt-1">
                  Rs. {salesMetrics.totalRevenue.toLocaleString()}
                </div>
                <span className="text-[10px] text-[#8B909A] mt-1 block">
                  {salesMetrics.totalTransactions} transactions
                </span>
              </div>

              {/* Cell 2: Total COGS */}
              <div className="p-4">
                <span className="text-[11px] uppercase tracking-[0.04em] text-[#8B909A] font-semibold block">
                  Cost of Goods (COGS)
                </span>
                <div className="font-condensed text-2xl font-bold text-[#ECEAE6] tabular-nums mt-1">
                  Rs. {salesMetrics.totalCogs.toLocaleString()}
                </div>
                <span className="text-[10px] text-[#8B909A] mt-1 block">Purchase cost of items</span>
              </div>

              {/* Cell 3: Gross Profit */}
              <div className="p-4">
                <span className="text-[11px] uppercase tracking-[0.04em] text-[#8B909A] font-semibold block">
                  Gross Profit
                </span>
                <div className="font-condensed text-2xl font-bold text-[#3DB88B] tabular-nums mt-1">
                  Rs. {salesMetrics.grossProfit.toLocaleString()}
                </div>
                <span className="text-[10px] text-[#3DB88B] font-semibold mt-1 block">
                  {salesMetrics.profitMargin}% margin
                </span>
              </div>

              {/* Cell 4: Products Sold */}
              <div className="p-4">
                <span className="text-[11px] uppercase tracking-[0.04em] text-[#8B909A] font-semibold block">
                  Products Sold
                </span>
                <div className="font-condensed text-2xl font-bold text-[#ECEAE6] tabular-nums mt-1">
                  {salesMetrics.totalQuantitySold}
                </div>
                <span className="text-[10px] text-[#8B909A] mt-1 block">Units dispatched</span>
              </div>

              {/* Cell 5: Cash Sales */}
              <div className="p-4">
                <span className="text-[11px] uppercase tracking-[0.04em] text-[#8B909A] font-semibold block">
                  Cash Collections
                </span>
                <div className="font-condensed text-2xl font-bold text-[#ECEAE6] tabular-nums mt-1">
                  Rs. {salesMetrics.cashSales.toLocaleString()}
                </div>
                <span className="text-[10px] text-[#8B909A] mt-1 block">Front counter drawer</span>
              </div>

              {/* Cell 6: Digital Payments */}
              <div className="p-4">
                <span className="text-[11px] uppercase tracking-[0.04em] text-[#8B909A] font-semibold block">
                  Digital Collections
                </span>
                <div className="font-condensed text-2xl font-bold text-[#ECEAE6] tabular-nums mt-1">
                  Rs. {salesMetrics.digitalSales.toLocaleString()}
                </div>
                <span className="text-[10px] text-[#8B909A] mt-1 block">Cash only</span>
              </div>
            </div>

            {/* Best Seller Banner */}
            {salesMetrics.bestSellingProduct && (
              <div className="p-3.5 rounded-[8px] bg-[#15171A] border border-[#262A30] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-[6px] bg-[#1C1F23] border border-[#262A30] flex items-center justify-center text-[#D9383A]">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#D9383A] tracking-wider">
                      Best-Selling Product of Period
                    </span>
                    <h4 className="font-bold text-sm text-[#ECEAE6]">{salesMetrics.bestSellingProduct.name}</h4>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-condensed text-lg font-bold text-[#ECEAE6] tabular-nums">
                    {salesMetrics.bestSellingProduct.quantity} Sold
                  </div>
                  <span className="text-[10px] text-[#8B909A] font-mono tabular-nums">
                    Revenue: Rs. {salesMetrics.bestSellingProduct.revenue.toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            {/* Product-Wise Sales Report Table */}
            <div className="border border-[#262A30] rounded-[8px] bg-[#15171A] overflow-hidden">
              <div className="p-3.5 border-b border-[#262A30] flex items-center justify-between">
                <h3 className="font-condensed uppercase tracking-[0.04em] text-sm font-bold text-[#ECEAE6]">
                  Product-Wise Sales & Remaining Stock Report
                </h3>
                <span className="text-xs text-[#8B909A]">
                  Showing real-time stock and unit profit margins
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#262A30] bg-[#1C1F23] text-[#8B909A] text-[11px] uppercase tracking-wider">
                      <th className="py-2.5 px-4 font-semibold">Product</th>
                      <th className="py-2.5 px-4 font-semibold">Category</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Sold Units</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Remaining Stock</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Total Revenue</th>
                      <th className="py-2.5 px-4 font-semibold text-right">COGS</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Gross Profit</th>
                      <th className="py-2.5 px-4 font-semibold text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#262A30]">
                    {salesMetrics.productSales.map((item) => (
                      <tr key={item.productId} className="h-11 hover:bg-[#1C1F23]/50 transition-colors">
                        <td className="py-2 px-4 font-medium text-[#ECEAE6]">{item.productName}</td>
                        <td className="py-2 px-4 text-[#8B909A]">{item.category}</td>
                        <td className="py-2 px-4 text-right font-mono font-bold text-[#ECEAE6] tabular-nums">
                          {item.quantitySold}
                        </td>
                        <td className="py-2 px-4 text-right font-mono tabular-nums">
                          <span
                            className={
                              item.remainingStock <= 0
                                ? 'text-[#E5484D] font-bold'
                                : item.remainingStock <= 10
                                ? 'text-[#E5AE4A] font-bold'
                                : 'text-[#ECEAE6]'
                            }
                          >
                            {item.remainingStock}
                          </span>
                        </td>
                        <td className="py-2 px-4 text-right font-mono text-[#ECEAE6] tabular-nums">
                          Rs. {item.revenue.toLocaleString()}
                        </td>
                        <td className="py-2 px-4 text-right font-mono text-[#8B909A] tabular-nums">
                          Rs. {item.cogs.toLocaleString()}
                        </td>
                        <td className="py-2 px-4 text-right font-mono font-bold text-[#3DB88B] tabular-nums">
                          Rs. {item.grossProfit.toLocaleString()}
                        </td>
                        <td className="py-2 px-4 text-center">
                          {item.status === 'OUT_OF_STOCK' ? (
                            <span className="status-pill-danger">Out of Stock</span>
                          ) : item.status === 'LOW_STOCK' ? (
                            <span className="status-pill-warning">Low Stock</span>
                          ) : (
                            <span className="status-pill-success">In Stock</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* SUB-TAB 3: PRODUCT CATALOG & STOCK MANAGEMENT */}
        {/* ======================================================== */}
        {activeSubTab === 'products' && (
          <div className="h-full flex flex-col overflow-hidden">
            {/* Top Toolbar */}
            <div className="p-3.5 border-b border-[#262A30] bg-[#15171A] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-[#8B909A] absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by code, title, supplier..."
                    className="w-full bg-[#1C1F23] border border-[#262A30] rounded-[6px] pl-8 pr-3 py-1.5 text-xs text-[#ECEAE6] focus:ring-2 focus:ring-[#D9383A] focus:outline-none"
                  />
                </div>

                {/* Stock Level Filter */}
                <select
                  value={stockFilter}
                  onChange={(e) => setStockFilter(e.target.value as any)}
                  className="bg-[#1C1F23] border border-[#262A30] rounded-[6px] px-2.5 py-1.5 text-xs text-[#ECEAE6] focus:ring-2 focus:ring-[#D9383A] focus:outline-none"
                >
                  <option value="ALL">All Stock Levels</option>
                  <option value="LOW">Low Stock Only</option>
                  <option value="OUT">Out of Stock Only</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowRestockDrawer(true)}
                  className="px-3 py-1.5 rounded-[6px] bg-[#1C1F23] hover:bg-[#262A30] border border-[#262A30] text-xs font-semibold text-[#ECEAE6] flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-[#8B909A]" />
                  <span>Receive Restock Shipment</span>
                </button>

                <button
                  onClick={() => {
                    setEditingProduct(null);
                    setShowAddProductDrawer(true);
                  }}
                  className="px-3.5 py-1.5 rounded-[6px] bg-[#D9383A] hover:bg-[#C92A2C] text-xs font-bold text-[#ECEAE6] flex items-center gap-1.5 cursor-pointer focus:ring-2 focus:ring-[#D9383A]"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add New Product</span>
                </button>
              </div>
            </div>

            {/* Product Table */}
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-[#1C1F23] border-b border-[#262A30] text-[#8B909A] text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">SKU / Code</th>
                    <th className="py-2.5 px-4 font-semibold">Product Name</th>
                    <th className="py-2.5 px-4 font-semibold">Category</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Purchase Cost</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Selling Price</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Current Stock</th>
                    <th className="py-2.5 px-4 font-semibold">Supplier</th>
                    <th className="py-2.5 px-4 font-semibold text-center">Status</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#262A30]">
                  {filteredProducts.map((p) => {
                    const isOut = p.stockQuantity <= 0;
                    const isLow = p.stockQuantity > 0 && p.stockQuantity <= p.minStockLevel;

                    return (
                      <tr key={p.id} className="h-11 hover:bg-[#1C1F23]/60 transition-colors">
                        <td className="py-2 px-4 font-mono font-bold text-[#ECEAE6]">{p.code}</td>
                        <td className="py-2 px-4 font-medium text-[#ECEAE6]">
                          <div>{p.name}</div>
                          {p.description && <div className="text-[10px] text-[#8B909A] truncate max-w-xs">{p.description}</div>}
                        </td>
                        <td className="py-2 px-4 text-[#8B909A]">{p.category}</td>
                        <td className="py-2 px-4 text-right font-mono text-[#8B909A] tabular-nums">
                          Rs. {p.purchasePrice.toLocaleString()}
                        </td>
                        <td className="py-2 px-4 text-right font-mono font-bold text-[#ECEAE6] tabular-nums">
                          Rs. {p.sellingPrice.toLocaleString()}
                        </td>
                        <td className="py-2 px-4 text-right font-mono font-bold tabular-nums">
                          <span className={isOut ? 'text-[#E5484D]' : isLow ? 'text-[#E5AE4A]' : 'text-[#ECEAE6]'}>
                            {p.stockQuantity} {p.unit || ''}
                          </span>
                        </td>
                        <td className="py-2 px-4 text-[#8B909A] text-[11px] truncate max-w-[150px]">
                          {p.supplierName || '—'}
                        </td>
                        <td className="py-2 px-4 text-center">
                          {isOut ? (
                            <span className="status-pill-danger">Out of Stock</span>
                          ) : isLow ? (
                            <span className="status-pill-warning">Low ({p.minStockLevel} min)</span>
                          ) : (
                            <span className="status-pill-success">Normal</span>
                          )}
                        </td>
                        <td className="py-2 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setAdjustingProduct(p);
                                setAdjustQty(0);
                                setAdjustReason('Physical stock count update');
                                setShowAdjustStockDrawer(true);
                              }}
                              className="px-2 py-1 rounded-[4px] bg-[#1C1F23] hover:bg-[#262A30] border border-[#262A30] text-[11px] text-[#ECEAE6] cursor-pointer"
                              title="Adjust stock (Damage, Expiry, Recount)"
                            >
                              Adjust Stock
                            </button>
                            <button
                              onClick={() => {
                                setEditingProduct(p);
                                setShowAddProductDrawer(true);
                              }}
                              className="px-2 py-1 rounded-[4px] bg-[#1C1F23] hover:bg-[#262A30] border border-[#262A30] text-[11px] text-[#ECEAE6] cursor-pointer"
                            >
                              Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* SUB-TAB 4: RESTOCKING & SHIPMENT PURCHASES */}
        {/* ======================================================== */}
        {activeSubTab === 'purchases' && (
          <div className="h-full overflow-y-auto p-5 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-condensed uppercase tracking-[0.04em] text-lg font-bold text-[#ECEAE6]">
                  Stock Purchases & Supplier Shipments
                </h2>
                <p className="text-xs text-[#8B909A]">
                  Log stock intake from distributors to automatically increment inventory counts and compute weighted cost.
                </p>
              </div>

              <button
                onClick={() => setShowRestockDrawer(true)}
                className="px-3.5 py-1.5 rounded-[6px] bg-[#D9383A] hover:bg-[#C92A2C] text-xs font-bold text-[#ECEAE6] flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Record New Purchase</span>
              </button>
            </div>

            {/* Purchases History Table */}
            <div className="border border-[#262A30] rounded-[8px] bg-[#15171A] overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#262A30] bg-[#1C1F23] text-[#8B909A] text-[11px] uppercase tracking-wider">
                    <th className="py-2.5 px-4 font-semibold">PO Number</th>
                    <th className="py-2.5 px-4 font-semibold">Date</th>
                    <th className="py-2.5 px-4 font-semibold">Supplier</th>
                    <th className="py-2.5 px-4 font-semibold">Items Received</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Total Cost</th>
                    <th className="py-2.5 px-4 font-semibold">Payment</th>
                    <th className="py-2.5 px-4 font-semibold">Received By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#262A30]">
                  {purchases.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-[#8B909A] text-xs">
                        No purchase shipments logged yet. Click "Record New Purchase" above to add stock.
                      </td>
                    </tr>
                  ) : (
                    purchases.map((po) => (
                      <tr key={po.id} className="h-11 hover:bg-[#1C1F23]/50 transition-colors">
                        <td className="py-2 px-4 font-mono font-bold text-[#ECEAE6]">{po.purchaseNumber}</td>
                        <td className="py-2 px-4 font-mono text-[#8B909A]">{po.purchaseDate}</td>
                        <td className="py-2 px-4 font-medium text-[#ECEAE6]">{po.supplierName}</td>
                        <td className="py-2 px-4 text-[#8B909A]">
                          {po.items.map((i) => `${i.productName} (${i.quantity})`).join(', ')}
                        </td>
                        <td className="py-2 px-4 text-right font-mono font-bold text-[#ECEAE6] tabular-nums">
                          Rs. {po.totalCost.toLocaleString()}
                        </td>
                        <td className="py-2 px-4 font-mono text-xs">{po.paymentMethod}</td>
                        <td className="py-2 px-4 text-[#8B909A]">{po.receivedBy}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* SUB-TAB 5: INVENTORY AUDIT & STOCK TRANSACTIONS */}
        {/* ======================================================== */}
        {activeSubTab === 'transactions' && (
          <div className="h-full overflow-y-auto p-5 space-y-4">
            <div>
              <h2 className="font-condensed uppercase tracking-[0.04em] text-lg font-bold text-[#ECEAE6]">
                Inventory Movement Log (Audit Trail)
              </h2>
              <p className="text-xs text-[#8B909A]">
                Complete audit ledger recording every sale deduction, restock shipment, and stock adjustment.
              </p>
            </div>

            <div className="border border-[#262A30] rounded-[8px] bg-[#15171A] overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#262A30] bg-[#1C1F23] text-[#8B909A] text-[11px] uppercase tracking-wider">
                    <th className="py-2.5 px-4 font-semibold">Timestamp</th>
                    <th className="py-2.5 px-4 font-semibold">Product</th>
                    <th className="py-2.5 px-4 font-semibold">Type</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Change</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Prev Stock</th>
                    <th className="py-2.5 px-4 font-semibold text-right">New Stock</th>
                    <th className="py-2.5 px-4 font-semibold">Reference / Reason</th>
                    <th className="py-2.5 px-4 font-semibold">Operator</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#262A30]">
                  {transactions.slice(0, 100).map((t) => (
                    <tr key={t.id} className="h-11 hover:bg-[#1C1F23]/50 transition-colors">
                      <td className="py-2 px-4 font-mono text-[#8B909A] text-[11px]">
                        {new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {t.timestamp.split('T')[0]}
                      </td>
                      <td className="py-2 px-4 font-medium text-[#ECEAE6]">{t.productName}</td>
                      <td className="py-2 px-4">
                        <span
                          className={
                            t.type === 'SALE'
                              ? 'status-pill-neutral'
                              : t.type === 'PURCHASE'
                              ? 'status-pill-success'
                              : t.type === 'DAMAGED' || t.type === 'EXPIRED'
                              ? 'status-pill-danger'
                              : 'status-pill-warning'
                          }
                        >
                          {t.type}
                        </span>
                      </td>
                      <td
                        className={`py-2 px-4 text-right font-mono font-bold tabular-nums ${
                          t.quantityChange > 0 ? 'text-[#3DB88B]' : 'text-[#E5484D]'
                        }`}
                      >
                        {t.quantityChange > 0 ? `+${t.quantityChange}` : t.quantityChange}
                      </td>
                      <td className="py-2 px-4 text-right font-mono text-[#8B909A] tabular-nums">{t.previousStock}</td>
                      <td className="py-2 px-4 text-right font-mono font-bold text-[#ECEAE6] tabular-nums">{t.newStock}</td>
                      <td className="py-2 px-4 text-[#8B909A] truncate max-w-xs">{t.reason || t.referenceId || '—'}</td>
                      <td className="py-2 px-4 text-[#8B909A]">{t.operator}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* SLIDE-OVER DRAWER: ADD / EDIT PRODUCT */}
      {/* ======================================================== */}
      {showAddProductDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-[2px] transition-all">
          <div className="w-[480px] max-w-full bg-[#1C1F23] border-l border-[#262A30] h-full flex flex-col shadow-2xl">
            {/* Header */}
            <div className="p-4 border-b border-[#262A30] flex items-center justify-between bg-[#15171A]">
              <h3 className="font-condensed uppercase tracking-[0.04em] text-base font-bold text-[#ECEAE6]">
                {editingProduct ? 'Edit Product Details' : 'Register New Inventory Product'}
              </h3>
              <button
                onClick={() => setShowAddProductDrawer(false)}
                className="p-1 text-[#8B909A] hover:text-[#ECEAE6] rounded-[4px] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const formData = new FormData(form);

                const productPayload = {
                  code: formData.get('code') as string,
                  name: formData.get('name') as string,
                  category: formData.get('category') as ProductCategory,
                  purchasePrice: Number(formData.get('purchasePrice')) || 0,
                  sellingPrice: Number(formData.get('sellingPrice')) || 0,
                  stockQuantity: Number(formData.get('stockQuantity')) || 0,
                  minStockLevel: Number(formData.get('minStockLevel')) || 5,
                  unit: (formData.get('unit') as string) || 'Piece',
                  supplierName: (formData.get('supplierName') as string) || undefined,
                  description: (formData.get('description') as string) || undefined,
                  expiryDate: (formData.get('expiryDate') as string) || undefined,
                  isActive: true,
                };

                if (editingProduct) {
                  db.updateProduct(editingProduct.id, productPayload);
                  showToast(`Updated ${productPayload.name}`);
                } else {
                  db.addProduct(productPayload);
                  showToast(`Added ${productPayload.name} to inventory`);
                }

                setShowAddProductDrawer(false);
                refreshData();
              }}
              className="flex-1 overflow-y-auto p-5 space-y-4 text-xs"
            >
              <div>
                <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-semibold block mb-1">
                  Product SKU / Code *
                </label>
                <input
                  name="code"
                  type="text"
                  required
                  defaultValue={editingProduct?.code || `PRD-${(products.length + 1).toString().padStart(3, '0')}`}
                  className="w-full bg-[#15171A] border border-[#262A30] rounded-[6px] px-3 py-2 text-xs font-mono text-[#ECEAE6] focus:ring-2 focus:ring-[#D9383A] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-semibold block mb-1">
                  Product Name *
                </label>
                <input
                  name="name"
                  type="text"
                  required
                  defaultValue={editingProduct?.name || ''}
                  placeholder="e.g. Red Bull 250ml or Whey Shake"
                  className="w-full bg-[#15171A] border border-[#262A30] rounded-[6px] px-3 py-2 text-xs text-[#ECEAE6] focus:ring-2 focus:ring-[#D9383A] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-semibold block mb-1">
                    Category *
                  </label>
                  <select
                    name="category"
                    defaultValue={editingProduct?.category || 'Energy Drinks'}
                    className="w-full bg-[#15171A] border border-[#262A30] rounded-[6px] px-3 py-2 text-xs text-[#ECEAE6] focus:ring-2 focus:ring-[#D9383A] focus:outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-semibold block mb-1">
                    Packaging Unit
                  </label>
                  <input
                    name="unit"
                    type="text"
                    defaultValue={editingProduct?.unit || 'Bottle'}
                    placeholder="Bottle, Scoop, Bar, Can, Piece"
                    className="w-full bg-[#15171A] border border-[#262A30] rounded-[6px] px-3 py-2 text-xs text-[#ECEAE6] focus:ring-2 focus:ring-[#D9383A] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-semibold block mb-1">
                    Purchase Cost (PKR) *
                  </label>
                  <input
                    name="purchasePrice"
                    type="number"
                    required
                    min="0"
                    defaultValue={editingProduct?.purchasePrice || 0}
                    className="w-full bg-[#15171A] border border-[#262A30] rounded-[6px] px-3 py-2 text-xs font-mono text-[#ECEAE6] focus:ring-2 focus:ring-[#D9383A] focus:outline-none"
                  />
                  <span className="text-[10px] text-[#8B909A] mt-0.5 block">Used for exact COGS</span>
                </div>

                <div>
                  <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-semibold block mb-1">
                    Selling Price (PKR) *
                  </label>
                  <input
                    name="sellingPrice"
                    type="number"
                    required
                    min="0"
                    defaultValue={editingProduct?.sellingPrice || 0}
                    className="w-full bg-[#15171A] border border-[#262A30] rounded-[6px] px-3 py-2 text-xs font-mono font-bold text-[#D9383A] focus:ring-2 focus:ring-[#D9383A] focus:outline-none"
                  />
                  <span className="text-[10px] text-[#8B909A] mt-0.5 block">Charged at POS counter</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-semibold block mb-1">
                    Current Stock Quantity *
                  </label>
                  <input
                    name="stockQuantity"
                    type="number"
                    required
                    min="0"
                    defaultValue={editingProduct?.stockQuantity !== undefined ? editingProduct.stockQuantity : 24}
                    className="w-full bg-[#15171A] border border-[#262A30] rounded-[6px] px-3 py-2 text-xs font-mono text-[#ECEAE6] focus:ring-2 focus:ring-[#D9383A] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-semibold block mb-1">
                    Min Stock Alert Level *
                  </label>
                  <input
                    name="minStockLevel"
                    type="number"
                    required
                    min="1"
                    defaultValue={editingProduct?.minStockLevel || 6}
                    className="w-full bg-[#15171A] border border-[#262A30] rounded-[6px] px-3 py-2 text-xs font-mono text-[#ECEAE6] focus:ring-2 focus:ring-[#D9383A] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-semibold block mb-1">
                  Supplier Name
                </label>
                <select
                  name="supplierName"
                  defaultValue={editingProduct?.supplierName || ''}
                  className="w-full bg-[#15171A] border border-[#262A30] rounded-[6px] px-3 py-2 text-xs text-[#ECEAE6] focus:ring-2 focus:ring-[#D9383A] focus:outline-none"
                >
                  <option value="">Select or type supplier...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.name}>{s.name} ({s.city})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-semibold block mb-1">
                  Expiry Date (Optional)
                </label>
                <input
                  name="expiryDate"
                  type="date"
                  defaultValue={editingProduct?.expiryDate || ''}
                  className="w-full bg-[#15171A] border border-[#262A30] rounded-[6px] px-3 py-2 text-xs font-mono text-[#ECEAE6] focus:ring-2 focus:ring-[#D9383A] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-semibold block mb-1">
                  Description / Serving Notes
                </label>
                <textarea
                  name="description"
                  rows={2}
                  defaultValue={editingProduct?.description || ''}
                  placeholder="Notes about dosage, refrigeration, or size..."
                  className="w-full bg-[#15171A] border border-[#262A30] rounded-[6px] px-3 py-2 text-xs text-[#ECEAE6] focus:ring-2 focus:ring-[#D9383A] focus:outline-none"
                />
              </div>

              {/* Sticky footer */}
              <div className="pt-4 border-t border-[#262A30] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddProductDrawer(false)}
                  className="px-3.5 py-2 rounded-[6px] bg-[#15171A] hover:bg-[#262A30] text-[#ECEAE6] text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-[6px] bg-[#D9383A] hover:bg-[#C92A2C] text-[#ECEAE6] text-xs font-bold uppercase tracking-wider cursor-pointer focus:ring-2 focus:ring-[#D9383A]"
                >
                  {editingProduct ? 'Save Changes' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SLIDE-OVER DRAWER: STOCK ADJUSTMENT (DAMAGE/EXPIRY/RECOUNT) */}
      {/* ======================================================== */}
      {showAdjustStockDrawer && adjustingProduct && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-[2px]">
          <div className="w-[440px] max-w-full bg-[#1C1F23] border-l border-[#262A30] h-full flex flex-col shadow-2xl">
            <div className="p-4 border-b border-[#262A30] flex items-center justify-between bg-[#15171A]">
              <h3 className="font-condensed uppercase tracking-[0.04em] text-base font-bold text-[#ECEAE6]">
                Adjust Stock — {adjustingProduct.name}
              </h3>
              <button onClick={() => setShowAdjustStockDrawer(false)} className="text-[#8B909A] hover:text-[#ECEAE6]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                db.adjustStock(adjustingProduct.id, adjustQty, adjustReason, adjustType);
                showToast(`Stock updated for ${adjustingProduct.name}`);
                setShowAdjustStockDrawer(false);
                refreshData();
              }}
              className="p-5 space-y-4 text-xs flex-1 overflow-y-auto"
            >
              <div className="p-3 rounded-[6px] bg-[#15171A] border border-[#262A30] space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#8B909A]">Current System Stock:</span>
                  <span className="font-mono font-bold text-[#ECEAE6]">{adjustingProduct.stockQuantity} {adjustingProduct.unit}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B909A]">Resulting Stock:</span>
                  <span className="font-mono font-bold text-[#D9383A]">
                    {Math.max(0, adjustingProduct.stockQuantity + adjustQty)} {adjustingProduct.unit}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-semibold block mb-1">
                  Adjustment Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['ADJUSTMENT', 'DAMAGED', 'EXPIRED'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setAdjustType(type)}
                      className={`py-1.5 rounded-[6px] border text-[11px] font-semibold text-center cursor-pointer ${
                        adjustType === type
                          ? 'bg-[#D9383A] border-[#D9383A] text-[#ECEAE6]'
                          : 'bg-[#15171A] border-[#262A30] text-[#8B909A]'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-semibold block mb-1">
                  Quantity Change (+ to add, - to subtract)
                </label>
                <input
                  type="number"
                  required
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(Number(e.target.value))}
                  placeholder="-2 or +5"
                  className="w-full bg-[#15171A] border border-[#262A30] rounded-[6px] px-3 py-2 text-xs font-mono font-bold text-[#ECEAE6] focus:ring-2 focus:ring-[#D9383A] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-semibold block mb-1">
                  Reason for Adjustment *
                </label>
                <input
                  type="text"
                  required
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. Broken bottle, expired batch, physical inventory recount"
                  className="w-full bg-[#15171A] border border-[#262A30] rounded-[6px] px-3 py-2 text-xs text-[#ECEAE6] focus:ring-2 focus:ring-[#D9383A] focus:outline-none"
                />
              </div>

              <div className="pt-4 border-t border-[#262A30] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdjustStockDrawer(false)}
                  className="px-3 py-1.5 rounded-[6px] bg-[#15171A] hover:bg-[#262A30] text-xs font-semibold text-[#ECEAE6]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-[6px] bg-[#D9383A] hover:bg-[#C92A2C] text-xs font-bold text-[#ECEAE6] uppercase tracking-wider"
                >
                  Commit Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SLIDE-OVER DRAWER: RECEIVE RESTOCK SHIPMENT */}
      {/* ======================================================== */}
      {showRestockDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-[2px]">
          <div className="w-[500px] max-w-full bg-[#1C1F23] border-l border-[#262A30] h-full flex flex-col shadow-2xl">
            <div className="p-4 border-b border-[#262A30] flex items-center justify-between bg-[#15171A]">
              <h3 className="font-condensed uppercase tracking-[0.04em] text-base font-bold text-[#ECEAE6]">
                Receive Supplier Stock Shipment
              </h3>
              <button onClick={() => setShowRestockDrawer(false)} className="text-[#8B909A] hover:text-[#ECEAE6]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmRestock} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-semibold block mb-1">
                    Supplier Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={restockSupplier}
                    onChange={(e) => setRestockSupplier(e.target.value)}
                    placeholder="e.g. Sindh Beverage Traders"
                    className="w-full bg-[#15171A] border border-[#262A30] rounded-[6px] px-3 py-2 text-xs text-[#ECEAE6] focus:ring-2 focus:ring-[#D9383A] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-semibold block mb-1">
                    Contact / Invoice Ref
                  </label>
                  <input
                    type="text"
                    value={restockSupplierContact}
                    onChange={(e) => setRestockSupplierContact(e.target.value)}
                    placeholder="Invoice # or phone"
                    className="w-full bg-[#15171A] border border-[#262A30] rounded-[6px] px-3 py-2 text-xs text-[#ECEAE6] focus:ring-2 focus:ring-[#D9383A] focus:outline-none"
                  />
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2.5">
                <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-semibold flex items-center justify-between">
                  <span>Shipment Products</span>
                  <button
                    type="button"
                    onClick={() =>
                      setRestockItems([...restockItems, { productId: '', quantity: 12, unitPurchasePrice: 0 }])
                    }
                    className="text-[#D9383A] font-bold text-[11px] hover:underline cursor-pointer"
                  >
                    + Add Another Product
                  </button>
                </label>

                {restockItems.map((item, index) => (
                  <div key={index} className="p-3 rounded-[6px] bg-[#15171A] border border-[#262A30] space-y-2">
                    <div className="flex items-center justify-between">
                      <select
                        required
                        value={item.productId}
                        onChange={(e) => {
                          const p = products.find((pr) => pr.id === e.target.value);
                          const updated = [...restockItems];
                          updated[index].productId = e.target.value;
                          if (p) {
                            updated[index].unitPurchasePrice = p.purchasePrice;
                          }
                          setRestockItems(updated);
                        }}
                        className="flex-1 bg-[#1C1F23] border border-[#262A30] rounded-[4px] px-2.5 py-1.5 text-xs text-[#ECEAE6]"
                      >
                        <option value="">Select product to restock...</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.code} — {p.name} (Stock: {p.stockQuantity})
                          </option>
                        ))}
                      </select>

                      {restockItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setRestockItems(restockItems.filter((_, i) => i !== index))}
                          className="ml-2 text-[#8B909A] hover:text-[#E5484D]"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] text-[#8B909A] block mb-0.5">Quantity Received</span>
                        <input
                          type="number"
                          required
                          min="1"
                          value={item.quantity}
                          onChange={(e) => {
                            const updated = [...restockItems];
                            updated[index].quantity = Number(e.target.value) || 0;
                            setRestockItems(updated);
                          }}
                          className="w-full bg-[#1C1F23] border border-[#262A30] rounded-[4px] px-2 py-1 text-xs font-mono text-[#ECEAE6]"
                        />
                      </div>

                      <div>
                        <span className="text-[10px] text-[#8B909A] block mb-0.5">Unit Purchase Cost (PKR)</span>
                        <input
                          type="number"
                          required
                          min="0"
                          value={item.unitPurchasePrice}
                          onChange={(e) => {
                            const updated = [...restockItems];
                            updated[index].unitPurchasePrice = Number(e.target.value) || 0;
                            setRestockItems(updated);
                          }}
                          className="w-full bg-[#1C1F23] border border-[#262A30] rounded-[4px] px-2 py-1 text-xs font-mono text-[#ECEAE6]"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-semibold block mb-1">
                  Payment Method
                </label>
                <select
                  value={restockPaymentMethod}
                  onChange={(e) => setRestockPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full bg-[#15171A] border border-[#262A30] rounded-[6px] px-3 py-2 text-xs text-[#ECEAE6]"
                >
                  <option value="Cash">Cash on Delivery</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider text-[#8B909A] font-semibold block mb-1">
                  Shipment Notes
                </label>
                <textarea
                  rows={2}
                  value={restockNotes}
                  onChange={(e) => setRestockNotes(e.target.value)}
                  placeholder="Delivery truck, gate pass, or batch remarks..."
                  className="w-full bg-[#15171A] border border-[#262A30] rounded-[6px] px-3 py-2 text-xs text-[#ECEAE6]"
                />
              </div>

              <div className="pt-4 border-t border-[#262A30] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRestockDrawer(false)}
                  className="px-3 py-1.5 rounded-[6px] bg-[#15171A] text-xs font-semibold text-[#ECEAE6]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-[6px] bg-[#D9383A] hover:bg-[#C92A2C] text-xs font-bold text-[#ECEAE6] uppercase tracking-wider"
                >
                  Confirm & Update Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL / PRINTABLE DRAWER: SALE RECEIPT */}
      {/* ======================================================== */}
      {showReceiptDrawer && lastCompletedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-[2px]">
          <div className="w-full max-w-sm bg-[#15171A] border border-[#262A30] rounded-[8px] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-3 border-b border-[#262A30] flex items-center justify-between bg-[#1C1F23]">
              <span className="font-condensed uppercase tracking-[0.04em] text-xs font-bold text-[#ECEAE6]">
                Sales Receipt Generated
              </span>
              <button onClick={() => setShowReceiptDrawer(false)} className="text-[#8B909A] hover:text-[#ECEAE6]">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Receipt Printable Preview (80mm style) */}
            <div className="p-5 font-mono text-[11px] leading-relaxed bg-[#0D0E10] border-b border-[#262A30] text-[#ECEAE6] select-text print-inventory-receipt">
              <div className="text-center pb-3 border-b border-dashed border-[#262A30]">
                <div className="font-bold text-sm text-[#ECEAE6] tracking-wider uppercase">THE GYM TOWN</div>
                <div className="text-[10px] text-[#8B909A]">Hyderabad District Station</div>
                <div className="text-[9px] text-[#8B909A] mt-0.5">Ph: +92 22 2781 440</div>
              </div>

              <div className="py-2.5 space-y-1 text-[10px] border-b border-dashed border-[#262A30]">
                <div className="flex justify-between">
                  <span className="text-[#8B909A]">Invoice:</span>
                  <span className="font-bold text-[#ECEAE6]">{lastCompletedSale.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B909A]">Date/Time:</span>
                  <span>{new Date(lastCompletedSale.createdAt).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B909A]">Cashier:</span>
                  <span>{lastCompletedSale.soldBy}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B909A]">Customer:</span>
                  <span className="font-bold text-[#ECEAE6]">{lastCompletedSale.memberName}</span>
                </div>
              </div>

              {/* Items Table */}
              <div className="py-2.5 space-y-1.5 border-b border-dashed border-[#262A30]">
                {lastCompletedSale.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between text-[11px]">
                    <div className="flex-1 pr-2">
                      <div className="text-[#ECEAE6] font-medium">{it.productName}</div>
                      <div className="text-[9px] text-[#8B909A]">{it.quantity} x Rs. {it.unitSellingPrice}</div>
                    </div>
                    <span className="font-bold tabular-nums">Rs. {it.subtotal.toLocaleString()}</span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="pt-2.5 space-y-1 text-xs">
                {lastCompletedSale.discount > 0 && (
                  <div className="flex justify-between text-[#8B909A]">
                    <span>Discount:</span>
                    <span>-Rs. {lastCompletedSale.discount}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm text-[#ECEAE6]">
                  <span>TOTAL PAID:</span>
                  <span className="text-[#D9383A]">Rs. {lastCompletedSale.totalAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[10px] text-[#8B909A]">
                  <span>Method:</span>
                  <span>{lastCompletedSale.paymentMethod}</span>
                </div>
              </div>

              <div className="text-center pt-3 text-[9px] text-[#8B909A]">
                Thank you for training with The Gym Town Hyderabad!
              </div>
            </div>

            {/* Actions */}
            <div className="p-3 bg-[#15171A] flex items-center justify-end gap-2">
              <button
                onClick={() => setShowReceiptDrawer(false)}
                className="px-3 py-1.5 rounded-[6px] bg-[#1C1F23] text-xs font-semibold text-[#ECEAE6] cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => {
                  void printDocument('inventory-receipt');
                }}
                className="px-4 py-1.5 rounded-[6px] bg-[#D9383A] hover:bg-[#C92A2C] text-xs font-bold text-[#ECEAE6] flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
