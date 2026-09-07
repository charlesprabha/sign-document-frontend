import { useState } from 'react'
import SignaturePad from './components/SignaturePad'
import PdfViewer from './components/PdfViewer'
import './App.css'

const STEPS = ['Upload', 'Create Signature', 'Place & Sign']

function App() {

  const [step, setStep] = useState(1)

  const [file, setFile] = useState(null)
  const [message, setMessage] = useState('')
  const [documentId, setDocumentId] = useState(null)
  const [signature, setSignature] = useState(null)
  const [signaturePosition, setSignaturePosition] = useState(null)
  const [signedPdfUrl, setSignedPdfUrl] = useState(null)

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0]

    if (selectedFile) {
      setFile(selectedFile)
      setMessage('')
      setSignedPdfUrl(null)
    }
  }

  const handleUpload = async () => {

    if (!file) {
      setMessage('Please select a PDF first.')
      return
    }

    const formData = new FormData()
    formData.append('file', file)

    const uploadUrl = 'http://10.229.14.24:8080/api/documents/upload'

    console.log('Uploading to:', uploadUrl)
    setMessage('Trying: ' + uploadUrl)

    try {

      const response = await fetch(
        uploadUrl,
        {
          method: 'POST',
          body: formData
        }
      )

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      const data = await response.json()

      setDocumentId(data.documentId)
      setMessage('Upload successful!')
      setStep(2)   // auto-advance to signature creation

    } catch (error) {

      console.error(error)
      setMessage('Upload failed: ' + error.message)
    }
  }

  const handleSignatureSaved = (signatureImage) => {
    setSignature(signatureImage)
    setStep(3)   // auto-advance to place & sign
  }

  const handleSignDocument = async () => {

    if (!documentId || !signature || !signaturePosition) {
      setMessage('Please place your signature on the PDF first.')
      return
    }

    try {

      const response = await fetch(signature)
      const signatureBlob = await response.blob()

      const formData = new FormData()
      formData.append('signature', signatureBlob, 'signature.png')
      formData.append('page', signaturePosition.page)
      formData.append('x', signaturePosition.x)
      formData.append('y', signaturePosition.y)
      formData.append('width', signaturePosition.width)
      formData.append('height', signaturePosition.height)

      const signResponse = await fetch(
        `http://10.229.14.24:8080/api/documents/${documentId}/sign`,
        { method: 'POST', body: formData }
      )

      if (!signResponse.ok) {
        const errorData = await signResponse.json().catch(() => null)
        throw new Error(errorData?.error || 'Signing failed')
      }

      const signedPdfBlob = await signResponse.blob()
      const url = URL.createObjectURL(signedPdfBlob)

      setSignedPdfUrl(url)
      setMessage('Document signed successfully!')

    } catch (error) {

      console.error('Sign error:', error)
      setMessage('Signing failed. Please try again.')
    }
  }

  const startOver = () => {
    setStep(1)
    setFile(null)
    setMessage('')
    setDocumentId(null)
    setSignature(null)
    setSignaturePosition(null)
    setSignedPdfUrl(null)
  }

  return (
    <div className="app">

      <header className="app-header">
        <h1>Sign Document</h1>
        <p>Upload, sign, and download — in three quick steps.</p>
      </header>

      <div className="progress-bar">
        {STEPS.map((label, index) => (
          <div
            key={label}
            className={`progress-segment ${step > index ? 'progress-done' : ''} ${step === index + 1 ? 'progress-active' : ''}`}
          >
            {label}
          </div>
        ))}
      </div>

      <div className="wizard-card">

        {step === 1 && (
          <section className="step-panel">

            <h2>Upload your document</h2>

            <div className="upload-row">
              <label className="file-input-label">
                Choose File
                <input
                  className="file-input-hidden"
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                />
              </label>
              {file && <span className="file-name">{file.name}</span>}
            </div>

            <button className="btn btn-primary" onClick={handleUpload}>
              Upload Document
            </button>

            {message && <div className="message">{message}</div>}

          </section>
        )}

        {step === 2 && (
          <section className="step-panel">

            <h2>Create your signature</h2>

            <SignaturePad onSave={handleSignatureSaved} />

          </section>
        )}

        {step === 3 && (
          <section className="step-panel">

            <h2>Place your signature and sign</h2>

            <div className="pdf-wrapper">
              <PdfViewer
                documentId={documentId}
                signature={signature}
                onPositionChange={setSignaturePosition}
              />
            </div>

            <div className="action-row">
              <button className="btn btn-success" onClick={handleSignDocument}>
                Sign Document
              </button>

              {signedPdfUrl && (
                <a
                  className="btn btn-download"                  
                  href={signedPdfUrl}
                  download="signed-document.pdf"
                >
                  Download Signed PDF
                </a>
              )}
            </div>

            {message && <div className="message">{message}</div>}

            {signedPdfUrl && (
              <button className="btn btn-secondary start-over-btn" onClick={startOver}>
                Sign Another Document
              </button>
            )}

          </section>
        )}

      </div>

    </div>
  )
}

export default App