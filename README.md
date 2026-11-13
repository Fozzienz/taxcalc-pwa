# TaxTrack

Private Australian Tax & EOFY Calculator. It helps you organise working-from-home hours, receipts, and deduction totals before you lodge in ATO myTax. Sign-in is required. Records are encrypted on this device before they are stored.

```bash
npm install
npm run dev
```

`npm run dev` starts TaxTrack at http://localhost:3001 so StaxQ can keep port 3000. Use the menu, then Data and backup, to export or import a JSON file when you move between devices. Photos are compressed JPEGs. PDF and Word invoices are kept as the original file. All of them travel inside that backup. The summary also downloads an Excel workbook and a PDF of the selected income year for tax time or an accountant. The PDF carries the TaxTrack name and logo.

The working-from-home figure uses the ATO fixed rate of 70 cents an hour for the 2025–26 income year. Cents are disregarded. Tools and equipment over $300 are flagged as depreciating assets and kept out of the immediate total. Queensland public holidays, including Labour Day, the Ekka, and the King's Birthday, are highlighted on the calendar. The Ekka date is for the Brisbane area only.

This is an organiser, not a tax agent and not the ATO. Check every figure before you lodge.
