# Expense Splitter PWA

A complete, standalone Progressive Web App for splitting group expenses among friends and roommates. Works like Splitwise but 100% client-side with no backend server - all data is stored locally in your browser using IndexedDB.

## Features

### Core Functionality
- ✅ **Simple "login"** - Set your username once, stored locally
- ✅ **Groups** - Create, edit, and delete expense groups
- ✅ **Members** - Add/remove members to groups
- ✅ **Multiple Currencies** - Support for PKR, USD, EUR, GBP, INR, AED, SAR
- ✅ **Expense Tracking** - Full expense management with descriptions, amounts, dates, and categories
- ✅ **Flexible Splitting**:
  - Equally among all members
  - By percentage
  - Unequal/fixed amounts
- ✅ **Balance Calculation** - Automatically tracks who owes whom
- ✅ **Debt Simplification** - Smart algorithm minimizes the number of transactions needed
- ✅ **Settlements** - Record payments with payment methods (JazzCash, EasyPaisa, Cash, etc.)
- ✅ **History** - Complete chronological history of expenses and settlements
- ✅ **Search & Filter** - Search expenses by description or member, filter by category

### Extra Features
- ✅ **Export/Import** - Backup and restore all your data as JSON
- ✅ **WhatsApp Sharing** - Share settlement summaries directly on WhatsApp
- ✅ **Categories** - Pre-defined expense categories (Food, Rent, Utilities, etc.)
- ✅ **Receipt Notes** - Add notes for expenses
- ✅ **PWA Support** - Install on your device, works offline
- ✅ **Dark Mode** - Automatic dark mode support
- ✅ **Mobile-First Design** - Fully responsive interface

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript 5
- **Storage**: IndexedDB (via `idb` library)
- **UI**: Tailwind CSS 4 + shadcn/ui components
- **Icons**: Lucide React
- **Date Handling**: date-fns
- **PWA**: Custom service worker and manifest

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Main application component (all UI logic)
│   ├── layout.tsx            # Root layout with PWA setup
│   └── globals.css           # Global styles
├── components/
│   ├── ui/                   # shadcn/ui components
│   └── service-worker-registration.tsx
├── lib/
│   ├── storage.ts            # IndexedDB operations (all data persistence)
│   └── calculations.ts       # Expense calculations & debt simplification
└── hooks/
    └── use-toast.ts          # Toast notifications

public/
├── manifest.json             # PWA manifest
├── sw.js                     # Service worker for offline support
├── icon-192x192.png          # PWA icon (small)
└── icon-512x512.png          # PWA icon (large)
```

## How It Works

### Storage Layer (`lib/storage.ts`)
The app uses IndexedDB via the `idb` library for persistent client-side storage. Key features:

- **Structured data**: Separate stores for groups, expenses, settlements, and settings
- **Indexed queries**: Fast lookups by group ID, date, etc.
- **Type-safe**: Full TypeScript support with defined schemas
- **Export/Import**: Complete backup and restore functionality

### Debt Simplification Algorithm (`lib/calculations.ts`)
The debt simplification algorithm minimizes transactions:

1. Calculate each member's net balance (positive = owed money, negative = owes money)
2. Separate into creditors and debtors
3. Match largest creditor with largest debtor repeatedly
4. Continue until all debts are settled

This ensures the minimum number of transactions to settle all debts.

### UI Architecture (`src/app/page.tsx`)
- **View-based navigation**: Dashboard → Groups → Group Detail
- **Tabbed interface**: Balances | Add Expense | History
- **Modal-driven**: All actions (add, edit, delete) use modals
- **Real-time updates**: Balances recalculate automatically when expenses/settlements change

## Getting Started

### Prerequisites
- Node.js 18+ and Bun

### Installation
```bash
bun install
```

### Development
```bash
bun run dev
```
The app will be available at `http://localhost:3000`

### Build for Production
```bash
bun run build
bun start
```

### Linting
```bash
bun run lint
```

## Usage Guide

### First Time Setup
1. Open the app in your browser
2. Enter your username (e.g., "Ahmed")
3. This will be saved locally and shown as "You" throughout the app

### Creating a Group
1. Click "New Group" on the dashboard
2. Enter a group name (e.g., "Roommates", "Trip to Lahore")
3. You're automatically added as the first member
4. Add more members using the "+ Add member" button

