import { useSyncExternalStore } from 'react'
import type { OrderStatus } from '@/types/api'

/**
 * Texts of the customer pages (QR menu, My orders) in Turkish and English.
 * The guest picks the language with the TR / EN switch; the first visit follows the phone's language.
 * Menu content (dish names, descriptions) is shown as entered by the restaurant.
 */
export type Lang = 'tr' | 'en'

const tr = {
  menu: 'Menü',
  myOrders: 'Siparişlerim',
  search: 'Menüde ara…',
  clearSearch: 'Aramayı temizle',
  noResults: (q: string) => `“${q}” için sonuç bulunamadı`,
  resultsFor: (n: number, q: string) => `“${q}” için ${n} sonuç`,
  favourites: 'Şefin önerileri',
  categories: 'Kategoriler',
  items: (n: number) => `${n} ürün`,
  top: 'Öne çıkan',
  soldOut: 'Tükendi',
  add: (name: string) => `${name} ekle`,
  decrease: 'Azalt',
  remove: 'Kaldır',
  increase: 'Artır',
  details: (name: string) => `${name} — ayrıntılar`,
  prepTime: (n: number) => `~${n} dk`,
  viewOrder: 'Sepeti gör',
  yourOrder: 'Siparişiniz',
  emptyCart: 'Sepetiniz boş',
  emptyCartHint: 'Ürünlerin yanındaki + düğmesiyle ekleyin.',
  noteForKitchen: 'Mutfağa not',
  notePlaceholder: 'örn. şekersiz, az acılı, soğansız',
  lineNote: 'Not ekle (örn. şekersiz)',
  yourName: 'Adınız (isteğe bağlı)',
  phone: 'Telefon (isteğe bağlı)',
  orderNote: 'Sipariş notu (alerji vb.)',
  subtotal: 'Ara toplam',
  tax: (rate: number) => `KDV (%${rate})`,
  total: 'Toplam',
  payAtTable: 'Ödemeyi yemekten sonra masanızda yaparsınız.',
  placeOrder: 'Siparişi gönder',
  addToCart: (price: string) => `Sepete ekle · ${price}`,
  close: 'Kapat',
  freshlyPrepared: 'Mutfağımızda taze hazırlanır.',
  soldOutToday: 'Bugün için tükendi.',
  orderingOff: 'Menüye göz atın — sipariş için lütfen garsonumuzu çağırın.',
  menuUnavailable: 'Menü açılamadı',
  invalidQr: 'Bu QR kod geçerli değil. Lütfen garsona sorun.',
  tryAgain: 'Tekrar dene',
  inProgress: (n: number) => `${n} sipariş hazırlanıyor`,
  track: 'Takip et',
  pricesNote: (rate: number, name: string) => `Fiyatlara ödeme sırasında %${rate} KDV eklenir · ${name}`,
  // My orders
  liveSubtitle: (n: number) => `${n} sipariş hazırlanıyor — bu sayfa canlı güncellenir.`,
  fromThisPhone: 'Bu telefondan verdiğiniz siparişler.',
  noOrdersYet: 'Henüz siparişiniz yok',
  scanHint: 'Menüyü açmak ve sipariş vermek için masanızdaki QR kodu okutun.',
  openMenu: 'Menüyü aç',
  orderMore: 'Yeni ürün ekle',
  orderNo: (n: number) => `Sipariş #${n}`,
  takeaway: 'Paket',
  readyBanner: 'SİPARİŞİNİZ HAZIR',
  cancelledText: 'Bu sipariş iptal edildi. Lütfen garsona sorun.',
  completedText: 'Tamamlandı — bizi tercih ettiğiniz için teşekkürler!',
  steps: { Pending: 'Alındı', Confirmed: 'Onay', Preparing: 'Mutfakta', Ready: 'Hazır', Served: 'Servis' } as Partial<Record<OrderStatus, string>>,
  headline: {
    Pending: 'Mutfağın onayı bekleniyor',
    Confirmed: 'Onaylandı — sırada',
    Preparing: 'Şu anda hazırlanıyor',
    Ready: 'Hazır! Siparişiniz masanıza geliyor',
    Served: 'Servis edildi — afiyet olsun',
  } as Partial<Record<OrderStatus, string>>,
  progress: 'Sipariş durumu',
  readyTitle: 'Siparişiniz hazır!',
  readyBody: (n: number, table: string | null) => `Sipariş #${n}${table ? ` · ${table}` : ''} — masanıza getiriliyor.`,
  ok: 'Tamam',
  notifyOn: 'Bildirimler açık — siparişiniz hazır olduğunda ekran kilitliyken bile haber vereceğiz.',
  notifyTitle: 'Hazır olunca haber alın',
  notifyBody: 'Bu telefona bildirim göndereceğiz — sayfayı kapatabilir veya ekranı kilitleyebilirsiniz.',
  notifyButton: 'Bildirimleri aç',
  notifyDenied: 'Bildirimler tarayıcı ayarlarında kapalı. Bu sayfayı açık tutun — siparişiniz hazır olduğunda ses ve titreşimle uyaracağız.',
  notifyInPage: 'Bu sayfayı açık tutun — siparişiniz hazır olduğunda telefonunuz burada çalacak ve titreyecek.',
  dismiss: 'Kapat',
  localReadyTitle: 'Siparişiniz hazır! 🍽️',
  localReadyBody: (n: number, table: string | null) => `Sipariş #${n}${table ? ` · ${table}` : ''} hazır.`,
  language: 'Dil',
}

type Texts = typeof tr

