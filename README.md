# Short-Stay Accounts

Private desktop booking, payment, expense, staff-allocation, and accounting software for a small short-stay property. It runs locally on Windows and macOS and stores the business in an encrypted SQLite file.

## Features

- Manual booking and guest records for multiple units
- Payment allocation, refunds, corrections, and balances due
- Property expenses, suppliers, recurring reviews, assets, and loans
- Activity-based staff allocation and referral commission
- Uganda individual rental-tax estimate using the 12% annual rate and UGX 2,820,000 threshold
- Daily command center, month close, financial statements, ratios, Excel export, and print
- Encrypted local backup and password-gated restore

## Development

Requirements: Node.js 22 and npm 10.

```bash
npm ci
npm start
```

Validation:

```bash
npm run typecheck
npm test
npm run test:e2e
```

## User guide

Start with the [complete beginner handbook](docs/user-guide/short-stay-accounts-handbook.md) for an A-to-Z walkthrough with real app screenshots, recorded workflows, checklists, troubleshooting, and a client demonstration script.

Inside the application, select **Help** in the command bar to search the guide or begin a guided tour of the current workflow.

## Windows installer

Download the current [Short-Stay Accounts v0.3.4 Windows installer](https://github.com/Turigye/shortstay-accounts/releases/download/v0.3.4/Short-Stay.Accounts-0.3.4.Setup.exe).

Installing v0.3.4 over an earlier version keeps the existing encrypted local business file, password, profiles, bookings, reports, and settings. Create an encrypted backup before any software update as normal operating practice.

To produce a fresh development build, open the repository's **Actions** tab, run **Build Windows**, and download the `shortstay-accounts-windows-x64` artifact. Extract it and run the generated `Setup.exe` file.

The installer is currently unsigned, so Windows SmartScreen may show an unknown-publisher warning. Production signing requires a Windows code-signing certificate; the application itself and its encrypted native database are built and tested in the Windows workflow.

## macOS package

```bash
npm run make
npm run package:probe
```

## Tax boundary

The rental-tax figure is an estimate for an individual landlord: 12% of annual gross rental income above UGX 2,820,000. It is not a tax return or URA assessment. See [the research notes](docs/research/easyaccounts-market-notes.md).