### Adding an Expense
1. Navigate to a group
2. Go to the "Add Expense" tab
3. Fill in:
   - Description (e.g., "Dinner at restaurant")
   - Amount (e.g., 5000)
   - Date (defaults to today)
   - Who paid (select from members)
   - Split type:
     - **Equal**: Divides equally among all members
     - **Percentage**: Enter percentage for each member (must sum to 100%)
     - **Fixed**: Enter exact amount per member (must equal total)
   - Category (optional)
   - Receipt note (optional)
4. Click "Add Expense"

### Viewing Balances
1. Go to the "Balances" tab in a group
2. See simplified debts showing who should pay whom
3. Click "Record Payment" to log a settlement
4. View each member's total owed/receivable amounts

### Settling Up
1. From "Balances" tab, click "Record Payment" on any debt
2. Fill in payment details:
   - From (payer)
   - To (receiver)
   - Amount
   - Date
   - Payment method (Cash, JazzCash, EasyPaisa, etc.)
   - Note (optional)
3. Click "Record Payment"
4. The settlement is saved and balances are updated

### Viewing History
1. Go to the "History" tab in a group
2. See all expenses and settlements in chronological order
3. Search by description or member name
4. Filter by category
5. Edit or delete any entry

### Managing Groups
- **Edit group name**: Click Settings → Update Name
- **Change currency**: Click Settings → Select Currency
- **Delete group**: Click Settings → Delete Group (⚠️ permanent)
- **Add members**: Click the + button in the header
- **Remove members**: Click X on member badge (can't remove yourself)

### Exporting/Importing Data
1. Click Settings gear icon (top right)
2. **Export**: Click "Export All Data" - downloads JSON backup
3. **Import**: Select a JSON backup file to restore
4. This is useful for backup, transfer to another device, or sharing data

### Sharing on WhatsApp
1. In a group's "Balances" tab
2. Click "Share" button
3. Opens WhatsApp with pre-formatted settlement summary
4. Send to group chat to inform everyone about pending payments

## PWA Features

### Installing the App
1. Open the app in Chrome, Safari, or Edge on mobile or desktop
2. Look for "Install" or "Add to Home Screen" in browser menu
3. Follow the prompts to install
4. App will work offline and have its own icon

### Offline Support
- The app works completely offline after first load
- All data is stored locally in IndexedDB
- Service worker caches static assets
- Perfect for use during travel or in areas with poor connectivity

## Data Storage

All data is stored in your browser's IndexedDB:

| Store | Description |
|-------|-------------|
| `settings` | App-wide settings (username) |
| `groups` | Group information, members, currency |
| `expenses` | All expense records |
| `settlements` | All payment/settlement records |

Data is **not synced** to any server - it's completely private and local to your device.

## Privacy & Security

- ✅ No account or authentication required
- ✅ No data sent to any server
- ✅ All data stays in your browser
- ✅ Works completely offline
- ✅ Export your data anytime as JSON backup

## Browser Compatibility

- Chrome/Edge 90+
- Safari 14+
- Firefox 88+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Limitations

- Data is device-specific (no sync between devices)
- No real-time collaboration
- Deleting a group permanently deletes all its expenses and settlements
- Maximum storage depends on browser's IndexedDB limits (typically 50-80% of available disk space)

## Pakistani-Specific Features

- **Default Currency**: PKR (Pakistani Rupee)
- **Payment Methods**: JazzCash, EasyPaisa support
- **Local Names**: Works perfectly with Pakistani names (Ahmed, Ali, Fatima, etc.)
- **WhatsApp Integration**: Easy sharing on WhatsApp (popular in Pakistan)

## Contributing

This is a standalone PWA with no backend. To modify:

1. Edit the relevant files in `src/` directory
2. Run `bun run lint` to check code quality
3. Test thoroughly in your browser's dev tools
4. Service worker updates may require clearing cache

## Troubleshooting

### App not loading data
- Check browser console for IndexedDB errors
- Try clearing browser cache and reloading
- Export your data and re-import after clearing storage

### PWA not installing
- Ensure you're visiting over HTTPS (or localhost)
- Check browser supports PWA installation
- Try in a different browser

### Service worker issues
- Open DevTools → Application → Service Workers
- Click "Update on reload" for development
- Unregister and reload to clear cache

## License

This project is open source and available for personal and commercial use.

## Credits

Built with modern web technologies:
- Next.js 16
- shadcn/ui components
- Tailwind CSS 4
- idb (IndexedDB wrapper)
- date-fns
- Lucide icons
