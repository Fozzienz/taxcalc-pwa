# TaxTrack

Private Australian Tax & EOFY Calculator. It helps you organise working-from-home hours, receipts, and deduction totals before you lodge in ATO myTax. Records and receipt files stay in this browser. There is no account and no database.

```bash
npm install
npm run dev
```

Open the local address printed by Next.js. If port 3000 is already in use, start with `npm run dev -- -p 3001`. Use the menu, then Data and backup, to export or import a JSON file when you move between devices. Photos are compressed JPEGs. PDF and Word invoices are kept as the original file. All of them travel inside that backup.

The working-from-home figure uses the ATO fixed rate of 70 cents an hour for the 2025–26 income year. Cents are disregarded. Tools and equipment over $300 are flagged as depreciating assets and kept out of the immediate total. Queensland public holidays, including Labour Day, the Ekka, and the King's Birthday, are highlighted on the calendar. The Ekka date is for the Brisbane area only.

This is an organiser, not a tax agent and not the ATO. Check every figure before you lodge.
