# **App Name**: Lawra9

## Core Features:

- Automated Invoice Data Extraction: Use DeepSeek OCR to automatically extract data (supplier, amount, due date, reference) from uploaded invoice PDFs, images, or screenshots. Then use a tool to pre-fill an invoice form, allowing manual modification.
- Simplified Document Management: Enable users to upload household-related documents (contracts, receipts, warranties) and display them in a simplified Google Drive-like interface, sortable chronologically and by category with optional summaries for long documents.
- Automated Document Type Detection: Employ DeepSeek to automatically identify document types upon upload and suggest relevant categories (insurance, lease, maintenance, etc.) Use a tool to optionally provide a clear language summary for longer documents.
- Intelligent Alert Generation: Use DeepSeek to automatically detect dates (expiration, renewal) in uploaded documents/invoices. Then use a tool to create alerts with tiered push notifications.
- Proactive Alert System: Generate automatic reminders from dates extracted by AI for invoice deadlines, document expirations, and renewal dates. Send tiered push notifications (15d/7d/1d before). Display alerts in a color-coded list (urgent, upcoming, normal) and as a mobile widget showing the next due date.
- Fuzzy Search: Implement a search bar that understands misspellings, synonyms, and abbreviations using DeepSeek to correct or interpret fuzzy search terms and return corresponding documents/invoices. For example: Search 	STEG janv	 or 	factur sonede	 and retrieve the expected files.
- User Authentication & Security: Implement authentication via email, Google, or Apple, with encryption for sensitive files and cloud backups.

## Style Guidelines:

- Primary color: Light blue (#ADD8E6) to inspire confidence and trust.
- Background color: Very light blue (#F0F8FF) for a clean, readable interface.
- Accent color: Muted orange (#FFB347) to highlight key actions.
- Font pairing: 'Poppins' (sans-serif) for headlines, 'PT Sans' (sans-serif) for body text. Note: currently only Google Fonts are supported.
- Employ playful, rounded icons.
- Prioritize a modern, mobile-first design that is responsive across all phone formats, integrating soft, rounded corners and smooth transitions.
- Integrate subtle animations for a smooth and engaging user experience.