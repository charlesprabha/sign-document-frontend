# Sign Document — Frontend

React app for uploading a PDF, creating a signature (draw or upload image), placing it on the document, and downloading the signed result.

**Live demo:** https://sign-document-frontend.onrender.com
**Backend repo:** https://github.com/charlesprabha/sign-document

## Tech Stack

- React (Vite)
- react-pdf (PDF rendering)
- react-signature-canvas (drawing signatures)

## Features

- Step-by-step wizard flow: Upload → Create Signature → Place & Sign
- Draw a signature by hand, or upload a signature image (with automatic background removal for photographed signatures)
- Drag to reposition and resize the signature directly on the PDF preview
- Responsive layout — works on desktop, tablet, and mobile
- Download the final signed PDF

## Running Locally

```bash
npm install
npm run dev
```
Runs on `http://localhost:5173`. Requires the backend to be running (see backend repo) — update the API URLs in `App.jsx` and `PdfViewer.jsx` if pointing to a local backend instead of the deployed one.

## Deployment

Deployed on [Render](https://render.com) as a static site (`npm run build` → `dist/`).

## Known Limitations (POC scope)

- Background removal for uploaded signature images uses a brightness-based heuristic — works best with plain, evenly-lit paper backgrounds
- DOCX documents not yet supported (PDF only)
