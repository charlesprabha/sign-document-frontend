import { useRef, useState, useEffect } from 'react'
import SignatureCanvas from 'react-signature-canvas'

const ASPECT_RATIO = 200 / 500
const DARKNESS_THRESHOLD = 15     // how much darker than local background counts as "ink"
const FEATHER_RANGE = 20          // smooths the edge between ink and background
const BLUR_DOWNSCALE = 25
const OPACITY_BOOST = 1.6         // smaller = blurrier background estimate

function SignaturePad({ onSave }) {

  const [mode, setMode] = useState('draw')
  const [uploadedPreview, setUploadedPreview] = useState(null)
  const [uploadError, setUploadError] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const signatureRef = useRef(null)
  const containerRef = useRef(null)
  const fileInputRef = useRef(null)

  const [canvasSize, setCanvasSize] = useState({ width: 500, height: 200 })

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth
        const width = Math.min(500, containerWidth)
        const height = Math.round(width * ASPECT_RATIO)
        setCanvasSize({ width, height })
      }
    }

    updateSize()

    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  const switchMode = (newMode) => {
    setMode(newMode)
    setUploadError('')
    setUploadedPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const clearSignature = () => {
    if (mode === 'draw') {
      signatureRef.current.clear()
    } else {
      setUploadedPreview(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Local adaptive background removal — handles uneven lighting/shadows,
  // not just a flat white background.
  const removeBackground = (dataUrl) => {
    return new Promise((resolve, reject) => {
      const img = new Image()

      img.onload = () => {
        const width = img.naturalWidth
        const height = img.naturalHeight

        // 1. Draw the original at full size
        const fullCanvas = document.createElement('canvas')
        fullCanvas.width = width
        fullCanvas.height = height
        const fullCtx = fullCanvas.getContext('2d')
        fullCtx.drawImage(img, 0, 0)
        const originalData = fullCtx.getImageData(0, 0, width, height)

        // 2. Build a blurred "local background" estimate by downscaling
        //    then upscaling — this washes out thin ink strokes but keeps
        //    the broad lighting/paper color, per-region.
        const smallW = Math.max(1, Math.round(width / BLUR_DOWNSCALE))
        const smallH = Math.max(1, Math.round(height / BLUR_DOWNSCALE))

        const smallCanvas = document.createElement('canvas')
        smallCanvas.width = smallW
        smallCanvas.height = smallH
        const smallCtx = smallCanvas.getContext('2d')
        smallCtx.drawImage(img, 0, 0, smallW, smallH)

        const blurCanvas = document.createElement('canvas')
        blurCanvas.width = width
        blurCanvas.height = height
        const blurCtx = blurCanvas.getContext('2d')
        blurCtx.imageSmoothingEnabled = true
        blurCtx.drawImage(smallCanvas, 0, 0, width, height)
        const blurredData = blurCtx.getImageData(0, 0, width, height)

        // 3. Compare each pixel to its LOCAL background estimate
        const orig = originalData.data
        const blur = blurredData.data

        for (let i = 0; i < orig.length; i += 4) {
          const origBrightness = (orig[i] + orig[i + 1] + orig[i + 2]) / 3
          const localBgBrightness = (blur[i] + blur[i + 1] + blur[i + 2]) / 3

          // Positive = this pixel is darker than its local surroundings (ink)
          const diff = localBgBrightness - origBrightness

          if (diff <= DARKNESS_THRESHOLD) {
            orig[i + 3] = 0   // background -> transparent
         } else {
           let alpha = Math.min(
            255,
           Math.round(((diff - DARKNESS_THRESHOLD) / FEATHER_RANGE) * 255)
          )

  // Boost curve: pushes partially-opaque pixels closer to solid,
  // while still keeping a smooth (not jagged) edge
           alpha = Math.min(255, Math.round(Math.pow(alpha / 255, 1 / OPACITY_BOOST) * 255))

           orig[i + 3] = alpha
        }
        }

        fullCtx.putImageData(originalData, 0, 0)
        resolve(fullCanvas.toDataURL('image/png'))
      }

      img.onerror = () => {
        reject(new Error('Could not process image'))
      }

      img.src = dataUrl
    })
  }

  const handleFileSelect = async (event) => {
    const file = event.target.files[0]

    if (!file) {
      return
    }

    setUploadError('')

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg']

    if (!validTypes.includes(file.type)) {
      setUploadError('Please upload a PNG or JPG image.')
      setUploadedPreview(null)
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      setUploadError('Image must be under 2 MB.')
      setUploadedPreview(null)
      return
    }

    const reader = new FileReader()

    reader.onload = async () => {
      try {
        setIsProcessing(true)
        const cleaned = await removeBackground(reader.result)
        setUploadedPreview(cleaned)
      } catch (err) {
        console.error(err)
        setUploadError('Could not process the image. Please try another one.')
      } finally {
        setIsProcessing(false)
      }
    }

    reader.onerror = () => {
      setUploadError('Could not read the image file. Please try again.')
    }

    reader.readAsDataURL(file)
  }

  const saveSignature = () => {

    if (mode === 'draw') {

      if (signatureRef.current.isEmpty()) {
        alert('Please draw your signature first.')
        return
      }

      const signatureImage =
        signatureRef.current.toDataURL('image/png')

      onSave(signatureImage)

    } else {

      if (!uploadedPreview) {
        alert('Please upload a signature image first.')
        return
      }

      onSave(uploadedPreview)
    }
  }

  return (
    <div className="signature-pad">

      <h3>Add Your Signature</h3>

      <div className="signature-mode-toggle">
        <button
          type="button"
          className={`mode-btn ${mode === 'draw' ? 'mode-btn-active' : ''}`}
          onClick={() => switchMode('draw')}
        >
          Draw
        </button>
        <button
          type="button"
          className={`mode-btn ${mode === 'upload' ? 'mode-btn-active' : ''}`}
          onClick={() => switchMode('upload')}
        >
          Upload Image
        </button>
      </div>

      {mode === 'draw' && (
        <div className="signature-box" ref={containerRef}>
          <SignatureCanvas
            ref={signatureRef}
            penColor="black"
            canvasProps={{
              width: canvasSize.width,
              height: canvasSize.height,
              className: 'signature-canvas'
            }}
          />
        </div>
      )}

      {mode === 'upload' && (
        <div className="signature-upload-box">

          <label className="file-input-label">
            Choose Signature Image
            <input
              ref={fileInputRef}
              className="file-input-hidden"
              type="file"
              accept="image/png,image/jpeg"
              onChange={handleFileSelect}
            />
          </label>

          <p className="upload-hint">
            Best results: a signature on plain paper, photographed in good light.
          </p>

          {isProcessing && (
            <p className="upload-processing">Removing background…</p>
          )}

          {uploadError && (
            <p className="upload-error">{uploadError}</p>
          )}

          {uploadedPreview && !isProcessing && (
            <div className="uploaded-signature-preview checkerboard">
              <img src={uploadedPreview} alt="Uploaded signature preview" />
            </div>
          )}

        </div>
      )}

      <div className="signature-buttons">

        <button type="button" className="btn btn-secondary" onClick={clearSignature}>
          Clear
        </button>

        <button
          type="button"
          className="btn btn-primary"
          onClick={saveSignature}
          disabled={isProcessing}
        >
          Save Signature
        </button>

      </div>

    </div>
  )
}

export default SignaturePad