const en: Texts = {
  menu: 'Menu',
  myOrders: 'My orders',
  search: 'Search the menu…',
  clearSearch: 'Clear search',
  noResults: (q) => `No results for “${q}”`,
  resultsFor: (n, q) => `${n} result${n === 1 ? '' : 's'} for “${q}”`,
  favourites: "Chef's favourites",
  categories: 'Categories',
  items: (n) => `${n} item${n === 1 ? '' : 's'}`,
  top: 'Top',
  soldOut: 'Sold out',
  add: (name) => `Add ${name}`,
  decrease: 'Decrease',
  remove: 'Remove',
  increase: 'Increase',
  details: (name) => `${name} — details`,
  prepTime: (n) => `~${n} min`,
  viewOrder: 'View your order',
  yourOrder: 'Your order',
  emptyCart: 'Your order is empty',
  emptyCartHint: 'Tap + next to a dish to add it.',
  noteForKitchen: 'Note for the kitchen',
  notePlaceholder: 'e.g. no sugar, extra hot, no onions',
  lineNote: 'Add a note (e.g. no sugar)',
  yourName: 'Your name (optional)',
  phone: 'Phone (optional)',
  orderNote: 'Order note (allergies…)',
  subtotal: 'Subtotal',
  tax: (rate) => `Tax (${rate}%)`,
  total: 'Total',
  payAtTable: "You pay at your masa when you're done.",
  placeOrder: 'Place order',
  addToCart: (price) => `Add · ${price}`,
  close: 'Close',
  freshlyPrepared: 'Freshly prepared in our kitchen.',
  soldOutToday: 'Sold out for today.',
  orderingOff: 'Browse our menu — please order with your waiter.',
  menuUnavailable: 'Menu unavailable',
  invalidQr: 'This QR code is not valid. Please ask a waiter.',
  tryAgain: 'Try again',
  inProgress: (n) => `${n} order${n === 1 ? '' : 's'} in progress`,
  track: 'Track',
  pricesNote: (rate, name) => `Prices exclude ${rate}% tax, added at checkout · ${name}`,
  liveSubtitle: (n) => `${n} order${n === 1 ? '' : 's'} in progress — this page updates live.`,
  fromThisPhone: 'Orders placed from this phone.',
  noOrdersYet: 'No orders yet',
  scanHint: 'Scan the QR code on your masa to see the menu and order.',
  openMenu: 'Open the menu',
  orderMore: 'Order more',
  orderNo: (n) => `Order #${n}`,
  takeaway: 'Takeaway',
  readyBanner: 'YOUR ORDER IS READY',
  cancelledText: 'This order was cancelled. Please ask a waiter.',
  completedText: 'Completed — thank you for your visit!',
  steps: { Pending: 'Received', Confirmed: 'Accepted', Preparing: 'Preparing', Ready: 'Ready', Served: 'Served' },
  headline: {
    Pending: 'Waiting for the kitchen to accept',
    Confirmed: 'Accepted — in the queue',
    Preparing: 'Being prepared now',
    Ready: 'Ready! Your order is on its way',
    Served: 'Served — enjoy your meal',
  },
  progress: 'Order progress',
  readyTitle: 'Your order is ready!',
  readyBody: (n, table) => `Order #${n}${table ? ` · ${table}` : ''} — it's on its way to you.`,
  ok: 'OK',
  notifyOn: "Notifications are on — we'll tell you the moment your order is ready, even with your screen locked.",
  notifyTitle: "Get notified when it's ready",
  notifyBody: "We'll send a notification to this phone — you can close the page or lock your screen.",
  notifyButton: 'Turn on notifications',
  notifyDenied: 'Notifications are blocked in your browser settings. Keep this page open — it will alert you with sound and vibration when your order is ready.',
  notifyInPage: 'Keep this page open — your phone will ring and vibrate here the moment your order is ready.',
  dismiss: 'Dismiss',
  localReadyTitle: 'Your order is ready! 🍽️',
  localReadyBody: (n, table) => `Order #${n}${table ? ` · ${table}` : ''} is ready.`,
  language: 'Language',
}

const texts: Record<Lang, Texts> = { tr, en }
const KEY = 'faro.menu.lang'

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'tr' || saved === 'en') return saved
  } catch {
    /* ignore */
  }
  return navigator.language?.toLowerCase().startsWith('tr') ? 'tr' : 'en'
}

let current: Lang = initialLang()
const listeners = new Set<() => void>()

/** Lets the service worker word push notifications in the guest's language. */
function shareWithServiceWorker(lang: Lang) {
  if (!('caches' in window)) return
  void caches
    .open('faro-prefs')
    .then((c) => c.put('/menu/__lang', new Response(lang)))
    .catch(() => undefined)
}

export function getCustomerLang() {
  return current
}

export function customerTexts(lang: Lang = current) {
  return texts[lang]
}

export function setCustomerLang(lang: Lang) {
  current = lang
  try {
    localStorage.setItem(KEY, lang)
  } catch {
    /* ignore */
  }
  document.documentElement.lang = lang
  shareWithServiceWorker(lang)
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Current customer language + its texts; re-renders when the guest switches TR / EN. */
export function useCustomerText() {
  const lang = useSyncExternalStore(subscribe, getCustomerLang, getCustomerLang)
  return { lang, t: texts[lang], setLang: setCustomerLang }
}

/** Marks the document language for screen readers and the service worker (call once per customer page). */
export function applyCustomerLang() {
  document.documentElement.lang = current
  shareWithServiceWorker(current)
}
